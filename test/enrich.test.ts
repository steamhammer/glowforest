import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { importIndexRows, upsertMeta } from "../src/db/meta";
import { enrichItems } from "../src/metadata/enrich";
import type { SteamClient, SteamDetails } from "../src/metadata/steam";
import type { ListItemRecord } from "../src/types";

function item(partial: Partial<ListItemRecord> & { position: number }): ListItemRecord {
  return {
    listId: "list",
    packageId: null,
    steamId: null,
    name: null,
    note: null,
    hidden: false,
    ...partial,
  };
}

function fakeSteam(details: SteamDetails[] = []): SteamClient & { calls: number } {
  const client = {
    calls: 0,
    async getDetails(wids: string[]) {
      client.calls += 1;
      return details.filter((detail) => wids.includes(detail.wid));
    },
    async getCollection() {
      return null;
    },
  };
  return client;
}

function detail(wid: string, title: string): SteamDetails {
  return {
    wid,
    title,
    thumb: null,
    description: null,
    fileSize: 1000,
    subs: 10,
    gameVersions: ["1.7"],
    updatedAt: 1700000000,
  };
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM mod_meta"),
    env.DB.prepare("DELETE FROM workshop_mods"),
  ]);
});

describe("enrichment", () => {
  it("makes no Steam request when every mod is cached and fresh", async () => {
    await upsertMeta(env.DB, [
      {
        wid: "2009463077",
        title: "Harmony",
        authors: "Andreas Pardeike",
        thumb: null,
        description: null,
        fileSize: 8306239,
        subs: 3335085,
        gameVersions: ["1.7"],
        updatedAt: 1700000000,
        fetchedAt: 10_000,
      },
    ]);

    const steam = fakeSteam();
    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "brrainz.harmony", steamId: "2009463077" })],
      { gameVersion: "1.7.4976", steam, now: 10_100, freshnessSeconds: 3600 },
    );

    expect(steam.calls).toBe(0);
    expect(enriched[0].title).toBe("Harmony");
    expect(enriched[0].unresolved).toBe(false);
  });

  it("refreshes stale metadata and keeps the page usable when Steam fails", async () => {
    await upsertMeta(env.DB, [
      {
        wid: "1",
        title: "Old title",
        authors: null,
        thumb: null,
        description: null,
        fileSize: null,
        subs: null,
        gameVersions: [],
        updatedAt: null,
        fetchedAt: 1,
      },
    ]);

    const failing: SteamClient = {
      async getDetails() {
        throw new Error("steam down");
      },
      async getCollection() {
        return null;
      },
    };

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "a.b", steamId: "1", name: "Recorded Name" })],
      { gameVersion: "1.7", steam: failing, now: 10_000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].title).toBe("Old title");
    expect(enriched[0].unresolved).toBe(false);
  });

  it("prefers a recorded Workshop id over the index", async () => {
    await importIndexRows(
      env.DB,
      [{ wid: "111", packageId: "author.mod", name: "Indexed", authors: "A", gameVersions: ["1.7"] }],
      1,
    );
    await upsertMeta(env.DB, [
      {
        wid: "222",
        title: "Recorded",
        authors: null,
        thumb: null,
        description: null,
        fileSize: null,
        subs: null,
        gameVersions: ["1.7"],
        updatedAt: null,
        fetchedAt: 10_000,
      },
    ]);

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "author.mod", steamId: "222" })],
      { gameVersion: "1.7", steam: fakeSteam(), now: 10_100, freshnessSeconds: 3600 },
    );

    expect(enriched[0].wid).toBe("222");
    expect(enriched[0].title).toBe("Recorded");
  });

  it("resolves a package id through the index", async () => {
    await importIndexRows(
      env.DB,
      [{ wid: "111", packageId: "author.mod", name: "Indexed", authors: "Author", gameVersions: ["1.7"] }],
      1,
    );
    const steam = fakeSteam([detail("111", "From Steam")]);

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "author.mod", name: "Recorded" })],
      { gameVersion: "1.7", steam, now: 10_100, freshnessSeconds: 3600 },
    );

    expect(steam.calls).toBe(1);
    expect(enriched[0].wid).toBe("111");
    expect(enriched[0].title).toBe("From Steam");
    expect(enriched[0].authors).toBe("Author");
  });

  it("marks official content without a Workshop link", async () => {
    const enriched = await enrichItems(
      env.DB,
      [
        item({ position: 0, packageId: "ludeon.rimworld" }),
        item({ position: 1, packageId: "ludeon.rimworld.royalty" }),
      ],
      { gameVersion: "1.7", steam: fakeSteam(), now: 10_000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].official).toBe(true);
    expect(enriched[0].title).toBe("Core");
    expect(enriched[0].workshopUrl).toBeNull();
    expect(enriched[0].storeUrl).toContain("store.steampowered.com/app/294100");
    expect(enriched[1].title).toBe("Royalty");
    expect(enriched[1].storeUrl).toContain("1149640");
  });

  it("marks an unresolvable mod and fabricates no links", async () => {
    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "local.onlymod", name: "Local Only" })],
      { gameVersion: "1.7", steam: fakeSteam(), now: 10_000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].unresolved).toBe(true);
    expect(enriched[0].title).toBe("Local Only");
    expect(enriched[0].workshopUrl).toBeNull();
    expect(enriched[0].storeUrl).toBeNull();
  });
});
