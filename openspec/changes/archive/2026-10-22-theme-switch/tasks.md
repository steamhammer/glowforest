## 1. Icons

- [x] 1.1 Regenerate `public/fonts/nerd-symbols.woff2` with U+F522 (`nf-oct-sun`), U+F4EE (`nf-oct-moon`), and U+F1522, and update the regeneration note in `public/fonts/NOTICE.md`
- [x] 1.2 Verify all three glyphs render in the bundled font in both palettes

## 2. Switch markup and behaviour

- [x] 2.1 Replace the three theme chips in `renderThemeControl()` with a two-position switch: `role="switch"`, `aria-checked`, `Light`/`Dark` labels, sun and moon in the track
- [x] 2.2 Mirror the same markup in `public/index.html` and `public/edit.html`
- [x] 2.3 Rewrite the theme branch of `public/theme.js`: place the knob from storage or from `matchMedia("(prefers-color-scheme: dark)")`, toggle `aria-checked` and `data-theme`, and store the explicit choice; drop the auto branch entirely
- [x] 2.4 Confirm the control stays hidden without scripting and that the pre-paint snippet still applies a stored choice

## 3. Styling

- [x] 3.1 Style the track (fixed pale-yellow and navy halves, hairline border), the sliding plain knob, and the icon colours in both page themes
- [x] 3.2 Add a visible focus ring for keyboard use and keep the control from wrapping on narrow headers

## 4. Verification

- [x] 4.1 Update the header assertions in `test/showcase-enhancements.test.ts` for the switch and keep them passing
- [x] 4.2 Update `scripts/verify-showcase.mjs` to drive the switch on a list page and on the home page, including a reload that proves persistence
- [x] 4.3 Check every page type — home, list, edit, not-found — renders the switch in the header, and that a system-dark first visit shows dark without storing a choice
- [x] 4.4 Re-run the full suite and the production verification against the deployed worker
