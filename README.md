# Zillow Decision Dashboard

Decision-support dashboard for comparing shortlisted rentals with transparent weighted tradeoffs.

## What It Does

- Captures renter preferences and attribute priorities.
- Lets users tune weighted attributes and ranking behavior.
- Produces deterministic, explainable scores for each listing.
- Supports sorting and drag-reordering of the comparison table.
- Persists preferences and ordering locally across sessions.

## Architecture Snapshot

- Frontend-only Next.js App Router application.
- Deterministic scoring engine in local library modules.
- Browser-side LocalStorage persistence for user preferences and table state.

## Scoring Snapshot

Ranking is active only when there are at least:

- `3` homes
- `3` selected attributes

Normalization summary:

- Numeric fields use min-max normalization (`max == min => 0.5`).
- Boolean fields map to `true = 1`, `false = 0`.
- Lower-is-better attributes invert normalized scores.

Formula:

```text
score = sum(norm_i * weight_i) / sum(weight_i)
```

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` - Start dev server
- `npm run lint` - Run lint checks
- `npm run typecheck` - Run TypeScript type checks
- `npm run build` - Build production bundle
- `npm run start` - Start production server

## Deployment Notes

- Vercel is the recommended deployment target for current scope.
- No required environment variables for the current version.

## Deep Docs

- [Scoring details](docs/SCORING.md)
- [Product notes](docs/PRODUCT_NOTES.md)
- [Roadmap](docs/ROADMAP.md)
