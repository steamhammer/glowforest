#!/usr/bin/env node
/**
 * Browser verification for the showcase page.
 *
 * Creates a temporary list through the public API, drives Chrome through the
 * interactive flows, then deletes the list. Exits non-zero on the first failed
 * assertion.
 *
 * Usage:
 *   node scripts/verify-showcase.mjs [--base-url http://127.0.0.1:8787]
 *                                    [--chrome /usr/bin/google-chrome]
 *                                    [--keep]
 */

import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const baseUrl = flag("--base-url", "http://127.0.0.1:8787").replace(/\/$/, "");
const chromePath = flag("--chrome", "/usr/bin/google-chrome");
const keep = args.includes("--keep");

const failures = [];
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const mods = [
  { packageId: "zebra.tools", rawPackageId: "zebra.tools", steamId: null, name: "Zebra Tools", index: 0 },
  { packageId: "alpha.lib", rawPackageId: "alpha.lib", steamId: null, name: "Alpha Library", index: 1 },
  { packageId: "ludeon.rimworld", rawPackageId: "ludeon.rimworld", steamId: null, name: "Core", index: 2 },
  { packageId: "ludeon.rimworld.royalty", rawPackageId: "ludeon.rimworld.royalty", steamId: null, name: "Royalty", index: 3 },
  { packageId: "quarry.mod", rawPackageId: "quarry.mod", steamId: null, name: "Quarry", index: 4 },
  { packageId: "noted.mod", rawPackageId: "noted.mod", steamId: null, name: "Noted Mod", index: 5 },
  { packageId: "brrainz.harmony", rawPackageId: "brrainz.harmony", steamId: "2009463077", name: "Harmony", index: 6 },
  { packageId: "gamma.pack", rawPackageId: "gamma.pack", steamId: null, name: "Gamma Pack", index: 7 },
  { packageId: "twin.mod", rawPackageId: "twin.mod", steamId: null, name: "Twin Mod", index: 8 },
];

const payload = {
  source: "rws",
  gameVersion: "1.7.4976 rev1043",
  defaultTitle: "Verification list",
  title: `Verification ${Date.now()}`,
  mods: mods.map((mod, index) => ({ ...mod, index })),
};

// Give one mod a deterministic author so author search can be checked. Local
// development allows token-less imports; production returns 401 and this is skipped.
const seeded = await fetch(`${baseUrl}/__admin/import-index`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    rows: [
      { wid: "999000111", packageId: "quarry.mod", name: "Quarry", authors: "Zebraauthor", gameVersions: ["1.7"] },
      { wid: "999000222", packageId: null, name: "Twin Mod", authors: null, gameVersions: ["1.4"] },
      { wid: "999000333", packageId: null, name: "Twin Mod", authors: null, gameVersions: ["1.5"] },
    ],
  }),
}).then((response) => response.ok, () => false);

// Only the local dev server honours a supplied client IP; Cloudflare rejects the
// managed header on the public edge, so production requests must omit it.
const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(baseUrl);
const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
const clientHeaders = local ? { "cf-connecting-ip": ip } : {};

const created = await fetch(`${baseUrl}/api/lists`, {
  method: "POST",
  headers: { "content-type": "application/json", ...clientHeaders },
  body: JSON.stringify(payload),
});
if (!created.ok) {
  console.error(`could not create verification list: ${created.status} ${await created.text()}`);
  process.exit(1);
}
const list = await created.json();
console.log(`verification list: ${list.url}`);

if (!list.editToken) {
  console.error("creation did not return an edit token");
  process.exit(1);
}

// Mark one mod as noted via the edit API so the noted filter has something to find.
await fetch(`${baseUrl}/api/lists/${list.id}`, {
  method: "PATCH",
  headers: { "content-type": "application/json", "x-edit-token": list.editToken },
  body: JSON.stringify({
    items: [
      { position: 5, note: "the backbone of the list" },
      { position: 7, hidden: true },
    ],
  }),
});

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(baseUrl, ["clipboard-read", "clipboard-write"]);

  const page = await browser.newPage();
  // The platform clipboard is unreliable in headless Chrome; capture what the
  // page writes and allow the failure path to be exercised on demand.
  await page.evaluateOnNewDocument(() => {
    window.__clipboard = [];
    window.__clipboardFail = false;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          if (window.__clipboardFail) throw new Error("clipboard denied");
          window.__clipboard.push(text);
        },
      },
    });
  });
  const lastClipboard = () => page.evaluate(() => window.__clipboard[window.__clipboard.length - 1] ?? "");
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  const visiblePositions = () =>
    page.$$eval(".mod", (nodes) =>
      nodes.filter((node) => node.offsetParent !== null).map((node) => Number(node.dataset.position)),
    );
  const cardCount = () => page.$$eval(".mod", (nodes) => nodes.length);

  console.log("\ndetailed mode");
  await page.goto(list.url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".mod");
  check("page loads", (await page.$("main.page")) !== null);
  check("default mode is detailed", (await page.$eval("main.page", (el) => el.dataset.mode)) === "detailed");
  check("facts visible", await page.$eval(".mod .facts", (el) => el.offsetParent !== null));
  const total = await cardCount();
  check("every visible mod is rendered", total === mods.length - 1, `rendered ${total}`);
  check("hidden mod is absent", !(await page.content()).includes("Gamma Pack"));
  check("positions are one-based and sequential", (await visiblePositions()).join(",") === "1,2,3,4,5,6,7,9");

  console.log("\nbrief mode via URL");
  await page.goto(`${list.url}?mode=brief`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".mod");
  check("brief attribute set", (await page.$eval("main.page", (el) => el.dataset.mode)) === "brief");
  check("facts hidden", await page.$eval(".mod .facts", (el) => el.offsetParent === null));
  check("package id hidden", await page.$eval(".mod .package-id", (el) => el.offsetParent === null));
  check("thumbnail hidden", await page.$eval(".mod .thumb", (el) => el.offsetParent === null));
  check("byline hidden", await page.$eval(".mod .byline", (el) => el.offsetParent === null));
  check("note hidden", await page.$eval(".mod .note", (el) => el.offsetParent === null));
  check("title still visible", await page.$eval(".mod .mod-title", (el) => el.offsetParent !== null));
  check("position still visible", await page.$eval(".mod .mod-position", (el) => el.offsetParent !== null));
  check(
    "column labels visible",
    (await page.$$eval(".brief-head span", (nodes) => nodes.map((n) => n.textContent).join("|"))) === "Order|Mod|Workshop" &&
      (await page.$eval(".brief-head", (el) => el.offsetParent !== null)),
  );
  check(
    "rows lay out in three columns",
    (await page.$eval(".mod", (el) => getComputedStyle(el).display)) === "grid" &&
      (await page.$eval(".mod", (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length)) === 3,
  );
  check("row link visible", await page.$eval(".mod .row-link", (el) => el.offsetParent !== null));
  check(
    "unresolved rows show the question-mark icon",
    await page.$$eval(
      '.mod[data-unresolved="1"] .row-flag',
      (nodes) => nodes.length > 0 && nodes.every((node) => node.offsetParent !== null),
    ),
  );
  check(
    "icon uses the bundled symbol font in brick red",
    /rgb\(166, 58, 43\)|rgb\(224, 106, 82\)/.test(await page.$eval('.mod[data-unresolved="1"] .row-flag', (el) => getComputedStyle(el).color)) &&
      (await page.$eval('.mod[data-unresolved="1"] .row-flag .nf', (el) => getComputedStyle(el).fontFamily)).includes("Nerd Symbols"),
  );
  check(
    "icon is drawn, not a blank box",
    (await page.$eval('.mod[data-unresolved="1"] .row-flag .nf', (el) => el.getBoundingClientRect().width)) > 4,
  );
  check(
    "tooltip is hidden until hover",
    (await page.$eval('.mod[data-unresolved="1"] .row-tip', (el) => getComputedStyle(el).visibility)) === "hidden",
  );
  await page.hover('.mod[data-unresolved="1"] .row-flag');
  await new Promise((resolve) => setTimeout(resolve, 200));
  const placement = await page.evaluate(() => {
    const flag = document.querySelector('.mod[data-unresolved="1"] .row-flag');
    const tip = flag.querySelector(".row-tip");
    const icon = flag.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    return { left: box.left, right: box.right, iconRight: icon.right, viewport: innerWidth };
  });
  await page.hover('.mod[data-unresolved="1"] .row-flag');
  await new Promise((resolve) => setTimeout(resolve, 200));
  const painted = await page.evaluate(() => {
    const row = document.querySelector('.mod[data-unresolved="1"]');
    const tip = row.querySelector(".row-tip");
    const box = tip.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    const y = box.top < rowBox.top ? box.top + 6 : box.bottom - 6;
    const x = box.left + 12;
    const hit = document.elementFromPoint(x, Math.round(y));
    return { insideRow: y >= rowBox.top && y <= rowBox.bottom, hit: hit ? hit.closest(".row-tip") !== null : false };
  });
  check("tooltip is not clipped by the row", painted.hit, JSON.stringify(painted));

  const gap = await page.evaluate(() => {
    const flag = document.querySelector('.mod[data-unresolved="1"] .row-flag');
    const tip = flag.querySelector(".row-tip");
    const f = flag.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    return { x: Math.round((f.right + t.left) / 2), y: Math.round(f.top + f.height / 2) };
  });
  await page.mouse.move(gap.x, gap.y);
  await new Promise((resolve) => setTimeout(resolve, 260));
  check(
    "tooltip survives crossing the gap to it",
    (await page.$eval('.mod[data-unresolved="1"] .row-tip', (el) => getComputedStyle(el).visibility)) === "visible",
  );

  await page.mouse.move(2, 2);
  await new Promise((resolve) => setTimeout(resolve, 200));
  check(
    "tooltip stays open for a moment after the pointer leaves",
    (await page.$eval('.mod[data-unresolved="1"] .row-tip', (el) => getComputedStyle(el).visibility)) === "visible",
  );
  await new Promise((resolve) => setTimeout(resolve, 700));
  check(
    "tooltip closes once the pause elapses",
    (await page.$eval('.mod[data-unresolved="1"] .row-tip', (el) => getComputedStyle(el).visibility)) === "hidden",
  );

  check(
    "tooltip opens to the right of the icon",
    placement.left >= placement.iconRight,
    `${Math.round(placement.left)} vs ${Math.round(placement.iconRight)}`,
  );
  check("tooltip stays inside the viewport", placement.right <= placement.viewport, `${Math.round(placement.right)} vs ${placement.viewport}`);

  await page.hover('.mod[data-unresolved="1"] .row-flag');
  await new Promise((resolve) => setTimeout(resolve, 220));
  const explained = await page.evaluate(() => {
    const tip = document.querySelector('.mod[data-unresolved="1"] .row-tip');
    const text = tip?.querySelector(".row-tip-text")?.textContent ?? "";
    return { visibility: tip ? getComputedStyle(tip).visibility : "missing", text };
  });
  check(
    "tooltip explains the mark on hover",
    explained.visibility === "visible" && explained.text.includes("missing from the community index"),
    JSON.stringify(explained),
  );
  if (seeded) {
    await page.goto(`${list.url}?mode=brief`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".mod");
    const twin = '.mod[data-title="Twin Mod"] .row-flag';
    check(
      "ambiguous mod keeps both candidates in its tooltip",
      (await page.$$eval(`${twin} .row-tip-links a`, (nodes) => nodes.map((n) => n.getAttribute("href")).sort())).join(",") ===
        "https://steamcommunity.com/sharedfiles/filedetails/?id=999000222,https://steamcommunity.com/sharedfiles/filedetails/?id=999000333",
    );
    await page.hover(twin);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await page.evaluate(() => {
      window.__tipClick = null;
      document.addEventListener(
        "click",
        (event) => {
          const link = event.target.closest?.(".row-tip-links a");
          if (!link) return;
          window.__tipClick = link.getAttribute("href");
          event.preventDefault();
        },
        true,
      );
    });
    const linkPoint = await page.$eval(`${twin} .row-tip-links a`, (el) => {
      const box = el.getBoundingClientRect();
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
    });
    await page.mouse.move(linkPoint.x, linkPoint.y);
    await new Promise((resolve) => setTimeout(resolve, 150));
    check(
      "pointer can rest on the tooltip without closing it",
      (await page.$eval(`${twin} .row-tip`, (el) => getComputedStyle(el).visibility)) === "visible" &&
        (await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest(".row-tip-links a") !== null, linkPoint)),
    );
    await page.mouse.click(linkPoint.x, linkPoint.y);
    check(
      "candidate link is clickable from the tooltip",
      (await page.evaluate(() => window.__tipClick)) === "https://steamcommunity.com/sharedfiles/filedetails/?id=999000222",
    );
  } else {
    console.log("  skip ambiguous tooltip checks (index import needs admin token or development mode)");
  }

  check(
    "resolved rows carry no icon",
    (await page.$$eval('.mod[data-unresolved="0"] .row-flag', (nodes) => nodes.filter((n) => n.offsetParent !== null).length)) === 0,
  );
  check("no-js mode link points at detailed", (await page.$eval(".no-js-only", (el) => el.getAttribute("href"))) === "?mode=detailed");

  console.log("\nmode toggle");
  await page.click("[data-mode-toggle]");
  check("toggle switches instantly", (await page.$eval("main.page", (el) => el.dataset.mode)) === "detailed");
  check("URL reflects detailed", !new URL(page.url()).searchParams.has("mode"));
  await page.click("[data-mode-toggle]");
  check("toggle back to brief", (await page.$eval("main.page", (el) => el.dataset.mode)) === "brief");
  check("URL reflects brief", new URL(page.url()).searchParams.get("mode") === "brief");
  const briefUrl = page.url();
  await page.goto(briefUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".mod");
  check("toggle URL reopens brief", (await page.$eval("main.page", (el) => el.dataset.mode)) === "brief");

  console.log("\ntheme");
  const switchSelector = ".site-header [data-theme-switch]";
  const sliderSelector = ".site-header .switch .slider";
  const checked = () => page.$eval(switchSelector, (el) => el.checked);
  check("control lives in the site header", (await page.$$eval(switchSelector, (nodes) => nodes.length)) === 1);
  check("toolbar carries no theme control", (await page.$$eval(".toolbar [data-theme-switch]", (nodes) => nodes.length)) === 0);
  check("switch exposes a switch role", (await page.$eval(switchSelector, (el) => el.getAttribute("role"))) === "switch");
  check(
    "switch carries sun and moon artwork",
    (await page.$$eval(".site-header .theme-switch svg", (nodes) => nodes.length)) === 2 &&
      (await page.$$eval(".site-header .theme-switch svg", (nodes) => nodes.every((n) => n.getBoundingClientRect().width > 4))),
  );

  await page.evaluate(() => localStorage.removeItem("glowforest-theme"));
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".mod");
  check("no choice is stored yet", (await page.evaluate(() => localStorage.getItem("glowforest-theme"))) === null);
  check("switch follows the system preference", (await checked()) === true);
  check(
    "system palette applies without an attribute",
    (await page.$eval("html", (el) => el.dataset.theme ?? "")) === "",
  );
  const systemDarkBg = await page.$eval("body", (el) => getComputedStyle(el).backgroundColor);

  await page.click(sliderSelector);
  check("toggle stores the choice", (await page.evaluate(() => localStorage.getItem("glowforest-theme"))) === "light");
  check("light attribute applied", (await page.$eval("html", (el) => el.dataset.theme)) === "light");
  check("switch shows the light position", (await checked()) === false);
  const lightBg = await page.$eval("body", (el) => getComputedStyle(el).backgroundColor);
  check("light palette differs from the system dark one", lightBg !== systemDarkBg, `${lightBg} vs ${systemDarkBg}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".mod");
  check("choice persists across reload", (await page.$eval("html", (el) => el.dataset.theme)) === "light");
  check("switch position persists", (await checked()) === false);

  await page.focus(switchSelector);
  check(
    "hidden input takes focus",
    await page.evaluate(() => document.activeElement?.hasAttribute("data-theme-switch") === true),
  );
  await page.keyboard.press("Space");
  check("Space toggles the switch", (await checked()) === true);
  const darkBg = await page.$eval("body", (el) => getComputedStyle(el).backgroundColor);
  check("dark palette differs from light", lightBg !== darkBg, `${lightBg} vs ${darkBg}`);
  check("keyboard choice is stored", (await page.evaluate(() => localStorage.getItem("glowforest-theme"))) === "dark");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".mod");
  check("keyboard choice persists", (await checked()) === true);

  for (const [label, path] of [["home", "/"], ["edit", "/edit.html"], ["missing", "/l/no-such-list"]]) {
    const html = await (await fetch(`${baseUrl}${path}`)).text();
    check(`${label} page carries the switch`, html.includes("data-theme-switch"));
  }

  console.log("\ntheme on a page without a list");
  await page.evaluate(() => localStorage.removeItem("glowforest-theme"));
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  check("home page offers the switch", (await page.$$eval(switchSelector, (nodes) => nodes.length)) === 1);
  await page.click(sliderSelector);
  check("switch changes the theme on the home page", (await page.$eval("html", (el) => el.dataset.theme)) === "light");
  await page.reload({ waitUntil: "domcontentloaded" });
  check("choice persists on the home page", (await page.$eval("html", (el) => el.dataset.theme)) === "light");
  await page.evaluate(() => localStorage.removeItem("glowforest-theme"));

  console.log("\nsearch and filters");
  await page.goto(`${list.url}?mode=brief`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".mod");
  await page.type("#mod-search", "tools");
  await new Promise((resolve) => setTimeout(resolve, 400));
  check("search narrows to one mod", (await visiblePositions()).join(",") === "1");
  check("match counter shown", (await page.$eval("#match-count", (el) => el.textContent)) === `1 of ${total} shown`);
  check("URL carries the query", new URL(page.url()).searchParams.get("q") === "tools");

  if (seeded) {
    await page.click("[data-clear]");
    await page.type("#mod-search", "zebraauthor");
    await new Promise((resolve) => setTimeout(resolve, 400));
    check("search matches an author", (await visiblePositions()).join(",") === "5");
  } else {
    console.log("  skip author search (index import needs admin token or development mode)");
  }

  await page.goto(`${list.url}?mode=brief&q=backbone`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".mod");
  await new Promise((resolve) => setTimeout(resolve, 300));
  check("search matches notes", (await visiblePositions()).join(",") === "6");

  await page.click("[data-clear]");
  await page.click('[data-filter="only-noted"]');
  check("only-noted filter keeps the noted mod", (await visiblePositions()).join(",") === "6");
  check("noted toggle reports pressed", (await page.$eval('[data-filter="only-noted"]', (el) => el.getAttribute("aria-pressed"))) === "true");
  await page.type("#mod-search", "zebra");
  await new Promise((resolve) => setTimeout(resolve, 400));
  check("filters compose with search", (await visiblePositions()).length === 0);
  check("empty state appears", await page.$eval("#list-empty", (el) => el.offsetParent !== null));
  check("clear button appears while filtering", await page.$eval("[data-clear]", (el) => el.offsetParent !== null));

  await page.click("[data-clear]");
  await page.type("#mod-search", "core");
  await new Promise((resolve) => setTimeout(resolve, 400));
  check("search finds official content", (await visiblePositions()).join(",") === "3");
  check("no official toggle exists", (await page.$$eval('[data-filter="hide-official"]', (nodes) => nodes.length)) === 0);
  await page.click("[data-clear]");
  await page.click('[data-filter="only-noted"]');
  await page.click('[data-filter="only-outdated"]');
  check("two filters compose", (await visiblePositions()).length === 0);
  await page.click('[data-filter="only-noted"]');
  await page.click('[data-filter="only-outdated"]');
  await new Promise((resolve) => setTimeout(resolve, 100));
  const restored = await visiblePositions();
  check("clear restores every mod", restored.length === total, `${restored.length} vs ${total}`);
  check("order preserved after clearing", restored.every((value, index, all) => index === 0 || all[index - 1] < value));

  const outdatedCount = await page.$$eval('.mod[data-outdated="1"]', (nodes) => nodes.length);
  await page.click('[data-filter="only-outdated"]');
  const outdatedVisible = await visiblePositions();
  check("outdated filter matches its flag count", outdatedVisible.length === outdatedCount, `${outdatedVisible.length} vs ${outdatedCount}`);
  await page.click('[data-filter="only-outdated"]');

  console.log("\ncopy actions");
  await page.goto(`${list.url}?mode=brief&q=tools`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".mod");
  await new Promise((resolve) => setTimeout(resolve, 300));
  await page.click("#copy-list");
  await new Promise((resolve) => setTimeout(resolve, 200));
  const copied = await lastClipboard();
  check("copy list contains only visible mods", copied === "1. Zebra Tools", JSON.stringify(copied));

  check("cards offer no copy-link control", (await page.$$eval(".copy-link", (nodes) => nodes.length)) === 0);

  await new Promise((resolve) => setTimeout(resolve, 1700));
  await page.evaluate(() => { window.__clipboardFail = true; });
  await page.click("#copy-list");
  await new Promise((resolve) => setTimeout(resolve, 200));
  check("copy failure is reported", (await page.$eval("#copy-list", (el) => el.textContent)) === "Copy failed");

  console.log("\nperformance hints");
  const contentVisibility = await page.$eval(".mod", (el) => getComputedStyle(el).contentVisibility);
  check("content-visibility applied", contentVisibility === "auto", contentVisibility);

  console.log("\nno JavaScript");
  const noJs = await browser.newPage();
  await noJs.setJavaScriptEnabled(false);
  await noJs.goto(list.url, { waitUntil: "domcontentloaded" });
  const noJsCards = await noJs.$$eval(".mod", (nodes) => nodes.length);
  check("all mods rendered without scripting", noJsCards === total, `${noJsCards} vs ${total}`);
  await noJs.waitForSelector(".theme-switch", { hidden: true, timeout: 5000 }).catch(() => undefined);
  check(
    "theme switch hidden without scripting",
    (await noJs.$eval(".theme-switch", (el) => el.offsetParent !== null)) === false,
  );
  await noJs.waitForSelector(".toolbar-controls", { hidden: true, timeout: 5000 }).catch(() => undefined);
  const searchVisible = await noJs.$eval(".toolbar-controls", (el) => el.offsetParent !== null);
  check("interactive controls hidden", searchVisible === false);
  await noJs.waitForSelector(".no-js-only", { visible: true, timeout: 5000 }).catch(() => undefined);
  const modeLinkVisible = await noJs.$eval(".no-js-only", (el) => el.offsetParent !== null);
  check("mode link available", modeLinkVisible === true);
  await Promise.all([noJs.waitForNavigation({ waitUntil: "domcontentloaded" }), noJs.click(".no-js-only")]);
  check("mode link renders brief without scripting", (await noJs.$eval("main.page", (el) => el.dataset.mode)) === "brief");
  await noJs.close();

  console.log("\npreview card");
  const card = await fetch(`${baseUrl}/og/${list.id}.png`);
  check(
    "preview card renders",
    card.status === 200 && card.headers.get("content-type") === "image/png",
    `${card.status} ${card.headers.get("content-type")}`,
  );

  check("no page errors", consoleErrors.length === 0, consoleErrors.join("; "));
} finally {
  await browser.close();
  if (!keep) {
    let deleted;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      deleted = await fetch(`${baseUrl}/api/lists/${list.id}`, {
        method: "DELETE",
        headers: { "x-edit-token": list.editToken },
      });
      if (deleted.ok) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
    const after = await fetch(`${list.url}?deleted=${Date.now()}`);
    check(
      "verification list removed",
      deleted.ok && after.status === 404,
      `delete ${deleted.status}, page ${after.status}`,
    );
  } else {
    console.log(`kept verification list: ${list.url}`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log("\nall checks passed");
