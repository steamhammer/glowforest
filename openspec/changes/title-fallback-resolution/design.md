## Context

`workshop_mods` is imported from the RimSort Steam-Workshop-Database dataset, which only records a `packageId` for entries whose mod files it has inspected (18,639 of 57,673). Saves and `ModsConfig.xml` carry package identifiers but no Workshop ids, so for entries missing a package identifier there is no join key at all and the item renders unresolved even though the Workshop item exists.

Two paths could recover these: title matching, which is only safe when it is unique, and manual curation, which needs the package identifier to be handed to us. Title matching handles the bulk of the current gap, so it becomes the automatic path, with curation kept as an escape hatch through the existing index import.

## Goals / Non-Goals

**Goals:**
- Resolve mods whose index entry lacks a package identifier when the title match is unambiguous.
- Never attach a Workshop item on a guess.
- Keep curated mappings stable across dataset refreshes.
- Keep page rendering independent of metadata cache writes.

**Non-Goals:**
- Fetching mod files or Steam credentials to extract identifiers upstream.
- Fuzzy matching, similarity thresholds, or author-name heuristics.
- Rewriting the import pipeline or the dataset's schema.

## Decisions

**Match titles in SQL, decide in TypeScript.** `findIndexRowsByName` selects index rows with `package_id IS NULL` and a normalized title in the requested set; `pickByTitle` then applies the uniqueness rule. Keeping the decision in one pure function makes the ambiguity policy testable without a database.

**Ambiguity resolves only by game version.** Two entries titled "Dust Bunnies" exist, tagged 1.1–1.3 and 1.5–1.6; the list runs 1.5, so the version tag decides. Beyond that one signal the system stays silent instead of falling back to lowest Workshop id, which would silently pick a 2021 mod for a 2025 list.

**No poaching of indexed entries.** Only rows with a null package identifier are candidates. Otherwise a mod missing from the index could steal the Workshop item of a different mod that shares its title.

**Imports merge instead of overwrite.** The upsert uses `COALESCE` for the package identifier, name, and authors, and keeps stored game versions when the incoming list is empty. This makes re-imports safe and lets an operator add a mapping by importing a single row.

**Metadata writes are best-effort.** Rendering already tolerates a Steam failure; it now tolerates a D1 write failure too, using the fetched values for the response. Without this, an exhausted write quota would turn any page with a newly resolvable mod into a 500.

## Risks / Trade-offs

- **A title match can still be wrong** when two separate Workshop items share a title and only one is version-tagged — mitigated by requiring uniqueness on version tags as well; the residual risk is a mod whose version tag is stale upstream.
- **Index refreshes can overwrite curated names** — mitigated by the merge upsert, which keeps known values when the dataset is silent.
- **Extra query per page** — one additional D1 read keyed by title, only for items that the identifier lookup missed.

## Migration Plan

No schema change. Deploy, then re-check the production lists: the affected mods should resolve, and no mod that previously resolved should change identity. Rollback is the previous Worker version; index data is unchanged.
