import {
  findIndexRows,
  findIndexRowsByName,
  findNamespaceSiblings,
  getMetaFor,
  isFresh,
  upsertMeta,
} from "../db/meta";
import type { ListItemRecord, ModMeta, WorkshopIndexRow } from "../types";
import {
  isOfficialPackageId,
  officialContentFor,
  storeUrl as officialStoreUrl,
  workshopUrl as workshopItemUrl,
} from "./official";
import {
  isPlaceholder,
  normalizeName,
  packageNamespace,
  pickByCreator,
  pickByTitle,
  pickCandidate,
} from "./resolve";
import type { SteamClient, SteamDetails } from "./steam";

export interface WorkshopAlternative {
  wid: string;
  name: string | null;
  gameVersions: string[];
}

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
  alternatives: WorkshopAlternative[];
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
    creator: details.creator ?? existing?.creator ?? null,
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

interface TitleResolution {
  widByPackage: Map<string, string>;
  alternatives: Map<string, WorkshopAlternative[]>;
}

/** Map package ids the index does not know to Workshop items by exact title. */
async function resolveByTitle(
  db: D1Database,
  packageIds: string[],
  namesByPackage: Map<string, string | null>,
  gameVersion: string | null,
): Promise<TitleResolution> {
  const widByPackage = new Map<string, string>();
  const alternatives = new Map<string, WorkshopAlternative[]>();
  if (packageIds.length === 0) return { widByPackage, alternatives };

  const titles = packageIds
    .map((packageId) => namesByPackage.get(packageId) ?? null)
    .filter((name): name is string => name !== null && normalizeName(name) !== "");
  if (titles.length === 0) return { widByPackage, alternatives };

  const rowsByTitle = await findIndexRowsByName(db, titles);
  const claims = new Map<string, Set<string>>();
  const picked = new Map<string, WorkshopIndexRow>();

  for (const packageId of packageIds) {
    const title = namesByPackage.get(packageId) ?? null;
    const candidates = title === null ? [] : rowsByTitle.get(title.trim().toLowerCase()) ?? [];
    const match = pickByTitle(candidates, gameVersion);
    if (!match) {
      // Several same-titled items with nothing to separate them: keep them so the
      // page can offer the links instead of guessing.
      if (candidates.length > 1) {
        alternatives.set(
          packageId,
          candidates.slice(0, 6).map((candidate) => ({
            wid: candidate.wid,
            name: candidate.name,
            gameVersions: candidate.gameVersions,
          })),
        );
      }
      continue;
    }
    picked.set(packageId, match);
    const claimants = claims.get(match.wid) ?? new Set<string>();
    claimants.add(packageId);
    claims.set(match.wid, claimants);
  }

  for (const [packageId, match] of picked) {
    if ((claims.get(match.wid)?.size ?? 0) === 1) widByPackage.set(packageId, match.wid);
  }
  return { widByPackage, alternatives };
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

  const unresolvedPackageIds = items
    .filter((item) => !isOfficialPackageId(item.packageId) && item.packageId !== null && !item.steamId)
    .map((item) => item.packageId as string)
    .filter((packageId) => !widByPackage.get(packageId));

  const byTitle = await resolveByTitle(db, unresolvedPackageIds, namesByPackage, options.gameVersion);

  const resolved: Array<{ item: ListItemRecord; wid: string | null; official: boolean }> = items.map(
    (item) => {
      const official = isOfficialPackageId(item.packageId);
      if (official) return { item, wid: null, official };
      if (item.steamId) return { item, wid: item.steamId, official };
      if (item.packageId) {
        const candidate = widByPackage.get(item.packageId) ?? null;
        return {
          item,
          wid: candidate?.wid ?? byTitle.widByPackage.get(item.packageId) ?? null,
          official,
        };
      }
      return { item, wid: null, official };
    },
  );

  // Mods the title step left ambiguous: compare the candidates' Workshop creators
  // with the namespace's already-resolved mods before giving up on them.
  const ambiguous = resolved.filter(
    (entry) =>
      entry.wid === null &&
      !entry.official &&
      entry.item.packageId !== null &&
      byTitle.alternatives.has(entry.item.packageId),
  );
  const namespaces = [
    ...new Set(
      ambiguous
        .map((entry) => packageNamespace(entry.item.packageId))
        .filter((value): value is string => value !== null),
    ),
  ];
  const siblings = namespaces.length > 0 ? await findNamespaceSiblings(db, namespaces) : new Map<string, string[]>();
  const candidateWids = [
    ...new Set(
      ambiguous.flatMap((entry) => (byTitle.alternatives.get(entry.item.packageId as string) ?? []).map((alt) => alt.wid)),
    ),
  ];
  const siblingWids = [...new Set([...siblings.values()].flat())];

  const wids = resolved.map((entry) => entry.wid).filter((wid): wid is string => wid !== null);
  const lookupWids = [...new Set([...wids, ...candidateWids, ...siblingWids])];
  const cached = await getMetaFor(db, lookupWids);

  const stale = lookupWids.filter((wid) => {
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
      try {
        await upsertMeta(db, rows);
      } catch {
        // A cache write failure must not cost the response: the fresh rows are used as-is.
      }
      for (const row of rows) cached.set(row.wid, row);
    }
  }

  const creatorOf = (wid: string) => cached.get(wid)?.creator ?? null;
  const widByCreator = new Map<string, string>();
  for (const entry of ambiguous) {
    const packageId = entry.item.packageId as string;
    const namespace = packageNamespace(packageId);
    const match = pickByCreator(
      (byTitle.alternatives.get(packageId) ?? []).map((alternative) => alternative.wid),
      namespace ? siblings.get(namespace) ?? [] : [],
      creatorOf,
    );
    if (match !== null) widByCreator.set(packageId, match);
  }

  return resolved.map((entry) => {
    const { item, official } = entry;
    const wid = entry.wid ?? (item.packageId ? widByCreator.get(item.packageId) ?? null : null);
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
        alternatives: [],
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
      alternatives:
        wid === null && item.packageId
          ? byTitle.alternatives.get(item.packageId) ?? []
          : [],
    };
  });
}
