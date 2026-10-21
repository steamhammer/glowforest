import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createList, deleteList, getItems, getList, updateItem, updateTitle } from "../src/db/lists";
import { getMetaFor, isFresh, upsertMeta } from "../src/db/meta";
import type { RawMod } from "../src/types";

const mods: RawMod[] = [
  { packageId: "brrainz.harmony", rawPackageId: "brrainz.harmony", steamId: "2009463077", name: "Harmony", index: 0 },
  { packageId: "ludeon.rimworld", rawPackageId: "ludeon.rimworld", steamId: null, name: "Core", index: 1 },
];

async function seed(id = "list-one") {
  await createList(
    env.DB,
    {
      id,
      slug: "my-colony",
      title: "My Colony",
      source: "rws",
      gameVersion: "1.7.4976 rev1043",
      tokenHash: "hash",
      now: 1000,
    },
    mods,
  );
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM list_items"),
    env.DB.prepare("DELETE FROM lists"),
    env.DB.prepare("DELETE FROM mod_meta"),
    env.DB.prepare("DELETE FROM workshop_mods"),
  ]);
});

describe("list repository", () => {
  it("creates and reads a list with items in order", async () => {
    await seed();
    const list = await getList(env.DB, "list-one");
    expect(list?.title).toBe("My Colony");
    expect(list?.visibility).toBe("unlisted");
    expect(list?.gameVersion).toBe("1.7.4976 rev1043");

    const items = await getItems(env.DB, "list-one");
    expect(items.map((item) => item.position)).toEqual([0, 1]);
    expect(items[0].packageId).toBe("brrainz.harmony");
    expect(items[0].steamId).toBe("2009463077");
    expect(items[1].hidden).toBe(false);
  });

  it("returns null for an unknown list", async () => {
    expect(await getList(env.DB, "nope")).toBeNull();
  });

  it("updates the title and slug", async () => {
    await seed();
    await updateTitle(env.DB, "list-one", "Renamed", "renamed", 2000);
    const list = await getList(env.DB, "list-one");
    expect(list?.title).toBe("Renamed");
    expect(list?.slug).toBe("renamed");
    expect(list?.updatedAt).toBe(2000);
  });

  it("updates notes and hidden flags, and rejects unknown positions", async () => {
    await seed();
    expect(await updateItem(env.DB, "list-one", 0, { note: "core of the list", hidden: true }, 3000)).toBe(true);
    const items = await getItems(env.DB, "list-one");
    expect(items[0].note).toBe("core of the list");
    expect(items[0].hidden).toBe(true);
    expect(await updateItem(env.DB, "list-one", 99, { hidden: true }, 3000)).toBe(false);
  });

  it("deletes a list and its items", async () => {
    await seed();
    await deleteList(env.DB, "list-one");
    expect(await getList(env.DB, "list-one")).toBeNull();
    expect(await getItems(env.DB, "list-one")).toEqual([]);
  });
});

describe("metadata repository", () => {
  it("stores and reads cached metadata", async () => {
    await upsertMeta(env.DB, [
      {
        wid: "2009463077",
        title: "Harmony",
        authors: "Andreas Pardeike",
        thumb: "https://example.test/harmony.png",
        description: null,
        fileSize: 8306239,
        subs: 3335085,
        gameVersions: ["1.6", "1.7"],
        updatedAt: 1700000000,
        fetchedAt: 5000,
      },
    ]);

    const found = await getMetaFor(env.DB, ["2009463077"]);
    const meta = found.get("2009463077");
    expect(meta?.title).toBe("Harmony");
    expect(meta?.fileSize).toBe(8306239);
    expect(meta?.gameVersions).toEqual(["1.6", "1.7"]);
  });

  it("distinguishes fresh from stale rows", async () => {
    await upsertMeta(env.DB, [
      {
        wid: "1",
        title: "Fresh",
        authors: null,
        thumb: null,
        description: null,
        fileSize: null,
        subs: null,
        gameVersions: [],
        updatedAt: null,
        fetchedAt: 10_000,
      },
      {
        wid: "2",
        title: "Stale",
        authors: null,
        thumb: null,
        description: null,
        fileSize: null,
        subs: null,
        gameVersions: [],
        updatedAt: null,
        fetchedAt: 100,
      },
    ]);

    const found = await getMetaFor(env.DB, ["1", "2"]);
    const window = 1000;
    expect(isFresh(found.get("1")!, 10_500, window)).toBe(true);
    expect(isFresh(found.get("2")!, 10_500, window)).toBe(false);
  });
});
