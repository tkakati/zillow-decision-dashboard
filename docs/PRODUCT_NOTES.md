# Product Notes

Product behavior and UX notes for Zillow Decision Dashboard.

## Source of Truth

- `app/page.tsx`
- `components/PreferencesCard.tsx`
- `components/AttributeSelector.tsx`
- `components/DashboardTable.tsx`
- `lib/storage.ts`

## Current Scope

- Frontend-only application with deterministic scoring.
- Preference selection and weighting workflow for rental comparison.
- Table sorting, drag-reordering, and persisted local state.
- Optional AI explanation paths are currently deterministic/template-oriented by default behavior.

## To Be Expanded

- UX decision rationale per panel
- State model and persistence matrix
- Accessibility and keyboard interaction notes
