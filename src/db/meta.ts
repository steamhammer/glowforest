import type { ModMeta, WorkshopIndexRow } from "../types";

type Row = Record<string, unknown>;

function parseVersions(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function toMeta(row: Row): ModMeta {
  return {
    wid: String(row.wid),
    title: row.title === null ? null : String(row.title),
    authors: row.authors === null ? null : String(row.authors),
    thumb: row.thumb === null ? null : String(row.thumb),
    description: row.description === null ? null : String(row.description),
    fileSize: row.file_size === null ? null : Number(row.file_size),
    subs: row.subs === null ? null : Number(row.subs),
    gameVersions: parseVersions(row.game_versions),
    updatedAt: row.updated_at === null ? null : Number(row.updated_at),
    fetchedAt: Number(row.fetched_at),
  };
}

function chunks<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

export async function getMetaFor(
  db: D1Database,
  wids: string[],
): Promise<Map<string, ModMeta>> {
  const found = new Map<string, ModMeta>();
  for (const chunk of chunks([...new Set(wids)], 90)) {
    const placeholders = chunk.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT * FROM mod_meta WHERE wid IN (${placeholders})`)
      .bind(...chunk)
      .all<Row>();
    for (const row of results ?? []) {
      const meta = toMeta(row);
      found.set(meta.wid, meta);
    }
  }
  return found;
}

export function isFresh(meta: ModMeta, now: number, windowSeconds: number): boolean {
  return meta.fetchedAt + windowSeconds > now;
}

export async function upsertMeta(db: D1Database, rows: ModMeta[]): Promise<void> {
  for (const chunk of chunks(rows, 50)) {
    await db.batch(
      chunk.map((row) =>
        db
          .prepare(
            `INSERT INTO mod_meta (wid, title, authors, thumb, description, file_size, subs, game_versions, updated_at, fetched_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(wid) DO UPDATE SET
               title = excluded.title,
               authors = excluded.authors,
               thumb = excluded.thumb,
               description = excluded.description,
               file_size = excluded.file_size,
               subs = excluded.subs,
               game_versions = excluded.game_versions,
               updated_at = excluded.updated_at,
               fetched_at = excluded.fetched_at`,
          )
          .bind(
            row.wid,
            row.title,
            row.authors,
            row.thumb,
            row.description,
            row.fileSize,
            row.subs,
            JSON.stringify(row.gameVersions),
            row.updatedAt,
            row.fetchedAt,
          ),
      ),
    );
  }
}

function toIndexRow(row: Row): WorkshopIndexRow {
  return {
    wid: String(row.wid),
    packageId: row.package_id === null ? null : String(row.package_id),
    name: row.name === null ? null : String(row.name),
    authors: row.authors === null ? null : String(row.authors),
    gameVersions: parseVersions(row.game_versions),
  };
}

export async function findIndexRows(
  db: D1Database,
  packageIds: string[],
): Promise<Map<string, WorkshopIndexRow[]>> {
  const byPackage = new Map<string, WorkshopIndexRow[]>();
  for (const chunk of chunks([...new Set(packageIds)], 90)) {
    const placeholders = chunk.map(() => "?").join(",");
    const { results } = await db
      .prepare(
        `SELECT * FROM workshop_mods WHERE package_id IN (${placeholders})`,
      )
      .bind(...chunk)
      .all<Row>();
    for (const row of results ?? []) {
      const entry = toIndexRow(row);
      if (entry.packageId === null) continue;
      const list = byPackage.get(entry.packageId) ?? [];
      list.push(entry);
      byPackage.set(entry.packageId, list);
    }
  }
  return byPackage;
}

export interface IndexImportRow {
  wid: string;
  packageId: string | null;
  name: string | null;
  authors: string | null;
  gameVersions: string[];
}

/** Idempotent: rows are keyed by Workshop id, so a repeat import leaves counts unchanged. */
export async function importIndexRows(
  db: D1Database,
  rows: IndexImportRow[],
  importedAt: number,
): Promise<number> {
  let written = 0;
  for (const chunk of chunks(rows, 50)) {
    await db.batch(
      chunk.map((row) =>
        db
          .prepare(
            `INSERT INTO workshop_mods (wid, package_id, name, authors, game_versions, imported_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(wid) DO UPDATE SET
               package_id = excluded.package_id,
               name = excluded.name,
               authors = excluded.authors,
               game_versions = excluded.game_versions,
               imported_at = excluded.imported_at`,
          )
          .bind(
            row.wid,
            row.packageId,
            row.name,
            row.authors,
            JSON.stringify(row.gameVersions),
            importedAt,
          ),
      ),
    );
    written += chunk.length;
  }
  return written;
}

export async function countIndexRows(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM workshop_mods`).first<{ n: number }>();
  return Number(row?.n ?? 0);
}
