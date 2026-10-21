## Context

`title-fallback-resolution` resolves mods whose index entry lacks a package id by exact title, and leaves genuinely ambiguous titles unresolved with the candidate links exposed in the tooltip. In the live lists that leaves one mod: `crows.dustbunny`, with candidates 2659958183 (2021, versions 1.1–1.3) and 3480725900 (2025, versions 1.5–1.6), on a 1.7 list where neither version matches.

Steam's anonymous `ISteamRemoteStorage/GetPublishedFileDetails` returns `creator`, a numeric Steam id, for every item. The package id namespace gives a second signal: other mods from the same author share the prefix before the first dot, and 2,293 of the index's 5,347 namespaces contain more than one indexed mod. Comparing creators needs no API key, unlike enumerating an author's items (`IPublishedFileService.GetUserFiles`), which would.

## Goals / Non-Goals

**Goals:**
- Resolve the ambiguous-title class using evidence rather than a guess.
- Spend no extra round trips: reuse the single batched Steam request per page.
- Fail safe: any inconclusive comparison leaves the current behavior intact.

**Non-Goals:**
- Introducing a Steam Web API key, secret, or quota.
- Enumerating an author's catalogue or discovering Workshop items missing from the index.
- Re-checking mods that already resolved; the comparison never overrides a recorded or package-id match.

## Decisions

**Creator is cached with the metadata.** `mod_meta` gains a `creator` column, filled from the same `GetPublishedFileDetails` call that already fetches title, art, and versions, and merged with `COALESCE` so a refresh that omits it cannot erase a known id. Candidates and namespace siblings are fetched in that same call, which keeps the request count unchanged; the ids are real Workshop items, so caching their metadata is harmless.

**Siblings come from the index, capped per namespace.** `packageNamespace` takes the segment before the first dot; `findNamespaceSiblings` returns up to six resolved Workshop ids for `prefix.%`. Six is enough to establish an author for a namespace without turning one long-lived namespace into a large request.

**The decision is one pure function.** `pickByCreator(candidateWids, siblingWids, creatorOf)` returns a wid only when exactly one candidate's creator is among the siblings' creators. Keeping it pure makes the "several match" and "nothing matches" cases testable without a database or network.

**Additive only.** The rule runs only for mods that are still unresolved after recorded id, package id, and title resolution, and only when the title step left candidates behind. Everything else is untouched, so the change cannot regress a page that renders correctly today.

## Risks / Trade-offs

- **Namespace reuse across authors** (the largest namespace has 1,621 indexed mods) yields several matching creators, so the comparison declines rather than picking one — the safe direction.
- **Transferred items**: a mod moved to another account loses the link, so it stays unresolved with candidates instead of resolving wrongly.
- **Stale creators**: like other metadata, creator is refreshed on the configured freshness window; a stale value can only cause a decline, never a wrong single match, unless the author genuinely changed.

## Migration Plan

One additive migration (`ALTER TABLE mod_meta ADD COLUMN creator TEXT`). Deploy, then re-render the affected list: Dust Bunnies should resolve to 3480725900 and the tooltip disappear for it. Rollback is the previous Worker version; the extra column is ignored by it.
