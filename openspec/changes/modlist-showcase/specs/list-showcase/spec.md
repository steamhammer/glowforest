# Spec Delta

## Purpose

Renders a published mod list as a readable, linkable page and a useful preview card, so a player can share what their colony was built on without explaining it.

## ADDED Requirements

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
