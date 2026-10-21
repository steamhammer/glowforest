# Spec Delta

## Purpose

Gives every mod in a list a resolvable Steam identity and cached display metadata, so pages show real titles, authors, art, and version support rather than bare identifiers.

## ADDED Requirements

### Requirement: Resolve package identifiers to Workshop items

The system SHALL resolve a package identifier to a Workshop item using the imported community index, preferring an exact identifier match and breaking ties by the list's game version and then by recorded name similarity.

#### Scenario: Exact match resolves

- **WHEN** the index contains an exact entry for a mod's package identifier
- **THEN** that Workshop item is attached to the list item

#### Scenario: Ambiguous identifier resolved deterministically

- **WHEN** more than one Workshop item claims the same package identifier
- **THEN** the system chooses by game version and then recorded name, and the same input always yields the same choice

#### Scenario: Placeholder identifiers never resolve

- **WHEN** a package identifier is a known placeholder such as `scenario.rsc` or `missing.packageid`
- **THEN** the system treats the mod as unresolved instead of attaching an arbitrary Workshop item

### Requirement: Prefer a recorded Workshop identity

When a list item carries a recorded Workshop identity that is neither `0` nor a known DLC app ID, the system SHALL use it in preference to index resolution.

#### Scenario: Recorded identity wins

- **WHEN** the recorded Workshop ID and the index point at different items
- **THEN** the recorded Workshop ID is used

### Requirement: Serve cached metadata without contacting Steam

The system SHALL render a page from stored metadata whenever it is present and fresh, SHALL request Steam only for missing or stale items, and SHALL NOT make page availability depend on a Steam response.

#### Scenario: Fresh cache makes no outbound call

- **WHEN** a page is requested and every mod has fresh cached metadata
- **THEN** no Steam request is made

#### Scenario: Steam unavailable

- **WHEN** Steam does not respond within the configured timeout
- **THEN** the page still renders using cached or recorded names

### Requirement: Fetch and cache Workshop metadata

For items lacking fresh metadata, the system SHALL fetch the Workshop title, author, thumbnail, file size, subscriber count, supported game versions, and last-updated time, and SHALL store them with the time of retrieval.

#### Scenario: Batched retrieval

- **WHEN** a list of 150 mods requires metadata
- **THEN** the system requests them in batches and stores one cached row per item

### Requirement: Represent unresolved mods honestly

For a mod with no Workshop item, the system SHALL display its recorded name or package identifier, SHALL mark it as unresolved, and SHALL NOT present a Workshop link or fabricated metadata.

#### Scenario: Unresolved mod with a recorded name

- **WHEN** a local-only mod has a recorded name but no Workshop item
- **THEN** the page shows that name, marked unresolved, with no Workshop link

#### Scenario: Unresolved mod without a name

- **WHEN** a mod has neither a Workshop item nor a recorded name
- **THEN** the page shows its package identifier, marked unresolved

### Requirement: Present official content as official

Core and expansion content SHALL be labelled as official and linked to its store page rather than the Workshop.

#### Scenario: Expansion rendered as official

- **WHEN** a list item is a known RimWorld expansion
- **THEN** it is shown as official content with no Workshop link

### Requirement: Import and refresh the community index

The system SHALL support importing the community package-identifier index, SHALL record when the current index was imported, and SHALL allow the import to be repeated without duplicating entries.

#### Scenario: Repeat import is idempotent

- **WHEN** the index is imported twice from the same dataset
- **THEN** the stored index is unchanged
