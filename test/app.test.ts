import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createList, getEditTokenHash, getItems } from "../src/db/lists";
import { upsertMeta } from "../src/db/meta";
import { sha256Hex } from "../src/publish/tokens";
import type { CardData } from "../src/showcase/og";

const NOW = 1_700_000_000;
let currentTime = NOW;
const ctx = { waitUntil: (_p: Promise<unknown>) => {}, passThroughOnException: () => {} } as ExecutionContext;

let cardCalls: CardData[] = [];

const app = createApp({
  now: () => currentTime,
  steam: () => ({
    async getDetails() {
      return [];
    },
    async getCollection(id: string) {
      return { id, children: ["111", "222"], name: null };
    },
  }),
  renderCard: async (_env, _request, card) => {
    cardCalls.push(card);
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  },
});

function request(path: string, init?: RequestInit): Promise<Response> {
  return app.fetch(new Request(`https://example.test${path}`, init), env, ctx);
}

function jsonRequest(path: string, method: string, body: unknown, headers: Record<string, string> = {}) {
  return request(path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const payload = {
  source: "rws",
  gameVersion: "1.7.4976 rev1043",
  defaultTitle: "My Colony",
  mods: [
    { packageId: "brrainz.harmony", rawPackageId: "brrainz.harmony", steamId: "2009463077", name: "Harmony", index: 0 },
    { packageId: "ludeon.rimworld", rawPackageId: "ludeon.rimworld", steamId: null, name: "Core", index: 1 },
  ],
};

async function create(overrides: Record<string, unknown> = {}, ip = "10.0.0.1") {
  const response = await jsonRequest("/api/lists", "POST", { ...payload, ...overrides }, {
    "cf-connecting-ip": ip,
  });
  return { response, body: await response.json() as { id: string; url: string; editToken: string; modCount: number } };
}

beforeEach(async () => {
  cardCalls = [];
  currentTime = NOW;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM list_items"),
    env.DB.prepare("DELETE FROM lists"),
    env.DB.prepare("DELETE FROM mod_meta"),
    env.DB.prepare("DELETE FROM workshop_mods"),
    env.DB.prepare("DELETE FROM rate_limits"),
  ]);
});

describe("publishing", () => {
  it("creates a list anonymously and stores only the token hash", async () => {
    const { response, body } = await create();
    expect(response.status).toBe(201);
    expect(body.url).toBe(`https://example.test/l/${body.id}/my-colony`);
    expect(body.editToken.length).toBeGreaterThan(20);

    const stored = await getEditTokenHash(env.DB, body.id);
    expect(stored).not.toBe(body.editToken);
    expect(stored).toBe(await sha256Hex(body.editToken));

    const items = await getItems(env.DB, body.id);
    expect(items).toHaveLength(2);
  });

  it("accepts edits with the token and refuses edits without it", async () => {
    const { body } = await create();

    const ok = await jsonRequest(`/api/lists/${body.id}`, "PATCH", { title: "Renamed" }, {
      "x-edit-token": body.editToken,
    });
    expect(ok.status).toBe(200);

    const wrong = await jsonRequest(`/api/lists/${body.id}`, "PATCH", { title: "Hijacked" }, {
      "x-edit-token": "not-the-token",
    });
    expect(wrong.status).toBe(401);

    const missing = await jsonRequest(`/api/lists/${body.id}`, "PATCH", { title: "Hijacked" });
    expect(missing.status).toBe(401);
  });

  it("edits notes and hidden flags, keeping hidden items stored", async () => {
    const { body } = await create();

    const response = await jsonRequest(`/api/lists/${body.id}`, "PATCH", {
      items: [{ position: 0, note: "The backbone", hidden: true }],
    }, { "x-edit-token": body.editToken });
    expect(response.status).toBe(200);

    const items = await getItems(env.DB, body.id);
    expect(items[0].hidden).toBe(true);
    expect(items[0].note).toBe("The backbone");

    const page = await request(`/l/${body.id}/my-colony`);
    const html = await page.text();
    expect(html).not.toContain("Harmony");
    expect(html).toContain("1 mod");
  });

  it("deletes a list so its URL stops resolving", async () => {
    const { body } = await create();

    const deleted = await request(`/api/lists/${body.id}`, {
      method: "DELETE",
      headers: { "x-edit-token": body.editToken },
    });
    expect(deleted.status).toBe(200);

    const page = await request(`/l/${body.id}/my-colony`);
    expect(page.status).toBe(404);
  });

  it("rate limits creation per client", async () => {
    const ip = "10.9.9.9";
    for (let i = 0; i < 10; i += 1) {
      const { response } = await create({}, ip);
      expect(response.status).toBe(201);
    }
    const { response } = await create({}, ip);
    expect(response.status).toBe(429);
  });
});

describe("canonical URLs", () => {
  it("serves the canonical slug and redirects a stale one", async () => {
    const { body } = await create();

    const canonical = await request(`/l/${body.id}/my-colony`);
    expect(canonical.status).toBe(200);

    const stale = await request(`/l/${body.id}/old-title`);
    expect(stale.status).toBe(301);
    expect(stale.headers.get("location")).toBe(`https://example.test/l/${body.id}/my-colony`);

    const bare = await request(`/l/${body.id}`);
    expect(bare.status).toBe(301);
  });
});

describe("unlisted visibility", () => {
  it("sends noindex and exposes no directory", async () => {
    const { body } = await create();
    const page = await request(`/l/${body.id}/my-colony`);
    expect(page.headers.get("x-robots-tag")).toContain("noindex");
    expect(await page.text()).toContain('name="robots" content="noindex');

    for (const path of ["/gallery", "/browse", "/sitemap.xml", "/api/lists"]) {
      const response = await request(path);
      expect(response.status).not.toBe(200);
    }
  });
});

describe("collections", () => {
  it("resolves a collection URL into workshop identities", async () => {
    const response = await jsonRequest("/api/collections", "POST", {
      url: "https://steamcommunity.com/sharedfiles/filedetails/?id=999",
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { mods: Array<{ steamId: string; packageId: null }> };
    expect(body.mods.map((mod) => mod.steamId)).toEqual(["111", "222"]);
    expect(body.mods[0].packageId).toBeNull();
  });

  it("rejects a non-collection URL", async () => {
    const response = await jsonRequest("/api/collections", "POST", { url: "https://example.com" });
    expect(response.status).toBe(400);
  });
});

describe("showcase page", () => {
  async function seeded() {
    await createList(
      env.DB,
      {
        id: "showcase",
        slug: "showcase",
        title: "Showcase",
        source: "rws",
        gameVersion: "1.7.4976 rev1043",
        tokenHash: "hash",
        now: NOW,
      },
      [
        { packageId: "brrainz.harmony", rawPackageId: "brrainz.harmony", steamId: "2009463077", name: "Harmony", index: 0 },
        { packageId: "ludeon.rimworld", rawPackageId: "ludeon.rimworld", steamId: null, name: "Core", index: 1 },
        { packageId: "old.mod", rawPackageId: "old.mod", steamId: "555", name: "Old Mod", index: 2 },
        { packageId: "local.onlymod", rawPackageId: "local.onlymod", steamId: null, name: "Local Only", index: 3 },
      ],
    );

    await upsertMeta(env.DB, [
      {
        wid: "2009463077",
        title: "Harmony",
        authors: "Andreas Pardeike",
        thumb: "https://images.example/harmony.png",
        description: null,
        fileSize: 8306239,
        subs: 3335085,
        gameVersions: ["1.7", "1.6"],
        updatedAt: 1_700_000_000,
        fetchedAt: NOW,
      },
      {
        wid: "555",
        title: "Old Mod",
        authors: "Legacy Author",
        thumb: null,
        description: null,
        fileSize: 1_000_000,
        subs: 5,
        gameVersions: ["1.6"],
        updatedAt: 1_600_000_000,
        fetchedAt: NOW,
      },
    ]);
  }

  it("renders mods in recorded load order with metadata and links", async () => {
    await seeded();
    const response = await request("/l/showcase/showcase");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html.indexOf("Harmony")).toBeLessThan(html.indexOf("Core"));
    expect(html.indexOf("Core")).toBeLessThan(html.indexOf("Old Mod"));
    expect(html).toContain("Andreas Pardeike");
    expect(html).toContain("https://images.example/harmony.png");
    expect(html).toContain("https://steamcommunity.com/sharedfiles/filedetails/?id=2009463077");
    expect(html).toContain("8.3 MB");
  });

  it("shows official and unresolved mods distinctly", async () => {
    await seeded();
    const html = await (await request("/l/showcase/showcase")).text();
    expect(html).toContain("Official content");
    expect(html).toContain("https://store.steampowered.com/app/294100");
    expect(html).toContain("Not found on Workshop");
    expect(html).toContain("local.onlymod");
  });

  it("computes statistics and flags version drift", async () => {
    await seeded();
    const html = await (await request("/l/showcase/showcase")).text();
    expect(html).toContain("4 mods");
    expect(html).toContain("RimWorld 1.7");
    expect(html).toContain("not list support for 1.7");
    expect(html).toContain("No 1.7 support");
  });

  it("exposes preview metadata and attribution", async () => {
    await seeded();
    const html = await (await request("/l/showcase/showcase")).text();
    expect(html).toContain('property="og:image"');
    expect(html).toContain("/og/showcase.png");
    expect(html).toContain("Steam Workshop");
    expect(html).toContain("RimSort Steam Workshop Database");
  });

  it("renders without any script tag", async () => {
    await seeded();
    const html = await (await request("/l/showcase/showcase")).text();
    expect(html).not.toContain("<script");
    expect(html).toContain("Harmony");
  });

  it("returns not found for unknown lists", async () => {
    const response = await request("/l/doesnotexist/whatever");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("List not found");
  });
});

describe("preview card", () => {
  it("renders once per list revision and again after an edit", async () => {
    const { body } = await create();

    const first = await request(`/og/${body.id}.png`);
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("image/png");
    expect(cardCalls).toHaveLength(1);

    const cached = await request(`/og/${body.id}.png`);
    expect(cached.status).toBe(200);
    expect(cardCalls).toHaveLength(1);

    currentTime = NOW + 60;
    await jsonRequest(`/api/lists/${body.id}`, "PATCH", { title: "Changed" }, {
      "x-edit-token": body.editToken,
    });

    const refreshed = await request(`/og/${body.id}.png`);
    expect(refreshed.status).toBe(200);
    expect(cardCalls).toHaveLength(2);
  });
});

describe("Steam failure", () => {
  it("renders recorded names when Steam times out", async () => {
    const failing = createApp({
      now: () => NOW,
      steam: () => ({
        async getDetails() {
          throw new Error("timed out");
        },
        async getCollection() {
          return null;
        },
      }),
      renderCard: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    });

    const created = await failing.fetch(
      new Request("https://example.test/api/lists", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "10.4.4.4" },
        body: JSON.stringify(payload),
      }),
      env,
      ctx,
    );
    const body = (await created.json()) as { id: string };

    const page = await failing.fetch(
      new Request(`https://example.test/l/${body.id}/my-colony`),
      env,
      ctx,
    );
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain("Harmony");
    expect(html).toContain("Core");
  });
});
