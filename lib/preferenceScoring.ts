import { House, PreferenceScoreBreakdown, WeightedScoringDimension } from "@/lib/types";

export interface ScoringDimensionDefinition {
  id: string;
  label: string;
  type: "numeric" | "categorical";
  higherIsBetter?: boolean;
  weightLevel: number;
  getValue: (house: House) => number;
}

interface ResolvedDimension {
  id: string;
  label: string;
  type: "numeric" | "categorical";
  higherIsBetter: boolean;
  weightPercent: number;
  getValue: (house: House) => number;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeNumeric(value: number, min: number, max: number, higherIsBetter: boolean): number {
  let normalized = max === min ? 0.5 : (value - min) / (max - min);
  if (!higherIsBetter) {
    normalized = 1 - normalized;
  }
  return clamp01(normalized);
}

export function computePreferenceScores(
  houses: House[],
  definitions: ScoringDimensionDefinition[],
): {
  dimensions: WeightedScoringDimension[];
  scoreMap: Record<string, PreferenceScoreBreakdown>;
} {
  const usableDefinitions = definitions.filter(
    (dimension) => Number.isFinite(dimension.weightLevel) && dimension.weightLevel > 0,
  );

  if (usableDefinitions.length === 0) {
    const emptyScoreMap: Record<string, PreferenceScoreBreakdown> = Object.fromEntries(
      houses.map((house) => [
        house.id,
        {
          score: 0,
          rank: 1,
          normalized: {},
          contributions: {},
        },
      ]),
    );

    return {
      dimensions: [],
      scoreMap: emptyScoreMap,
    };
  }

  const totalWeight = usableDefinitions.reduce((sum, dimension) => sum + dimension.weightLevel, 0);
  const resolved: ResolvedDimension[] = usableDefinitions.map((dimension) => ({
    id: dimension.id,
    label: dimension.label,
    type: dimension.type,
    higherIsBetter: dimension.higherIsBetter ?? true,
    weightPercent: (dimension.weightLevel / totalWeight) * 100,
    getValue: dimension.getValue,
  }));

  const numericStats: Record<string, { min: number; max: number }> = {};
  for (const dimension of resolved) {
    if (dimension.type !== "numeric") {
      continue;
    }

    const values = houses.map((house) => dimension.getValue(house));
    numericStats[dimension.id] = {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  const scored = houses.map((house) => {
    const normalized: Record<string, number> = {};
    const contributions: Record<string, number> = {};

    let score = 0;

    for (const dimension of resolved) {
      const rawValue = dimension.getValue(house);
      const normalizedValue =
        dimension.type === "numeric"
          ? normalizeNumeric(
              rawValue,
              numericStats[dimension.id].min,
              numericStats[dimension.id].max,
              dimension.higherIsBetter,
            )
          : clamp01(rawValue >= 1 ? 1 : 0);

      const contribution = dimension.weightPercent * normalizedValue;
      normalized[dimension.id] = normalizedValue;
      contributions[dimension.id] = contribution;
      score += contribution;
    }

    return {
      houseId: house.id,
      score,
      normalized,
      contributions,
    };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const rankMap = new Map<string, number>();
  ranked.forEach((entry, index) => rankMap.set(entry.houseId, index + 1));

  const scoreMap: Record<string, PreferenceScoreBreakdown> = Object.fromEntries(
    scored.map((entry) => [
      entry.houseId,
      {
        score: entry.score,
        rank: rankMap.get(entry.houseId) ?? ranked.length,
        normalized: entry.normalized,
        contributions: entry.contributions,
      },
    ]),
  );

  return {
    dimensions: resolved.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      weightPercent: dimension.weightPercent,
    })),
    scoreMap,
  };
}
