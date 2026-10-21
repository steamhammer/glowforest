import { describe, expect, it } from "vitest";
import { importIndexRows, countIndexRows } from "../src/db/meta";
import { env } from "cloudflare:test";
import { isPlaceholder, majorMinor, packageNamespace, pickByCreator, pickByTitle, pickCandidate } from "../src/metadata/resolve";
import type { WorkshopIndexRow } from "../src/types";

function row(wid: string, packageId: string, name: string, gameVersions: string[]): WorkshopIndexRow {
  return { wid, packageId, name, authors: null, gameVersions };
}

describe("identifier resolution", () => {
  it("extracts the major and minor version", () => {
    expect(majorMinor("1.7.4976 rev1043")).toBe("1.7");
    expect(majorMinor("1.6")).toBe("1.6");
    expect(majorMinor(null)).toBeNull();
  });

  it("recognises placeholder identifiers", () => {
    expect(isPlaceholder("scenario.rsc")).toBe(true);
    expect(isPlaceholder("missing.packageid")).toBe(true);
    expect(isPlaceholder("brrainz.harmony")).toBe(false);
    expect(isPlaceholder(null)).toBe(false);
  });

  it("accepts a single title candidate", () => {
    const chosen = pickByTitle([row("3480725900", "", "Dust Bunnies", ["1.5", "1.6"])], "1.5.4243");
    expect(chosen?.wid).toBe("3480725900");
  });

  it("separates same-titled items by game version", () => {
    const chosen = pickByTitle(
      [
        row("2659958183", "", "Dust Bunnies", ["1.1", "1.2", "1.3"]),
        row("3480725900", "", "Dust Bunnies", ["1.5", "1.6"]),
      ],
      "1.5.4243 rev947",
    );
    expect(chosen?.wid).toBe("3480725900");
  });

  it("refuses a title match that stays ambiguous", () => {
    const chosen = pickByTitle(
      [
        row("1", "", "Wall Light", ["1.6"]),
        row("2", "", "Wall Light", ["1.6"]),
      ],
      "1.6.4297",
    );
    expect(chosen).toBeNull();
    expect(pickByTitle([], "1.6.4297")).toBeNull();
  });

  it("needs a game version to break a title tie", () => {
    const chosen = pickByTitle(
      [row("1", "", "Wall Light", ["1.6"]), row("2", "", "Wall Light", ["1.5"])],
      null,
    );
    expect(chosen).toBeNull();
  });

  it("extracts the package-id namespace", () => {
    expect(packageNamespace("crows.dustbunny")).toBe("crows");
    expect(packageNamespace("Crows.DustBunny")).toBe("crows");
    expect(packageNamespace("brrainz.harmony")).toBe("brrainz");
    expect(packageNamespace("singleword")).toBeNull();
    expect(packageNamespace(".leading")).toBeNull();
    expect(packageNamespace("trailing.")).toBeNull();
    expect(packageNamespace(null)).toBeNull();
  });

  it("accepts the only candidate owned by the namespace's author", () => {
    const creators: Record<string, string> = {
      "1": "author-a",
      "2": "author-a",
      "3": "author-b",
    };
    expect(pickByCreator(["2", "3"], ["1"], (wid) => creators[wid] ?? null)).toBe("2");
  });

  it("declines when several candidates share the namespace's authors", () => {
    const creators: Record<string, string> = {
      "1": "author-a",
      "2": "author-a",
      "3": "author-b",
      "4": "author-b",
    };
    expect(pickByCreator(["2", "4"], ["1", "3"], (wid) => creators[wid] ?? null)).toBeNull();
  });

  it("declines without namespace evidence or creators", () => {
    expect(pickByCreator(["2", "3"], [], () => "author-a")).toBeNull();
    expect(pickByCreator(["2", "3"], ["1"], () => null)).toBeNull();
    expect(pickByCreator([], ["1"], () => "author-a")).toBeNull();
  });

  it("prefers a candidate that supports the list's game version", () => {
    const chosen = pickCandidate(
      [row("2", "author.mod", "Author Mod", ["1.5"]), row("1", "author.mod", "Author Mod", ["1.7"])],
      { gameVersion: "1.7.4976 rev1043", name: "Author Mod" },
    );
    expect(chosen?.wid).toBe("1");
  });

  it("breaks a version tie by name similarity", () => {
    const chosen = pickCandidate(
      [
        row("10", "author.mod", "Something Else Entirely", ["1.7"]),
        row("20", "author.mod", "Author Mod (Continued)", ["1.7"]),
      ],
      { gameVersion: "1.7.4976 rev1043", name: "Author Mod" },
    );
    expect(chosen?.wid).toBe("20");
  });

  it("is deterministic when nothing distinguishes candidates", () => {
    const candidates = [row("30", "a.b", "Same", ["1.7"]), row("20", "a.b", "Same", ["1.7"])];
    const first = pickCandidate(candidates, { gameVersion: "1.7", name: "Same" });
    const second = pickCandidate([...candidates].reverse(), { gameVersion: "1.7", name: "Same" });
    expect(first?.wid).toBe("20");
    expect(second?.wid).toBe("20");
  });
});

describe("community index import", () => {
  it("is idempotent across repeated imports", async () => {
    await env.DB.prepare("DELETE FROM workshop_mods").run();
    const rows = [
      { wid: "1", packageId: "a.one", name: "One", authors: "A", gameVersions: ["1.7"] },
      { wid: "2", packageId: "b.two", name: "Two", authors: "B", gameVersions: ["1.6"] },
    ];

    await importIndexRows(env.DB, rows, 1000);
    const first = await countIndexRows(env.DB);
    await importIndexRows(env.DB, rows, 2000);
    const second = await countIndexRows(env.DB);

    expect(first).toBe(2);
    expect(second).toBe(2);
  });

  it("keeps stored values when a refresh omits them", async () => {
    await env.DB.prepare("DELETE FROM workshop_mods").run();
    await importIndexRows(
      env.DB,
      [{ wid: "3480725900", packageId: "crows.dustbunny", name: "Dust Bunnies", authors: "Crow", gameVersions: ["1.5"] }],
      1000,
    );
    await importIndexRows(
      env.DB,
      [{ wid: "3480725900", packageId: null, name: null, authors: null, gameVersions: [] }],
      2000,
    );
    const stored = await env.DB.prepare("SELECT * FROM workshop_mods WHERE wid = '3480725900'").first<Record<string, unknown>>();
    expect(stored?.package_id).toBe("crows.dustbunny");
    expect(stored?.name).toBe("Dust Bunnies");
    expect(stored?.authors).toBe("Crow");
    expect(stored?.game_versions).toBe('["1.5"]');
    expect(stored?.imported_at).toBe(2000);
  });

  it("accepts a curated package identifier for an entry that lacked one", async () => {
    await env.DB.prepare("DELETE FROM workshop_mods").run();
    await importIndexRows(
      env.DB,
      [{ wid: "3480725900", packageId: null, name: "Dust Bunnies", authors: null, gameVersions: ["1.5", "1.6"] }],
      1000,
    );
    await importIndexRows(
      env.DB,
      [{ wid: "3480725900", packageId: "crows.dustbunny", name: null, authors: null, gameVersions: [] }],
      2000,
    );
    const stored = await env.DB.prepare("SELECT * FROM workshop_mods WHERE wid = '3480725900'").first<Record<string, unknown>>();
    expect(stored?.package_id).toBe("crows.dustbunny");
    expect(stored?.name).toBe("Dust Bunnies");
    expect(stored?.game_versions).toBe('["1.5","1.6"]');
  });
});

describe("identifier generation", () => {
  it("produces URL-safe identifiers of the expected length", async () => {
    const { newEditToken, newListId, toBase64Url, slugify } = await import("../src/publish/tokens");
    const id = newListId();
    const token = newEditToken();
    expect(id).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Set(Array.from({ length: 50 }, () => newListId())).size).toBe(50);
    expect(toBase64Url(new Uint8Array([0xfb, 0xff]))).toBe("-_8");
    expect(slugify("My Colony 12!")).toBe("my-colony-12");
    expect(slugify("日本語")).toBe("modlist");
  });
});
