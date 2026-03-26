# Scoring Details

Detailed scoring behavior for Zillow Decision Dashboard.

## Source of Truth

- `lib/scoring.ts`
- `lib/preferenceScoring.ts`
- `data/attributeSchema.ts`
- `components/RankingExplanationModal.tsx`

## Current Behavior

- Ranking activates when there are at least 3 homes and 3 selected attributes.
- Numeric values are min-max normalized (`max == min => 0.5`).
- Boolean values are mapped to binary fitness values.
- Lower-is-better attributes invert normalized values.
- Final score is weighted by user-selected attribute weights.

Formula:

```text
score = sum(norm_i * weight_i) / sum(weight_i)
```

## To Be Expanded

- Attribute-specific normalization examples
- Edge-case handling examples
- Explanation modal metric mapping
