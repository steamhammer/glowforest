## 1. Index lookup

- [x] 1.1 Add a DB function that returns index rows lacking a package identifier for a set of titles
- [x] 1.2 Normalize titles consistently between the resolver and the query

## 2. Resolution

- [x] 2.1 Add a pure candidate picker: unique match, or a unique game-version match, else none
- [x] 2.2 Consult the title fallback only for mods without a recorded Workshop id whose package identifier missed
- [x] 2.3 Verify a page still marks genuinely unknown mods unresolved

## 3. Import durability

- [x] 3.1 Preserve stored package identifiers, names, and authors when an import omits them
- [x] 3.2 Preserve stored game versions when an import carries none

## 4. Resilience

- [x] 4.1 Keep rendering when the metadata cache write fails

## 5. Verification

- [x] 5.1 Unit tests for unique, version-tied, and ambiguous title matches
- [x] 5.2 Unit tests for import merge behaviour
- [ ] 5.3 Browser check that `crows.dustbunny` resolves on the production list
- [x] 5.4 Document curated mappings as an escape hatch
