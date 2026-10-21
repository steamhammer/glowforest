/**
 * Browser-side mod-list extraction.
 *
 * Reads only a bounded header of a submitted file and returns the normalised
 * list. The colony body of a save is never parsed, kept, or sent anywhere.
 *
 * This module is plain ESM with no DOM dependencies so it can be imported by
 * both the page and the test runner.
 */

export const HEADER_BYTES = 1024 * 1024;
export const MAX_MODS = 1000;
export const STEAM_POSTFIX = "_steam";

/** RimWorld DLC store app IDs, which are not Workshop published-file IDs. */
export const OFFICIAL_APP_IDS = Object.freeze([
  "1149640", // Royalty
  "1392840", // Ideology
  "1826140", // Biotech
  "2380740", // Anomaly
  "3022790", // Odyssey
]);

const OFFICIAL_APP_ID_SET = new Set(OFFICIAL_APP_IDS);

export const PLACEHOLDER_PACKAGE_IDS = Object.freeze([
  "scenario.rsc",
  "missing.packageid",
  "invalid.item",
]);

const PLACEHOLDER_SET = new Set(PLACEHOLDER_PACKAGE_IDS);

const NAMED_ENTITIES = Object.freeze({
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
});

export class IngestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IngestError";
    this.code = code;
  }
}

const ACCEPTED =
  "Accepted files are a RimWorld save (.rws), a mod-list export (.rml), or ModsConfig.xml.";

/** @param {Uint8Array} bytes */
export function sniff(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return "gzip";
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return "zip";
  return "text";
}

/**
 * Decompress a gzip prefix, keeping whatever was produced before the input ran
 * out. A save is only needed as far as its header.
 *
 * @param {Uint8Array} bytes
 * @param {number} [maxBytes]
 */
export async function gunzipPrefix(bytes, maxBytes = HEADER_BYTES) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
      if (total >= maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* already closed */
        }
        break;
      }
    }
  } catch {
    /* truncated gzip stream: the produced prefix is still usable */
  }
  return concatBytes(chunks, maxBytes);
}

/** @param {Uint8Array[]} chunks @param {number} limit */
function concatBytes(chunks, limit) {
  const total = Math.min(
    limit,
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= total) break;
    const take = Math.min(chunk.length, total - offset);
    out.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return out;
}

/** @param {Uint8Array} bytes */
export function decodeText(bytes) {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** @param {string} text */
export function detectRoot(text) {
  if (/<savegame[\s>]/.test(text)) return "rws";
  if (/<savedModList[\s>]/.test(text)) return "rml";
  if (/<ModsConfigData[\s>]/.test(text)) return "modsconfig";
  return null;
}

/** @param {string} value */
export function decodeXmlEntities(value) {
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/** First inner text of a tag, if present. @param {string} text @param {string} tag */
export function readText(text, tag) {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(text);
  return match ? decodeXmlEntities(match[1].trim()) : null;
}

/** All `<li>` values inside a list tag, or null when the tag is absent. */
export function listValues(text, tag) {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(text);
  if (!match) return null;
  /** @type {string[]} */
  const values = [];
  const item = /<li>([\s\S]*?)<\/li>/g;
  let found;
  while ((found = item.exec(match[1])) !== null) {
    values.push(decodeXmlEntities(found[1].trim()));
  }
  return values;
}

/** @param {string} text */
export function parseMetaHeader(text) {
  const match = /<meta>([\s\S]*?)<\/meta>/.exec(text);
  if (!match) return null;
  const meta = match[0];
  return {
    gameVersion: readText(meta, "gameVersion"),
    modIds: listValues(meta, "modIds"),
    modSteamIds: listValues(meta, "modSteamIds"),
    modNames: listValues(meta, "modNames"),
  };
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizePackageId(raw) {
  const lower = raw.trim().toLowerCase();
  return lower.endsWith(STEAM_POSTFIX) ? lower.slice(0, -STEAM_POSTFIX.length) : lower;
}

/** @param {string} packageId */
export function isPlaceholderPackageId(packageId) {
  return PLACEHOLDER_SET.has(packageId.trim().toLowerCase());
}

/**
 * Split a recorded Steam identifier into its two meanings.
 * @param {string | null | undefined} raw
 */
export function classifySteamId(raw) {
  const value = (raw ?? "").trim();
  if (!value || value === "0") return { steamId: null, official: false };
  if (OFFICIAL_APP_ID_SET.has(value)) return { steamId: null, official: true };
  return { steamId: value, official: false };
}

/**
 * @param {string[]} modIds
 * @param {(string | null)[] | null} modSteamIds
 * @param {(string | null)[] | null} modNames
 */
export function buildMods(modIds, modSteamIds, modNames) {
  if (modSteamIds && modSteamIds.length !== modIds.length) {
    throw new IngestError(
      "mismatched-lists",
      "This file is malformed: its mod identifiers and Steam identifiers have different lengths.",
    );
  }
  if (modNames && modNames.length !== modIds.length) {
    throw new IngestError(
      "mismatched-lists",
      "This file is malformed: its mod identifiers and mod names have different lengths.",
    );
  }
  if (modIds.length === 0) {
    throw new IngestError("empty-list", "There are no mods in this file to publish.");
  }
  if (modIds.length > MAX_MODS) {
    throw new IngestError(
      "too-many-mods",
      `This list has ${modIds.length} mods; lists are limited to ${MAX_MODS}.`,
    );
  }

  return modIds.map((raw, index) => {
    const rawPackageId = raw.trim();
    const { steamId } = classifySteamId(modSteamIds ? modSteamIds[index] : null);
    return {
      packageId: normalizePackageId(rawPackageId),
      rawPackageId,
      steamId,
      name: modNames ? modNames[index] || null : null,
      index,
    };
  });
}

/** @param {string} filename */
export function defaultTitleFromFilename(filename) {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  return base.replace(/\.(rws|rml|xml)(\.gz)?$/i, "") || null;
}

/**
 * Extract an ingested list from already-decoded text.
 * @param {string} text
 * @param {{ filename?: string, source?: string }} [options]
 */
export function extractFromText(text, options = {}) {
  const root = detectRoot(text);
  if (root === null) {
    throw new IngestError(
      "unrecognised",
      `That file is not a RimWorld mod list. ${ACCEPTED}`,
    );
  }

  if (root === "modsconfig") {
    const activeMods = listValues(text, "activeMods");
    if (activeMods === null) {
      throw new IngestError(
        "no-mods-config",
        `This ModsConfig.xml has no active mod list. ${ACCEPTED}`,
      );
    }
    const mods = buildMods(activeMods, null, null);
    return {
      source: "modsconfig",
      gameVersion: readText(text, "version"),
      mods,
      defaultTitle: options.filename ? defaultTitleFromFilename(options.filename) : null,
    };
  }

  const meta = parseMetaHeader(text);
  if (meta === null || meta.modIds === null) {
    if (root === "rws") {
      throw new IngestError(
        "legacy-save",
        "This save predates mod package identifiers. Use the game's \"Save mod list\" export (.rml) or upload ModsConfig.xml instead.",
      );
    }
    throw new IngestError(
      "header-missing",
      `The mod list header could not be found. ${ACCEPTED}`,
    );
  }

  const mods = buildMods(meta.modIds, meta.modSteamIds, meta.modNames);
  return {
    source: root,
    gameVersion: meta.gameVersion,
    mods,
    defaultTitle: options.filename ? defaultTitleFromFilename(options.filename) : null,
  };
}

/**
 * Extract an ingested list from raw bytes, reading no more than the header.
 * @param {Uint8Array} bytes
 * @param {{ filename?: string, source?: string }} [options]
 */
export async function extractFromBytes(bytes, options = {}) {
  const kind = sniff(bytes);
  if (kind === "zip") {
    throw new IngestError(
      "zip",
      `That looks like a ZIP archive, not a RimWorld file. ${ACCEPTED}`,
    );
  }
  const prefix = kind === "gzip" ? await gunzipPrefix(bytes, HEADER_BYTES) : bytes;
  return extractFromText(decodeText(prefix), options);
}

/**
 * Read a File header without touching the rest of the file.
 * @param {File | Blob} file
 * @param {{ filename?: string }} [options]
 */
export async function extractFromFile(file, options = {}) {
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const filename = options.filename ?? (typeof File !== "undefined" && file instanceof File ? file.name : undefined);
  return extractFromBytes(head, { ...options, filename });
}
