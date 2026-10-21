# Design

## Context

See `proposal.md` — Why. This project starts from zero: no code, no schema, no deployment. The design is shaped by four findings from the exploration phase, each verified against live endpoints, real save files, or decompiled RimWorld source.

**1. Save files carry the mod list in their first ~12 KB.**

```
BOM <?xml version="1.0" encoding="utf-8"?>
<savegame>
  <meta>
    <gameVersion>1.7.4976 rev1043</gameVersion>
    <modIds>      <li>brrainz.harmony</li> ... </modIds>
    <modSteamIds> <li>0</li><li>1149640</li> ... </modSteamIds>
    <modNames>    <li>Harmony</li> ... </modNames>
  </meta>
  <game> ...remaining 20+ MB... </game>
</savegame>
```

`ScribeMetaHeaderUtility.WriteMetaHeader()` (`Verse/ScribeMetaHeaderUtility.cs`) writes three parallel, index-aligned lists from `LoadedModManager.RunningMods`, and `GameDataSaveLoader.SaveGame` calls it as the first statement inside the root element. Measured on real saves:

| fixture | total | `<meta>` ends at | meta size | mods |
|---|---|---|---|---|
| 1.3, 135 mods | 20,831,455 B | 11,605 B | 11,549 B (0.055%) | 135 |
| 1.3, same colony later | 21,576,938 B | 11,605 B | 11,549 B | 135 |
| 1.7, new colony | 19,599,794 B | 748 B | 692 B (0.004%) | 7 |

**2. `modIds` is load order, not a set.** `LoadedModManager.InitializeMods()` iterates `ModsConfig.ActiveModsInLoadOrder`, which is `data.activeMods` verbatim (`Verse/ModsConfig.cs`) — no sorting — and appends to `runningMods` in that order. The meta block therefore records the exact order the game used.

**3. The schema is stable across 1.3 → 1.7.** Same four fields in both fixtures, and the 1.6 decompile still writes them. `LoadGameDataHeader` reads `modIds` and `modNames` but not `modSteamIds`, so the Steam-ID list exists for external tools and is intentionally stable.

**4. `modSteamIds` is a hint, not a mapping.** It mixes three meanings:

| value | meaning |
|---|---|
| `0` | locally installed mod |
| `1149640`, `1392840`, `1826140`, `2380740`, `3022790` | official DLC **store app IDs** |
| anything else | Steam Workshop **published file ID** |

Observed fill rates: 3/135 in the 1.3 fixture (2 of those DLC app IDs), 5/7 in the 1.7 fixture (4 of those DLC app IDs). Package IDs can additionally carry a `_steam` suffix (`ModMetaData.SteamModPostfix`) when a Workshop copy coexists with a local copy. So Workshop resolution must still come from an external index.

## Goals / Non-Goals

**Goals:**

- One normalised mod-list model that every supported input maps onto, so downstream code never branches on source format.
- Extraction that runs entirely in the browser and never reads past the header of a save.
- A public page that is fast, legible, link-preview friendly, and honest about what it does and does not validate.
- A cost profile that stays inside Cloudflare's free or near-free tiers for a niche audience.

**Non-Goals:**

- Validating, sorting, or repairing load order. Dependency data (`modDependencies`, `loadAfter`, `loadBefore`) lives in `About.xml` and is absent from every save, `.rml`, and `ModsConfig.xml`. Sorting would require downloading and parsing every mod.
- Creating Steam collections. There is no public API for it; it would require a logged-in session.
- Server-side handling of save files. Accepting the full file would create a privacy and storage problem that local extraction eliminates.
- User accounts, comments, ratings, screenshot uploads, or a public gallery.
- Non-Workshop sources (Nexus, Ludeon forums, GitHub) as metadata providers. They may appear as unresolved mods with their package IDs.

## Decisions

### D1 — Extract mod lists in the browser from a bounded header slice

The client reads the `File` object, takes `file.slice(0, 1 MiB)`, and parses only the meta/`activeMods` region.

```
 File
  |
  +-- sniff first bytes: 0x1f 0x8b -> DecompressionStream('gzip')
  |                      "PK"      -> reject (not a RimWorld file)
  |                      otherwise -> text
  |
  +-- slice(0, 1 MiB) only
  |     |
  |     +-- <savegame>    -> meta/modIds, modSteamIds, modNames, gameVersion
  |     +-- <savedModList>-> meta + modList/ids, names
  |     +-- <ModsConfigData> -> activeMods, knownExpansions, version
  |     +-- not recognised -> actionable error naming the accepted files
  |
  +-- POST ~12 KB { version, mods: [{ packageId, steamId, name }] }
```

*Why:* privacy (the colony never leaves the device), size independence (a 300 MB save costs the same as a 12 KB one), and no request-body or storage limits to engineer around. `DOMParser` in an XML mode does not fetch external entities, and the 1 MiB cap removes the remaining parse-cost risk.

*Alternatives rejected:* uploading the whole save (privacy, R2 staging, 100 MB request ceiling); a server-side streaming XML parser (still requires the bytes to arrive); requiring a desktop companion (install friction, signing, trust).

*Guards:* reject when `</meta>` is not found in the slice, when the parallel lists have different lengths, when `modIds` is empty, and when the save predates package IDs.

### D2 — One container model, four adapters

All inputs normalise to:

```ts
type GameVersion = string;              // "1.7.4976 rev1043"

type RawMod = {
  packageId: string;                    // normalised: lowercase, _steam stripped
  rawPackageId: string;                 // as written in the file
  steamId: string | null;               // null for 0 and for DLC app IDs
  name: string | null;                  // from modNames, when present
  index: number;                        // position in load order
};

type IngestedList = {
  source: 'rws' | 'rml' | 'modsconfig' | 'collection' | 'paste';
  gameVersion: GameVersion | null;
  mods: RawMod[];
  defaultTitle: string | null;          // save/modlist filename, collection name
};
```

Adapters are thin: `rws` and `rml` share the meta parser; `modsconfig` reads `activeMods`; `collection` calls `GetCollectionDetails` and produces package IDs only (workshop IDs, no package IDs).

*Why:* the three file formats already share a meta shape, and the differences are structural, not semantic. One model keeps the enrichment and rendering layers ignorant of provenance.

*Note:* a Steam collection gives Workshop IDs without package IDs, so its adapter fills `steamId` and leaves `packageId` null. The model and the metadata layer must tolerate both directions of resolution.

### D3 — Treat the extracted list as a dated snapshot, not a live config

A published list stores the extracted rows as an immutable snapshot (order, IDs, names, game version), plus a `gameVersion` from the file. Mod metadata is cached separately and refreshed lazily.

*Why:* the promise is "the list this colony was built on", which is historical. Live metadata lets the page show drift ("6 mods no longer support 1.7") without rewriting what the author published. A list built from `ModsConfig.xml` records the current game version at import time and behaves the same way.

*Alternative rejected:* re-reading `ModsConfig.xml` on every page view — impossible, the file is not on the server.

### D4 — Resolve package IDs to Workshop IDs through an imported RimSort index

Import `RimSort/Steam-Workshop-Database` (`steamDB.json`, ~48 MB) into D1 as `workshop_mods`, keyed by Workshop ID, with a unique index on `(package_id, game_version)`.

Measured coverage of the snapshot inspected:

```
57,673 workshop entries
39,034 have no packageId            (pre-1.1 mods, mostly dead)
10,781 tagged 1.6 -> 10,780 with a packageId
 8,641 tagged 1.5 ->  8,640 with a packageId
   155 packageIds claimed by more than one Workshop item
 1,621 entries share the junk packageId "scenario.rsc"
```

*Why:* there is no Steam API that maps package ID to Workshop ID, and the community index already solves it for every modern mod.

*Resolution rules:* prefer an exact package-ID match; break ties by the save's game version, then by `modNames` similarity; never trust `scenario.rsc`, `missing.packageid`, or `invalid.item`; strip `_steam` before lookup; treat a nonzero `modSteamIds` value as authoritative when it is not a DLC app ID.

*Alternatives rejected:* scraping Workshop search (brittle, no package IDs in page metadata); reading `About.xml` (requires downloading every mod); maintaining our own index from scratch (duplicated effort, cold start).

### D5 — Enrich with the public Steam endpoints, cache-first

`ISteamRemoteStorage/GetPublishedFileDetails` (POST, no API key, batched) provides title, description, thumbnail URL, file size, subscriber count, views, tags, created/updated timestamps, creator. `GetCollectionDetails` resolves collection URLs.

Verified response shape for Harmony (`2009463077`): 3.3M subscribers, 8.3 MB, thumbnail on `images.steamusercontent.com`, tags `Mod, 1.7, 1.6, ...`.

*Policy:* read from D1 first; fetch only missing or stale rows (older than a configurable window, e.g. 7 days); write results back; never block page rendering on a Steam call; time out and fall back to the stored name from `modNames` or the index. Batch IDs in chunks of 100.

*Why:* the endpoint is unauthenticated and reliable, but it is the only external dependency that can make a page request slow.

*Alternatives rejected:* proxying thumbnails through Cloudflare Images (paid add-on, no first-order benefit); nightly full refresh of every known mod (wasteful, tens of thousands of IDs).

### D6 — D1 for state, R2 for generated previews, no KV

```sql
lists        (id TEXT PK, slug TEXT, title TEXT, source TEXT, game_version TEXT,
              edit_token_hash TEXT, visibility TEXT, created_at INT, updated_at INT)
list_items   (list_id TEXT, position INT, package_id TEXT, steam_id TEXT,
              name TEXT, note TEXT, hidden INT,
              PRIMARY KEY (list_id, position))
workshop_mods(wid TEXT PK, package_id TEXT, name TEXT, authors TEXT,
              game_versions TEXT, imported_at INT)
mod_meta     (wid TEXT PK, title TEXT, thumb TEXT, file_size INT, subs INT,
              updated_at INT, fetched_at INT)
```

Small integers and strings only; no colony data, no raw files. R2 stores `og/<list-id>-<updated_at>.webp`.

*Why:* D1 gives SQL and indexes for the reverse lookup and for future browsing; R2 has no egress cost for preview images. KV adds a second consistency model for no benefit at this scale.

*Alternative rejected:* SQLite in a Durable Object (more moving parts than the workload needs); D1 for images (wrong tool).

### D7 — Anonymous publishing with a hashed edit token; unlisted by default

Creating a list returns an unguessable list ID plus a one-time edit token. Only `sha256(token)` is stored. The token is shown once and set as an `httpOnly` cookie on the creating device; the page offers an explicit "save this link to edit later" step because cookies are not durable.

Visibility is `unlisted` by default: the page is reachable by URL, not listed or indexed. `noindex` is sent for unlisted pages. There is no public gallery in the first version.

*Why:* account creation is the largest drop-off in the funnel, and a mod list carries no identity requirement. The token model is the smallest thing that supports editing.

*Alternatives rejected:* Steam OpenID (right eventually, to let authors claim a list and import subscriptions, but not needed for the core loop); email magic links (infrastructure and deliverability for no MVP gain); fully immutable pages (users always want to fix a typo or hide a mod).

### D8 — Server-render the page; hotlink thumbnails; generate preview images on demand

The Worker renders HTML for `/l/<id>-<slug>`. Mod thumbnails are hotlinked from `images.steamusercontent.com` with `loading="lazy"`; they are not proxied.

Link previews use a generated image (`satori` layout → `resvg-wasm` → WebP), cached in R2 and regenerated when `lists.updated_at` changes. The card carries the list title, mod count, game version, and total size.

*Why:* server rendering keeps the page usable without JavaScript and gives crawlers real HTML. Hotlinking avoids a paid image pipeline. A generated preview is the distribution mechanism for Discord and Reddit, so it is part of the MVP, not polish.

### D9 — Slug from the title, ID remains authoritative

URL shape: `/l/<opaque-id>/<slug>`. The ID resolves the page; the slug is decorative and redirects to the canonical form if it drifts. Titles are user-supplied and must be sanitised and length-capped.

*Why:* links survive renaming, and the URL still reads well when pasted.

## Risks / Trade-offs

- **Steam API latency or outage** → cache-first reads, short timeouts, render with stored names; a page never fails because Steam is slow.
- **RimSort dataset staleness or abandonment** → store the import date, display it, and fall back to `modSteamIds` and unresolved-by-name states; importing is a batch job that can be re-run.
- **Package-ID collisions** (155 ambiguous IDs, forks, reuploads) → deterministic tie-break by game version then name similarity, and show both candidates when unresolved rather than guessing silently.
- **DLC app IDs misread as Workshop IDs** → explicit `ludeon.*` / known-app-ID check before any Workshop URL is built.
- **Legacy saves without package IDs** → reject with a clear message pointing at `ModsConfig.xml` or `.rml`; do not invent IDs.
- **Users cannot find the file** → the hardest remaining UX problem. Mitigate with per-OS copyable paths, acceptance of the game's own `.rml` export, and drag-and-drop for all three formats.
- **Abuse and spam** → unlisted pages, `noindex`, rate limiting per IP, Turnstile on creation once traffic justifies it, and a delete path.
- **NSFW or offensive Workshop content appears on a page** → per-page flag, no gallery, and a report route; do not attempt automated classification.
- **Cloudflare Worker limits** (subrequests, CPU) → batched Steam calls, enrichment outside the render path, header-only parsing keeps CPU negligible.
- **Legal/ToS** → display Steam metadata with attribution and outbound links to the Workshop page; do not mirror descriptions wholesale beyond what the card needs; respect the RimSort dataset's licence and attribution requirements.

## Migration Plan

Greenfield, so there is no data migration.

1. Provision D1, apply the schema, import `steamDB.json`, verify a known list of ~50 package IDs resolves end-to-end.
2. Deploy the Worker with static assets to a preview URL; validate each ingestion format against the three save fixtures and a real `ModsConfig.xml`.
3. Seed one hand-made list, verify rendering, edit-token flow, and preview-image output.
4. Promote to production; keep the previous Worker version for rollback, and make the `steamDB` import idempotent so it can be re-run or rolled back by re-import.

## Resolved Decisions

Settled during the proposal review; these constrain the specs.

1. **Default ingestion prompt — save first, `.rml` secondary.** All four inputs are accepted. The create flow leads with a save because a save always exists and carries a dated game version; users who have used the in-game "Save mod list" button are offered the `.rml` export as the cleaner alternative. `ModsConfig.xml` and collection URLs are accepted without being promoted.
2. **Curation depth — notes and hiding, no sections.** `list_items` carries an optional note and a hidden flag. There is no section grouping, no drag-to-reorder, and no per-item custom ordering beyond the extracted load order.
3. **Visibility — unlisted only.** No gallery, no browse page, no listing. Pages send `noindex` and are reachable only by URL.
4. **Abuse gate — rate limiting only.** Creation is rate limited per client. No Turnstile in the first version; it is added only if spam appears.

## Open Questions

- Maximum supported mod count per list (practical cap for page size and preview rendering; the model itself has no limit).
- Whether the parsed `modNames` should be shown when the Workshop title differs (e.g. localised names) or used only as a fallback.
