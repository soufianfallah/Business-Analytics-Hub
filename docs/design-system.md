# Design system

Reusable UI primitives live in `src/components/ui`. They are feature-agnostic, accessible, theme-aware, and accept `className` for deliberate layout composition.

## Foundations

- `button`, `async-button`, `badge`, `input`, `textarea`, `label`, `field`, `checkbox`, `select`, and `date-picker` cover actions and form controls.
- `card`, `table`, `data-table`, `chart`, and `chart-card` cover structured data presentation.
- `dialog`, `sheet`, `popover`, `dropdown-menu`, `tabs`, and `tooltip` cover overlays and navigation.
- `skeleton`, `loading-state`, `empty-state`, `error-state`, and `alert` provide consistent UI states.

Prefer these primitives over one-off feature styling. Business language and data fetching remain in feature components; UI primitives must not import feature modules.
