## 1. Unify the markup

- [x] 1.1 Emit the checkbox switch from `renderThemeControl()` in `src/showcase/render.ts`, matching the hand-applied block in `public/index.html`, with `role="switch"` and `aria-label="Dark theme"` on the input
- [x] 1.2 Update `public/edit.html` to the same markup
- [x] 1.3 Confirm all four page types render one identical control in the header

## 2. Behaviour

- [x] 2.1 Rework `public/theme.js` to drive `checked` and listen to `change`, keeping the storage key, pre-paint application, and the `matchMedia` fallback while nothing is stored
- [x] 2.2 Verify keyboard use: the hidden input is focusable, Space toggles it, and the choice persists across a reload

## 3. Styles

- [x] 3.1 Remove the dead button-switch rules from `public/styles.css` so only the slider implementation remains
- [x] 3.2 Adapt the slider styles: `:focus-visible` ring on the slider, `prefers-reduced-motion` guard for the sun/moon animations and the knob transition, and confirm the fixed light/dark track colours in both page palettes
- [x] 3.3 Confirm the control stays hidden when scripting is disabled

## 4. Verification

- [x] 4.1 Update the header assertions in `test/showcase-enhancements.test.ts` for the checkbox markup
- [x] 4.2 Update `scripts/verify-showcase.mjs` to drive the switch through the label and assert the `checked` state on a list page and on the home page, including a reload that proves persistence
- [x] 4.3 Run the full suite and typecheck
- [x] 4.4 Check both states visually at desktop and narrow widths, in both page palettes
- [x] 4.5 After deploy, confirm the control works on the live home and list pages
