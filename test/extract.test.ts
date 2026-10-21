import { describe, expect, it } from "vitest";
import {
  HEADER_BYTES,
  IngestError,
  classifySteamId,
  decodeXmlEntities,
  detectRoot,
  extractFromBytes,
  extractFromFile,
  extractFromText,
  normalizePackageId,
  sniff,
} from "../public/extract.js";
import sampleRws from "./fixtures/sample.rws?raw";
import sampleRml from "./fixtures/sample.rml?raw";
import modsConfig from "./fixtures/ModsConfig.xml?raw";
import legacyRws from "./fixtures/legacy.rws?raw";

const encoder = new TextEncoder();

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([encoder.encode(text)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function expectIngestError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(IngestError);
    expect((error as IngestError).code).toBe(code);
    return;
  }
  throw new Error(`expected IngestError ${code}`);
}

describe("input sniffing", () => {
  it("recognises gzip, zip, and text", () => {
    expect(sniff(new Uint8Array([0x1f, 0x8b, 0x08]))).toBe("gzip");
    expect(sniff(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe("zip");
    expect(sniff(encoder.encode("<savegame>"))).toBe("text");
  });

  it("rejects zip archives", async () => {
    await expect(
      extractFromBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
    ).rejects.toMatchObject({ code: "zip" });
  });

  it("reads at most the header of a file", async () => {
    let requested = -1;
    const fake = {
      slice(start: number, end: number) {
        requested = end;
        return { arrayBuffer: async () => encoder.encode(sampleRws).buffer };
      },
    };
    await extractFromFile(fake as unknown as Blob);
    expect(requested).toBe(HEADER_BYTES);
  });
});

describe("meta parsing", () => {
  it("extracts a save header with ids, names, steam ids and version", () => {
    const list = extractFromText(sampleRws, { filename: "My Colony 12.rws" });
    expect(list.source).toBe("rws");
    expect(list.gameVersion).toBe("1.7.4976 rev1043");
    expect(list.mods).toHaveLength(5);
    expect(list.mods.map((mod) => mod.packageId)).toEqual([
      "brrainz.harmony",
      "ludeon.rimworld",
      "ludeon.rimworld.royalty",
      "mlie.somemod",
      "local.onlymod",
    ]);
    expect(list.mods[3].rawPackageId).toBe("Mlie.SomeMod_Steam");
    expect(list.mods[3].name).toBe("Some Mod & Friends");
    expect(list.defaultTitle).toBe("My Colony 12");
  });

  it("reads a mod-list export from its meta header", () => {
    const list = extractFromText(sampleRml);
    expect(list.source).toBe("rml");
    expect(list.mods).toHaveLength(4);
    expect(list.mods[2].packageId).toBe("vanillaexpanded.vfecore");
  });

  it("reads ModsConfig.xml in recorded order", () => {
    const list = extractFromText(modsConfig, { filename: "ModsConfig.xml" });
    expect(list.source).toBe("modsconfig");
    expect(list.gameVersion).toBe("1.7.4976 rev1043");
    expect(list.mods.map((mod) => mod.packageId)).toEqual([
      "brrainz.harmony",
      "ludeon.rimworld",
      "ludeon.rimworld.royalty",
    ]);
    expect(list.mods[0].name).toBeNull();
    expect(list.defaultTitle).toBe("ModsConfig");
  });

  it("decodes XML entities", () => {
    expect(decodeXmlEntities("Some Mod &amp; Friends &#8212; &quot;x&quot;")).toBe(
      'Some Mod & Friends — "x"',
    );
  });

  it("detects roots", () => {
    expect(detectRoot(sampleRws)).toBe("rws");
    expect(detectRoot(sampleRml)).toBe("rml");
    expect(detectRoot(modsConfig)).toBe("modsconfig");
    expect(detectRoot("<html></html>")).toBeNull();
  });
});

describe("normalisation", () => {
  it("lowercases and strips the steam postfix", () => {
    expect(normalizePackageId("Mlie.SomeMod_Steam")).toBe("mlie.somemod");
    expect(normalizePackageId("  Ludeon.RimWorld  ")).toBe("ludeon.rimworld");
  });

  it("classifies zero, DLC app ids, and workshop ids", () => {
    expect(classifySteamId("0")).toEqual({ steamId: null, official: false });
    expect(classifySteamId("")).toEqual({ steamId: null, official: false });
    expect(classifySteamId("1149640")).toEqual({ steamId: null, official: true });
    expect(classifySteamId("2009463077")).toEqual({ steamId: "2009463077", official: false });
  });

  it("keeps the recorded order, including official content mid-list", () => {
    const list = extractFromText(sampleRws);
    expect(list.mods[1].index).toBe(1);
    expect(list.mods[1].packageId).toBe("ludeon.rimworld");
    expect(list.mods[0].packageId).toBe("brrainz.harmony");
  });
});

describe("compressed input", () => {
  it("accepts a gzip-compressed save", async () => {
    const bytes = await gzip(sampleRws);
    const list = await extractFromBytes(bytes, { filename: "sample.rws.gz" });
    expect(list.mods).toHaveLength(5);
    expect(list.defaultTitle).toBe("sample");
  });
});

describe("failures", () => {
  it("rejects unrecognised content", () => {
    expectIngestError(() => extractFromText("not xml at all"), "unrecognised");
  });

  it("rejects mismatched parallel lists", () => {
    const text = `<savegame><meta><gameVersion>1.7</gameVersion><modIds><li>a.b</li><li>c.d</li></modIds><modNames><li>One</li></modNames></meta></savegame>`;
    expectIngestError(() => extractFromText(text), "mismatched-lists");
  });

  it("rejects an empty list", () => {
    const text = `<savegame><meta><gameVersion>1.7</gameVersion><modIds></modIds><modSteamIds></modSteamIds><modNames></modNames></meta></savegame>`;
    expectIngestError(() => extractFromText(text), "empty-list");
  });

  it("rejects a save that predates package identifiers", () => {
    expectIngestError(() => extractFromText(legacyRws), "legacy-save");
  });

  it("rejects a save whose header is missing entirely", () => {
    expectIngestError(() => extractFromText("<savegame><game></game></savegame>"), "legacy-save");
  });

  it("rejects more than the supported mod count", () => {
    const ids = Array.from({ length: 1001 }, (_, index) => `<li>author.mod${index}</li>`).join("");
    const blanks = "<li>0</li>".repeat(1001);
    const names = Array.from({ length: 1001 }, (_, index) => `<li>Mod ${index}</li>`).join("");
    const text = `<savegame><meta><gameVersion>1.7</gameVersion><modIds>${ids}</modIds><modSteamIds>${blanks}</modSteamIds><modNames>${names}</modNames></meta></savegame>`;
    expectIngestError(() => extractFromText(text), "too-many-mods");
  });

  it("rejects ModsConfig without an active list", () => {
    expectIngestError(() => extractFromText("<ModsConfigData><version>1.7</version></ModsConfigData>"), "no-mods-config");
  });
});
