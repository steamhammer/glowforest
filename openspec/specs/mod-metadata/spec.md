# mod-metadata Specification

## Purpose

Gives every mod in a list a resolvable Steam identity and cached display metadata, so pages show real titles, authors, art, and version support rather than bare identifiers.

## Requirements

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

### Requirement: Break a title tie by shared Workshop author

When several Workshop items share a mod's title and the game version cannot separate them, the system SHALL compare each candidate's Workshop creator with the creators of the list's indexed mods in the same package-id namespace, and SHALL resolve to a candidate only when exactly one of them shares such a creator. Otherwise the mod SHALL stay unresolved and keep its candidate links.

#### Scenario: Namespace sibling identifies the author

- **WHEN** two candidates share a title, one of them has the same creator as an indexed mod in the namespace, and the other does not
- **THEN** the matching candidate is attached to the list item

#### Scenario: No shared author stays unresolved

- **WHEN** no candidate shares a creator with an indexed mod in the namespace, or several candidates do
- **THEN** the mod stays unresolved and its candidates remain listed as links

#### Scenario: No namespace sibling, no guess

- **WHEN** the namespace has no resolved mod in the index, so no creator can be established
- **THEN** the candidates are not compared and the mod stays unresolved

#### Scenario: Recorded identity and identifier matches are untouched

- **WHEN** a mod already resolved through a recorded Workshop id or a package-id match
- **THEN** the creator comparison does not run

### Requirement: Resolve unindexed mods by exact title

When a mod's package identifier has no index entry, the system SHALL fall back to an exact normalized title match against index entries without a package identifier, and SHALL attach a Workshop item only when that match is unambiguous.

#### Scenario: Unique title resolves an unindexed mod

- **WHEN** a list item's package identifier is absent from the index and exactly one index entry without a package identifier has the same title
- **THEN** that Workshop item is attached to the list item

#### Scenario: Version support breaks a title tie

- **WHEN** two index entries share the title, only one of them lists the list's game version, and both lack a package identifier
- **THEN** the version-compatible entry is attached

#### Scenario: Ambiguous title stays unresolved

- **WHEN** the title matches index entries without a package identifier and more than one of them supports the list's game version, or none does
- **THEN** the mod stays unresolved rather than receiving a guessed Workshop item

### Requirement: Scope the title fallback narrowly

The fallback SHALL consider only index entries that carry no package identifier, SHALL skip mods that carry a recorded Workshop identity, and SHALL leave a mod unresolved when the match stays ambiguous.

#### Scenario: Indexed entries are never poached

- **WHEN** an index entry with the matching title already carries a package identifier
- **THEN** it is not used as a fallback, so one mod is never attributed another mod's Workshop item

#### Scenario: Recorded Workshop identity still wins

- **WHEN** a list item carries a recorded Workshop identifier
- **THEN** the title fallback is not consulted

### Requirement: Preserve stored index values across imports

An index import SHALL NOT replace a stored package identifier or other stored index field with an empty value from the incoming dataset, so mappings learned or curated earlier survive dataset refreshes.

#### Scenario: Refresh keeps a known identifier

- **WHEN** an index entry is re-imported with no package identifier but a package identifier is already stored for that Workshop id
- **THEN** the stored package identifier remains

#### Scenario: Refresh keeps stored details

- **WHEN** an index entry is re-imported with no name, no authors, or no game versions but such values are already stored
- **THEN** the stored values remain
