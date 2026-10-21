# modlist-ingestion Specification

## Purpose

Turns a RimWorld mod list from any supported source into one ordered, normalised list, while reading no more of the user's file than the header that holds it.

## Requirements

### Requirement: Accept four mod-list sources

The system SHALL accept a RimWorld save file, a `.rml` mod-list export, a `ModsConfig.xml`, and a Steam Workshop collection URL as mod-list sources.

#### Scenario: Save file accepted

- **WHEN** the user submits a `.rws` file containing a mod-list header
- **THEN** the system extracts the mods and proceeds to publish

#### Scenario: Mod-list export accepted

- **WHEN** the user submits a `.rml` file produced by the game's "Save mod list" action
- **THEN** the system extracts the mods and proceeds to publish

#### Scenario: Configuration file accepted

- **WHEN** the user submits a `ModsConfig.xml`
- **THEN** the system extracts the active mods in their recorded order

#### Scenario: Collection URL accepted

- **WHEN** the user submits a Steam Workshop collection URL for RimWorld
- **THEN** the system resolves the collection's items and proceeds with Workshop identities only

#### Scenario: Unrecognised input rejected

- **WHEN** the user submits a file or URL that is not one of the accepted sources
- **THEN** the system rejects it and names the accepted sources

### Requirement: Read only the header of a submitted file

The system SHALL read at most the first 1 MiB of a submitted file, SHALL parse only the mod-list header, and SHALL NOT transmit, store, or display any colony content.

#### Scenario: Large save produces a small upload

- **WHEN** the user submits a 20 MB save whose header ends within the first 12 KB
- **THEN** only the extracted mod-list data leaves the user's device

#### Scenario: Header not found in the window

- **WHEN** the mod-list header is not present within the first 1 MiB
- **THEN** the system rejects the file without extracting a partial list

### Requirement: Preserve the recorded load order

The system SHALL assign each mod the position it held in the source and SHALL NOT reorder, sort, or otherwise change that order.

#### Scenario: Order matches the file

- **WHEN** a save records 135 mods in a specific sequence
- **THEN** the published list preserves that exact sequence

#### Scenario: Core is not assumed to be first

- **WHEN** the source places `ludeon.rimworld` at a position other than the first
- **THEN** the system keeps that position rather than moving official content to the front

### Requirement: Normalise package identifiers

The system SHALL normalise every package identifier to lowercase and SHALL strip a trailing `_steam` suffix before resolution, while retaining the original value for display.

#### Scenario: Steam postfix stripped

- **WHEN** a source records `Mlie.SomeMod_Steam`
- **THEN** the system resolves the identifier as `mlie.somemod`

### Requirement: Classify recorded Steam identifiers

The system SHALL interpret a recorded Steam identifier of `0` as no Workshop identity, SHALL treat known RimWorld DLC app IDs as official content rather than Workshop items, and SHALL otherwise treat the value as a Workshop published-file ID.

#### Scenario: DLC app ID is not a Workshop item

- **WHEN** the source records `1149640` for Royalty
- **THEN** the system classifies it as official content and never builds a Workshop link from it

#### Scenario: Workshop identity recognised

- **WHEN** the source records a published-file ID that is not `0` and not a known DLC app ID
- **THEN** the system treats it as that mod's Workshop identity

### Requirement: Accept gzip-compressed saves

The system SHALL detect gzip-compressed input and decompress it before parsing.

#### Scenario: Compressed save accepted

- **WHEN** the user submits a gzip-compressed save
- **THEN** the system decompresses it and extracts the mod list normally

### Requirement: Report extraction failures with an actionable reason

The system SHALL fail with a specific reason when the root element is unrecognised, the mod-list header is missing, the parallel mod lists differ in length, or the list contains no mods. Each message SHALL name a source the user can supply instead.

#### Scenario: Parallel lists disagree

- **WHEN** the identifier and name lists contain different numbers of entries
- **THEN** the system rejects the file and states that it is malformed

#### Scenario: Save predates package identifiers

- **WHEN** the user submits a save whose mod entries are folder names rather than package identifiers
- **THEN** the system rejects it and asks for a `.rml` or `ModsConfig.xml` instead

#### Scenario: Empty mod list

- **WHEN** the extracted list contains no mods
- **THEN** the system reports that there is nothing to publish

### Requirement: Derive a default title

The system SHALL derive an editable default title from the submitted filename for files, and from the collection name for collection URLs.

#### Scenario: Title from save filename

- **WHEN** the user submits `My Colony 12.rws`
- **THEN** the draft list is titled `My Colony 12`
