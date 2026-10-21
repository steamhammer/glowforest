# Tasks

## 1. Server-rendered structure

- [x] 1.1 Emit `data-*` attributes on each card (position, official, unresolved, outdated, noted, search haystack) and a visible one-based position label, and verify a render test asserts the attributes and the visible number
- [x] 1.2 Switch the mod container to `<ul class="mods">` and set `data-mode` from the `mode` query parameter (default detailed), and verify a test renders both modes and checks the default
- [x] 1.3 Group official content into one `<li>` containing `<details><summary>Official content (N mods)</summary>`, and verify a test asserts one group, the nested cards, and unchanged statistics
- [x] 1.4 Render the sticky toolbar skeleton (summary, mode link, search field, filter toggles, back-to-top) with controls hidden by default for the no-JS case, and verify a test asserts the markup and that the mode link points at the opposite `?mode=` URL
- [x] 1.5 Pass the query parameters from the Worker route into the renderer and verify a request test shows `?mode=brief` producing the brief attribute

## 2. Theme

- [x] 2.1 Split `public/styles.css` tokens into light and dark palettes with the `prefers-color-scheme` default plus `[data-theme]` overrides, declare `color-scheme: light dark`, and verify both palettes resolve in a browser check of computed styles under emulated preferences
- [x] 2.2 Add the inline head script that applies the stored theme before first paint and verify it appears before the stylesheet and sets `data-theme` from `localStorage`
- [x] 2.3 Add `content-visibility` and `contain-intrinsic-size` per density, and verify the declarations resolve on cards in a browser check

## 3. Client behaviour (`public/list.js`)

- [x] 3.1 Implement and export the pure helpers — `normalize`, `matches(mod, query, filters)`, `listAsText(mods)` — and verify unit tests cover diacritics, field coverage, filter composition, and text format
- [x] 3.2 Wire the `.js` marker, debounced search, `?q=` initial state, and the match counter, and verify a browser check filters by author and shows the correct count
- [x] 3.3 Wire the four filter toggles with `aria-pressed` and composition with search, and verify a browser check applies two filters plus a query
- [x] 3.4 Wire the mode toggle with `history.replaceState`, and verify a browser check switches density instantly and that the copied URL reopens brief
- [x] 3.5 Wire copy-list and copy-link with success and failure states, and verify a browser check copies only visible mods in order and reports failure when the clipboard rejects
- [x] 3.6 Wire the Auto/Light/Dark control with persistence, and verify a browser check survives a reload and that Auto follows an emulated system preference

## 4. Order guarantees

- [x] 4.1 Verify no mode, search, or filter changes the relative order of visible cards, with a browser assertion comparing `data-position` sequences after filtering
- [x] 4.2 Verify the server-rendered order equals the stored order in both modes, with a render test using a deliberately non-alphabetical fixture

## 5. Long lists

- [x] 5.1 Generate a synthetic 1000-mod list in a render test and verify the page renders within a generous time budget and contains every position in order
- [x] 5.2 Verify no pagination or truncation was introduced — every visible mod appears in the HTML regardless of list size

## 6. Browser verification and deployment

- [x] 6.1 Add `scripts/verify-showcase.mjs` driving Chrome against a running instance through default, brief, toggle, search, filters, copy, and theme flows, and verify it exits 0
- [x] 6.2 Verify the no-JS case in the same script with JavaScript disabled: all mods visible, interactive controls absent, mode link still usable
- [x] 6\.3 Run the checks against the live 135-mod reference list after deployment and verify the page, brief URL, and preview card all work

## 7. Documentation

- [x] 7.1 Update the README feature bullets to mention search, filters, brief mode, and light theme, and verify the claims match the shipped behaviour

## 8. Toolbar and brief-view refinement

- [x] 8.1 Move the Auto/Light/Dark control into the site header, serve it on the home, edit, list, and not-found pages through `public/theme.js`, and verify a browser check switches theme from the header on a page without a list
- [x] 8.2 Remove the official-content filter toggle and verify no control or client state remains for it
- [x] 8.3 Remove the per-card copy-link control, keeping the Workshop link as the card's outbound link, and verify the copy-list action still respects filters
- [x] 8.4 Render brief mode as a three-column table (position, title, Workshop link) with one header row, hiding every other detail, and verify a browser check reads three columns and no secondary fields
- [x] 8.5 Re-run the browser verification suite and confirm the no-JS brief view stays readable
- [x] 8.6 Mark unresolved brief rows with the `nf-md-progress_question` glyph in brick red, ship a one-glyph webfont subset, and verify a browser check shows the icon and its hover explanation
- [x] 8.7 Open the tooltip to the right of the icon, offer every same-titled Workshop item as a link when the reason is ambiguous, and let the hovered row escape paint containment so the popup is never clipped
- [x] 8.8 Read supported game versions from dataset tags when `gameVersions` is absent, so name-only index entries can be told apart in the tooltip and by the version tie-break
- [x] 8.9 Keep the tooltip open for a short pause after the pointer leaves and while it rests on the tooltip, with a hover bridge across the gap, and verify a browser check can cross to a candidate link and click it

## Workflow follow-up

- Archive the change once the browser checks pass and the deployed page has been verified on the reference list.
