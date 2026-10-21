# Proposal

## Why

The showcase page renders every mod as a fully detailed card, and real lists run long — our reference list is 135 mods, and lists up to 1,000 are allowed. That turns the page into a wall of near-identical cards where finding a mod, an author, or everything that is broken means browser Ctrl+F. At the same time every card shows secondary facts most glances do not need, the page is dark-only regardless of the visitor's system, and the two things a reader most often wants to do with a list — paste it into a chat thread and link to one specific mod — are awkward.

## What Changes

- **Brief mode**: a compact card variant showing position, thumbnail, title, author, status badges, and author notes — the author's own words are content, not metadata. Served as a real server-rendered variant at `?mode=brief` (so it works without JavaScript and is independently linkable), with an instant in-page toggle that keeps the URL in sync. Detailed remains the default.
- **Search**: debounced client-side matching across title, author, package ID, and author notes, with a "N of M shown" counter and a shareable `?q=` parameter.
- **Filter toggles**: hide official content; show only unresolved, only outdated, or only noted mods. Pure client-side; never reorders anything.
- **Sticky toolbar**: list summary (count, game version, size), search, toggles, mode switch, and back-to-top, fixed at the top of long pages.
- **Load-order position** rendered on every card — the order is the page's whole point and is currently invisible.
- **Collapsed official content**: Core and expansions fold into one expandable row instead of standing cards.
- **Copy actions**: one click copies the whole visible list as ordered text (for pasting into support threads); each card gets a "copy link" for its anchor.
- **Light theme**: the page follows the visitor's `prefers-color-scheme` without JavaScript; a Light/Dark/Auto control (persisted per visitor) when scripting is available. The generated preview card image stays dark in all themes.
- **Render performance**: `content-visibility` on cards so very long lists stay smooth.
- **No sorting.** Recorded load order is the page's contract; nothing in this change reorders mods.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `list-showcase`: adds requirements for brief mode, search, filter toggles, the sticky toolbar, load-order labels, collapsed official content, copy actions, and colour-scheme handling. All additions — no existing requirement changes; the no-JavaScript and load-order requirements are untouched.

## Impact

- `src/showcase/render.ts` and `public/styles.css` change; a small client script joins the public page (it currently has none).
- The public page gains one query-parameter dimension (`mode`, `q`). Any future read-path caching must key on it — that caching stays a separate follow-up change.
- No data-model changes, no new external dependencies, edit page untouched.

## Open Decisions

None blocking — scope, brief-mode default, theme defaults, and the sorting exclusion were all settled during exploration. Per-visitor theme persistence is a design note, not a fork.
