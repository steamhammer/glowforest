## ADDED Requirements

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
