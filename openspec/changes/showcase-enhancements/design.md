# Design

## Context

See `proposal.md` — Why. The showcase page is produced by `renderItem` and `renderListPage` in `src/showcase/render.ts`: one `<li class="mod">` per visible mod, carrying thumbnail, title, author, badges, package ID, note, a facts line, and a Workshop link. `public/styles.css` is already token-driven (`--bg`, `--panel`, `--text`, `--line`, `--accent`, …) but declares `color-scheme: dark` and one dark palette. The page ships no client script today — `public/app.js` and `public/edit.js` belong to the create and edit pages.

Measured shape on the reference list: 135 mods, 82 KB of HTML, 135 hotlinked Steam thumbnails. The synced `list-showcase` spec constrains this design in three ways: the page SHALL render its full content without JavaScript, mods SHALL be presented in recorded load order, and the page SHALL NOT sort by name, author, or popularity.

## Goals / Non-Goals

**Goals:**

- Let a visitor control density (detailed vs brief) on a 1000-mod page without breaking the no-JS baseline.
- Make a specific mod findable by text and by status, without changing the order of what remains.
- Make filtered and brief views shareable as URLs.
- Give the page a light theme that follows the system by default and remembers an explicit choice.
- Keep the page smooth on very long lists.

**Non-Goals:**

- Sorting of any kind. Order is the contract.
- Pagination or virtual scrolling; `content-visibility` is the chosen mitigation.
- Server-side search. The server never interprets `q`.
- Per-list theming chosen by the publisher; the preview card stays dark for every viewer.
- Image resizing or proxying; thumbnails remain hotlinked.

## Decisions

### D1 — One DOM, mode as a rendering attribute

Both densities render the same card markup; the mode is a `data-mode` attribute on the list container. In brief mode the card becomes one row of a three-column table — position, title, Workshop link — by switching the card to `display: grid` with `grid-template-columns: 3.5rem minmax(0, 1fr) 11rem` and turning `.mod-body` into `display: contents` so the title and link land in columns two and three. Everything else (thumbnail, byline, badges, package ID, note, facts, detailed actions) is hidden, and a single header row above the list carries the column labels. The server sets the mode from `?mode=brief`, so the table works without JavaScript and is independently linkable. The in-page toggle flips the attribute and rewrites the URL with `history.replaceState`, so switching is instant and the state stays shareable.

```
?mode=brief  ->  server renders data-mode="brief"  ->  CSS: row grid, three columns,
                                                        secondary blocks hidden
                                                        ^
                              toggle button ------------+ (instant, URL rewritten)
```

*Trade-off accepted:* the brief URL does not save bytes, because the detail markup is still in the document (hidden with `display: none`, which also removes it from the accessibility tree). Byte savings would require a second full render plus a fetch-and-swap on toggle, and the real cost at 1000 mods is DOM and paint cost, which D8 addresses. Revisit if edge caching makes two variants cheap.

*Alternatives rejected:* navigation on toggle (violates the instant-switch requirement); fetch-and-swap of the alternative variant (more moving parts, scroll and focus handling, no measured benefit at this size).

### D2 — Search is a precomputed haystack on each card

Each card carries `data-search` — the lowercased, NFKD-folded concatenation of title, author, package ID, and note — computed at render time. The client lowercases the query the same way and does a substring test. This avoids walking the DOM on every keystroke and makes the match rule identical for every field.

*Why:* 1000 mods × ~120 bytes of haystack is ~120 KB of markup, but matching is then a single string scan per card with no per-keystroke DOM reads. Input is debounced at ~120 ms and the URL's `q` parameter is written on the same debounce.

*Note:* the server ignores `q` entirely; a `?q=` URL renders the same HTML and the script applies the filter on load. That keeps the server cacheable per mode only, and keeps no-JS behaviour honest (the full list is what a no-JS visitor gets).

### D3 — Filters are independent predicates over data attributes

Cards expose `data-official`, `data-unresolved`, `data-outdated`, `data-noted`, and `data-position`. Toggles combine as AND with the search predicate: only unresolved, only outdated, only noted. Official content has no toggle: it is already collapsed into one group, so hiding it separately duplicates that control and leaves the statistics inconsistent with what a toggle appears to promise. Buttons carry `aria-pressed`; the match counter is an `aria-live="polite"` region.

*Alternative rejected:* encoding toggles in the URL. It adds state surface for a control whose whole point is ephemeral scanning; only `q` and `mode` are shareable.

### D4 — Progressive enhancement with a `.js` marker

Exactly one element of behaviour is required for interaction: the script sets `document.documentElement.classList.add("js")` as it initialises. Everything interactive is styled to appear only under `.js`:

| control | without JavaScript | with JavaScript |
|---|---|---|
| search field | hidden | live filter |
| filter toggles | hidden | live filters |
| mode switch | a link to the other `?mode=` URL | instant toggle |
| back to top | plain `<a href="#top">` | same, smooth scroll |
| copy buttons | hidden | clipboard actions |

*Why:* the no-JS requirement is about reading, and a control that cannot work should not be shown. The mode link is the one control that has a meaningful non-scripting equivalent, so it stays visible as a link.

### D5 — Explicit positions instead of `<ol>` numbering

Cards display their one-based position from `data-position`. The container becomes `<ul class="mods">` rather than `<ol>`, because official content moves into a nested group (D6) and a single ordered list can no longer span both containers. Explicit numbers keep the displayed order authoritative and decouple it from DOM nesting.

### D6 — Official content is one native `<details>` group

Official mods render inside a single `<li class="official-group">` containing `<details><summary>Official content (3 mods)</summary><ul>…cards…</ul></details>`. It expands natively without scripting, keeps the mods in the accessibility tree when open, and is skipped by the "hide official" toggle as a unit. Statistics still include them, because the group is a presentation change, not filtering.

*Why not a single `<details>` around list items:* `<ol>`/`<ul>` may only contain `<li>`, so a wrapper above the item level is invalid markup. Grouping inside one `<li>` keeps the document valid.

### D7 — Theme: system by default, explicit choice remembered

Three layers, in cascade order:

```
@media (prefers-color-scheme: light)   -> light palette when no choice is stored
html[data-theme="light"]               -> explicit light
html[data-theme="dark"]                -> explicit dark
```

`color-scheme` is declared as `light dark` so form controls and scrollbars follow. A small inline script in `<head>` reads `localStorage["glowforest-theme"]` and sets `data-theme` before the stylesheet paints, preventing a flash of the wrong theme; the toolbar control offers Auto / Light / Dark and writes both the storage key and the attribute (Auto removes it). The preview card generator is untouched and stays dark — it is viewed inside embed clients whose theme is unknown.

The control lives in the site header, not the list toolbar, and `public/theme.js` owns it on every page: home and edit are static HTML, the list and not-found pages are rendered, so a shared header snippet plus one shared script keeps behaviour identical without pulling the whole list client onto pages that have no list. The pre-paint snippet is repeated in each page head for the same reason.

*Alternative rejected:* a single `<select>` with only light/dark (loses the "follow my system" default, which is the behaviour most visitors expect).

### D8 — Long-list rendering cost

Cards get `content-visibility: auto` with `contain-intrinsic-size` tuned per density (~180 px detailed, ~44 px brief). The brief row under the pointer or focus opts back to `content-visibility: visible`, because paint containment would clip the unresolved tooltip to the row box; only one row pays that cost at a time. Thumbnails already use `loading="lazy"` and `decoding="async"`. No pagination.

### D9 — A dedicated `public/list.js`

The showcase page loads one small module script, separate from `app.js` and `edit.js`. It owns: `.js` marker, mode toggle, search, filters, counter, and copying the visible list. Theme belongs to `public/theme.js` because every page carries the control. Pure helpers (haystack normalisation, text export format, predicate evaluation) are exported so they can be unit-tested headlessly; DOM wiring is verified in a browser.

```
render.ts  --->  HTML with data-* attributes + <script src="/list.js">
                    |
list.js  -----------+-- normalize()  (shared with tests)
                     +-- matches(mod, query, filters)
                     +-- listAsText(visibleMods)
                     +-- DOM wiring
```

## Risks / Trade-offs

- **Brief mode still ships detail markup** → accepted for instant toggling; mitigated by `content-visibility` and noted for the future caching change.
- **Search haystack adds markup weight** (~120 bytes/mod) → bounded and compressible; the alternative is per-keystroke DOM reads.
- **Clipboard writes can fail** (permissions, non-secure contexts) → catch, show an inline "Copy failed — select and copy manually" state; the text remains selectable.
- **Filtering hides content that the no-JS spec promises is present** → only when the visitor explicitly filters, and a visible "Clear" control plus the counter make the hidden state obvious.
- **Theme flash** → inline head script runs before the stylesheet; covered by a browser check.
- **Accessibility regressions** → native `<details>` for grouping, `aria-pressed` on toggles, labelled search, `aria-live` counter, focus left in the search field while filtering.
- **Future edge caching** → the cache key must include `mode`; `q` stays client-side, so nothing else changes.

## Migration Plan

No data changes and no new dependencies. Deploy is a normal Worker + assets release; the previous version remains available through `wrangler rollback`. Verification uses the live 135-mod reference list plus the existing fixture renders; the light and brief variants are checked in a real browser before the change is archived.

## Open Questions

None blocking. Deferred: whether filter toggles should survive in the URL, and whether the exporter (ordered list as text) should gain sibling formats in the later `list-export` change.
