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

function detail(wid: string, title: string, creator: string | null = null): SteamDetails {
  return {
    wid,
    creator,
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

async function seedUnindexed(wid: string, name: string, gameVersions: string[]) {
  await importIndexRows(
    env.DB,
    [{ wid, packageId: null, name, authors: null, gameVersions }],
    1000,
  );
}

describe("title fallback", () => {
  it("resolves a mod the index knows only by title", async () => {
    await seedUnindexed("3480725900", "Dust Bunnies", ["1.5", "1.6"]);
    const steam = fakeSteam([detail("3480725900", "Dust Bunnies")]);

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "crows.dustbunny", name: "Dust Bunnies" })],
      { gameVersion: "1.5.4243 rev947", steam, now: 5000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].unresolved).toBe(false);
    expect(enriched[0].wid).toBe("3480725900");
    expect(enriched[0].workshopUrl).toContain("3480725900");
  });

  it("uses the list's game version to choose between same-titled items", async () => {
    await seedUnindexed("2659958183", "Dust Bunnies", ["1.1", "1.2", "1.3"]);
    await seedUnindexed("3480725900", "Dust Bunnies", ["1.5", "1.6"]);

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "crows.dustbunny", name: "Dust Bunnies" })],
      { gameVersion: "1.5.4243 rev947", steam: null, now: 5000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].wid).toBe("3480725900");
  });

  it("leaves an ambiguous title unresolved", async () => {
    await seedUnindexed("1", "Wall Light", ["1.6"]);
    await seedUnindexed("2", "Wall Light", ["1.6"]);

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "murmur.walllight", name: "Wall Light" })],
      { gameVersion: "1.6.4297", steam: null, now: 5000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].unresolved).toBe(true);
    expect(enriched[0].wid).toBeNull();
  });

  it("does not take an entry that belongs to another package id", async () => {
    await importIndexRows(
      env.DB,
      [{ wid: "999", packageId: "other.mod", name: "Wall Light", authors: null, gameVersions: ["1.6"] }],
      1000,
    );

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "murmur.walllight", name: "Wall Light" })],
      { gameVersion: "1.6.4297", steam: null, now: 5000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].unresolved).toBe(true);
  });

  it("resolves an ambiguous title when a namespace sibling shares the creator", async () => {
    await importIndexRows(
      env.DB,
      [
        {
          wid: "3560507606",
          packageId: "crows.medievaltransport",
          name: "Medieval Transport",
          authors: "Crow",
          gameVersions: ["1.6"],
        },
      ],
      1000,
    );
    await seedUnindexed("2659958183", "Dust Bunnies", ["1.1", "1.2", "1.3"]);
    await seedUnindexed("3480725900", "Dust Bunnies", ["1.5", "1.6"]);
    const steam = fakeSteam([
      detail("3560507606", "Medieval Transport", "76561198059787220"),
      detail("3480725900", "Dust Bunnies", "76561198059787220"),
      detail("2659958183", "Dust Bunnies", "76561198160066277"),
    ]);

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "crows.dustbunny", name: "Dust Bunnies" })],
      { gameVersion: "1.7.4984 rev1242", steam, now: 5000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].unresolved).toBe(false);
    expect(enriched[0].wid).toBe("3480725900");
    expect(enriched[0].alternatives).toEqual([]);
  });

  it("stays ambiguous when no candidate shares the namespace creator", async () => {
    await importIndexRows(
      env.DB,
      [
        {
          wid: "3560507606",
          packageId: "crows.medievaltransport",
          name: "Medieval Transport",
          authors: "Crow",
          gameVersions: ["1.6"],
        },
      ],
      1000,
    );
    await seedUnindexed("2659958183", "Dust Bunnies", ["1.1", "1.2", "1.3"]);
    await seedUnindexed("3480725900", "Dust Bunnies", ["1.5", "1.6"]);
    const steam = fakeSteam([
      detail("3560507606", "Medieval Transport", "76561198059787220"),
      detail("3480725900", "Dust Bunnies", "76561198160066277"),
      detail("2659958183", "Dust Bunnies", "76561198160066277"),
    ]);

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "crows.dustbunny", name: "Dust Bunnies" })],
      { gameVersion: "1.7.4984 rev1242", steam, now: 5000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].unresolved).toBe(true);
    expect(enriched[0].alternatives).toHaveLength(2);
  });

  it("exposes every same-titled candidate when the title cannot decide", async () => {
    await seedUnindexed("2659958183", "Dust Bunnies", ["1.1", "1.2", "1.3"]);
    await seedUnindexed("3480725900", "Dust Bunnies", ["1.5", "1.6"]);

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "crows.dustbunny", name: "Dust Bunnies" })],
      { gameVersion: "1.7.4984 rev1242", steam: null, now: 5000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].unresolved).toBe(true);
    expect(enriched[0].alternatives.map((alternative) => alternative.wid).sort()).toEqual([
      "2659958183",
      "3480725900",
    ]);
  });

  it("carries no alternatives when the title match resolves", async () => {
    await seedUnindexed("3480725900", "Dust Bunnies", ["1.5", "1.6"]);

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "crows.dustbunny", name: "Dust Bunnies" })],
      { gameVersion: "1.5.4243", steam: null, now: 5000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].unresolved).toBe(false);
    expect(enriched[0].alternatives).toEqual([]);
  });

  it("keeps a recorded Workshop id ahead of the title fallback", async () => {
    await seedUnindexed("3480725900", "Dust Bunnies", ["1.5", "1.6"]);

    const enriched = await enrichItems(
      env.DB,
      [item({ position: 0, packageId: "crows.dustbunny", steamId: "2659958183", name: "Dust Bunnies" })],
      { gameVersion: "1.5.4243", steam: null, now: 5000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].wid).toBe("2659958183");
  });

  it("renders when the metadata cache write fails", async () => {
    await seedUnindexed("3480725900", "Dust Bunnies", ["1.5", "1.6"]);
    const steam = fakeSteam([detail("3480725900", "Dust Bunnies")]);
    const failing = new Proxy(env.DB, {
      get(target, key) {
        if (key === "batch") return () => Promise.reject(new Error("quota"));
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as D1Database;

    const enriched = await enrichItems(
      failing,
      [item({ position: 0, packageId: "crows.dustbunny", name: "Dust Bunnies" })],
      { gameVersion: "1.5.4243", steam, now: 5000, freshnessSeconds: 3600 },
    );

    expect(enriched[0].title).toBe("Dust Bunnies");
    expect(enriched[0].unresolved).toBe(false);
  });
});

describe("enrichment", () => {
  it("makes no Steam request when every mod is cached and fresh", async () => {
    await upsertMeta(env.DB, [
      {
        wid: "2009463077",
        creator: null,
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
        creator: null,
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
        creator: null,
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
