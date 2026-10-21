# Tasks

## 1. Foundation

- [x] 1.1 Scaffold the Worker application with static assets in TypeScript, and verify `wrangler dev` serves the landing page locally
- [x] 1.2 Configure D1 and R2 bindings for local and deployed environments, and verify both bindings resolve in a dev-only diagnostic route
- [x] 1.3 Set up the test runner with one passing smoke test, and verify `npm test` succeeds
- [x] 1.4 Define the shared mod-list types from `design.md` D2 (source, game version, raw mod, ingested list), and verify type-check passes

## 2. Data Layer

- [x] 2.1 Write the D1 migration for `lists`, `list_items`, `workshop_mods`, and `mod_meta` per `design.md` D6, and verify it applies and rolls back locally
- [x] 2.2 Implement the list and list-item repository, and verify unit tests cover create, read, update, and delete
- [x] 2.3 Implement the metadata repository with a freshness window, and verify unit tests distinguish fresh from stale rows

## 3. Ingestion

- [x] 3.1 Implement input sniffing (gzip magic, ZIP rejection, text) and the 1 MiB header slice, and verify tests cover each branch
- [x] 3.2 Implement the `<savegame>` and `<savedModList>` meta parser, and verify tests extract ids, Steam ids, names, and game version from fixtures
- [x] 3.3 Add small synthetic fixtures for save, `.rml`, and `ModsConfig.xml` (header plus filler body), and verify each fixture parses to the expected mod count
- [x] 3.4 Implement the `ModsConfig.xml` adapter, and verify tests read `activeMods` order
- [x] 3.5 Implement the Steam collection adapter against `GetCollectionDetails`, and verify tests resolve a mocked collection into Workshop identities
- [x] 3.6 Implement normalisation: lowercase, `_steam` stripping, `0` handling, and DLC app-ID classification, and verify tests cover Royalty `1149640` and a Workshop ID
- [x] 3.7 Implement ingestion failures with actionable messages per the spec, and verify tests cover missing header, mismatched list lengths, empty list, and legacy saves
- [x] 3.8 Build the create form leading with a save drop target and a secondary `.rml` path, with `ModsConfig.xml` and collection URL as alternatives, and verify the flow locally with each fixture
- [x] 3.9 Add per-OS copyable file paths and drag-and-drop for all three file formats, and verify the paths are selectable and correct on each documented OS
- [x] 3.10 Derive the default title from filename or collection name, and verify an editable title is pre-filled in the form

## 4. Metadata

- [x] 4.1 Implement the community-index importer over `steamDB.json`, and verify a repeat import leaves row counts unchanged
- [x] 4.2 Implement identifier resolution with exact match, version and name tie-break, placeholder rejection, and recorded-ID precedence, and verify tests cover each rule
- [x] 4.3 Implement the Steam client with batched `GetPublishedFileDetails`, request timeout, and per-item error isolation, and verify tests use a mocked fetch
- [x] 4.4 Wire cache-first enrichment so a fully fresh list makes no Steam request, and verify with a test asserting zero outbound calls
- [x] 4.5 Verify the page renders when Steam times out by injecting a failing client and asserting the response still contains recorded names
- [x] 4.6 Classify Core and expansions and map them to store links, and verify tests assert no Workshop link is produced for them

## 5. Publishing

- [x] 5.1 Implement anonymous list creation that issues an edit token exactly once, and verify a test asserts only the token hash is persisted
- [x] 5.2 Implement edit authorization against the stored token hash, and verify tests accept the correct token and refuse a wrong or missing one
- [x] 5.3 Implement title, note, and hidden-flag edits plus permanent deletion, and verify tests confirm hidden items remain stored and deleted lists stop resolving
- [x] 5.4 Implement per-client creation rate limiting, and verify a test exceeds the window and receives a refusal
- [x] 5.5 Implement the canonical `/l/<id>/<slug>` route with slug-drift redirect, and verify tests cover correct slug, stale slug, and identifier-only requests
- [x] 5.6 Send `noindex` on list pages and confirm no directory, sitemap, or search route exposes lists, and verify with a response-header assertion and a route inventory check

## 6. Showcase

- [x] 6.1 Render the public page server-side in recorded load order with name, author, thumbnail, versions, size, last-updated time, and Workshop link, and verify HTML assertions against a seeded list
- [x] 6.2 Render author notes and omit hidden mods from both the list and the statistics, and verify a seeded list with notes and hidden items
- [x] 6.3 Render official and unresolved mods with their distinct states and no incorrect links, and verify assertions for both cases
- [x] 6.4 Render aggregate statistics (visible count, combined size, recorded game version), and verify the numbers on a seeded fixture
- [x] 6.5 Implement game-version drift detection, and verify a list recording `1.7` flags a mod supporting only `1.6`
- [x] 6.6 Implement the preview card image (layout to WebP) cached in R2 under a key derived from list update time, and verify the card is regenerated after an edit
- [x] 6.7 Add preview metadata tags and Workshop attribution, and verify a fetched page exposes the card URL and source attribution
- [x] 6.8 Return a not-found response for unknown and deleted identifiers, and verify with a test
- [x] 6.9 Verify the page remains readable with JavaScript disabled and degrades when metadata is missing

## 7. Deployment

- [x] 7.1 Apply the production D1 migration and import the community index, and verify a sample of ~50 known package identifiers resolves correctly
- [x] 7.2 Deploy the Worker and run a create → publish → view → edit → delete smoke test against production
- [x] 7.3 Document the rollback path (previous Worker version plus idempotent index re-import) and verify it by redeploying the prior version

## 8. Integration Verification

- [x] 8.1 Run the full journey with a real 135-mod save: extract, resolve, publish, view, and confirm the preview image renders
- [x] 8.2 Confirm no colony content is transmitted by inspecting the creation request payload size and fields

## Workflow follow-up

- Archive the change once review requirements are satisfied and the deployment smoke test has passed.
