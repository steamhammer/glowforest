import { Resvg, initWasm } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import type { Env } from "../env";
import { majorMinor } from "../metadata/resolve";
import { formatBytes, type ListStats } from "./stats";

export interface CardData {
  title: string;
  stats: ListStats;
}

let wasmReady: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (wasmReady === null) wasmReady = initWasm(resvgWasm);
  return wasmReady;
}

async function fetchFont(env: Env, request: Request, path: string): Promise<Uint8Array> {
  const response = await env.ASSETS.fetch(new URL(path, request.url));
  if (!response.ok) throw new Error(`font ${path} unavailable (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Cache a font for the lifetime of the Worker instance. A rejected load is not
 * cached, so the next render retries instead of pinning the failure.
 */
export function memoizeFont(load: () => Promise<Uint8Array>): () => Promise<Uint8Array> {
  let cached: Promise<Uint8Array> | null = null;
  return () => {
    if (cached === null) {
      cached = load().catch((error: unknown) => {
        cached = null;
        throw error;
      });
    }
    return cached;
  };
}

let fontLoader: (() => Promise<Uint8Array>) | null = null;

function loadFont(env: Env, request: Request): Promise<Uint8Array> {
  fontLoader ??= memoizeFont(() => fetchFont(env, request, "/fonts/Lato-Regular.ttf"));
  return fontLoader();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Rough line breaking for a fixed-width card; no shaping engine needed. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  const joinedLength = lines.join(" ").length;
  if (joinedLength < text.replace(/\s+/g, " ").trim().length && lines.length > 0) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : last;
  }
  return lines.length > 0 ? lines : [""];
}

function summaryLine(stats: ListStats): string {
  const parts: string[] = [`${stats.modCount} ${stats.modCount === 1 ? "mod" : "mods"}`];
  if (stats.gameVersion) parts.push(`RimWorld ${majorMinor(stats.gameVersion) ?? stats.gameVersion}`);
  if (stats.totalBytes > 0) parts.push(formatBytes(stats.totalBytes));
  if (stats.unsupported > 0) parts.push(`${stats.unsupported} not on this version`);
  return parts.join("  ·  ");
}

function cardSvg(card: CardData): string {
  const titleLines = wrap(card.title, 34, 3);
  const lineHeight = 84;
  const titleTop = 250 - (titleLines.length - 1) * (lineHeight / 2);
  const titleSpans = titleLines
    .map(
      (line, index) =>
        `<tspan x="72" y="${titleTop + index * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  const summary = escapeXml(summaryLine(card.stats));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#14161a"/>
  <rect x="0" y="0" width="1200" height="10" fill="#4f9cf0"/>
  <text x="72" y="104" font-family="Lato" font-size="26" letter-spacing="4" fill="#9db0c7">RIMWORLD MOD LIST</text>
  <text font-family="Lato" font-size="76" letter-spacing="-0.4" fill="#f4f7fb">${titleSpans}</text>
  <text x="72" y="${titleTop + titleLines.length * lineHeight + 24}" font-family="Lato" font-size="32" fill="#a9bbd4">${summary}</text>
  <line x1="72" y1="520" x2="1128" y2="520" stroke="#2c333d" stroke-width="2"/>
  <text x="72" y="572" font-family="Lato" font-size="24" fill="#6f819a">Load order as recorded</text>
  <text x="1128" y="572" font-family="Lato" font-size="24" fill="#6f819a" text-anchor="end">Steam Workshop metadata</text>
</svg>`;
}

/** Render a 1200x630 PNG preview card. */
export async function renderCardImage(
  env: Env,
  request: Request,
  card: CardData,
): Promise<Uint8Array> {
  await ensureWasm();
  const regular = await loadFont(env, request);

  const renderer = new Resvg(cardSvg(card), {
    fitTo: { mode: "width", value: 1200 },
    font: {
      fontBuffers: [regular],
      defaultFontFamily: "Lato",
      loadSystemFonts: false,
    },
  });
  return renderer.render().asPng();
}
