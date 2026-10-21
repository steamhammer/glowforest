import { findIndexRows, getMetaFor, isFresh, upsertMeta } from "../db/meta";
import type { ListItemRecord, ModMeta, WorkshopIndexRow } from "../types";
import {
  isOfficialPackageId,
  officialContentFor,
  storeUrl as officialStoreUrl,
  workshopUrl as workshopItemUrl,
} from "./official";
import { isPlaceholder, pickCandidate } from "./resolve";
import type { SteamClient, SteamDetails } from "./steam";

export interface EnrichedItem {
  position: number;
  packageId: string | null;
  steamId: string | null;
  recordedName: string | null;
  note: string | null;
  hidden: boolean;
  official: boolean;
  unresolved: boolean;
  wid: string | null;
  title: string;
  authors: string | null;
  thumb: string | null;
  fileSize: number | null;
  subs: number | null;
  gameVersions: string[];
  updatedAt: number | null;
  workshopUrl: string | null;
  storeUrl: string | null;
}

export interface EnrichOptions {
  gameVersion: string | null;
  steam: SteamClient | null;
  now: number;
  freshnessSeconds: number;
}

function mergeDetails(
  details: SteamDetails,
  existing: ModMeta | undefined,
  authorsByWid: Map<string, string | null>,
  now: number,
): ModMeta {
  const authors = authorsByWid.get(details.wid) ?? existing?.authors ?? null;
  return {
    wid: details.wid,
    title: details.title ?? existing?.title ?? null,
    authors,
    thumb: details.thumb ?? existing?.thumb ?? null,
    description: details.description ?? existing?.description ?? null,
    fileSize: details.fileSize ?? existing?.fileSize ?? null,
    subs: details.subs ?? existing?.subs ?? null,
    gameVersions:
      details.gameVersions.length > 0 ? details.gameVersions : (existing?.gameVersions ?? []),
    updatedAt: details.updatedAt ?? existing?.updatedAt ?? null,
    fetchedAt: now,
  };
}

export async function enrichItems(
  db: D1Database,
  items: ListItemRecord[],
  options: EnrichOptions,
): Promise<EnrichedItem[]> {
  const packageIds = items
    .map((item) => item.packageId)
    .filter((value): value is string => value !== null && !isPlaceholder(value));

  const indexRows = await findIndexRows(db, packageIds);
  const namesByPackage = new Map<string, string | null>();
  for (const item of items) {
    if (item.packageId && !namesByPackage.has(item.packageId)) {
      namesByPackage.set(item.packageId, item.name);
    }
  }

  const authorsByWid = new Map<string, string | null>();
  const widByPackage = new Map<string, WorkshopIndexRow | null>();
  for (const [packageId, candidates] of indexRows) {
    for (const candidate of candidates) authorsByWid.set(candidate.wid, candidate.authors);
    widByPackage.set(
      packageId,
      pickCandidate(candidates, {
        gameVersion: options.gameVersion,
        name: namesByPackage.get(packageId) ?? null,
      }),
    );
  }

  const resolved: Array<{ item: ListItemRecord; wid: string | null; official: boolean }> = items.map(
    (item) => {
      const official = isOfficialPackageId(item.packageId);
      if (official) return { item, wid: null, official };
      if (item.steamId) return { item, wid: item.steamId, official };
      if (item.packageId) {
        const candidate = widByPackage.get(item.packageId) ?? null;
        return { item, wid: candidate?.wid ?? null, official };
      }
      return { item, wid: null, official };
    },
  );

  const wids = resolved.map((entry) => entry.wid).filter((wid): wid is string => wid !== null);
  const cached = await getMetaFor(db, wids);

  const stale = wids.filter((wid) => {
    const meta = cached.get(wid);
    return !meta || !isFresh(meta, options.now, options.freshnessSeconds);
  });

  if (options.steam && stale.length > 0) {
    let details: SteamDetails[] = [];
    try {
      details = await options.steam.getDetails(stale);
    } catch {
      // A Steam failure never breaks rendering; cached or recorded names stand in.
      details = [];
    }
    if (details.length > 0) {
      const rows = details.map((detail) =>
        mergeDetails(detail, cached.get(detail.wid), authorsByWid, options.now),
      );
      await upsertMeta(db, rows);
      for (const row of rows) cached.set(row.wid, row);
    }
  }

  return resolved.map(({ item, wid, official }) => {
    const meta = wid ? cached.get(wid) ?? null : null;

    if (official) {
      const content = officialContentFor(item.packageId);
      return {
        position: item.position,
        packageId: item.packageId,
        steamId: null,
        recordedName: item.name,
        note: item.note,
        hidden: item.hidden,
        official: true,
        unresolved: false,
        wid: null,
        title: content?.name ?? item.name ?? item.packageId ?? "Official content",
        authors: "Ludeon Studios",
        thumb: null,
        fileSize: null,
        subs: null,
        gameVersions: [],
        updatedAt: null,
        workshopUrl: null,
        storeUrl: content ? officialStoreUrl(content.appId) : null,
      };
    }

    const title = meta?.title ?? item.name ?? item.packageId ?? "Unknown mod";
    return {
      position: item.position,
      packageId: item.packageId,
      steamId: wid,
      recordedName: item.name,
      note: item.note,
      hidden: item.hidden,
      official: false,
      unresolved: wid === null,
      wid,
      title,
      authors: meta?.authors ?? (wid ? authorsByWid.get(wid) ?? null : null),
      thumb: meta?.thumb ?? null,
      fileSize: meta?.fileSize ?? null,
      subs: meta?.subs ?? null,
      gameVersions: meta?.gameVersions ?? [],
      updatedAt: meta?.updatedAt ?? null,
      workshopUrl: wid && meta ? workshopItemUrl(wid) : null,
      storeUrl: null,
    };
  });
}
