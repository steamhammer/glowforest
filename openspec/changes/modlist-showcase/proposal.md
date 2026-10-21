# Proposal

## Why

RimWorld players share mod lists constantly — in Discord, on Reddit, in bug reports — but there is no durable, readable place to put one. Today a list is a wall of Workshop links, a screenshot of the mods screen, or a `.rws` file someone has to download and load to understand. Existing tools (RimSort, RimPy, JudgeMyList, RimLists) are local utilities: they sort, validate, or export, but none produce a shareable page.

At the same time the data needed to build that page is now available without scraping: Steam's public `GetPublishedFileDetails` endpoint needs no API key, and the RimSort community database maps `packageId` to Workshop IDs with near-complete coverage for 1.5+ mods. The barrier is no longer data — it is getting a player's mod list out of their machine and turning it into something worth linking to.

## What Changes

- A web application on Cloudflare that accepts a RimWorld mod list in whatever form the player already has it: `ModsConfig.xml`, a game-exported `.rml`, a `.rws` save, or a Steam Workshop collection URL.
- Extraction of the mod list happens **in the browser**, from the header of the file only. The colony body of a save is never read, transmitted, or stored.
- Enrichment of each mod with Workshop metadata (title, author, thumbnail, file size, subscriber count, last update, supported game versions) through the Steam Web API, cached and refreshed lazily.
- A published showcase page at a stable, shareable URL, showing the mod list in load order with grouping, per-mod notes, aggregate stats, and version-drift warnings.
- Publishing requires no account: a page is created anonymously and edited with a secret edit token. Pages are unlisted by default.
- Discord/Reddit-friendly link previews generated as images and cached at the edge.

## Capabilities

### New Capabilities

- `modlist-ingestion`: accepting a mod list from each supported source format and normalising it into one ordered model of package IDs, Steam IDs, names, and game version.
- `mod-metadata`: resolving package IDs to Workshop items and maintaining cached Steam metadata for them.
- `list-publishing`: creating, editing, and controlling the visibility of a published list without user accounts.
- `list-showcase`: rendering a published list as a public page, including load order, grouping, notes, stats, and link previews.

### Modified Capabilities

None — this is the project's first change.

## Impact

New Cloudflare application; no existing code or APIs are affected.

- Cloudflare Workers with static assets serves both the application and the public pages.
- D1 stores lists, list items, cached mod metadata, and the package-ID index.
- R2 stores generated link-preview images.
- Outbound dependency on `api.steampowered.com` (public Workshop endpoints) and on the RimSort `Steam-Workshop-Database` dataset, which must be imported and refreshed.
- No Steam, Discord, or Cloudflare account integration in the first version; no server-side handling of save files.

## Decisions Settled Before Specs

- Save is the primary ingestion prompt; the game's `.rml` export is the secondary path. `ModsConfig.xml` and collection URLs are accepted too.
- Curation is limited to per-mod notes and hiding mods. No sections, no reordering.
- Lists are unlisted only. No gallery.
- Creation is rate limited; no challenge step at launch.
