import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createList } from "../src/db/lists";
import type { EnrichedItem } from "../src/metadata/enrich";
import { renderListPage, renderNotFound } from "../src/showcase/render";
import { listAsText, matches, normalize } from "../public/list.js";
import type { ListRecord } from "../src/types";

const NOW = 1_700_000_000;

function makeItem(partial: Partial<EnrichedItem> & { position: number }): EnrichedItem {
  return {
    packageId: `author.mod${partial.position}`,
    steamId: null,
    recordedName: null,
    note: null,
    hidden: false,
    official: false,
    unresolved: false,
    wid: null,
    title: `Mod ${partial.position}`,
    authors: "An Author",
    thumb: null,
    fileSize: 1_000_000,
    subs: 10,
    gameVersions: ["1.7"],
    updatedAt: 1_600_000_000,
    workshopUrl: null,
    storeUrl: null,
    alternatives: [],
    ...partial,
  };
}

function makeList(partial: Partial<ListRecord> = {}): ListRecord {
  return {
    id: "list1",
    slug: "list-1",
    title: "Test list",
    source: "rws",
    gameVersion: "1.7.4976 rev1043",
    visibility: "unlisted",
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

function page(items: EnrichedItem[], mode: "detailed" | "brief" = "detailed"): string {
  return renderListPage({
    list: makeList(),
    items,
    mode,
    canonicalUrl: "https://example.test/l/list1/list-1",
    ogImageUrl: "https://example.test/og/list1.png",
  });
}

const mixed: EnrichedItem[] = [
  makeItem({ position: 0, title: "Harmony", authors: "Andreas Pardeike", note: "The backbone" }),
  makeItem({ position: 1, packageId: "ludeon.rimworld", title: "Core", authors: "Ludeon Studios", official: true, storeUrl: "https://store.steampowered.com/app/294100" }),
  makeItem({ position: 2, packageId: "ludeon.rimworld.royalty", title: "Royalty", authors: "Ludeon Studios", official: true, storeUrl: "https://store.steampowered.com/app/1149640" }),
  makeItem({ position: 3, title: "Old Mod", gameVersions: ["1.6"] }),
  makeItem({ position: 4, title: "Local Only", packageId: "local.onlymod", unresolved: true, gameVersions: [] }),
];

describe("card data attributes", () => {
  it("emits position, status flags, search haystack, and a visible number", () => {
    const html = page(mixed);
    expect(html).toContain('data-position="1"');
    expect(html).toContain('data-title="Harmony"');
    expect(html).toContain('data-search="harmony andreas pardeike author.mod0 the backbone');
    expect(html).toContain('data-noted="1"');
    expect(html).toContain('data-outdated="1"');
    expect(html).toContain('data-unresolved="1"');
    expect(html).toContain('data-official="1"');
    expect(html).toContain('<span class="mod-position" aria-label="Load order">1</span>');
    expect(html).toContain('<span class="mod-position" aria-label="Load order">5</span>');
  });

  it("normalises the haystack the same way the client does", () => {
    expect(normalize("Pardéike")).toBe("pardeike");
    const html = page([makeItem({ position: 0, title: "Achtung!", authors: "Pardéike" })]);
    expect(html).toContain("pardeike");
    expect(html).not.toContain("pardéike");
  });
});

describe("density modes", () => {
  it("renders a list container with the requested mode", () => {
    expect(page(mixed)).toContain('<main class="page" data-mode="detailed">');
    expect(page(mixed)).toContain('<ul class="mods" id="mod-list">');
    expect(page(mixed, "brief")).toContain('<main class="page" data-mode="brief">');
  });

  it("keeps the same content in both modes, delegating hiding to the stylesheet", () => {
    const detailed = page(mixed);
    const brief = page(mixed, "brief");
    expect(brief).toContain('class="facts"');
    expect(brief).toContain("1.0 MB");
    expect(brief).toContain("The backbone");
    expect(detailed).toContain("The backbone");
  });

  it("labels three brief columns once above the list", () => {
    const brief = page(mixed, "brief");
    expect(brief).toContain('<div class="brief-head" aria-hidden="true"><span>Order</span><span>Mod</span><span>Workshop</span></div>');
    expect(brief.indexOf("brief-head")).toBeLessThan(brief.indexOf('<ul class="mods"'));
  });

  it("marks unresolved rows with a question mark and a tooltip", () => {
    const html = page(mixed, "brief");
    expect(html.match(/class="row-flag"/g)).toHaveLength(1);
    expect(html).toContain("&#xF1522;");
    expect(html).toContain('class="nf" aria-hidden="true"');
    expect(html).toContain("missing from the community index");
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('aria-describedby="tip-5"');
    expect(html).toContain('id="tip-5"');
    expect(html).toContain('aria-label="Unresolved mod"');
  });

  it("offers every same-titled Workshop item when the reason is ambiguous", () => {
    const ambiguous: EnrichedItem[] = [
      makeItem({
        position: 0,
        packageId: "crows.dustbunny",
        title: "Dust Bunnies",
        unresolved: true,
        alternatives: [
          { wid: "2659958183", name: "Dust Bunnies", gameVersions: ["1.1", "1.2", "1.3"] },
          { wid: "3480725900", name: "Dust Bunnies", gameVersions: ["1.5", "1.6"] },
        ],
      }),
    ];
    const html = page(ambiguous, "brief");
    expect(html).toContain("2 Workshop items share this title");
    expect(html).toContain("filedetails/?id=2659958183");
    expect(html).toContain("filedetails/?id=3480725900");
    expect(html).toContain("Dust Bunnies (1.3, 1.2, 1.1)");
    expect(html).toContain("Dust Bunnies (1.6, 1.5)");
    expect(html).toContain('class="row-tip-links"');
  });

  it("gives every card a row link for the brief column", () => {
    const brief = page(mixed, "brief");
    expect(brief.match(/class="row-link/g)).toHaveLength(5);
    expect(brief).toContain('class="row-link" href="https://store.steampowered.com/app/1149640" rel="noopener noreferrer">Store</a>');
    expect(brief.match(/class="row-link row-link-none"/g)).toHaveLength(3);
  });
});

describe("official content group", () => {
  it("collapses official mods into one expandable row", () => {
    const html = page(mixed);
    expect(html.match(/class="official-group"/g)).toHaveLength(1);
    expect(html).toContain("<details>");
    expect(html).toContain("Official content (2 mods)");
    expect(html).toContain('<ul class="mods mods-official">');
    expect(html).toContain("https://store.steampowered.com/app/1149640");
  });

  it("keeps official mods in the statistics", () => {
    expect(page(mixed)).toContain("5 mods");
  });

  it("places the group where the first official mod appears", () => {
    const html = page(mixed);
    const harmony = html.indexOf(">Harmony<");
    const group = html.indexOf("official-group");
    const oldMod = html.indexOf(">Old Mod<");
    expect(harmony).toBeLessThan(group);
    expect(group).toBeLessThan(oldMod);
  });
});

describe("toolbar", () => {
  it("renders summary, search, filters, and a no-JS mode link", () => {
    const html = page(mixed);
    expect(html).toContain('<div class="toolbar" id="toolbar">');
    expect(html).toContain('id="mod-search"');
    expect(html).toContain('data-filter="only-outdated"');
    expect(html).toContain('href="#top"');
    expect(html).toContain('class="chip no-js-only" href="?mode=brief"');
    expect(html).toContain('<a class="wordmark" href="/">Glowforest</a>');
  });

  it("offers no official toggle and no per-card copy link", () => {
    const html = page(mixed);
    expect(html).not.toContain("hide-official");
    expect(html).not.toContain("data-copy-link");
    expect(html).toContain('data-filter="only-unresolved"');
    expect(html).toContain('id="copy-list"');
  });

  it("points the no-JS mode link at detailed when already brief", () => {
    expect(page(mixed, "brief")).toContain('href="?mode=detailed"');
  });
});

describe("theme control", () => {
  it("sits in the site header and loads the shared theme script", () => {
    for (const html of [page(mixed), page(mixed, "brief")]) {
      const header = html.slice(html.indexOf('<header class="site-header">'), html.indexOf("</header>"));
      expect(header).toContain('data-theme-choice="auto"');
      expect(header).toContain('data-theme-choice="light"');
      expect(header).toContain('data-theme-choice="dark"');
      expect(html.slice(html.indexOf('<div class="toolbar"')).indexOf("data-theme-choice")).toBe(-1);
      expect(html).toContain('<script type="module" src="/theme.js"></script>');
    }
  });

  it("carries the control on the not-found page too", () => {
    expect(renderNotFound()).toContain('data-theme-choice="dark"');
    expect(renderNotFound()).toContain('<script type="module" src="/theme.js"></script>');
  });

  it("applies the stored theme before the stylesheet loads", () => {
    const html = page(mixed);
    const script = html.indexOf("localStorage.getItem(\"glowforest-theme\")");
    const stylesheet = html.indexOf('rel="stylesheet"');
    expect(script).toBeGreaterThan(-1);
    expect(script).toBeLessThan(stylesheet);
    expect(html).toContain('<meta name="color-scheme" content="dark light">');
  });
});

describe("route mode handling", () => {
  const ctx = { waitUntil: (_p: Promise<unknown>) => {}, passThroughOnException: () => {} } as ExecutionContext;
  const app = createApp({
    now: () => NOW,
    steam: () => null,
    renderCard: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  });

  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM list_items"),
      env.DB.prepare("DELETE FROM lists"),
    ]);
    await createList(
      env.DB,
      {
        id: "routelist",
        slug: "route-list",
        title: "Route list",
        source: "rws",
        gameVersion: "1.7.4976 rev1043",
        tokenHash: "hash",
        now: NOW,
      },
      [
        { packageId: "brrainz.harmony", rawPackageId: "brrainz.harmony", steamId: null, name: "Harmony", index: 0 },
        { packageId: "ludeon.rimworld", rawPackageId: "ludeon.rimworld", steamId: null, name: "Core", index: 1 },
      ],
    );
  });

  function get(path: string): Promise<Response> {
    return app.fetch(new Request(`https://example.test${path}`), env, ctx);
  }

  it("defaults to detailed and honours ?mode=brief", async () => {
    const detailed = await (await get("/l/routelist/route-list")).text();
    expect(detailed).toContain('data-mode="detailed"');
    const brief = await (await get("/l/routelist/route-list?mode=brief")).text();
    expect(brief).toContain('data-mode="brief"');
  });

  it("preserves the mode through a slug redirect", async () => {
    const response = await get("/l/routelist/stale?mode=brief");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toContain("?mode=brief");
  });
});

describe("order guarantees", () => {
  const shuffled = [
    makeItem({ position: 0, title: "Zebra" }),
    makeItem({ position: 1, title: "Apple" }),
    makeItem({ position: 2, title: "Mango" }),
  ];

  it("renders stored order in both modes", () => {
    for (const mode of ["detailed", "brief"] as const) {
      const html = page(shuffled, mode);
      expect(html.indexOf("Zebra")).toBeLessThan(html.indexOf("Apple"));
      expect(html.indexOf("Apple")).toBeLessThan(html.indexOf("Mango"));
    }
  });
});

describe("long lists", () => {
  it("renders 1000 mods in order within a generous budget", () => {
    const items = Array.from({ length: 1000 }, (_, index) =>
      makeItem({ position: index, title: `Mod ${index + 1}`, note: index % 50 === 0 ? "a note" : null }),
    );
    const started = Date.now();
    const html = page(items);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(3000);
    expect(html.match(/<li class="mod/g)).toHaveLength(1000);
    const positions = [...html.matchAll(/data-position="(\d+)"/g)].map((match) => Number(match[1]));
    expect(positions).toEqual(Array.from({ length: 1000 }, (_, index) => index + 1));
  });
});

describe("client helpers", () => {
  const mod = {
    position: 1,
    title: "Harmony",
    author: "Andreas Pardeike",
    search: "harmony andreas pardeike brrainz.harmony the backbone",
    official: false,
    unresolved: false,
    outdated: false,
    noted: true,
  };

  it("normalises diacritics and case", () => {
    expect(normalize("Pardéike")).toBe("pardeike");
    expect(normalize(null)).toBe("");
  });

  it("matches every field in the haystack", () => {
    expect(matches(mod, "harmony")).toBe(true);
    expect(matches(mod, "pardeike")).toBe(true);
    expect(matches(mod, "brrainz")).toBe(true);
    expect(matches(mod, "backbone")).toBe(true);
    expect(matches(mod, "zzz")).toBe(false);
  });

  it("composes filters with search", () => {
    expect(matches(mod, "", { onlyNoted: true })).toBe(true);
    expect(matches(mod, "", { onlyOutdated: true })).toBe(false);
    expect(matches(mod, "harmony", { onlyNoted: true })).toBe(true);
    expect(matches(mod, "zzz", { onlyNoted: true })).toBe(false);
    expect(matches({ ...mod, official: true }, "", { onlyNoted: true })).toBe(true);
  });

  it("formats the visible list as ordered text", () => {
    expect(
      listAsText([
        { position: 3, title: "Third", author: "" },
        { position: 1, title: "First", author: "Someone" },
      ]),
    ).toBe("1. First (Someone)\n3. Third");
  });
});
