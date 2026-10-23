# Proposal

## Why

The header's three chips (Auto / Light / Dark) read as a settings row rather than a theme control: they take a full row on narrow screens, name a state most visitors never think about, and the current theme is only discoverable by reading `aria-pressed`. A single two-position switch shows both choices at a glance and makes the active side obvious at the moment of use.

## What Changes

- Replace the three theme chips with one sliding switch in the site header: sun icon on the light side, moon icon on the dark side, a plain knob over the active side, and the visible `Light` / `Dark` labels beside the track.
- Drop the explicit "auto" control. First-time visitors still follow the system preference; the switch merely reflects it. The first toggle stores an explicit choice, which then persists as before.
- Keep everything that already works: the stored choice is applied before first paint, the control is present on every page through the shared header, and the preview card stays theme-independent.
- Ship the sun and moon glyphs (`nf-oct-sun` U+F522, `nf-oct-moon` U+F4EE) in the existing single-file icon subset, alongside the unresolved-mod glyph.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `list-showcase`: the *Site-wide colour theme control* requirement now specifies a two-position switch instead of automatic, light, and dark choices. The system-preference behaviour is unchanged for visitors without a stored choice.

## Impact

- `src/showcase/render.ts` — header markup.
- `public/index.html`, `public/edit.html` — the same header block on the static pages.
- `public/theme.js` — remove the auto branch; read the system preference to place the knob when nothing is stored.
- `public/styles.css` — switch anatomy, focus ring, and fixed light/dark halves.
- `public/fonts/nerd-symbols.woff2` and `public/fonts/NOTICE.md` — three-glyph subset.
- `test/showcase-enhancements.test.ts`, `scripts/verify-showcase.mjs` — assertions that count `[data-theme-choice]` buttons and click the auto chip.
