"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AmenityKey,
  BathroomOption,
  BedroomOption,
  CommuteDestination,
  HomeType,
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

type FilterTab =
  | "price"
  | "bedsBaths"
  | "moveInDate"
  | "homeType"
  | "pets"
  | "view"
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
  { value: "city", label: "City" },
  { value: "mountain", label: "Mountain" },
  { value: "park", label: "Park" },
  { value: "water", label: "Water" },
];

const tabRows: FilterTab[][] = [
  ["price", "bedsBaths", "moveInDate", "homeType"],
  ["pets", "view", "commute", "amenities"],
];

const priorityLabels: Record<PriorityKey, string> = {
  price: "Price",
  commute: "Commute",
  amenities: "Amenities",
  size: "Size",
  pets: "Pets",
  view: "View",
  homeType: "Home Type",
  moveInDate: "Move-in Date",
  bedsBaths: "Beds/Baths",
};

function toggleItem<T extends string>(items: T[], value: T): T[] {
  if (items.includes(value)) {
    return items.filter((item) => item !== value);
  }

  return [...items, value];
}

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

  if (tab === "view") {
    return preferences.viewPreferences.length > 0 ? `View (${preferences.viewPreferences.length})` : "View";
  }

  if (tab === "commute") {
    const count = preferences.commuteDestinations.filter((item) => item.address.trim()).length;
    return count > 0 ? `Commute (${count})` : "Commute";
  }

  if (tab === "amenities") {
    return preferences.amenities.length > 0 ? `Amenities (${preferences.amenities.length})` : "Amenities";
  }

  return "";
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
    case "view":
      return "View";
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

  if (
    preferences.moveInStart !== "2026-09-01" ||
    preferences.moveInEnd !== "2026-09-10"
  ) {
    priorities.push("moveInDate");
  }

  if (preferences.homeTypes.length > 0) {
    priorities.push("homeType");
  }

  if (preferences.petPolicyFilters.length > 0) {
    priorities.push("pets");
  }

  if (preferences.viewPreferences.length > 0) {
    priorities.push("view");
  }

  if (preferences.commuteDestinations.some((item) => item.address.trim())) {
    priorities.push("commute");
  }

  if (preferences.amenities.length > 0) {
    priorities.push("amenities");
  }

  const unique = Array.from(new Set(priorities));
  if (unique.length > 0) {
    return unique;
  }

  return ["price", "commute", "amenities", "size"];
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

  return {
    ...next,
    moveInStart,
    moveInEnd,
    priceMin,
    priceMax,
    petPolicyFilters,
    hasPets: petTypes.length > 0,
    petTypes: Array.from(new Set(petTypes)),
    commuteDestinations:
      cleanedCommute.length > 0
        ? cleanedCommute
        : [{ type: "office" as const, label: "", address: "" }],
  };
}

function priorityDots(level: number): string {
  const clamped = Math.min(5, Math.max(1, Math.round(level)));
  return `${"●".repeat(clamped)}${"○".repeat(5 - clamped)}`;
}

export function PreferencesCard({ preferences, onPreferencesChange }: PreferencesCardProps) {
  const [activeTab, setActiveTab] = useState<FilterTab | null>(null);
  const [draft, setDraft] = useState<PreferencesState>(preferences);
  const [expandedPriorities, setExpandedPriorities] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setActiveTab(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedPriorities = useMemo(() => deriveSelectedPriorities(preferences), [preferences]);
  const visiblePriorities = expandedPriorities ? selectedPriorities : selectedPriorities.slice(0, 4);
  const hiddenCount = selectedPriorities.length - visiblePriorities.length;

  function openTab(tab: FilterTab) {
    setDraft(preferences);
    setActiveTab((current) => (current === tab ? null : tab));
  }

  function applyDraft() {
    onPreferencesChange(normalizePreferences(draft));
    setActiveTab(null);
  }

  function savePreferences() {
    onPreferencesChange(normalizePreferences(draft));
    setActiveTab(null);
  }

  function resetActiveTab() {
    if (!activeTab) {
      return;
    }

    if (activeTab === "homeType") {
      setDraft((current) => ({ ...current, homeTypes: [] }));
      return;
    }

    if (activeTab === "pets") {
      setDraft((current) => ({ ...current, petPolicyFilters: [] }));
      return;
    }

    if (activeTab === "view") {
      setDraft((current) => ({ ...current, viewPreferences: [] }));
      return;
    }

    if (activeTab === "commute") {
      setDraft((current) => ({
        ...current,
        commuteDestinations: [{ type: "office" as const, label: "", address: "" }],
      }));
      return;
    }

    if (activeTab === "amenities") {
      setDraft((current) => ({ ...current, amenities: [] }));
    }
  }

  function setPriorityLevel(priority: PriorityKey, level: number) {
    onPreferencesChange({
      ...preferences,
      priorityWeights: {
        ...preferences.priorityWeights,
        [priority]: level,
      },
    });
  }

  return (
    <section ref={wrapperRef} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 md:p-5">
      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2">
            <h2 className="text-xl font-semibold text-zillowSlate">Preferences</h2>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[980px] space-y-2">
              <div className="grid grid-cols-4 gap-2">
                {tabRows[0].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => openTab(tab)}
                    className={`inline-flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold ${
                      activeTab === tab
                        ? "border-zillowBlue bg-blue-50 text-zillowBlue"
                        : "border-slate-300 text-slate-800"
                    }`}
                  >
                    <span className="truncate">{summaryLabel(tab, preferences)}</span>
                    <span className="ml-2 text-xs">v</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_180px] gap-2">
                {tabRows[1].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => openTab(tab)}
                    className={`inline-flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold ${
                      activeTab === tab
                        ? "border-zillowBlue bg-blue-50 text-zillowBlue"
                        : "border-slate-300 text-slate-800"
                    }`}
                  >
                    <span className="truncate">{summaryLabel(tab, preferences)}</span>
                    <span className="ml-2 text-xs">v</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={savePreferences}
                  className="min-h-11 rounded-lg bg-zillowBlue px-3 py-2 text-sm font-semibold text-white"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>

          {activeTab ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-2xl font-semibold text-slate-700">{panelTitle(activeTab)}</h3>
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
                        value={draft.priceMin ?? ""}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, priceMin: toNumberOrNull(event.target.value) }))
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
                        value={draft.priceMax ?? ""}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, priceMax: toNumberOrNull(event.target.value) }))
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
                            onClick={() => setDraft((current) => ({ ...current, beds: option.value }))}
                            className={`border-r border-slate-300 px-2 py-2 text-sm font-semibold last:border-r-0 ${
                              draft.beds === option.value ? "bg-blue-50 text-zillowBlue" : "bg-white text-slate-800"
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
                        checked={draft.bedsExactMatch}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, bedsExactMatch: event.target.checked }))
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
                            onClick={() => setDraft((current) => ({ ...current, baths: option.value }))}
                            className={`border-r border-slate-300 px-2 py-2 text-sm font-semibold last:border-r-0 ${
                              draft.baths === option.value ? "bg-blue-50 text-zillowBlue" : "bg-white text-slate-800"
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
                        value={draft.moveInStart}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, moveInStart: event.target.value }))
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
                        value={draft.moveInEnd}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, moveInEnd: event.target.value }))
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
                          checked={draft.homeTypes.includes(option.value)}
                          onChange={() =>
                            setDraft((current) => ({
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
                          checked={draft.petPolicyFilters.includes(option.value)}
                          onChange={() =>
                            setDraft((current) => {
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

                {activeTab === "view" ? (
                  <div className="space-y-2">
                    {viewOptions.map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.viewPreferences.includes(option.value)}
                          onChange={() =>
                            setDraft((current) => ({
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
                ) : null}

                {activeTab === "commute" ? (
                  <div className="space-y-3">
                    {draft.commuteDestinations.map((destination, index) => (
                      <div key={`commute-${index}`} className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={destination.type}
                            onChange={(event) => {
                              const nextType: CommuteDestination["type"] =
                                event.target.value === "other" ? "other" : "office";
                              setDraft((current) => ({
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
                                setDraft((current) => ({
                                  ...current,
                                  commuteDestinations: current.commuteDestinations.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, label: value } : item,
                                  ),
                                }));
                              }}
                              placeholder="Other destination"
                              className="min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                          ) : null}

                          <input
                            type="text"
                            value={destination.address}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDraft((current) => ({
                                ...current,
                                commuteDestinations: current.commuteDestinations.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, address: value } : item,
                                ),
                              }));
                            }}
                            placeholder="Enter address, city, state and ZIP code"
                            className="min-w-[320px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />

                          {index > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  commuteDestinations: current.commuteDestinations.filter((_, itemIndex) => itemIndex !== index),
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
                        setDraft((current) => ({
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
                  <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
                    {amenityOptions.map((option) => (
                      <label key={option.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.amenities.includes(option.value)}
                          onChange={() =>
                            setDraft((current) => ({
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

                <div className="flex items-center justify-between pt-2">
                  {activeTab === "homeType" ||
                  activeTab === "pets" ||
                  activeTab === "view" ||
                  activeTab === "commute" ||
                  activeTab === "amenities" ? (
                    <button
                      type="button"
                      onClick={resetActiveTab}
                      className="text-sm font-semibold text-blue-800"
                    >
                      Reset all filters
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    onClick={applyDraft}
                    className="rounded-lg bg-zillowBlue px-8 py-2 text-sm font-semibold text-white"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="h-full rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-base font-semibold text-zillowSlate">Priorities</h3>
          <div className="space-y-2 text-sm">
            {visiblePriorities.map((priority) => {
              const level = preferences.priorityWeights[priority] ?? 3;
              return (
                <div key={priority} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-2 py-2">
                  <span className="font-medium text-slate-700">{priorityLabels[priority]}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((dotLevel) => (
                      <button
                        key={`${priority}-${dotLevel}`}
                        type="button"
                        onClick={() => setPriorityLevel(priority, dotLevel)}
                        className={`h-2.5 w-2.5 rounded-full ${
                          dotLevel <= level ? "bg-slate-800" : "bg-slate-300"
                        }`}
                        title={`${priorityLabels[priority]} importance ${dotLevel}/5`}
                        aria-label={`${priorityLabels[priority]} importance ${dotLevel}/5`}
                      />
                    ))}
                    <span className="ml-1 text-xs text-slate-500">{priorityDots(level)}</span>
                  </div>
                </div>
              );
            })}

            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setExpandedPriorities(true)}
                className="w-full text-left text-sm font-semibold text-zillowBlue"
              >
                +{hiddenCount} more
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
