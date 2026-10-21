# Spec Delta

## Purpose

Lets anyone publish a mod list and keep control of it without creating an account, while keeping every published list out of public directories.

## ADDED Requirements

### Requirement: Create a list without an account

The system SHALL allow a list to be published without registration, sign-in, or any third-party identity.

#### Scenario: Anonymous publish

- **WHEN** a visitor submits a valid mod list
- **THEN** the list is published and a shareable URL is returned

### Requirement: Issue a one-time edit token

On creation the system SHALL issue an edit token exactly once, SHALL store only a hash of it, and SHALL present it to the creator as the means of later control.

#### Scenario: Token shown once

- **WHEN** a list is created
- **THEN** the raw edit token is returned to the creator and never retrievable again

#### Scenario: Token not stored in plaintext

- **WHEN** the token is persisted
- **THEN** only its hash is stored

### Requirement: Authorize edits with the edit token

The system SHALL permit changes to a list only when the request presents an edit token whose hash matches the stored hash, and SHALL reject all other edit attempts.

#### Scenario: Valid token edits

- **WHEN** the creator presents the correct edit token
- **THEN** the requested changes are applied

#### Scenario: Invalid token rejected

- **WHEN** a request presents a wrong or missing edit token
- **THEN** no change is made and the request is refused

### Requirement: Keep every list unlisted

Every published list SHALL be reachable only by its URL: the system SHALL send `noindex`, SHALL NOT include lists in any directory, index, sitemap, or feed, and SHALL use identifiers that cannot be enumerated.

#### Scenario: Page is not indexed

- **WHEN** a crawler requests a published list
- **THEN** the response instructs it not to index the page

#### Scenario: No discovery surface

- **WHEN** a visitor has no list URL
- **THEN** the system offers no way to browse or search published lists

### Requirement: Provide a stable canonical URL

Each list SHALL be reachable at `/l/<id>/<slug>`, where the identifier resolves the list and the slug is decorative.

#### Scenario: Slug drift redirects

- **WHEN** a request uses a slug that no longer matches the list title
- **THEN** the system redirects to the canonical URL for that identifier

#### Scenario: Identifier alone resolves

- **WHEN** a request uses the correct identifier with any slug
- **THEN** the list is served or redirected to its canonical URL

### Requirement: Edit title, notes, and hidden mods

The system SHALL let the creator change the list title, add or change a note on any item, and hide or unhide any item. Hidden items SHALL remain stored with the list.

#### Scenario: Note added

- **WHEN** the creator saves a note on a mod
- **THEN** the public page shows that note with the mod

#### Scenario: Mod hidden

- **WHEN** the creator hides a mod
- **THEN** the public page omits it while the list still stores it

### Requirement: Rate limit list creation

The system SHALL limit how many lists a single client can create within a time window and SHALL refuse excess attempts.

#### Scenario: Repeated creation throttled

- **WHEN** one client creates lists beyond the allowed rate
- **THEN** further attempts are refused until the window passes

### Requirement: Delete a list permanently

The system SHALL let the creator delete a list when presenting its edit token, and SHALL make a deleted list's URL stop resolving.

#### Scenario: Deleted list is gone

- **WHEN** the creator deletes a list and then requests its URL
- **THEN** the system reports that no such list exists
