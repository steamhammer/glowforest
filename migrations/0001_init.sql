-- Lists, their items, the community package index, and cached Steam metadata.
-- See openspec/changes/modlist-showcase/design.md D6.
-- Rollback: DROP TABLE mod_meta; DROP TABLE workshop_mods; DROP TABLE list_items;
--           DROP TABLE lists; DROP TABLE rate_limits;

CREATE TABLE lists (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  game_version TEXT,
  edit_token_hash TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'unlisted',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE list_items (
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  package_id TEXT,
  steam_id TEXT,
  name TEXT,
  note TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (list_id, position)
);

CREATE TABLE workshop_mods (
  wid TEXT PRIMARY KEY,
  package_id TEXT,
  name TEXT,
  authors TEXT,
  game_versions TEXT,
  imported_at INTEGER NOT NULL
);

CREATE INDEX idx_workshop_mods_package_id ON workshop_mods (package_id);

CREATE TABLE mod_meta (
  wid TEXT PRIMARY KEY,
  title TEXT,
  authors TEXT,
  thumb TEXT,
  description TEXT,
  file_size INTEGER,
  subs INTEGER,
  game_versions TEXT,
  updated_at INTEGER,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
