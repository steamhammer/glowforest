## Why

When two Workshop items share a title and neither the list's game version nor the recorded name can separate them, the page stays unresolved even though the author is knowable. A RimWorld package id carries a namespace (`crows.dustbunny` → `crows`), and other mods from that namespace are already resolved in the index; Steam reports the numeric creator of every item anonymously, so the candidate owned by the same creator as a namespace sibling is the right one. For Dust Bunnies the two candidates have different creators and only 3480725900 shares the creator of `crows.medievaltransport`.

This avoids a Steam Web API key: listing an author's items would need one, but comparing creators of candidates we already have does not.

## What Changes

- Request the Workshop `creator` with the metadata that is already fetched, and cache it beside the rest of the metadata.
- When a title match stays ambiguous, look up the package id's namespace siblings in the index, compare creators, and resolve only when exactly one candidate is owned by a creator seen among those siblings.
- Keep the mod unresolved, with its candidate links, when the comparison is inconclusive.

## Impact

- Affected specs: `mod-metadata`
- Affected code: `src/metadata/steam.ts`, `src/metadata/enrich.ts`, `src/metadata/resolve.ts`, `src/db/meta.ts`, `src/types.ts`, `migrations/0002_mod_meta_creator.sql`
