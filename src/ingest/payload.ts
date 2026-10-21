import type { IngestedList, ListSource, RawMod } from "../types";

const SOURCES: ReadonlySet<ListSource> = new Set([
  "rws",
  "rml",
  "modsconfig",
  "collection",
  "paste",
]);

export const MAX_MODS = 1000;
export const MAX_TITLE = 120;
export const MAX_NOTE = 1000;

export class PayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadError";
  }
}

function asString(value: unknown, field: string, max = 512): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new PayloadError(`${field} must be a string or null`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new PayloadError(`${field} is too long`);
  return trimmed.length === 0 ? null : trimmed;
}

function parseMod(value: unknown, index: number): RawMod {
  if (typeof value !== "object" || value === null) {
    throw new PayloadError(`mods[${index}] must be an object`);
  }
  const record = value as Record<string, unknown>;
  const packageId = asString(record.packageId, `mods[${index}].packageId`, 200)?.toLowerCase() ?? null;
  const steamId = asString(record.steamId, `mods[${index}].steamId`, 32);
  if (steamId !== null && !/^\d+$/.test(steamId)) {
    throw new PayloadError(`mods[${index}].steamId must be numeric`);
  }
  if (packageId === null && steamId === null) {
    throw new PayloadError(`mods[${index}] needs a packageId or a steamId`);
  }
  return {
    packageId,
    rawPackageId: asString(record.rawPackageId, `mods[${index}].rawPackageId`, 200) ?? packageId,
    steamId,
    name: asString(record.name, `mods[${index}].name`, 300),
    index,
  };
}

/** Validate and normalise the browser-extracted payload. */
export function parseIngestedPayload(body: unknown): IngestedList {
  if (typeof body !== "object" || body === null) throw new PayloadError("body must be an object");
  const record = body as Record<string, unknown>;

  const source = record.source;
  if (typeof source !== "string" || !SOURCES.has(source as ListSource)) {
    throw new PayloadError("source is not a recognised mod-list source");
  }

  const mods = record.mods;
  if (!Array.isArray(mods)) throw new PayloadError("mods must be an array");
  if (mods.length === 0) throw new PayloadError("the list contains no mods");
  if (mods.length > MAX_MODS) throw new PayloadError(`lists are limited to ${MAX_MODS} mods`);

  const gameVersion = asString(record.gameVersion, "gameVersion", 60);
  const defaultTitle = asString(record.defaultTitle, "defaultTitle", MAX_TITLE);

  return {
    source: source as ListSource,
    gameVersion,
    mods: mods.map(parseMod),
    defaultTitle,
  };
}

export function cleanTitle(input: unknown, fallback: string): string {
  const title = typeof input === "string" ? input.trim() : "";
  const chosen = title.length > 0 ? title : fallback;
  return chosen.slice(0, MAX_TITLE) || "Untitled mod list";
}

export function cleanNote(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") throw new PayloadError("note must be a string");
  const note = input.trim().slice(0, MAX_NOTE);
  return note.length === 0 ? null : note;
}
