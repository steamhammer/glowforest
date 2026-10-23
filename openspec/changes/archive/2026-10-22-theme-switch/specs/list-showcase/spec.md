# Spec Delta

## MODIFIED Requirements

### Requirement: Site-wide colour theme control

Without scripting, every page SHALL follow the visitor's system colour preference. With scripting, every page — home, list, edit, and not-found — SHALL carry the same two-position switch in its site header, offering light and dark; the first explicit choice SHALL persist across visits and be applied before the first paint. The generated preview card image SHALL keep a fixed appearance in every theme.

#### Scenario: System preference honoured without JavaScript

- **WHEN** a page is opened with scripting disabled
- **THEN** both colour palettes are provided and the visitor's system preference selects the active one

#### Scenario: Control present on every page

- **WHEN** the visitor opens the home page, a list page, an edit page, or a missing page
- **THEN** the site header offers a light position and a dark position

#### Scenario: Switch reflects the system preference until a choice is made

- **WHEN** the visitor has never chosen a theme and the system prefers dark
- **THEN** the switch shows the dark position as active, and no theme preference is stored

#### Scenario: Manual choice persists

- **WHEN** the visitor moves the switch to light and reloads any page
- **THEN** the light palette is applied before the first paint

#### Scenario: Preview card is theme-independent

- **WHEN** the same list is viewed in light and dark themes
- **THEN** its preview card image is identical
