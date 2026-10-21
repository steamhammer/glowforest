import type { EnrichedItem } from "../metadata/enrich";
import type { ListRecord } from "../types";
import { majorMinor } from "../metadata/resolve";
import { formatBytes, formatDate, summarise, supportStatus } from "./stats";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface RenderOptions {
  list: ListRecord;
  items: EnrichedItem[];
  canonicalUrl: string;
  ogImageUrl: string;
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

function renderItem(item: EnrichedItem, listVersion: string | null): string {
  const status = supportStatus(item, listVersion);
  const shortVersion = majorMinor(listVersion) ?? listVersion ?? "this version";
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

  return `<li class="mod${item.unresolved ? " mod-unresolved" : ""}${item.official ? " mod-official" : ""}" id="mod-${item.position + 1}">
  ${thumb}
  <div class="mod-body">
    <h2 class="mod-title">${escapeHtml(item.title)}</h2>
    <p class="byline">${item.authors ? escapeHtml(item.authors) : "Unknown author"} ${badges.join(" ")}</p>
    ${identity}
    ${item.note ? `<p class="note">${escapeHtml(item.note)}</p>` : ""}
    ${facts.length > 0 ? `<p class="facts">${facts.join(" · ")}</p>` : ""}
    ${link}
  </div>
</li>`;
}

export function renderListPage(options: RenderOptions): string {
  const { list, items, canonicalUrl, ogImageUrl } = options;
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

  const description = `${summary} — a RimWorld mod list in load order.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(list.title)} — RimWorld mod list</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="noindex, nofollow">
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
<body>
<header class="site-header">
  <a class="wordmark" href="/">RimWorld mod list</a>
</header>
<main class="page">
  <h1>${escapeHtml(list.title)}</h1>
  <p class="summary">${escapeHtml(summary)}</p>
  ${drift}
  <ol class="mods">
${visible.map((item) => renderItem(item, list.gameVersion)).join("\n")}
  </ol>
</main>
<footer class="site-footer">
  <p>Mod metadata from <a href="https://steamcommunity.com/app/294100/workshop/" rel="noopener noreferrer">Steam Workshop</a>. Community package index from the RimSort Steam Workshop Database. RimWorld is a trademark of Ludeon Studios; this site is unofficial.</p>
  <p>Load order is shown as recorded; it is not validated for missing dependencies or conflicts.</p>
</footer>
</body>
</html>`;
}

export function renderNotFound(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>List not found</title><link rel="stylesheet" href="/styles.css"></head>
<body>
<header class="site-header"><a class="wordmark" href="/">RimWorld mod list</a></header>
<main class="page">
  <h1>List not found</h1>
  <p>This mod list does not exist, or it has been deleted.</p>
  <p><a href="/">Share your own mod list</a></p>
</main>
</body>
</html>`;
}
