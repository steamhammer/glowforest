# list-showcase Specification

## Purpose

Renders a published mod list as a readable, linkable page and a useful preview card, so a player can share what their colony was built on without explaining it.

## Requirements

### Requirement: Render a published list as server-rendered HTML

A published list SHALL be delivered as HTML that displays its full content without requiring JavaScript.

#### Scenario: Page readable without JavaScript

- **WHEN** a visitor opens a list URL with scripting disabled
- **THEN** the list title, mods, notes, and statistics are all readable

### Requirement: Present mods in recorded load order

The page SHALL order mods by their recorded position and SHALL NOT sort them by name, author, or popularity.

#### Scenario: Order preserved on the page

- **WHEN** a list was published with a specific mod order
- **THEN** the page displays the mods in that order

### Requirement: Show per-mod identity and status

For each visible mod the page SHALL show its display name, author, thumbnail when available, supported game versions, download size, last-updated time, and a link to its Workshop page. Official content and unresolved mods SHALL be visibly distinguished from resolved Workshop mods.

#### Scenario: Resolved Workshop mod

- **WHEN** a mod has cached Workshop metadata
- **THEN** the page shows that metadata and links to the Workshop item

#### Scenario: Unresolved mod shown without a link

- **WHEN** a mod could not be resolved to a Workshop item
- **THEN** the page shows its available name or identifier, marked unresolved, with no Workshop link

#### Scenario: Official content distinguished

- **WHEN** an item is Core or an expansion
- **THEN** the page marks it as official content

### Requirement: Show author notes and honour hidden mods

The page SHALL display each visible mod's author note, and SHALL omit hidden mods from the public page entirely.

#### Scenario: Note visible

- **WHEN** the creator has written a note for a visible mod
- **THEN** the note appears with that mod

#### Scenario: Hidden mod omitted

- **WHEN** a mod is hidden
- **THEN** it does not appear anywhere on the public page, including statistics

### Requirement: Show aggregate list statistics

The page SHALL show the number of visible mods, their combined download size, and the game version recorded with the list.

#### Scenario: Statistics reflect visible mods

- **WHEN** a list of 135 mods has 3 hidden mods
- **THEN** the page reports 132 mods and a total size excluding the hidden ones

### Requirement: Warn about game-version drift

When a list records a game version, the page SHALL identify visible mods whose supported versions exclude that version.

#### Scenario: Outdated mod flagged

- **WHEN** a list records `1.7` and a mod supports only up to `1.6`
- **THEN** the page marks that mod as not supporting the list's version

### Requirement: Provide a link preview card

The page SHALL expose preview metadata and a generated preview image showing the list title, mod count, game version, and total size. The image SHALL be cached and SHALL change when the list changes.

#### Scenario: Preview available to link unfurlers

- **WHEN** the list URL is posted in a chat client that reads preview metadata
- **THEN** a preview shows the generated card image and list title

#### Scenario: Preview refreshed after an edit

- **WHEN** the creator changes the list
- **THEN** the next preview request reflects the updated list

### Requirement: Attribute Workshop content and link out

The page SHALL identify Steam Workshop as the source of mod metadata and SHALL link each resolved mod to its Workshop page rather than reproducing Workshop pages wholesale.

#### Scenario: Source attributed

- **WHEN** a visitor views resolved Workshop mods
- **THEN** each links to its Workshop page and the page identifies Steam Workshop as the metadata source

### Requirement: Report missing lists as not found

The system SHALL return a not-found response for an identifier that does not exist or has been deleted.

#### Scenario: Unknown identifier

- **WHEN** a visitor requests a list URL whose identifier is unknown
- **THEN** the system responds that the list does not exist

### Requirement: Brief mode as a three-column table

The page SHALL render a brief variant when requested with `?mode=brief` that presents each visible mod as a table row of exactly three columns: its one-based load-order position, its title, and a link to its Workshop page. Brief rows SHALL omit thumbnails, authors, status badges, notes, game versions, download size, subscriber count, last-updated time, and package identifiers, and SHALL show the three column labels once above the rows. Detailed SHALL remain the default.

#### Scenario: Brief row carries three columns

- **WHEN** a visitor opens a list URL with `?mode=brief`
- **THEN** each row shows the position, the title, and a Workshop link, and nothing else

#### Scenario: Column labels

- **WHEN** the brief variant is shown
- **THEN** a single header row labels the three columns

#### Scenario: Unresolved row marked and explained

- **WHEN** a brief row belongs to a mod that is not found on Workshop
- **THEN** its title carries a brick-red question-mark icon, hovering or focusing that icon explains why the mod is unresolved, and when several Workshop items share the mod's title the explanation links to each of them so the visitor can judge which one it is

#### Scenario: Explanation stays open for the pointer

- **WHEN** the visitor moves the pointer from the icon onto the explanation, or briefly off both
- **THEN** the explanation stays open long enough to rest on it and follow one of its links, and closes shortly after both are left

#### Scenario: Detailed is the default

- **WHEN** a visitor opens a list URL without a mode parameter
- **THEN** mod cards show the full details

#### Scenario: Brief works without JavaScript

- **WHEN** the brief URL is opened with scripting disabled
- **THEN** the brief layout is served and readable

### Requirement: In-page mode toggle

When scripting is available, the page SHALL let the visitor switch between detailed and brief without a page load, and the URL SHALL reflect the active mode so either state can be shared.

#### Scenario: Toggle switches instantly

- **WHEN** the visitor activates the mode switch
- **THEN** the cards change density without a navigation

#### Scenario: Toggled state is shareable

- **WHEN** the visitor switches to brief and copies the page URL
- **THEN** opening that URL shows the brief layout

### Requirement: Search across mod fields

When scripting is available, the page SHALL let the visitor filter mods by text matching title, author, package identifier, and author note, SHALL show how many mods match, SHALL NOT reorder the remaining mods, and SHALL apply the search from a `?q=` parameter so a filtered view can be shared.

#### Scenario: Search matches several fields

- **WHEN** the visitor types part of an author's name
- **THEN** only mods whose title, author, package identifier, or note match remain visible

#### Scenario: Filtered results keep load order

- **WHEN** a search matches a subset of mods
- **THEN** the matches appear in their recorded load order

#### Scenario: Match counter

- **WHEN** a search is active
- **THEN** the page shows how many of the total mods match

#### Scenario: Shared search link

- **WHEN** a visitor opens the list URL with `?q=harmony`
- **THEN** the search is pre-applied on load

#### Scenario: Without JavaScript the list is intact

- **WHEN** the page is opened with scripting disabled
- **THEN** every mod remains visible and the full content is readable

### Requirement: Filter toggles

When scripting is available, the page SHALL offer toggles that show only unresolved, only outdated, or only noted mods; the toggles SHALL compose with search, SHALL NOT reorder mods, and SHALL be reflected in the match counter. Official content SHALL NOT need a toggle, because it is already collapsed into one group.

#### Scenario: Show only outdated mods

- **WHEN** the visitor enables the outdated toggle
- **THEN** only mods flagged as not supporting the list's game version remain visible

#### Scenario: Toggles and search compose

- **WHEN** a search is active and the visitor enables a toggle
- **THEN** the visible set satisfies both conditions

### Requirement: Sticky toolbar

The page SHALL present the list summary, search field, filter toggles, mode switch, and a back-to-top control in a toolbar that remains visible while the list is scrolled.

#### Scenario: Toolbar stays in view

- **WHEN** the visitor scrolls into the middle of a long list
- **THEN** the toolbar remains visible at the top of the viewport

#### Scenario: Back to top

- **WHEN** the visitor activates the back-to-top control
- **THEN** the view returns to the start of the list

### Requirement: Load-order position on cards

Every visible mod card SHALL display its position in the recorded load order.

#### Scenario: Positions visible

- **WHEN** the visitor views the list
- **THEN** each card shows its one-based position, matching the recorded order

### Requirement: Collapsed official content

Official content SHALL be presented as a single collapsed row that expands on activation without scripting, and its mods SHALL remain counted in the page's statistics.

#### Scenario: Collapsed by default

- **WHEN** the visitor opens the list
- **THEN** official content appears as one collapsed row rather than individual cards

#### Scenario: Expandable without JavaScript

- **WHEN** the visitor activates the collapsed row with scripting disabled
- **THEN** the official mods become visible

#### Scenario: Still counted

- **WHEN** official content is collapsed
- **THEN** the summary statistics still include those mods

### Requirement: Copy the visible list

When scripting is available, the page SHALL let the visitor copy the visible list as ordered text reflecting the current search and filters.

#### Scenario: Copy list respects filters

- **WHEN** the visitor copies the list while a search or filter is active
- **THEN** the copied text contains only the visible mods, in load order, one per line with position numbers


### Requirement: Site-wide colour theme control

Without scripting, every page SHALL follow the visitor's system colour preference. With scripting, every page — home, list, edit, and not-found — SHALL carry the same theme control in its site header, offering automatic, light, and dark choices; the choice SHALL persist across visits and be applied before the first paint. The generated preview card image SHALL keep a fixed appearance in every theme.

#### Scenario: System preference honoured without JavaScript

- **WHEN** a page is opened with scripting disabled
- **THEN** both colour palettes are provided and the visitor's system preference selects the active one

#### Scenario: Control present on every page

- **WHEN** the visitor opens the home page, a list page, an edit page, or a missing page
- **THEN** the site header offers the automatic, light, and dark choices

#### Scenario: Manual choice persists

- **WHEN** the visitor chooses light and reloads any page
- **THEN** the light palette is applied before the first paint

#### Scenario: Preview card is theme-independent

- **WHEN** the same list is viewed in light and dark themes
- **THEN** its preview card image is identical
