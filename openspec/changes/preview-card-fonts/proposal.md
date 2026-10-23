# Proposal

## Why

Every preview-card render fetches both Lato faces through the assets binding with no reuse (`src/showcase/og.ts:19`): 1.35 MB of font data per generated image, even for two images drawn back to back. The Bold face alone is 683 KB and exists only to give two text elements a heavier weight. Preview cards are regenerated whenever a list is edited, so this cost recurs in normal use.

## What Changes

- Remember the loaded font bytes for the lifetime of the Worker instance: the first card render pays the fetch, later renders reuse it.
- Ship and load a single Regular face instead of Regular plus Bold; the card's label and title use size, letter spacing, and colour for hierarchy instead of weight.
- Remove `Lato-Bold.ttf` from `public/fonts` and update the font notice.
- Keep full glyph coverage: no subsetting in this change, so every script a list title may use keeps rendering.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The preview card continues to show the same content, refresh behaviour, and caching defined by `list-showcase`; this change alters only how fonts are loaded and how heavily the title text is drawn.

## Impact

- `src/showcase/og.ts` — font memoization and single-face renderer.
- `public/fonts/Lato-Bold.ttf` — removed; `public/fonts/NOTICE.md` — updated.
- Preview-card regeneration on the next edit of each list, exercising the new loading path.
