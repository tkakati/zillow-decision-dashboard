"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardTable } from "@/components/DashboardTable";
import { PreferencesCard } from "@/components/PreferencesCard";
import { attributeOrder } from "@/data/attributeSchema";
import housesData from "@/data/houses.json";
import { defaultMoveInRange } from "@/lib/dateRange";
import { computeScores } from "@/lib/scoring";
import { reconcileRowOrder, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import {
  AmenityKey,
  AttributeKey,
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
};

const priorityAttributeMap: Omit<Record<PriorityKey, AttributeKey[]>, "neighborhood"> = {
  price: ["price"],
  commute: ["commuteTime"],
  amenities: ["parking", "inUnitLaundry"],
  size: ["squareFootage"],
  pets: ["inUnitLaundry"],
  homeType: ["safety", "noiseLevel"],
  moveInDate: ["hoaFees"],
  bedsBaths: ["squareFootage"],
};

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
  };
}

function deriveSelectedPriorities(preferences: PreferencesState): PriorityKey[] {
  const priorities: PriorityKey[] = [];

  const hasPrice = preferences.priceMin !== null || preferences.priceMax !== null;
  if (hasPrice) {
    priorities.push("price");
  }

  const hasBedsBaths = preferences.beds !== "1" || preferences.baths !== "1+" || !preferences.bedsExactMatch;
  if (hasBedsBaths) {
    priorities.push("bedsBaths", "size");
  }

  const hasMoveInDate =
    preferences.moveInStart !== defaultPreferences.moveInStart || preferences.moveInEnd !== defaultPreferences.moveInEnd;
  if (hasMoveInDate) {
    priorities.push("moveInDate");
  }

  if (preferences.homeTypes.length > 0) {
    priorities.push("homeType");
  }

  if (preferences.petPolicyFilters.length > 0) {
    priorities.push("pets");
  }

  if (preferences.viewPreferences.length > 0 || preferences.neighborhoodScores.length > 0) {
    priorities.push("neighborhood");
  }

  if (preferences.commuteDestinations.some((destination) => destination.address.trim())) {
    priorities.push("commute");
  }

  if (preferences.amenities.length > 0) {
    priorities.push("amenities");
  }

  const unique = Array.from(new Set(priorities));
  if (unique.length > 0) {
    return unique;
  }

  return [];
}

function deriveScoringState(preferences: PreferencesState): {
  selectedAttributes: AttributeKey[];
  weights: Partial<Record<AttributeKey, number>>;
} {
  const selectedPriorities = deriveSelectedPriorities(preferences);
  const selectedAttributeSet = new Set<AttributeKey>();
  const weights: Partial<Record<AttributeKey, number>> = {};

  for (const priority of selectedPriorities) {
    const level = preferences.priorityWeights[priority] ?? 3;
    const scaledWeight = Math.min(10, Math.max(1, level * 2));
    const priorityAttributes =
      priority === "neighborhood"
        ? [
            ...(preferences.viewPreferences.length > 0 ? (["naturalLight"] as AttributeKey[]) : []),
            ...preferences.neighborhoodScores,
          ]
        : priorityAttributeMap[priority];

    for (const attribute of priorityAttributes) {
      selectedAttributeSet.add(attribute);
      const current = weights[attribute] ?? 0;
      weights[attribute] = Math.max(current, scaledWeight);
    }
  }

  const selectedAttributes = attributeOrder.filter((attribute) => selectedAttributeSet.has(attribute));

  return {
    selectedAttributes,
    weights,
  };
}

export default function Home() {
  const houses = useMemo(() => housesData as House[], []);

  const [preferences, setPreferences] = useState<PreferencesState>(defaultPreferences);
  const [rowOrder, setRowOrder] = useState<string[]>(houseIds);
  const [listingStages, setListingStages] = useState<Record<string, ListingStage>>(defaultListingStages);
  const [aiInsightsEnabled, setAiInsightsEnabled] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const scoringState = useMemo(() => deriveScoringState(preferences), [preferences]);
  const scoreMap = useMemo(
    () => computeScores(houses, scoringState.selectedAttributes, scoringState.weights),
    [houses, scoringState.selectedAttributes, scoringState.weights],
  );

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
          selectedAttributes={scoringState.selectedAttributes}
          weights={scoringState.weights}
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
