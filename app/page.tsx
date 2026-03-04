"use client";

import { useEffect, useMemo, useState } from "react";

import { AttributeSelector } from "@/components/AttributeSelector";
import { DashboardTable } from "@/components/DashboardTable";
import { PreferencesCard } from "@/components/PreferencesCard";
import { defaultSelectedAttributes } from "@/data/attributeSchema";
import housesData from "@/data/houses.json";
import { defaultMoveInRange } from "@/lib/dateRange";
import { reconcileRowOrder, readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";
import { AttributeKey, House, PreferencesState } from "@/lib/types";

const houseIds = (housesData as House[]).map((house) => house.id);

const defaultPreferences: PreferencesState = {
  moveInStart: defaultMoveInRange().start,
  moveInEnd: defaultMoveInRange().end,
  beds: "1",
  baths: "1",
  hasPets: false,
  petTypes: [],
};

function sanitizeAttributes(raw: unknown): AttributeKey[] {
  if (!Array.isArray(raw)) {
    return defaultSelectedAttributes;
  }

  const allowed = new Set<string>([
    "price",
    "squareFootage",
    "commuteTime",
    "walkScore",
    "parking",
    "naturalLight",
    "noiseLevel",
    "safety",
    "inUnitLaundry",
    "hoaFees",
  ]);

  const cleaned = raw.filter((value): value is AttributeKey => {
    return typeof value === "string" && allowed.has(value);
  });

  return Array.from(new Set(cleaned));
}

function sanitizeWeights(raw: unknown): Partial<Record<AttributeKey, number>> {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const out: Partial<Record<AttributeKey, number>> = {};
  const entries = Object.entries(raw as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (typeof value !== "number") {
      continue;
    }

    if (
      key === "price" ||
      key === "squareFootage" ||
      key === "commuteTime" ||
      key === "walkScore" ||
      key === "parking" ||
      key === "naturalLight" ||
      key === "noiseLevel" ||
      key === "safety" ||
      key === "inUnitLaundry" ||
      key === "hoaFees"
    ) {
      out[key] = Math.max(0, Math.min(10, value));
    }
  }

  return out;
}

function sanitizePreferences(raw: unknown): PreferencesState {
  if (!raw || typeof raw !== "object") {
    return defaultPreferences;
  }

  const draft = raw as Partial<PreferencesState>;

  const moveInStart = typeof draft.moveInStart === "string" ? draft.moveInStart : defaultPreferences.moveInStart;
  const moveInEnd = typeof draft.moveInEnd === "string" ? draft.moveInEnd : defaultPreferences.moveInEnd;

  const beds = draft.beds === "1" || draft.beds === "2" || draft.beds === "3" || draft.beds === "3+" ? draft.beds : "1";
  const baths =
    draft.baths === "1" || draft.baths === "2" || draft.baths === "3" || draft.baths === "3+"
      ? draft.baths
      : "1";

  const hasPets = Boolean(draft.hasPets);
  const petTypes = Array.isArray(draft.petTypes)
    ? draft.petTypes.filter(
        (pet): pet is PreferencesState["petTypes"][number] =>
          pet === "cat" || pet === "smallDog" || pet === "largeDog" || pet === "other",
      )
    : [];

  return {
    moveInStart,
    moveInEnd,
    beds,
    baths,
    hasPets,
    petTypes,
  };
}

export default function Home() {
  const houses = useMemo(() => housesData as House[], []);

  const [preferences, setPreferences] = useState<PreferencesState>(defaultPreferences);
  const [selectedAttributes, setSelectedAttributes] = useState<AttributeKey[]>(defaultSelectedAttributes);
  const [weights, setWeights] = useState<Partial<Record<AttributeKey, number>>>({});
  const [rowOrder, setRowOrder] = useState<string[]>(houseIds);
  const [aiInsightsEnabled, setAiInsightsEnabled] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedPreferences = readStorage(STORAGE_KEYS.preferences, defaultPreferences);
    const storedAttributes = readStorage(STORAGE_KEYS.selectedAttributes, defaultSelectedAttributes);
    const storedWeights = readStorage(STORAGE_KEYS.attributeWeights, {});
    const storedRowOrder = readStorage(STORAGE_KEYS.rowOrder, houseIds);
    const storedAiToggle = readStorage(STORAGE_KEYS.aiInsightsEnabled, true);

    setPreferences(sanitizePreferences(storedPreferences));
    setSelectedAttributes(sanitizeAttributes(storedAttributes));
    setWeights(sanitizeWeights(storedWeights));
    setRowOrder(reconcileRowOrder(storedRowOrder, houseIds));
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

    writeStorage(STORAGE_KEYS.selectedAttributes, selectedAttributes);
  }, [hydrated, selectedAttributes]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    writeStorage(STORAGE_KEYS.attributeWeights, weights);
  }, [hydrated, weights]);

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

    writeStorage(STORAGE_KEYS.aiInsightsEnabled, aiInsightsEnabled);
  }, [hydrated, aiInsightsEnabled]);

  function handleSelectedAttributesChange(next: AttributeKey[]) {
    const unique = Array.from(new Set(next));
    setSelectedAttributes(unique);
    setWeights((current) => {
      const nextWeights: Partial<Record<AttributeKey, number>> = {};
      for (const attribute of unique) {
        nextWeights[attribute] = current[attribute] ?? 5;
      }
      return nextWeights;
    });
  }

  function handleWeightChange(attribute: AttributeKey, weight: number) {
    setWeights((current) => ({
      ...current,
      [attribute]: Math.max(0, Math.min(10, weight)),
    }));
  }

  function resetWeights() {
    const equalWeights: Partial<Record<AttributeKey, number>> = {};
    for (const attribute of selectedAttributes) {
      equalWeights[attribute] = 5;
    }
    setWeights(equalWeights);
  }

  return (
    <main className="min-h-screen pb-10">
      <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-4 py-4 md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zillowBlue">Prototype v1</p>
            <h1 className="text-2xl font-bold text-zillowSlate md:text-3xl">Home Decision Dashboard</h1>
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

        <AttributeSelector
          selectedAttributes={selectedAttributes}
          weights={weights}
          onSelectedAttributesChange={handleSelectedAttributesChange}
          onWeightChange={handleWeightChange}
          onResetWeights={resetWeights}
        />

        <DashboardTable
          houses={houses}
          selectedAttributes={selectedAttributes}
          weights={weights}
          preferences={preferences}
          rowOrder={rowOrder}
          aiInsightsEnabled={aiInsightsEnabled}
          onAiInsightsEnabledChange={setAiInsightsEnabled}
          onRowOrderChange={setRowOrder}
        />
      </div>
    </main>
  );
}
