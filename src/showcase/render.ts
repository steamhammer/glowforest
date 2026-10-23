import type { EnrichedItem } from "../metadata/enrich";
import type { ListRecord } from "../types";
import { workshopUrl as workshopItemUrl } from "../metadata/official";
import { majorMinor } from "../metadata/resolve";
import { formatBytes, formatDate, summarise, supportStatus } from "./stats";

export type ListMode = "detailed" | "brief";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Same normalisation the client uses, so the haystack and the query agree. */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

const HAYSTACK_LIMIT = 240;

export function searchHaystack(item: EnrichedItem): string {
  const raw = [item.title, item.authors ?? "", item.packageId ?? "", item.note ?? ""].join(" ");
  return normalizeForSearch(raw).slice(0, HAYSTACK_LIMIT);
}

export interface RenderOptions {
  list: ListRecord;
  items: EnrichedItem[];
  canonicalUrl: string;
  ogImageUrl: string;
  mode?: ListMode;
}

function versionLabel(versions: string[]): string | null {
  if (versions.length === 0) return null;
  const sorted = [...versions].sort((a, b) => {
    const [aMajor, aMinor] = a.split(".").map(Number);
    const [bMajor, bMinor] = b.split(".").map(Number);
    return bMajor - aMajor || bMinor - aMinor;
  });
  return sorted.slice(0, 3).join(", ");
}

function cardAttributes(item: EnrichedItem, listVersion: string | null): string {
  const status = supportStatus(item, listVersion);
  return [
    `data-position="${item.position + 1}"`,
    `data-title="${escapeHtml(item.title)}"`,
    `data-author="${escapeHtml(item.authors ?? "")}"`,
    `data-official="${item.official ? 1 : 0}"`,
    `data-unresolved="${item.unresolved ? 1 : 0}"`,
    `data-outdated="${status === "unsupported" ? 1 : 0}"`,
    `data-noted="${item.note ? 1 : 0}"`,
    `data-search="${escapeHtml(searchHaystack(item))}"`,
  ].join(" ");
}

const THEME_SCRIPT = `<script>try{var t=localStorage.getItem("glowforest-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>`;

const THEME_SWITCH = `<div class="theme-switch js-only">
    <label class="switch">
      <span class="sun"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="#ffd43b"><circle r="5" cy="12" cx="12"></circle><path d="m21 13h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm-17 0h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm13.66-5.66a1 1 0 0 1 -.66-.29 1 1 0 0 1 0-1.41l.71-.71a1 1 0 1 1 1.41 1.41l-.71.71a1 1 0 0 1 -.75.29zm-12.02 12.02a1 1 0 0 1 -.71-.29 1 1 0 0 1 0-1.41l.71-.66a1 1 0 0 1 1.41 1.41l-.71.71a1 1 0 0 1 -.7.24zm6.36-14.36a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm0 17a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm-5.66-14.66a1 1 0 0 1 -.7-.29l-.71-.71a1 1 0 0 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.29zm12.02 12.02a1 1 0 0 1 -.7-.29l-.66-.71a1 1 0 0 1 1.36-1.36l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.24z"></path></g></svg></span>
      <span class="moon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="m223.5 32c-123.5 0-223.5 100.3-223.5 224s100 224 223.5 224c60.6 0 115.5-24.2 155.8-63.4 5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6-96.9 0-175.5-78.8-175.5-176 0-65.8 36-123.1 89.3-153.3 6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z"></path></svg></span>
      <input type="checkbox" class="input" role="switch" aria-label="Dark theme" data-theme-switch>
      <span class="slider"></span>
    </label>
  </div>`;

function renderThemeControl(): string {
  return THEME_SWITCH;
}

const UNRESOLVED_TIP =
  "Not found on Workshop: this mod's package ID is missing from the community index, so there is no Steam link for it.";

function renderUnresolvedFlag(item: EnrichedItem): string {
  if (!item.unresolved) return "";
  const id = `tip-${item.position + 1}`;
  const ambiguous = item.alternatives.length > 0;
  const reason = ambiguous
    ? `${item.alternatives.length} Workshop items share this title, so the page cannot tell which one this list uses. Open them and judge by the supported versions:`
    : UNRESOLVED_TIP;
  const links = ambiguous
    ? `<span class="row-tip-links">${item.alternatives
        .map((alternative) => {
          const versions = versionLabel(alternative.gameVersions);
          const label = `${alternative.name ?? `Workshop ${alternative.wid}`}${versions ? ` (${versions})` : ""}`;
          return `<a href="${escapeHtml(workshopItemUrl(alternative.wid))}" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
        })
        .join("")}</span>`
    : "";
  return `<span class="row-flag" tabindex="0" aria-describedby="${id}" aria-label="Unresolved mod"><span class="nf" aria-hidden="true">&#xF1522;</span><span class="row-tip" id="${id}" role="tooltip"><span class="row-tip-text">${escapeHtml(reason)}</span>${links}</span></span>`;
}

function renderHeader(): string {
  return `<header class="site-header">
  <a class="wordmark" href="/">Glowforest</a>
  ${renderThemeControl()}
</header>`;
}

function renderCard(item: EnrichedItem, listVersion: string | null): string {
  const status = supportStatus(item, listVersion);
  const shortVersion = majorMinor(listVersion) ?? listVersion ?? "this version";
  const position = item.position + 1;

  const badges: string[] = [];
  if (item.official) badges.push(`<span class="badge badge-official">Official content</span>`);
  if (item.unresolved) badges.push(`<span class="badge badge-unresolved">Not found on Workshop</span>`);
  if (status === "unsupported") badges.push(`<span class="badge badge-outdated">No ${escapeHtml(shortVersion)} support</span>`);

  const thumb = item.thumb
    ? `<img class="thumb" src="${escapeHtml(item.thumb)}" alt="" loading="lazy" decoding="async">`
    : `<div class="thumb thumb-empty" aria-hidden="true"></div>`;

  const facts: string[] = [];
  const versions = versionLabel(item.gameVersions);
  if (versions) facts.push(`Game versions: ${escapeHtml(versions)}`);
  if (item.fileSize !== null) facts.push(escapeHtml(formatBytes(item.fileSize)));
  if (item.subs !== null) facts.push(`${escapeHtml(item.subs.toLocaleString("en-US"))} subscribers`);
  const updated = formatDate(item.updatedAt);
  if (updated) facts.push(`Updated ${escapeHtml(updated)}`);

  const link = item.storeUrl
    ? `<a class="action" href="${escapeHtml(item.storeUrl)}" rel="noopener noreferrer">Store page</a>`
    : item.workshopUrl
      ? `<a class="action" href="${escapeHtml(item.workshopUrl)}" rel="noopener noreferrer">Steam Workshop</a>`
      : "";

  const identity = item.packageId
    ? `<code class="package-id">${escapeHtml(item.packageId)}</code>`
    : "";

  const target = item.storeUrl ?? item.workshopUrl;
  const rowLink = target
    ? `<a class="row-link" href="${escapeHtml(target)}" rel="noopener noreferrer">${item.storeUrl ? "Store" : "Workshop"}</a>`
    : `<span class="row-link row-link-none" aria-hidden="true">—</span>`;

  return `<li class="mod${item.unresolved ? " mod-unresolved" : ""}${item.official ? " mod-official" : ""}" id="mod-${position}" ${cardAttributes(item, listVersion)}>
  <span class="mod-position" aria-label="Load order">${position}</span>
  ${thumb}
  <div class="mod-body">
    <div class="mod-headline">
      <h2 class="mod-title">${escapeHtml(item.title)}</h2>
      ${renderUnresolvedFlag(item)}
    </div>
    <p class="byline">${escapeHtml(item.authors ?? "Unknown author")} ${badges.join(" ")}</p>
    ${identity}
    ${item.note ? `<p class="note">${escapeHtml(item.note)}</p>` : ""}
    ${facts.length > 0 ? `<p class="facts">${facts.join(" · ")}</p>` : ""}
    <p class="mod-actions">${link}</p>
  </div>
  ${rowLink}
</li>`;
}

interface ToolbarOptions {
  summary: string;
  mode: ListMode;
}

function renderToolbar(options: ToolbarOptions): string {
  const otherMode: ListMode = options.mode === "brief" ? "detailed" : "brief";
  const otherLabel = options.mode === "brief" ? "Detailed view" : "Brief view";
  const briefPressed = options.mode === "brief" ? "true" : "false";

  return `<div class="toolbar" id="toolbar">
  <div class="toolbar-row">
    <p class="summary">${escapeHtml(options.summary)}</p>
    <p class="match-count" id="match-count" aria-live="polite" hidden></p>
  </div>
  <div class="toolbar-row toolbar-controls js-only" role="group" aria-label="Search and filters">
    <label class="search">
      <span class="sr-only">Search mods by name, author, package ID, or note</span>
      <input type="search" id="mod-search" placeholder="Search mods, authors, notes…" autocomplete="off" spellcheck="false">
    </label>
    <div class="filters" role="group" aria-label="Filter mods">
      <button type="button" class="chip" data-filter="only-unresolved" aria-pressed="false">Unresolved</button>
      <button type="button" class="chip" data-filter="only-outdated" aria-pressed="false">Outdated</button>
      <button type="button" class="chip" data-filter="only-noted" aria-pressed="false">Noted</button>
      <button type="button" class="chip chip-clear" data-clear hidden>Clear</button>
    </div>
  </div>
  <div class="toolbar-row toolbar-utility">
    <button type="button" class="chip js-only" id="copy-list">Copy list</button>
    <button type="button" class="chip js-only" data-mode-toggle aria-pressed="${briefPressed}">Brief</button>
    <a class="chip no-js-only" href="?mode=${otherMode}">${otherLabel}</a>
    <a class="chip top-link" href="#top">Top</a>
  </div>
</div>`;
}

export function renderListPage(options: RenderOptions): string {
  const { list, items, canonicalUrl, ogImageUrl } = options;
  const mode: ListMode = options.mode === "brief" ? "brief" : "detailed";
  const visible = items.filter((item) => !item.hidden);
  const stats = summarise(items, list.gameVersion);
  const size = stats.totalBytes > 0 ? formatBytes(stats.totalBytes) : null;

  const summaryParts = [`${stats.modCount} ${stats.modCount === 1 ? "mod" : "mods"}`];
  if (list.gameVersion) summaryParts.push(`RimWorld ${majorMinor(list.gameVersion) ?? list.gameVersion.split(" ")[0]}`);
  if (size) summaryParts.push(size);
  const summary = summaryParts.join(" · ");

  const shortVersion = majorMinor(list.gameVersion) ?? list.gameVersion ?? "this version";
  const drift =
    stats.unsupported > 0
      ? `<p class="warning">${stats.unsupported} ${stats.unsupported === 1 ? "mod does" : "mods do"} not list support for ${escapeHtml(shortVersion)}.</p>`
      : "";

  const official = visible.filter((item) => item.official);

  // The official group sits where the first official mod appears, so the visible
  // sequence still reads in ascending load order.
  const cards: string[] = [];
  let officialInserted = false;
  for (const item of visible) {
    if (item.official) {
      if (!officialInserted) {
        officialInserted = true;
        const groupLabel = `Official content (${official.length} ${official.length === 1 ? "mod" : "mods"})`;
        cards.push(`<li class="official-group" data-official-group="true" data-position="${official[0].position + 1}">
  <details>
    <summary>${groupLabel}</summary>
    <ul class="mods mods-official">
${official.map((entry) => renderCard(entry, list.gameVersion)).join("\n")}
    </ul>
  </details>
</li>`);
      }
      continue;
    }
    cards.push(renderCard(item, list.gameVersion));
  }

  const description = `${summary} — a RimWorld mod list in load order.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${THEME_SCRIPT}
<title>${escapeHtml(list.title)} — RimWorld mod list</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark light">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(list.title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta property="og:image" content="${escapeHtml(ogImageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(list.title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">
<link rel="stylesheet" href="/styles.css">
</head>
<body id="top">
${renderHeader()}
<main class="page" data-mode="${mode}">
  <h1>${escapeHtml(list.title)}</h1>
  ${renderToolbar({ summary, mode })}
  ${drift}
  <div class="brief-head" aria-hidden="true"><span>Order</span><span>Mod</span><span>Workshop</span></div>
  <ul class="mods" id="mod-list">
${cards.join("\n")}
  </ul>
  <p class="list-empty" id="list-empty" hidden>No mods match these filters.</p>
</main>
<footer class="site-footer">
  <p>Mod metadata from <a href="https://steamcommunity.com/app/294100/workshop/" rel="noopener noreferrer">Steam Workshop</a>. Community package index from the RimSort Steam Workshop Database. RimWorld is a trademark of Ludeon Studios; this site is unofficial.</p>
  <p>Load order is shown as recorded; it is not validated for missing dependencies or conflicts.</p>
</footer>
<script type="module" src="/theme.js"></script>
<script type="module" src="/list.js"></script>
</body>
</html>`;
}

export function renderNotFound(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${THEME_SCRIPT}<meta name="robots" content="noindex, nofollow"><title>List not found</title><link rel="stylesheet" href="/styles.css"></head>
<body id="top">
${renderHeader()}
<main class="page">
  <h1>List not found</h1>
  <p>This mod list does not exist, or it has been deleted.</p>
  <p><a href="/">Share your own mod list</a></p>
</main>
<script type="module" src="/theme.js"></script>
</body>
</html>`;
}
