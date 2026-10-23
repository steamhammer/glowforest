# Design

## Context

See `proposal.md` — Why. `src/showcase/og.ts` already memoizes WASM initialization with a module-level promise (`wasmReady`), so the font cache can follow the same established pattern. Cards are rendered only on an R2 cache miss and then stored immutably (`src/showcase/og-cache.ts`), so the font cost is tied to regeneration, not page views. The SVG uses `font-weight="700"` for the eyebrow label and the title; everything else is regular.

## Goals / Non-Goals

**Goals:**

- One font fetch per Worker instance instead of one per rendered card.
- Halve the font payload shipped and loaded, without changing what the card shows.
- Keep glyph coverage identical so any list title still renders.

**Non-Goals:**

- Subsetting fonts or accepting any loss of script coverage.
- woff2 or any other format the resvg WASM build may not load.
- Changing the card's content, dimensions, caching, or refresh behaviour.
- Touching the page's web fonts (the HTML uses a system stack; only the card uses Lato).

## Decisions

### D1 — Memoize the font buffer per isolate

Load the face once into a module-level `Promise<Uint8Array>`, mirroring `wasmReady`. On rejection, clear the cached promise so a transient asset error cannot poison the instance forever.

```
render 1 -> fontReady ??= fetch(661 KB)  -> bytes cached
render 2 -> (already resolved)           -> no fetch
error    -> fontReady = null             -> next render retries
```

*Alternative rejected:* caching in R2 or KV — the bytes come from the deployment itself, so an in-memory reference is the cheapest correct cache and needs no invalidation.

### D2 — One Regular face, hierarchy without weight

`fontBuffers` receives only the Regular face. resvg resolves the `font-weight="700"` attributes to the only available face, so the attributes are removed rather than left to silently fall back. Emphasis moves to properties the design already uses elsewhere: the eyebrow keeps its wide letter spacing, and the title gains a little size and tighter tracking so it still dominates at 1200×630.

*Alternative rejected:* keeping Bold for the title only — it is 683 KB for two text elements, and the card's purpose is a glanceable thumbnail.

*Trade-off accepted:* the title is lighter than today. If the result reads as weak in review, the fix is a typographic adjustment, not restoring the second face.

### D3 — No subsetting in this change

Full-coverage faces keep every script working: the live lists are Russian, and a Latin+Cyrillic subset would turn a CJK-titled list into boxes. Subsetting (Latin+Cyrillic alone measured at 67 KB per face) is a separate decision that needs a coverage policy.

*Alternative rejected for now:* default subset plus a full-font fallback — more moving parts than the measured regeneration volume justifies.

### D4 — Remove the Bold file rather than leave it deployed

Deleting `public/fonts/Lato-Bold.ttf` keeps the deployed asset set honest and saves 683 KB of upload; keeping it unused invites future confusion. The font notice records the remaining face and its role.

## Risks / Trade-offs

- **First card per isolate still transfers 661 KB.** Memoization cannot help a cold isolate; caching the card itself in R2 remains the primary mitigation.
- **Weight resolution changes silently** if a future edit reintroduces `font-weight="700"` without a second face — mitigated by removing those attributes now and noting the single-face constraint in the notice.
- **Visual regression risk** is confined to the card image; the page and its typography are untouched, and the card is regenerated on the next edit so it is easy to compare.
- **Font fetch failures** (asset removed, deployment mismatch) would surface as card render errors; the retry-on-failure cache avoids pinning a broken state.
