import type { ListItemRecord, ListRecord, ListSource, RawMod } from "../types";

type Row = Record<string, unknown>;

function toList(row: Row): ListRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    source: String(row.source) as ListSource,
    gameVersion: row.game_version === null ? null : String(row.game_version),
    visibility: String(row.visibility),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function toItem(row: Row): ListItemRecord {
  return {
    listId: String(row.list_id),
    position: Number(row.position),
    packageId: row.package_id === null ? null : String(row.package_id),
    steamId: row.steam_id === null ? null : String(row.steam_id),
    name: row.name === null ? null : String(row.name),
    note: row.note === null ? null : String(row.note),
    hidden: Number(row.hidden) === 1,
  };
}

export interface CreateListInput {
  id: string;
  slug: string;
  title: string;
  source: ListSource;
  gameVersion: string | null;
  tokenHash: string;
  now: number;
}

export async function createList(
  db: D1Database,
  input: CreateListInput,
  mods: RawMod[],
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO lists (id, slug, title, source, game_version, edit_token_hash, visibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'unlisted', ?, ?)`,
    )
    .bind(
      input.id,
      input.slug,
      input.title,
      input.source,
      input.gameVersion,
      input.tokenHash,
      input.now,
      input.now,
    )
    .run();

  // Chunked so a 1,000-mod list never becomes one oversized batch.
  for (let offset = 0; offset < mods.length; offset += 50) {
    const chunk = mods.slice(offset, offset + 50);
    await db.batch(
      chunk.map((mod) =>
        db
          .prepare(
            `INSERT INTO list_items (list_id, position, package_id, steam_id, name, note, hidden)
             VALUES (?, ?, ?, ?, ?, NULL, 0)`,
          )
          .bind(input.id, mod.index, mod.packageId, mod.steamId, mod.name),
      ),
    );
  }
}

export async function getList(db: D1Database, id: string): Promise<ListRecord | null> {
  const row = await db.prepare(`SELECT * FROM lists WHERE id = ?`).bind(id).first<Row>();
  return row ? toList(row) : null;
}

export async function getItems(db: D1Database, listId: string): Promise<ListItemRecord[]> {
  const { results } = await db
    .prepare(`SELECT * FROM list_items WHERE list_id = ? ORDER BY position ASC`)
    .bind(listId)
    .all<Row>();
  return (results ?? []).map(toItem);
}

export async function getEditTokenHash(db: D1Database, id: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT edit_token_hash FROM lists WHERE id = ?`)
    .bind(id)
    .first<{ edit_token_hash: string }>();
  return row?.edit_token_hash ?? null;
}

export async function updateTitle(
  db: D1Database,
  id: string,
  title: string,
  slug: string,
  now: number,
): Promise<void> {
  await db
    .prepare(`UPDATE lists SET title = ?, slug = ?, updated_at = ? WHERE id = ?`)
    .bind(title, slug, now, id)
    .run();
}

export async function updateItem(
  db: D1Database,
  listId: string,
  position: number,
  changes: { note?: string | null; hidden?: boolean },
  now: number,
): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (changes.note !== undefined) {
    sets.push("note = ?");
    values.push(changes.note);
  }
  if (changes.hidden !== undefined) {
    sets.push("hidden = ?");
    values.push(changes.hidden ? 1 : 0);
  }
  if (sets.length === 0) return true;

  const result = await db
    .prepare(`UPDATE list_items SET ${sets.join(", ")} WHERE list_id = ? AND position = ?`)
    .bind(...values, listId, position)
    .run();
  if (!result.meta.changes) return false;

  await db.prepare(`UPDATE lists SET updated_at = ? WHERE id = ?`).bind(now, listId).run();
  return true;
}

export async function deleteList(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM list_items WHERE list_id = ?`).bind(id),
    db.prepare(`DELETE FROM lists WHERE id = ?`).bind(id),
  ]);
}
