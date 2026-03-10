"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardTable } from "@/components/DashboardTable";
import { PreferencesCard } from "@/components/PreferencesCard";
import housesData from "@/data/houses.json";
import { defaultMoveInRange } from "@/lib/dateRange";
import { computePreferenceScores, ScoringDimensionDefinition } from "@/lib/preferenceScoring";
import { reconcileRowOrder, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  AmenityKey,
  CommuteDestination,
  House,
  HomeType,
  ListingStage,
  NeighborhoodScore,
  PetPolicyFilter,
  PreferencesState,
  PriorityKey,
  ViewPreference,
} from "@/lib/types";

const houseIds = (housesData as House[]).map((house) => house.id);
const defaultListingStages: Record<string, ListingStage> = Object.fromEntries(
  houseIds.map((id) => [id, "Scouting"]),
);

const defaultPriorityWeights: Record<PriorityKey, number> = {
  price: 3,
  commute: 4,
  amenities: 2,
  size: 3,
  pets: 2,
  neighborhood: 3,
  homeType: 2,
  moveInDate: 2,
  bedsBaths: 3,
};

const defaultPreferences: PreferencesState = {
  moveInStart: defaultMoveInRange().start,
  moveInEnd: defaultMoveInRange().end,
  beds: "1",
  bedsExactMatch: true,
  baths: "1+",
  hasPets: false,
  petTypes: [],
  priceMin: null,
  priceMax: null,
  homeTypes: [],
  amenities: [],
  petPolicyFilters: [],
  viewPreferences: [],
  neighborhoodScores: [],
  commuteDestinations: [{ type: "office", label: "", address: "" }],
  priorityWeights: defaultPriorityWeights,
  amenityWeights: {},
  neighborhoodViewWeights: {},
  neighborhoodScoreWeights: {},
};

const homeTypeScoreLabels: Record<HomeType, string> = {
  apartment: "Apartment",
  condo: "Condo",
  townhome: "Townhome",
  house: "House",
};

const petPolicyScoreLabels: Record<PetPolicyFilter, string> = {
  largeDog: "Allows large dogs",
  smallDog: "Allows small dogs",
  cat: "Allows cats",
  noPets: "No pets",
};

const viewScoreLabels: Record<ViewPreference, string> = {
  city: "City View",
  water: "Water View",
  mountain: "Mountain View",
  park: "Park View",
};

const neighborhoodScoreLabels: Record<NeighborhoodScore, string> = {
  walkScore: "Walk Score",
  transitScore: "Transit Score",
  bikeScore: "Bike Score",
};

const amenityScoreLabels: Record<AmenityKey, string> = {
  ac: "Must have A/C",
  pool: "Must have pool",
  waterfront: "Waterfront",
  parking: "On-site Parking",
  inUnitLaundry: "In-unit Laundry",
  zillowApplications: "Accepts Zillow Applications",
  incomeRestricted: "Income restricted",
  hardwoodFloors: "Hardwood Floors",
  disabledAccess: "Disabled Access",
  utilitiesIncluded: "Utilities Included",
  shortTermLease: "Short term lease",
  furnished: "Furnished",
  outdoorSpace: "Outdoor space",
  controlledAccess: "Controlled access",
  highSpeedInternet: "High speed internet",
  elevator: "Elevator",
  apartmentCommunity: "Apartment Community",
};

function clampWeightLevel(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(5, Math.max(1, Number(value)));
}

function sanitizePreferences(raw: unknown): PreferencesState {
  if (!raw || typeof raw !== "object") {
    return defaultPreferences;
  }

  const draft = raw as Partial<PreferencesState> & {
    commuteAddresses?: string[];
  };

  const moveInStart = typeof draft.moveInStart === "string" ? draft.moveInStart : defaultPreferences.moveInStart;
  const moveInEnd = typeof draft.moveInEnd === "string" ? draft.moveInEnd : defaultPreferences.moveInEnd;

  const beds =
    draft.beds === "studio" ||
    draft.beds === "1" ||
    draft.beds === "2" ||
    draft.beds === "3" ||
    draft.beds === "4" ||
    draft.beds === "5"
      ? draft.beds
      : defaultPreferences.beds;

  const bedsExactMatch = typeof draft.bedsExactMatch === "boolean" ? draft.bedsExactMatch : true;

  const baths =
    draft.baths === "any" ||
    draft.baths === "1+" ||
    draft.baths === "1.5+" ||
    draft.baths === "2+" ||
    draft.baths === "3+" ||
    draft.baths === "4+"
      ? draft.baths
      : defaultPreferences.baths;

  const priceMin =
    typeof draft.priceMin === "number" && Number.isFinite(draft.priceMin) ? Math.max(0, draft.priceMin) : null;
  const priceMax =
    typeof draft.priceMax === "number" && Number.isFinite(draft.priceMax) ? Math.max(0, draft.priceMax) : null;

  const homeTypes = Array.isArray(draft.homeTypes)
    ? draft.homeTypes.filter(
        (value): value is HomeType =>
          value === "apartment" || value === "condo" || value === "townhome" || value === "house",
      )
    : [];

  const amenities = Array.isArray(draft.amenities)
    ? draft.amenities.filter(
        (value): value is AmenityKey =>
          value === "ac" ||
          value === "pool" ||
          value === "waterfront" ||
          value === "parking" ||
          value === "inUnitLaundry" ||
          value === "zillowApplications" ||
          value === "incomeRestricted" ||
          value === "hardwoodFloors" ||
          value === "disabledAccess" ||
          value === "utilitiesIncluded" ||
          value === "shortTermLease" ||
          value === "furnished" ||
          value === "outdoorSpace" ||
          value === "controlledAccess" ||
          value === "highSpeedInternet" ||
          value === "elevator" ||
          value === "apartmentCommunity",
      )
    : [];

  const petPolicyFilters = Array.isArray(draft.petPolicyFilters)
    ? draft.petPolicyFilters.filter(
        (value): value is PetPolicyFilter =>
          value === "largeDog" || value === "smallDog" || value === "cat" || value === "noPets",
      )
    : [];

  const viewPreferences = Array.isArray(draft.viewPreferences)
    ? draft.viewPreferences.filter(
        (value): value is ViewPreference =>
          value === "city" || value === "mountain" || value === "park" || value === "water",
      )
    : [];
  const neighborhoodScores = Array.isArray(draft.neighborhoodScores)
    ? draft.neighborhoodScores.filter(
        (value): value is NeighborhoodScore =>
          value === "walkScore" || value === "transitScore" || value === "bikeScore",
      )
    : [];

  const commuteDestinations = Array.isArray(draft.commuteDestinations)
    ? draft.commuteDestinations
        .filter((item): item is CommuteDestination => Boolean(item && typeof item === "object"))
        .map((item) => ({
          type: (item.type === "other" ? "other" : "office") as CommuteDestination["type"],
          label: typeof item.label === "string" ? item.label : "",
          address: typeof item.address === "string" ? item.address : "",
        }))
        .slice(0, 5)
    : Array.isArray(draft.commuteAddresses)
      ? draft.commuteAddresses
          .filter((value): value is string => typeof value === "string")
          .map((address) => ({ type: "office" as const, label: "", address }))
          .slice(0, 5)
      : defaultPreferences.commuteDestinations;

  const priorityWeightsRaw = draft.priorityWeights;
  const priorityWeights: Record<PriorityKey, number> = {
    ...defaultPriorityWeights,
    ...(priorityWeightsRaw && typeof priorityWeightsRaw === "object"
      ? {
          price:
            typeof (priorityWeightsRaw as Record<string, unknown>).price === "number"
              ? Math.min(5, Math.max(1, Number((priorityWeightsRaw as Record<string, unknown>).price)))
              : defaultPriorityWeights.price,
          commute:
            typeof (priorityWeightsRaw as Record<string, unknown>).commute === "number"
              ? Math.min(5, Math.max(1, Number((priorityWeightsRaw as Record<string, unknown>).commute)))
              : defaultPriorityWeights.commute,
          amenities:
            typeof (priorityWeightsRaw as Record<string, unknown>).amenities === "number"
              ? Math.min(5, Math.max(1, Number((priorityWeightsRaw as Record<string, unknown>).amenities)))
              : defaultPriorityWeights.amenities,
          size:
            typeof (priorityWeightsRaw as Record<string, unknown>).size === "number"
              ? Math.min(5, Math.max(1, Number((priorityWeightsRaw as Record<string, unknown>).size)))
              : defaultPriorityWeights.size,
          pets:
            typeof (priorityWeightsRaw as Record<string, unknown>).pets === "number"
              ? Math.min(5, Math.max(1, Number((priorityWeightsRaw as Record<string, unknown>).pets)))
              : defaultPriorityWeights.pets,
          neighborhood: (() => {
            const current = (priorityWeightsRaw as Record<string, unknown>).neighborhood;
            if (typeof current === "number") {
              return Math.min(5, Math.max(1, Number(current)));
            }

            const legacy = (priorityWeightsRaw as Record<string, unknown>).view;
            if (typeof legacy === "number") {
              return Math.min(5, Math.max(1, Number(legacy)));
            }

            return defaultPriorityWeights.neighborhood;
          })(),
          homeType:
            typeof (priorityWeightsRaw as Record<string, unknown>).homeType === "number"
              ? Math.min(5, Math.max(1, Number((priorityWeightsRaw as Record<string, unknown>).homeType)))
              : defaultPriorityWeights.homeType,
          moveInDate:
            typeof (priorityWeightsRaw as Record<string, unknown>).moveInDate === "number"
              ? Math.min(5, Math.max(1, Number((priorityWeightsRaw as Record<string, unknown>).moveInDate)))
              : defaultPriorityWeights.moveInDate,
          bedsBaths:
            typeof (priorityWeightsRaw as Record<string, unknown>).bedsBaths === "number"
              ? Math.min(5, Math.max(1, Number((priorityWeightsRaw as Record<string, unknown>).bedsBaths)))
              : defaultPriorityWeights.bedsBaths,
        }
      : {}),
  };

  const amenityWeightsRaw =
    draft.amenityWeights && typeof draft.amenityWeights === "object"
      ? (draft.amenityWeights as Record<string, unknown>)
      : {};
  const neighborhoodViewWeightsRaw =
    draft.neighborhoodViewWeights && typeof draft.neighborhoodViewWeights === "object"
      ? (draft.neighborhoodViewWeights as Record<string, unknown>)
      : {};
  const neighborhoodScoreWeightsRaw =
    draft.neighborhoodScoreWeights && typeof draft.neighborhoodScoreWeights === "object"
      ? (draft.neighborhoodScoreWeights as Record<string, unknown>)
      : {};

  const amenityWeights: Partial<Record<AmenityKey, number>> = Object.fromEntries(
    amenities.map((amenity) => [
      amenity,
      clampWeightLevel(amenityWeightsRaw[amenity], priorityWeights.amenities),
    ]),
  ) as Partial<Record<AmenityKey, number>>;

  const neighborhoodViewWeights: Partial<Record<ViewPreference, number>> = Object.fromEntries(
    viewPreferences.map((view) => [
      view,
      clampWeightLevel(neighborhoodViewWeightsRaw[view], priorityWeights.neighborhood),
    ]),
  ) as Partial<Record<ViewPreference, number>>;

  const neighborhoodScoreWeights: Partial<Record<NeighborhoodScore, number>> = Object.fromEntries(
    neighborhoodScores.map((score) => [
      score,
      clampWeightLevel(neighborhoodScoreWeightsRaw[score], priorityWeights.neighborhood),
    ]),
  ) as Partial<Record<NeighborhoodScore, number>>;

  const hasNoPets = petPolicyFilters.includes("noPets");
  const hasPets = !hasNoPets && petPolicyFilters.some((value) => value === "cat" || value === "smallDog" || value === "largeDog");
  const petTypes = hasNoPets
    ? []
    : [
        ...(petPolicyFilters.includes("cat") ? (["cat"] as const) : []),
        ...(petPolicyFilters.includes("smallDog") ? (["smallDog"] as const) : []),
        ...(petPolicyFilters.includes("largeDog") ? (["largeDog"] as const) : []),
      ];

  return {
    moveInStart,
    moveInEnd,
    beds,
    bedsExactMatch,
    baths,
    hasPets,
    petTypes,
    priceMin,
    priceMax,
    homeTypes,
    amenities,
    petPolicyFilters,
    viewPreferences,
    neighborhoodScores,
    commuteDestinations:
      commuteDestinations.length > 0 ? commuteDestinations : [{ type: "office", label: "", address: "" }],
    priorityWeights,
    amenityWeights,
    neighborhoodViewWeights,
    neighborhoodScoreWeights,
  };
}

function bedroomTargetValue(value: PreferencesState["beds"]): number {
  if (value === "studio") {
    return 0;
  }
  return Number(value);
}

function bathroomMinimumValue(value: PreferencesState["baths"]): number {
  if (value === "any") {
    return 0;
  }
  return Number(value.replace("+", ""));
}

function deriveScoringDimensions(preferences: PreferencesState): ScoringDimensionDefinition[] {
  const dimensions: ScoringDimensionDefinition[] = [];
  const seen = new Set<string>();

  function addDimension(dimension: ScoringDimensionDefinition): void {
    if (seen.has(dimension.id) || dimension.weightLevel <= 0) {
      return;
    }
    seen.add(dimension.id);
    dimensions.push(dimension);
  }

  const hasPrice = preferences.priceMin !== null || preferences.priceMax !== null;
  if (hasPrice) {
    addDimension({
      id: "price",
      label: "Rent",
      type: "numeric",
      higherIsBetter: false,
      weightLevel: preferences.priorityWeights.price,
      getValue: (house) => house.price,
    });
  }

  const bedsBathsActive = preferences.beds !== "1" || preferences.baths !== "1+" || !preferences.bedsExactMatch;
  if (bedsBathsActive) {
    const targetBeds = bedroomTargetValue(preferences.beds);
    const minimumBaths = bathroomMinimumValue(preferences.baths);
    addDimension({
      id: "square-footage",
      label: "Sq Ft",
      type: "numeric",
      higherIsBetter: true,
      weightLevel: preferences.priorityWeights.size,
      getValue: (house) => house.squareFootage,
    });
    addDimension({
      id: "bedroom-match",
      label: "Bedroom Match",
      type: "categorical",
      weightLevel: preferences.priorityWeights.bedsBaths,
      getValue: (house) =>
        preferences.bedsExactMatch ? (house.bedrooms === targetBeds ? 1 : 0) : house.bedrooms >= targetBeds ? 1 : 0,
    });
    addDimension({
      id: "bathroom-match",
      label: "Bathroom Match",
      type: "categorical",
      weightLevel: preferences.priorityWeights.bedsBaths,
      getValue: (house) => (house.bathrooms >= minimumBaths ? 1 : 0),
    });
  }

  if (preferences.commuteDestinations.some((destination) => destination.address.trim())) {
    addDimension({
      id: "commute-time",
      label: "Commute",
      type: "numeric",
      higherIsBetter: false,
      weightLevel: preferences.priorityWeights.commute,
      getValue: (house) => house.commuteTime,
    });
  }

  for (const score of preferences.neighborhoodScores) {
    addDimension({
      id: `neighborhood-score-${score}`,
      label: neighborhoodScoreLabels[score],
      type: "numeric",
      higherIsBetter: true,
      weightLevel: preferences.neighborhoodScoreWeights[score] ?? preferences.priorityWeights.neighborhood,
      getValue: (house) => house[score],
    });
  }

  for (const view of preferences.viewPreferences) {
    addDimension({
      id: `view-${view}`,
      label: viewScoreLabels[view],
      type: "categorical",
      weightLevel: preferences.neighborhoodViewWeights[view] ?? preferences.priorityWeights.neighborhood,
      getValue: (house) => (house.viewTags.includes(view) ? 1 : 0),
    });
  }

  for (const amenity of preferences.amenities) {
    addDimension({
      id: `amenity-${amenity}`,
      label: amenityScoreLabels[amenity],
      type: "categorical",
      weightLevel: preferences.amenityWeights[amenity] ?? preferences.priorityWeights.amenities,
      getValue: (house) => {
        if (amenity === "parking") {
          return house.parking ? 1 : 0;
        }

        if (amenity === "inUnitLaundry") {
          return house.inUnitLaundry ? 1 : 0;
        }

        return house.amenityTags.includes(amenity) ? 1 : 0;
      },
    });
  }

  for (const homeType of preferences.homeTypes) {
    addDimension({
      id: `home-type-${homeType}`,
      label: homeTypeScoreLabels[homeType],
      type: "categorical",
      weightLevel: preferences.priorityWeights.homeType,
      getValue: (house) => (house.homeType === homeType ? 1 : 0),
    });
  }

  for (const petPolicy of preferences.petPolicyFilters) {
    addDimension({
      id: `pet-policy-${petPolicy}`,
      label: petPolicyScoreLabels[petPolicy],
      type: "categorical",
      weightLevel: preferences.priorityWeights.pets,
      getValue: (house) => {
        if (petPolicy === "noPets") {
          return house.petFriendly.length === 0 ? 1 : 0;
        }
        return house.petFriendly.includes(petPolicy === "cat" ? "cat" : petPolicy) ? 1 : 0;
      },
    });
  }

  return dimensions;
}

export default function Home() {
  const houses = useMemo(() => housesData as House[], []);

  const [preferences, setPreferences] = useState<PreferencesState>(defaultPreferences);
  const [rowOrder, setRowOrder] = useState<string[]>(houseIds);
  const [listingStages, setListingStages] = useState<Record<string, ListingStage>>(defaultListingStages);
  const [aiInsightsEnabled, setAiInsightsEnabled] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const scoringDefinitions = useMemo(() => deriveScoringDimensions(preferences), [preferences]);
  const scoringState = useMemo(
    () => computePreferenceScores(houses, scoringDefinitions),
    [houses, scoringDefinitions],
  );
  const scoreMap = scoringState.scoreMap;

  useEffect(() => {
    const storedPreferences = readStorage(STORAGE_KEYS.preferences, defaultPreferences);
    const storedRowOrder = readStorage(STORAGE_KEYS.rowOrder, houseIds);
    const storedListingStages = readStorage(STORAGE_KEYS.listingStages, defaultListingStages);
    const storedAiToggle = readStorage(STORAGE_KEYS.aiInsightsEnabled, true);

    setPreferences(sanitizePreferences(storedPreferences));
    setRowOrder(reconcileRowOrder(storedRowOrder, houseIds));
    const sanitizedStages = Object.fromEntries(
      Object.entries({ ...defaultListingStages, ...storedListingStages }).map(([id, stage]) => [
        id,
        stage === "Scouting" ||
        stage === "Contacted" ||
        stage === "Tour Scheduled" ||
        stage === "Visited" ||
        stage === "Interested" ||
        stage === "Applied" ||
        stage === "Lease Signed"
          ? stage
          : "Scouting",
      ]),
    ) as Record<string, ListingStage>;

    setListingStages(sanitizedStages);
    setAiInsightsEnabled(Boolean(storedAiToggle));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    writeStorage(STORAGE_KEYS.preferences, preferences);
  }, [hydrated, preferences]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    writeStorage(STORAGE_KEYS.rowOrder, rowOrder);
  }, [hydrated, rowOrder]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    writeStorage(STORAGE_KEYS.listingStages, listingStages);
  }, [hydrated, listingStages]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    writeStorage(STORAGE_KEYS.aiInsightsEnabled, aiInsightsEnabled);
  }, [hydrated, aiInsightsEnabled]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const rankedIds = [...houses]
      .sort((a, b) => {
        const left = scoreMap[a.id]?.score ?? 0;
        const right = scoreMap[b.id]?.score ?? 0;
        return right - left;
      })
      .map((house) => house.id);

    setRowOrder((current) => {
      if (
        current.length === rankedIds.length &&
        current.every((id, index) => id === rankedIds[index])
      ) {
        return current;
      }
      return rankedIds;
    });
  }, [hydrated, houses, scoreMap]);

  return (
    <main className="min-h-screen pb-10">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-4 py-4 md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zillowBlue">Prototype v1</p>
            <h1 className="text-2xl font-bold text-zillowSlate md:text-3xl">Decision Workspace</h1>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:inline-flex">
            Zillow-style shortlist comparison
          </span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 pt-6 md:px-8">
        {!hydrated ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-soft">
            Loading your saved dashboard preferences...
          </div>
        ) : null}

        <PreferencesCard preferences={preferences} onPreferencesChange={setPreferences} />

        <DashboardTable
          houses={houses}
          scoringDimensions={scoringState.dimensions}
          scoreMap={scoreMap}
          preferences={preferences}
          rowOrder={rowOrder}
          listingStages={listingStages}
          aiInsightsEnabled={aiInsightsEnabled}
          onAiInsightsEnabledChange={setAiInsightsEnabled}
          onRowOrderChange={setRowOrder}
          onListingStageChange={(houseId, stage) =>
            setListingStages((current) => ({ ...current, [houseId]: stage }))
          }
        />
      </div>
    </main>
  );
}
