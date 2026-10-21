## ADDED Requirements

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
