"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AmenityKey,
  BathroomOption,
  BedroomOption,
  CommuteDestination,
  HomeType,
  NeighborhoodScore,
  PetPolicyFilter,
  PetType,
  PreferencesState,
  PriorityKey,
  ViewPreference,
} from "@/lib/types";

interface PreferencesCardProps {
  preferences: PreferencesState;
  onPreferencesChange: (next: PreferencesState) => void;
}

interface PreferenceWeightItem {
  id: string;
  label: string;
  priority: PriorityKey;
  kind: "priority" | "amenity" | "neighborhoodView" | "neighborhoodScore";
  amenity?: AmenityKey;
  neighborhoodView?: ViewPreference;
  neighborhoodScore?: NeighborhoodScore;
}

type FilterTab =
  | "price"
  | "bedsBaths"
  | "moveInDate"
  | "homeType"
  | "pets"
  | "neighborhood"
  | "commute"
  | "amenities";

const bedroomOptions: { value: BedroomOption; label: string }[] = [
  { value: "studio", label: "Studio" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

const bathroomOptions: { value: BathroomOption; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "1+", label: "1+" },
  { value: "1.5+", label: "1.5+" },
  { value: "2+", label: "2+" },
  { value: "3+", label: "3+" },
  { value: "4+", label: "4+" },
];

const homeTypeOptions: { value: HomeType; label: string }[] = [
  { value: "apartment", label: "Apartment" },
  { value: "condo", label: "Condo" },
  { value: "townhome", label: "Townhome" },
  { value: "house", label: "House" },
];

const amenityOptions: { value: AmenityKey; label: string }[] = [
  { value: "ac", label: "Must have A/C" },
  { value: "pool", label: "Must have pool" },
  { value: "waterfront", label: "Waterfront" },
  { value: "parking", label: "On-site Parking" },
  { value: "inUnitLaundry", label: "In-unit Laundry" },
  { value: "zillowApplications", label: "Accepts Zillow Applications" },
  { value: "incomeRestricted", label: "Income restricted" },
  { value: "hardwoodFloors", label: "Hardwood Floors" },
  { value: "disabledAccess", label: "Disabled Access" },
  { value: "utilitiesIncluded", label: "Utilities Included" },
  { value: "shortTermLease", label: "Short term lease available" },
  { value: "furnished", label: "Furnished" },
  { value: "outdoorSpace", label: "Outdoor space" },
  { value: "controlledAccess", label: "Controlled access" },
  { value: "highSpeedInternet", label: "High speed internet" },
  { value: "elevator", label: "Elevator" },
  { value: "apartmentCommunity", label: "Apartment Community" },
];

const petPolicyOptions: { value: PetPolicyFilter; label: string }[] = [
  { value: "largeDog", label: "Allows large dogs" },
  { value: "smallDog", label: "Allows small dogs" },
  { value: "cat", label: "Allows cats" },
  { value: "noPets", label: "No pets" },
];

const viewOptions: { value: ViewPreference; label: string }[] = [
  { value: "city", label: "City View" },
  { value: "water", label: "Water View" },
  { value: "mountain", label: "Mountain View" },
  { value: "park", label: "Park View" },
];

const neighborhoodScoreOptions: { value: NeighborhoodScore; label: string }[] = [
  { value: "walkScore", label: "Walk Score" },
  { value: "transitScore", label: "Transit Score" },
  { value: "bikeScore", label: "Bike Score" },
];

const tabRows: FilterTab[][] = [
  ["price", "bedsBaths", "moveInDate", "homeType"],
  ["pets", "neighborhood", "commute", "amenities"],
];

const priorityLabels: Record<PriorityKey, string> = {
  price: "Price",
  commute: "Commute",
  amenities: "Amenities",
  size: "Size",
  pets: "Pets",
  neighborhood: "Neighborhood",
  homeType: "Home Type",
  moveInDate: "Move-in Date",
  bedsBaths: "Beds/Baths",
};

const amenityLabelMap: Record<AmenityKey, string> = Object.fromEntries(
  amenityOptions.map((option) => [option.value, option.label]),
) as Record<AmenityKey, string>;
const viewLabelMap: Record<ViewPreference, string> = Object.fromEntries(
  viewOptions.map((option) => [option.value, option.label]),
) as Record<ViewPreference, string>;
const neighborhoodScoreLabelMap: Record<NeighborhoodScore, string> = Object.fromEntries(
  neighborhoodScoreOptions.map((option) => [option.value, option.label]),
) as Record<NeighborhoodScore, string>;

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function toggleItem<T extends string>(items: T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

function summaryLabel(tab: FilterTab, preferences: PreferencesState): string {
  if (tab === "price") {
    if (preferences.priceMin === null && preferences.priceMax === null) {
      return "Price";
    }

    const min = preferences.priceMin === null ? "No min" : `$${preferences.priceMin.toLocaleString()}`;
    const max = preferences.priceMax === null ? "No max" : `$${preferences.priceMax.toLocaleString()}`;
    return `${min} - ${max}`;
  }

  if (tab === "bedsBaths") {
    const bedLabel = preferences.beds === "studio" ? "Studio" : preferences.beds;
    return `${bedLabel} bd, ${preferences.baths} ba`;
  }

  if (tab === "moveInDate") {
    const start = new Date(preferences.moveInStart);
    const end = new Date(preferences.moveInEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "Move-in Date";
    }

    return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
  }

  if (tab === "homeType") {
    return preferences.homeTypes.length > 0 ? `Home Type (${preferences.homeTypes.length})` : "Home Type";
  }

  if (tab === "pets") {
    return preferences.petPolicyFilters.length > 0 ? `Pets (${preferences.petPolicyFilters.length})` : "Pets";
  }

  if (tab === "neighborhood") {
    const count = preferences.viewPreferences.length + preferences.neighborhoodScores.length;
    return count > 0 ? `Neighborhood (${count})` : "Neighborhood";
  }

  if (tab === "commute") {
    const count = preferences.commuteDestinations.filter((item) => item.address.trim()).length;
    return count > 0 ? `Commute (${count})` : "Commute";
  }

  return preferences.amenities.length > 0 ? `Amenities (${preferences.amenities.length})` : "Amenities";
}

function panelTitle(tab: FilterTab): string {
  switch (tab) {
    case "price":
      return "Price Range";
    case "bedsBaths":
      return "Bedrooms and Bathrooms";
    case "moveInDate":
      return "Move-In Date";
    case "homeType":
      return "Home Type";
    case "pets":
      return "Pets";
    case "neighborhood":
      return "Neighborhood";
    case "commute":
      return "Commute Time";
    case "amenities":
      return "Other Amenities";
    default:
      return "Filters";
  }
}

function deriveSelectedPriorities(preferences: PreferencesState): PriorityKey[] {
  const priorities: PriorityKey[] = [];

  if (preferences.priceMin !== null || preferences.priceMax !== null) {
    priorities.push("price");
  }

  const bedsBathsActive = preferences.beds !== "1" || preferences.baths !== "1+" || !preferences.bedsExactMatch;
  if (bedsBathsActive) {
    priorities.push("bedsBaths", "size");
  }

  if (preferences.moveInStart !== "2026-09-01" || preferences.moveInEnd !== "2026-09-10") {
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

  if (preferences.commuteDestinations.some((item) => item.address.trim())) {
    priorities.push("commute");
  }

  if (preferences.amenities.length > 0) {
    priorities.push("amenities");
  }

  const unique = Array.from(new Set(priorities));
  return unique;
}

function derivePriorityWeightItems(preferences: PreferencesState): PreferenceWeightItem[] {
  const priorities = deriveSelectedPriorities(preferences);
  const items: PreferenceWeightItem[] = [];

  for (const priority of priorities) {
    if (priority === "amenities") {
      if (preferences.amenities.length === 0) {
        items.push({
          id: "amenities",
          label: priorityLabels.amenities,
          priority,
          kind: "priority",
        });
        continue;
      }

      for (const amenity of preferences.amenities) {
        items.push({
          id: `amenity-${amenity}`,
          label: amenityLabelMap[amenity] ?? amenity,
          priority,
          kind: "amenity",
          amenity,
        });
      }
      continue;
    }

    if (priority === "neighborhood") {
      const neighborhoodItems: PreferenceWeightItem[] = [
        ...preferences.viewPreferences.map((view) => ({
          id: `neighborhood-view-${view}`,
          label: viewLabelMap[view] ?? view,
          priority,
          kind: "neighborhoodView" as const,
          neighborhoodView: view,
        })),
        ...preferences.neighborhoodScores.map((score) => ({
          id: `neighborhood-score-${score}`,
          label: neighborhoodScoreLabelMap[score] ?? score,
          priority,
          kind: "neighborhoodScore" as const,
          neighborhoodScore: score,
        })),
      ];

      if (neighborhoodItems.length === 0) {
        items.push({
          id: "neighborhood",
          label: priorityLabels.neighborhood,
          priority,
          kind: "priority",
        });
        continue;
      }

      items.push(...neighborhoodItems);
      continue;
    }

    items.push({
      id: priority,
      label: priorityLabels[priority],
      priority,
      kind: "priority",
    });
  }

  return items;
}

function getPreferenceWeightLevel(item: PreferenceWeightItem, preferences: PreferencesState): number {
  if (item.kind === "amenity" && item.amenity) {
    return preferences.amenityWeights[item.amenity] ?? preferences.priorityWeights.amenities ?? 3;
  }

  if (item.kind === "neighborhoodView" && item.neighborhoodView) {
    return (
      preferences.neighborhoodViewWeights[item.neighborhoodView] ??
      preferences.priorityWeights.neighborhood ??
      3
    );
  }

  if (item.kind === "neighborhoodScore" && item.neighborhoodScore) {
    return (
      preferences.neighborhoodScoreWeights[item.neighborhoodScore] ??
      preferences.priorityWeights.neighborhood ??
      3
    );
  }

  return preferences.priorityWeights[item.priority] ?? 3;
}

function normalizePreferences(next: PreferencesState): PreferencesState {
  let priceMin = next.priceMin;
  let priceMax = next.priceMax;

  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  let moveInStart = next.moveInStart;
  let moveInEnd = next.moveInEnd;
  if (moveInStart && moveInEnd && new Date(moveInStart) > new Date(moveInEnd)) {
    [moveInStart, moveInEnd] = [moveInEnd, moveInStart];
  }

  const hasNoPets = next.petPolicyFilters.includes("noPets");
  const petPolicyFilters = hasNoPets
    ? (["noPets"] as PetPolicyFilter[])
    : next.petPolicyFilters.filter((value) => value !== "noPets");

  const petTypes: PetType[] = [];
  if (!hasNoPets) {
    if (petPolicyFilters.includes("cat")) {
      petTypes.push("cat");
    }
    if (petPolicyFilters.includes("smallDog")) {
      petTypes.push("smallDog");
    }
    if (petPolicyFilters.includes("largeDog")) {
      petTypes.push("largeDog");
    }
  }

  const cleanedCommute = next.commuteDestinations
    .map((item) => ({
      type: item.type,
      label: item.label.trim(),
      address: item.address.trim(),
    }))
    .filter((item) => item.address || (item.type === "other" && item.label))
    .slice(0, 5);

  const amenityWeights: Partial<Record<AmenityKey, number>> = Object.fromEntries(
    next.amenities.map((amenity) => [
      amenity,
      Math.min(
        5,
        Math.max(
          1,
          Number(next.amenityWeights?.[amenity] ?? next.priorityWeights.amenities ?? 3),
        ),
      ),
    ]),
  ) as Partial<Record<AmenityKey, number>>;

  const neighborhoodViewWeights: Partial<Record<ViewPreference, number>> = Object.fromEntries(
    next.viewPreferences.map((view) => [
      view,
      Math.min(
        5,
        Math.max(
          1,
          Number(next.neighborhoodViewWeights?.[view] ?? next.priorityWeights.neighborhood ?? 3),
        ),
      ),
    ]),
  ) as Partial<Record<ViewPreference, number>>;

  const neighborhoodScoreWeights: Partial<Record<NeighborhoodScore, number>> = Object.fromEntries(
    next.neighborhoodScores.map((score) => [
      score,
      Math.min(
        5,
        Math.max(
          1,
          Number(next.neighborhoodScoreWeights?.[score] ?? next.priorityWeights.neighborhood ?? 3),
        ),
      ),
    ]),
  ) as Partial<Record<NeighborhoodScore, number>>;

  return {
    ...next,
    moveInStart,
    moveInEnd,
    priceMin,
    priceMax,
    petPolicyFilters,
    hasPets: petTypes.length > 0,
    petTypes: Array.from(new Set(petTypes)),
    amenityWeights,
    neighborhoodViewWeights,
    neighborhoodScoreWeights,
    commuteDestinations:
      cleanedCommute.length > 0
        ? cleanedCommute
        : [{ type: "office" as const, label: "", address: "" }],
  };
}

export function PreferencesCard({ preferences, onPreferencesChange }: PreferencesCardProps) {
  const [activeTab, setActiveTab] = useState<FilterTab | null>(null);
  const [weightsPopoverOpen, setWeightsPopoverOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setActiveTab(null);
        setWeightsPopoverOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (weightsPopoverOpen) {
        setWeightsPopoverOpen(false);
        return;
      }

      setActiveTab(null);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [weightsPopoverOpen]);

  const priorityWeightItems = useMemo(() => derivePriorityWeightItems(preferences), [preferences]);
  const firstRowPriorities = priorityWeightItems.slice(0, 2);
  const thirdPriority = priorityWeightItems[2];
  const hiddenCount = Math.max(priorityWeightItems.length - 3, 0);

  useEffect(() => {
    if (hiddenCount === 0) {
      setWeightsPopoverOpen(false);
    }
  }, [hiddenCount]);

  function updatePreferences(updater: (current: PreferencesState) => PreferencesState) {
    onPreferencesChange(normalizePreferences(updater(preferences)));
  }

  function openTab(tab: FilterTab) {
    setActiveTab((current) => (current === tab ? null : tab));
  }

  function setWeightLevel(item: PreferenceWeightItem, level: number) {
    updatePreferences((current) => {
      if (item.kind === "amenity" && item.amenity) {
        return {
          ...current,
          amenityWeights: {
            ...current.amenityWeights,
            [item.amenity]: level,
          },
        };
      }

      if (item.kind === "neighborhoodView" && item.neighborhoodView) {
        return {
          ...current,
          neighborhoodViewWeights: {
            ...current.neighborhoodViewWeights,
            [item.neighborhoodView]: level,
          },
        };
      }

      if (item.kind === "neighborhoodScore" && item.neighborhoodScore) {
        return {
          ...current,
          neighborhoodScoreWeights: {
            ...current.neighborhoodScoreWeights,
            [item.neighborhoodScore]: level,
          },
        };
      }

      return {
        ...current,
        priorityWeights: {
          ...current.priorityWeights,
          [item.priority]: level,
        },
      };
    });
  }

  function resetActiveTab() {
    if (!activeTab) {
      return;
    }

    if (activeTab === "homeType") {
      updatePreferences((current) => ({ ...current, homeTypes: [] }));
      return;
    }

    if (activeTab === "pets") {
      updatePreferences((current) => ({ ...current, petPolicyFilters: [] }));
      return;
    }

    if (activeTab === "neighborhood") {
      updatePreferences((current) => ({ ...current, viewPreferences: [], neighborhoodScores: [] }));
      return;
    }

    if (activeTab === "commute") {
      updatePreferences((current) => ({
        ...current,
        commuteDestinations: [{ type: "office" as const, label: "", address: "" }],
      }));
      return;
    }

    if (activeTab === "amenities") {
      updatePreferences((current) => ({ ...current, amenities: [] }));
    }
  }

  return (
    <>
      <section ref={wrapperRef} className="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100 md:p-4">
        <div className="grid items-stretch gap-3 lg:grid-cols-2">
          <div className="relative rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3">
            <h2 className="mb-2 text-lg font-semibold text-zillowSlate">Preferences</h2>

            <div className="space-y-2">
              {tabRows.map((row, rowIndex) => (
                <div key={`row-${rowIndex}`} className="grid grid-cols-4 gap-2">
                  {row.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => openTab(tab)}
                      className={`inline-flex h-8 w-full items-center justify-between rounded-lg border px-2.5 text-[13px] font-semibold ${
                        activeTab === tab
                          ? "border-zillowBlue bg-blue-50 text-zillowBlue"
                          : "border-slate-300 text-slate-800"
                      }`}
                    >
                      <span className="truncate">{summaryLabel(tab, preferences)}</span>
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className="ml-2 h-4 w-4 flex-none"
                      >
                        <path
                          d="M3 7l7 7 7-7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {activeTab ? (
              <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-xl border border-slate-200 bg-white shadow-soft">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-2xl font-semibold text-slate-700">{panelTitle(activeTab)}</h3>
                    {activeTab === "commute" ? (
                      <p className="text-xs font-medium text-slate-500">
                        Demo only: live commute not implemented (routing API required).
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4 px-4 py-4">
                  {activeTab === "price" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="price-min" className="mb-1 block text-sm font-semibold text-slate-700">
                          Min
                        </label>
                        <input
                          id="price-min"
                          type="number"
                          min={0}
                          value={preferences.priceMin ?? ""}
                          onChange={(event) =>
                            updatePreferences((current) => ({
                              ...current,
                              priceMin: toNumberOrNull(event.target.value),
                            }))
                          }
                          placeholder="No min"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-zillowBlue focus:ring"
                        />
                      </div>
                      <div>
                        <label htmlFor="price-max" className="mb-1 block text-sm font-semibold text-slate-700">
                          Max
                        </label>
                        <input
                          id="price-max"
                          type="number"
                          min={0}
                          value={preferences.priceMax ?? ""}
                          onChange={(event) =>
                            updatePreferences((current) => ({
                              ...current,
                              priceMax: toNumberOrNull(event.target.value),
                            }))
                          }
                          placeholder="No max"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-zillowBlue focus:ring"
                        />
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "bedsBaths" ? (
                    <>
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-slate-700">Bedrooms</h4>
                        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-300 sm:grid-cols-6">
                          {bedroomOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => updatePreferences((current) => ({ ...current, beds: option.value }))}
                              className={`border-r border-slate-300 px-2 py-2 text-sm font-semibold last:border-r-0 ${
                                preferences.beds === option.value
                                  ? "bg-blue-50 text-zillowBlue"
                                  : "bg-white text-slate-800"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={preferences.bedsExactMatch}
                          onChange={(event) =>
                            updatePreferences((current) => ({
                              ...current,
                              bedsExactMatch: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-zillowBlue"
                        />
                        Use exact match
                      </label>

                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-slate-700">Bathrooms</h4>
                        <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-300 sm:grid-cols-6">
                          {bathroomOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => updatePreferences((current) => ({ ...current, baths: option.value }))}
                              className={`border-r border-slate-300 px-2 py-2 text-sm font-semibold last:border-r-0 ${
                                preferences.baths === option.value
                                  ? "bg-blue-50 text-zillowBlue"
                                  : "bg-white text-slate-800"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}

                  {activeTab === "moveInDate" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="move-in-start" className="mb-1 block text-sm font-semibold text-slate-700">
                          Start
                        </label>
                        <input
                          id="move-in-start"
                          type="date"
                          value={preferences.moveInStart}
                          onChange={(event) =>
                            updatePreferences((current) => ({ ...current, moveInStart: event.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-zillowBlue focus:ring"
                        />
                      </div>
                      <div>
                        <label htmlFor="move-in-end" className="mb-1 block text-sm font-semibold text-slate-700">
                          End
                        </label>
                        <input
                          id="move-in-end"
                          type="date"
                          value={preferences.moveInEnd}
                          onChange={(event) =>
                            updatePreferences((current) => ({ ...current, moveInEnd: event.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-zillowBlue focus:ring"
                        />
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "homeType" ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {homeTypeOptions.map((option) => (
                        <label key={option.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={preferences.homeTypes.includes(option.value)}
                            onChange={() =>
                              updatePreferences((current) => ({
                                ...current,
                                homeTypes: toggleItem(current.homeTypes, option.value),
                              }))
                            }
                            className="h-4 w-4 accent-zillowBlue"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {activeTab === "pets" ? (
                    <div className="space-y-2">
                      {petPolicyOptions.map((option) => (
                        <label key={option.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={preferences.petPolicyFilters.includes(option.value)}
                            onChange={() =>
                              updatePreferences((current) => {
                                if (option.value === "noPets") {
                                  const next: PetPolicyFilter[] = current.petPolicyFilters.includes("noPets")
                                    ? []
                                    : ["noPets"];
                                  return { ...current, petPolicyFilters: next };
                                }

                                const withoutNoPets = current.petPolicyFilters.filter((value) => value !== "noPets");
                                return {
                                  ...current,
                                  petPolicyFilters: toggleItem(withoutNoPets, option.value),
                                };
                              })
                            }
                            className="h-4 w-4 accent-zillowBlue"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {activeTab === "neighborhood" ? (
                    <div className="space-y-5">
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-slate-700">View</h4>
                        <div className="space-y-2">
                          {viewOptions.map((option) => (
                            <label key={option.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={preferences.viewPreferences.includes(option.value)}
                                onChange={() =>
                                  updatePreferences((current) => ({
                                    ...current,
                                    viewPreferences: toggleItem(current.viewPreferences, option.value),
                                  }))
                                }
                                className="h-4 w-4 accent-zillowBlue"
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-slate-700">Scores</h4>
                        <div className="space-y-2">
                          {neighborhoodScoreOptions.map((option) => (
                            <label key={option.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={preferences.neighborhoodScores.includes(option.value)}
                                onChange={() =>
                                  updatePreferences((current) => ({
                                    ...current,
                                    neighborhoodScores: toggleItem(current.neighborhoodScores, option.value),
                                  }))
                                }
                                className="h-4 w-4 accent-zillowBlue"
                              />
                              {option.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "commute" ? (
                    <div className="space-y-3">
                      {preferences.commuteDestinations.map((destination, index) => (
                        <div key={`commute-${index}`} className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={destination.type}
                              onChange={(event) => {
                                const nextType: CommuteDestination["type"] =
                                  event.target.value === "other" ? "other" : "office";
                                updatePreferences((current) => ({
                                  ...current,
                                  commuteDestinations: current.commuteDestinations.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          type: nextType,
                                          label: nextType === "other" ? item.label : "",
                                        }
                                      : item,
                                  ),
                                }));
                              }}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                              <option value="office">Office</option>
                              <option value="other">Others</option>
                            </select>

                            {destination.type === "other" ? (
                              <input
                                type="text"
                                value={destination.label}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  updatePreferences((current) => ({
                                    ...current,
                                    commuteDestinations: current.commuteDestinations.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, label: value } : item,
                                    ),
                                  }));
                                }}
                                placeholder="Other destination"
                                className="min-w-[170px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                            ) : null}

                            <input
                              type="text"
                              value={destination.address}
                              onChange={(event) => {
                                const value = event.target.value;
                                updatePreferences((current) => ({
                                  ...current,
                                  commuteDestinations: current.commuteDestinations.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, address: value } : item,
                                  ),
                                }));
                              }}
                              placeholder="Enter address, city, state and ZIP code"
                              className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />

                            {index > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  updatePreferences((current) => ({
                                    ...current,
                                    commuteDestinations: current.commuteDestinations.filter(
                                      (_, itemIndex) => itemIndex !== index,
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() =>
                          updatePreferences((current) => ({
                            ...current,
                            commuteDestinations: [
                              ...current.commuteDestinations,
                              { type: "office" as const, label: "", address: "" },
                            ].slice(0, 5),
                          }))
                        }
                        className="text-sm font-semibold text-zillowBlue"
                      >
                        + Add More
                      </button>
                    </div>
                  ) : null}

                  {activeTab === "amenities" ? (
                    <div className="columns-1 gap-2 sm:columns-2">
                      {amenityOptions.map((option) => (
                        <label
                          key={option.value}
                          className="mb-2 inline-flex w-full items-center gap-2 text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={preferences.amenities.includes(option.value)}
                            onChange={() =>
                              updatePreferences((current) => ({
                                ...current,
                                amenities: toggleItem(current.amenities, option.value),
                              }))
                            }
                            className="h-4 w-4 accent-zillowBlue"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex justify-start pt-1">
                    {activeTab === "homeType" ||
                    activeTab === "pets" ||
                    activeTab === "neighborhood" ||
                    activeTab === "commute" ||
                    activeTab === "amenities" ? (
                      <button
                        type="button"
                        onClick={resetActiveTab}
                        className="text-sm font-semibold text-blue-800"
                      >
                        Reset all filters
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="relative h-full rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3">
            <h3 className="mb-2 text-sm font-semibold text-zillowSlate">Preference Weights</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {firstRowPriorities.map((item) => {
                const level = getPreferenceWeightLevel(item, preferences);
                return (
                  <div
                    key={item.id}
                    className="flex min-h-[40px] items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-700" title={item.label}>
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((dotLevel) => (
                        <button
                          key={`${item.id}-${dotLevel}`}
                          type="button"
                          onClick={() => setWeightLevel(item, dotLevel)}
                          className={`h-2.5 w-2.5 rounded-full ${
                            dotLevel <= level ? "bg-slate-800" : "bg-slate-300"
                          }`}
                          title={`${item.label} importance ${dotLevel}/5`}
                          aria-label={`${item.label} importance ${dotLevel}/5`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {Array.from({ length: Math.max(0, 2 - firstRowPriorities.length) }).map((_, index) => (
                <div
                  key={`first-row-empty-${index}`}
                  className="min-h-[40px] rounded-md border border-dashed border-slate-200 bg-slate-50/50"
                />
              ))}

              {thirdPriority ? (
                <div className="flex min-h-[40px] items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-700" title={thirdPriority.label}>
                    {thirdPriority.label}
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((dotLevel) => {
                      const level = getPreferenceWeightLevel(thirdPriority, preferences);
                      return (
                        <button
                          key={`${thirdPriority.id}-${dotLevel}`}
                          type="button"
                          onClick={() => setWeightLevel(thirdPriority, dotLevel)}
                          className={`h-2.5 w-2.5 rounded-full ${
                            dotLevel <= level ? "bg-slate-800" : "bg-slate-300"
                          }`}
                          title={`${thirdPriority.label} importance ${dotLevel}/5`}
                          aria-label={`${thirdPriority.label} importance ${dotLevel}/5`}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="min-h-[40px] rounded-md border border-dashed border-slate-200 bg-slate-50/50" />
              )}

              <div className="relative">
                <button
                  type="button"
                  disabled={hiddenCount === 0}
                  onClick={() => {
                    if (hiddenCount > 0) {
                      setWeightsPopoverOpen((current) => !current);
                    }
                  }}
                  className={`min-h-[40px] w-full rounded-md px-2 py-1.5 text-left text-sm font-semibold ${
                    hiddenCount > 0
                      ? "bg-slate-50 text-zillowBlue hover:bg-slate-100"
                      : "bg-slate-50 text-slate-400"
                  }`}
                >
                  +{hiddenCount} more
                </button>

                {weightsPopoverOpen && hiddenCount > 0 ? (
                  <div className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                    <p className="mb-2 text-sm font-semibold text-slate-800">All preference weights</p>
                    <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                      {priorityWeightItems.map((item) => {
                        const level = getPreferenceWeightLevel(item, preferences);
                        return (
                          <div
                            key={`popover-${item.id}`}
                            className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-2 py-2"
                          >
                            <span className="min-w-0 flex-1 truncate font-medium text-slate-700" title={item.label}>
                              {item.label}
                            </span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((dotLevel) => (
                                <button
                                  key={`popover-${item.id}-${dotLevel}`}
                                  type="button"
                                  onClick={() => setWeightLevel(item, dotLevel)}
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    dotLevel <= level ? "bg-slate-800" : "bg-slate-300"
                                  }`}
                                  title={`${item.label} importance ${dotLevel}/5`}
                                  aria-label={`${item.label} importance ${dotLevel}/5`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setWeightsPopoverOpen(false)}
                        className="rounded-md bg-zillowBlue px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
