# Design

## Context

See `proposal.md` — Why. The current control is three `.chip` buttons in `renderThemeControl()` (`src/showcase/render.ts`) with a duplicate of the same markup in `public/index.html` and `public/edit.html`. `public/theme.js` owns interaction: it reads `localStorage["glowforest-theme"]`, writes `data-theme` on `<html>`, and marks `aria-pressed`. The pre-paint snippet in every page head applies a stored choice before the stylesheet loads. Palettes come from `prefers-color-scheme` plus `html[data-theme]` overrides in `public/styles.css`, and the site already ships a one-glyph icon subset (`U+F1522`) used by the unresolved-mod marker.

## Goals / Non-Goals

**Goals:**

- One control that reads as a switch, with both choices visible and the active side obvious.
- Keep first-visit system-following and pre-paint application exactly as they are.
- Keep the control on every page from a single shared implementation.
- Keep the icon cost near zero by extending the existing subset.

**Non-Goals:**

- Changing the palettes themselves.
- Introducing a third "auto" position, a dropdown, or per-page overrides.
- Touching the preview-card renderer.

## Decisions

### D1 — Two positions, system preference as the initial position

`theme.js` keeps one storage key and two writable values. On load it places the knob at the stored value, or at the value implied by `window.matchMedia("(prefers-color-scheme: dark)")` when nothing is stored. Toggling writes the value and sets `data-theme`.

```
nothing stored  -> knob follows matchMedia; data-theme untouched (CSS media query wins)
stored "light"  -> data-theme="light"; knob left
stored "dark"   -> data-theme="dark"; knob right
```

*Alternative rejected:* treating "no attribute" as a visible third state — that is the Auto chip again, only harder to read.

*Trade-off accepted:* a visitor who wants to return to following the system has no control for it; they clear site data. Removing a state was the point of the change, and the system preference still governs anyone who has never toggled.

### D2 — `role="switch"` with the labels outside the track

The control is a single `<button type="button" role="switch" aria-checked="true|false" aria-label="Dark theme">`, flanked by `<span>` labels `Light` and `Dark`. The visible labels carry the meaning; the switch's accessible name names the state it controls. Space and Enter work for free, and `aria-checked` replaces the three `aria-pressed` states.

*Alternative rejected:* two radio inputs — more markup, and radios imply a form submission that does not exist here.

### D3 — Icons in the track, plain knob

The sun sits in the light half and the moon in the dark half; the opaque knob slides over the active half, so the visitor always sees the *inactive* icon, as in the reference sketch. Both glyphs come from the existing subset font (`nf-oct-sun` U+F522, `nf-oct-moon` U+F4EE), regenerated with the unresolved glyph (U+F1522) in one file.

*Alternative rejected:* putting the icon on the knob — it hides the affordance that the other side is a destination, and it needs per-state icon swapping in CSS.

### D4 — Fixed switch palette, not page-theme tokens

The track keeps its own light-yellow and deep-navy halves in both page themes, with a hairline border so the yellow half stays distinct on a white panel. A theme-derived track would make the control change appearance with the thing it controls and lose the familiar sun/moon reading.

*Alternative rejected:* `--panel`/`--line` tokens — in the dark page theme the "light" half would become dark and stop meaning light.

### D5 — The shared header stays the single source of truth

`renderThemeControl()` keeps producing the markup for rendered pages, and the two static pages keep their mirrored copy, because both are plain HTML with no templating. The markup is small and the duplication is already an accepted cost of the current design; introducing a client-side header renderer just to avoid it would make the header depend on scripting.

## Risks / Trade-offs

- **Losing the explicit Auto control** is a visible capability change; anyone who relied on the chip to return to system-following must clear site data. Recorded in the spec delta rather than hidden.
- **Icon subset regeneration** is manual (documented in `public/fonts/NOTICE.md`); a future glyph addition has the same cost, now with the exact command recorded.
- **Two-position semantics on a toggle** can confuse screen-reader users if the accessible name is the *target* theme rather than the current one; the implementation names the control "Dark theme" and exposes state through `aria-checked`, which is the platform convention for switches.
- **Test churn**: assertions currently count three `data-theme-choice` buttons and click the auto chip; those must be rewritten in the same change or CI stays red.
