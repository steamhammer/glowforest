# Design

## Context

See `proposal.md` — Why. The archived `theme-switch` change delivered a `<button role="switch">` with the sun and moon as glyphs from the bundled icon subset. The working tree now carries a different, hand-applied design on the home page: a `<label class="switch">` wrapping an visually hidden checkbox, inline SVG sun and moon, and a sliding `.slider`, with tutorial-style CSS added to `public/styles.css`. The requirement in `list-showcase` ("the same two-position switch in its site header, offering light and dark") already describes the resulting behaviour, which is why this change declares `skip_specs`.

## Goals / Non-Goals

**Goals:**

- Exactly one switch implementation, used by the home page, list pages, the edit page, and the not-found page.
- A working control: reflects the stored choice or the system preference, toggles on click and keyboard, and persists.
- Keep the visual design of the hand-applied version.

**Non-Goals:**

- Changing the requirement text; the behaviour is unchanged.
- Touching the icon font subset or the Lato files (font work stays separate).
- Adding themes, a third "auto" position, or per-page overrides.

## Decisions

### D1 — The checkbox is the control, marked up as a switch

Keep the hand-applied structure (`label.switch` wrapping the icons, the input, and the slider) and add the semantics the tutorial omitted: `role="switch"` and `aria-label="Dark theme"` on the input, so assistive tech announces a switch rather than a bare checkbox, with `checked` meaning dark. The visible icons carry the meaning; no text labels are added back.

```
unchecked  -> light theme active, knob left, sun visible
checked    -> dark theme active,  knob right, moon visible
```

*Alternative rejected:* reverting to the button implementation — it was replaced deliberately, and the checkbox brings native keyboard toggling for free.

### D2 — `theme.js` speaks checkbox

State handling mirrors the previous logic with two mechanical changes: `paint` sets `control.checked` instead of an `aria-checked` attribute, and the listener is `change` (which also fires for keyboard toggling) reading `control.checked`. Everything else survives: storage key, pre-paint snippet, `matchMedia` fallback while nothing is stored, and the system-preference listener that repaints only while no choice exists.

*Alternative rejected:* keeping `aria-checked` in sync alongside `checked` — redundant state with two sources of truth.

### D3 — One markup source for rendered pages, one mirror for static pages

`renderThemeControl()` emits the same block as `public/index.html`; `public/edit.html` is updated to match. The duplication is the accepted cost of static pages with no templating (unchanged from the previous design).

### D4 — Keep the pasted visual design, adapt its edges

The slider palette stays fixed and independent of the page theme (light blue unchecked, deep navy checked), consistent with the previous decision that the control should not re-tint with the page. Adaptations, all limited to the pasted block:

- Replace the weak `:focus` box-shadow with a visible `:focus-visible` ring on the slider, since the input itself is visually hidden.
- Honour `prefers-reduced-motion` by disabling the sun-rotation and moon-tilt animations and the knob transition.
- Remove the dead button-era rules (`.theme-switch-track`, `.theme-switch-knob`, `.theme-switch-mark`) so only one switch implementation exists in the stylesheet.

*Alternative rejected:* retuning the colours to page tokens — the control must keep meaning light/dark in both page themes.

### D5 — Icons become inline SVG; the subset keeps its glyphs unused

The markup no longer renders `nf-oct-sun`/`nf-oct-moon`, so those two glyphs in `nerd-symbols.woff2` become unused. Per the agreed boundary, the subset and its notice are not touched in this change; removing the unused glyphs is a follow-up for the font work.

## Risks / Trade-offs

- **The checkbox is visually hidden but must stay focusable** — the pasted `opacity: 0; width: 0; height: 0` keeps it in the tab order; verify focus moves to it and the ring shows on the slider.
- **Infinite animations run on every page** (rotating sun, tilting moon); they are cheap but constant, and the reduced-motion guard is the mitigation. If they prove distracting, gating them to hover is a one-line follow-up.
- **Two switch implementations briefly coexist** in the working tree until the rendered pages and the edit page are unified; tests assert the unified markup, so a missed page fails CI rather than shipping silently.
- **The verify script clicks the old control** — it must click the label or use the keyboard, since the input itself is zero-size.
