## Why

The community index only knows a package identifier for the mods it has inspected: 18,639 of 57,673 entries carry one. Every other Workshop item is stored with its name and supported game versions but no package identifier, so a mod that is otherwise perfectly identifiable stays "unresolved" on the page. In the current production lists this affects 17 distinct mods, for example `crows.dustbunny` ("Dust Bunnies", Workshop 3480725900), whose own Workshop page does not state its package identifier either.

## What Changes

- Resolve a mod whose package identifier is missing from the index by exact title match against index rows that carry no package identifier, when that match is unique.
- When several index rows share the title, accept the match only if exactly one of them supports the list's game version.
- Leave the mod unresolved when the title match is still ambiguous, and never use an index row that already belongs to another package identifier.
- Stop an index re-import from erasing a package identifier or other stored values that the incoming dataset leaves empty, so curated and previously learned mappings survive refreshes.
- Treat a metadata cache write failure as non-fatal: the page renders from freshly fetched data instead of failing.

## Impact

- Affected specs: `mod-metadata`
- Affected code: `src/db/meta.ts`, `src/metadata/resolve.ts`, `src/metadata/enrich.ts`, `docs/operations.md`
