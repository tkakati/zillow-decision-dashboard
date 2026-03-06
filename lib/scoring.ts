import { attributeSchema } from "@/data/attributeSchema";
import { AttributeKey, House, PreferencesState, ScoreBreakdown } from "@/lib/types";

function createAttributeRecord(seed = 0): Record<AttributeKey, number> {
  return {
    price: seed,
    squareFootage: seed,
    commuteTime: seed,
    walkScore: seed,
    parking: seed,
    naturalLight: seed,
    noiseLevel: seed,
    safety: seed,
    inUnitLaundry: seed,
    hoaFees: seed,
  };
}

export function getWeightForAttribute(
  attribute: AttributeKey,
  weights: Partial<Record<AttributeKey, number>>,
): number {
  const raw = weights[attribute];
  if (raw === undefined || Number.isNaN(raw)) {
    return 5;
  }

  return Math.max(0, raw);
}

function normalizeNumeric(
  value: number,
  min: number,
  max: number,
  higherIsBetter: boolean,
): number {
  let norm = max === min ? 0.5 : (value - min) / (max - min);
  if (!higherIsBetter) {
    norm = 1 - norm;
  }

  return Math.max(0, Math.min(1, norm));
}

function normalizeValue(
  house: House,
  attribute: AttributeKey,
  stats: Partial<Record<AttributeKey, { min: number; max: number }>>,
): number {
  const meta = attributeSchema[attribute];
  const value = house[attribute];

  if (meta.type === "numeric") {
    const stat = stats[attribute];
    if (!stat) {
      return 0.5;
    }

    return normalizeNumeric(value as number, stat.min, stat.max, meta.higherIsBetter);
  }

  if (meta.type === "boolean") {
    const boolNorm = value ? 1 : 0;
    return meta.higherIsBetter ? boolNorm : 1 - boolNorm;
  }

  let ratingNorm = (value as number) / 5;
  if (!meta.higherIsBetter) {
    ratingNorm = 1 - ratingNorm;
  }

  return Math.max(0, Math.min(1, ratingNorm));
}

function buildNumericStats(
  houses: House[],
  attributes: AttributeKey[],
): Partial<Record<AttributeKey, { min: number; max: number }>> {
  const stats: Partial<Record<AttributeKey, { min: number; max: number }>> = {};

  for (const attribute of attributes) {
    if (attributeSchema[attribute].type !== "numeric") {
      continue;
    }

    const values = houses.map((house) => house[attribute] as number);
    stats[attribute] = {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  return stats;
}

export function computeScores(
  houses: House[],
  selectedAttributes: AttributeKey[],
  weights: Partial<Record<AttributeKey, number>>,
): Record<string, ScoreBreakdown> {
  const stats = buildNumericStats(houses, selectedAttributes);
  const rawWeights = selectedAttributes.map((attribute) => ({
    attribute,
    weight: getWeightForAttribute(attribute, weights),
  }));

  const hasPositiveWeight = rawWeights.some(({ weight }) => weight > 0);
  const resolvedWeights = hasPositiveWeight
    ? rawWeights
    : rawWeights.map(({ attribute }) => ({ attribute, weight: 1 }));

  const scored = houses.map((house) => {
    const normalized = createAttributeRecord(0);
    const contributions = createAttributeRecord(0);

    let weightedSum = 0;

    for (const { attribute, weight } of resolvedWeights) {
      const norm = normalizeValue(house, attribute, stats);
      normalized[attribute] = norm;
      contributions[attribute] = norm * weight;
      weightedSum += norm * weight;
    }

    return {
      houseId: house.id,
      score: weightedSum,
      normalized,
      contributions,
    };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const rankMap = new Map<string, number>();
  ranked.forEach((entry, index) => {
    rankMap.set(entry.houseId, index + 1);
  });

  return Object.fromEntries(
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
}

function fmtAttributeValue(house: House, attribute: AttributeKey): string {
  const value = house[attribute];

  switch (attribute) {
    case "price":
    case "hoaFees":
      return `$${Number(value).toLocaleString()}`;
    case "squareFootage":
      return `${value} sqft`;
    case "commuteTime":
      return `${value} min`;
    case "walkScore":
      return `${value}`;
    case "naturalLight":
    case "noiseLevel":
    case "safety":
      return `${value}/5`;
    case "parking":
    case "inUnitLaundry":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
}

function bedroomToNumber(value: PreferencesState["beds"]): number {
  if (value === "studio") {
    return 0;
  }

  return Number(value);
}

function bathroomToNumber(value: PreferencesState["baths"]): number {
  if (value === "any") {
    return 0;
  }

  return Number(value.replace("+", ""));
}

// v2-ready stub: deterministic explanation template that can later be replaced by an LLM.
export function generateTradeoffExplanation(
  house: House,
  selectedAttributes: AttributeKey[],
  weights: Partial<Record<AttributeKey, number>>,
  breakdown: ScoreBreakdown,
  preferences: PreferencesState,
): string {
  const sortedStrengths = [...selectedAttributes].sort((a, b) => {
    const aScore = breakdown.contributions[a];
    const bScore = breakdown.contributions[b];
    return bScore - aScore;
  });

  const bestOne = sortedStrengths[0];
  const bestTwo = sortedStrengths[1];
  const weakest = [...selectedAttributes].sort((a, b) => {
    const aScore = breakdown.contributions[a];
    const bScore = breakdown.contributions[b];
    return aScore - bScore;
  })[0];

  const topWeight = bestOne ? getWeightForAttribute(bestOne, weights) : 0;
  const strongestClause = bestOne
    ? `${attributeSchema[bestOne].displayName.toLowerCase()} (${fmtAttributeValue(house, bestOne)})`
    : "its balanced profile";
  const secondaryClause = bestTwo
    ? ` and ${attributeSchema[bestTwo].displayName.toLowerCase()} (${fmtAttributeValue(house, bestTwo)})`
    : "";

  const sentenceOne = `${house.name} lands at #${breakdown.rank} because of strong ${strongestClause}${secondaryClause}.`;

  const sentenceTwo = weakest
    ? `Its biggest tradeoff is ${attributeSchema[weakest].displayName.toLowerCase()} at ${fmtAttributeValue(house, weakest)}, which contributes less under your current weights.`
    : "Tradeoffs are limited because your selected attributes are currently balanced.";

  const preferenceSentences: string[] = [];

  if (preferences.hasPets && preferences.petTypes.length > 0) {
    const supported = preferences.petTypes.filter((petType) => house.petFriendly.includes(petType));
    if (supported.length === preferences.petTypes.length) {
      preferenceSentences.push(
        `It also matches your pet setup by supporting ${supported.join(", ")} policies in this demo profile.`,
      );
    } else {
      const missing = preferences.petTypes.filter((petType) => !house.petFriendly.includes(petType));
      preferenceSentences.push(
        `Pet fit is mixed: ${missing.join(", ")} support is not explicit, so verify policy details before deciding.`,
      );
    }
  } else {
    const selectedBeds = bedroomToNumber(preferences.beds);
    const minBaths = bathroomToNumber(preferences.baths);
    const bedMatch = preferences.bedsExactMatch
      ? house.bedrooms === selectedBeds
      : house.bedrooms >= selectedBeds;
    const bedBathMatch = bedMatch && house.bathrooms >= minBaths;
    const bedLabel = preferences.beds === "studio" ? "Studio" : preferences.beds;
    if (bedBathMatch) {
      preferenceSentences.push(
        `This unit meets your ${bedLabel} bed / ${preferences.baths} bath preference in the demo data.`,
      );
    } else {
      preferenceSentences.push(
        `This unit may fall short of your ${bedLabel} bed / ${preferences.baths} bath target, so layout needs a closer look.`,
      );
    }
  }

  if (topWeight <= 1) {
    preferenceSentences.push("Weights are light right now, so rank differences are intentionally subtle.");
  }

  return [sentenceOne, sentenceTwo, ...preferenceSentences].slice(0, 4).join(" ");
}
