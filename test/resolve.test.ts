import { describe, expect, it } from "vitest";
import { importIndexRows, countIndexRows } from "../src/db/meta";
import { env } from "cloudflare:test";
import { isPlaceholder, majorMinor, pickCandidate } from "../src/metadata/resolve";
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
