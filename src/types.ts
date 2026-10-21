export type ListSource = "rws" | "rml" | "modsconfig" | "collection" | "paste";

export interface RawMod {
  /** Normalised identifier, or null when only a Workshop identity is known. */
  packageId: string | null;
  /** The identifier exactly as the source recorded it. */
  rawPackageId: string | null;
  /** Workshop published-file ID. Null for local-only mods and official content. */
  steamId: string | null;
  /** Display name recorded by the game, when the source provides one. */
  name: string | null;
  /** Position in the recorded load order. */
  index: number;
}

export interface IngestedList {
  source: ListSource;
  gameVersion: string | null;
  mods: RawMod[];
  defaultTitle: string | null;
}

export interface ListRecord {
  id: string;
  slug: string;
  title: string;
  source: ListSource;
  gameVersion: string | null;
  visibility: string;
  createdAt: number;
  updatedAt: number;
}

export interface ListItemRecord {
  listId: string;
  position: number;
  packageId: string | null;
  steamId: string | null;
  name: string | null;
  note: string | null;
  hidden: boolean;
}

export interface WorkshopIndexRow {
  wid: string;
  packageId: string | null;
  name: string | null;
  authors: string | null;
  gameVersions: string[];
}

export interface ModMeta {
  wid: string;
  creator: string | null;
  title: string | null;
  authors: string | null;
  thumb: string | null;
  description: string | null;
  fileSize: number | null;
  subs: number | null;
  gameVersions: string[];
  updatedAt: number | null;
  fetchedAt: number;
}
