# Proposal

## Why

The header switch was reworked by hand: `public/index.html` now carries a checkbox-based day/night toggle with inline sun and moon artwork, and matching slider styles were added to `public/styles.css`. The rest of the app still ships the previous button-based control, so the home page, the rendered list pages, the edit page, the client script, and the tests currently disagree, and the new control does not yet work: `public/theme.js` drives an `aria-checked` attribute that a checkbox does not have, so the switch never reflects or stores a choice.

## What Changes

- Adopt the checkbox switch as the one header control on every page: `public/index.html` keeps its hand-applied markup, and `src/showcase/render.ts` plus `public/edit.html` are updated to the same markup.
- Rework `public/theme.js` for checkbox semantics: sync the `checked` property, listen to `change`, keep storage, pre-paint behaviour, and the system-preference fallback.
- Reconcile `public/styles.css`: keep the newly added slider design, remove the now-dead button-switch styles, and adapt the pasted rules (focus visibility, reduced motion) to the site's conventions.
- Update the renderer tests and the browser verification script, which assert the old button markup and drive it via `aria-checked`.
- Leave the icon font subset untouched: the switch no longer uses the sun and moon glyphs, but font changes stay out of this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `list-showcase` already requires "the same two-position switch in its site header, offering light and dark", and the checkbox control satisfies that requirement as written: same positions, same persistence, same pre-paint behaviour, same no-JS story. This change re-implements the control's mechanics, so the change declares `skip_specs`.

## Impact

- `src/showcase/render.ts`, `public/edit.html` — switch markup unified with `public/index.html`.
- `public/theme.js` — checkbox-based state handling.
- `public/styles.css` — dead button styles removed, pasted slider styles adapted.
- `test/showcase-enhancements.test.ts`, `scripts/verify-showcase.mjs` — assertions and driving updated.
