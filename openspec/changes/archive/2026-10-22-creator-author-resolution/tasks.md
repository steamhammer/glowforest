## 1. Creator data

- [x] 1.1 Add a `creator` column to `mod_meta` and carry it through the metadata model
- [x] 1.2 Return the Workshop creator from the Steam details request and cache it with the other metadata

## 2. Resolution

- [x] 2.1 Add a pure candidate picker that accepts a candidate only when exactly one shares a creator with the namespace's siblings
- [x] 2.2 Add a query for a namespace's already-resolved Workshop ids, capped per namespace
- [x] 2.3 Compare creators only for mods left ambiguous by the title step, inside the page's existing batched fetch

## 3. Verification

- [x] 3.1 Unit tests for a unique creator match, several matches, and no namespace evidence
- [x] 3.2 Integration test that an ambiguous mod resolves when its creator matches a namespace sibling, and stays ambiguous otherwise
- [x] 3.3 Confirm on the production list that Dust Bunnies resolves to 3480725900 without any manual curation
