import type { EnrichedItem } from "../metadata/enrich";
import { majorMinor } from "../metadata/resolve";

export type SupportStatus = "official" | "ok" | "unsupported" | "unknown";

export function supportStatus(item: EnrichedItem, listVersion: string | null): SupportStatus {
  if (item.official) return "official";
  const wanted = majorMinor(listVersion);
  if (wanted === null) return "unknown";
  if (item.gameVersions.length === 0) return "unknown";
  return item.gameVersions.includes(wanted) ? "ok" : "unsupported";
}

export interface ListStats {
  modCount: number;
  totalBytes: number;
  knownBytes: number;
  unsupported: number;
  unknownVersion: number;
  gameVersion: string | null;
}

export function summarise(items: EnrichedItem[], gameVersion: string | null): ListStats {
  const visible = items.filter((item) => !item.hidden);
  let totalBytes = 0;
  let knownBytes = 0;
  let unsupported = 0;
  let unknownVersion = 0;

  for (const item of visible) {
    if (item.fileSize !== null) {
      totalBytes += item.fileSize;
      knownBytes += 1;
    }
    const status = supportStatus(item, gameVersion);
    if (status === "unsupported") unsupported += 1;
    if (status === "unknown") unknownVersion += 1;
  }

  return {
    modCount: visible.length,
    totalBytes,
    knownBytes,
    unsupported,
    unknownVersion,
    gameVersion,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const rounded = value >= 10 || unit === 0 ? Math.round(value).toString() : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

export function formatDate(epochSeconds: number | null): string | null {
  if (epochSeconds === null || epochSeconds <= 0) return null;
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}
