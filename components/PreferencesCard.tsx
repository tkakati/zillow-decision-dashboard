"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AmenityKey,
  BathroomOption,
  BedroomOption,
  HomeType,
  PetPolicyFilter,
  PetType,
  PreferencesState,
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
  | "amenities"
  | "pets"
  | "view"
  | "commute";

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

const tabs: { key: FilterTab; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "bedsBaths", label: "Beds/Baths" },
  { key: "moveInDate", label: "Move-In Date" },
  { key: "homeType", label: "Home Type" },
  { key: "amenities", label: "Amenities" },
  { key: "pets", label: "Pets" },
  { key: "view", label: "View" },
  { key: "commute", label: "Commute" },
];

function toggleItem<T extends string>(items: T[], value: T): T[] {
  if (items.includes(value)) {
    return items.filter((item) => item !== value);
  }

  return [...items, value];
}

function formatPrice(value: number | null): string {
  if (value === null) {
    return "No min/max";
  }

  return `$${value.toLocaleString()}`;
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

function normalizeAppliedPreferences(next: PreferencesState): PreferencesState {
  let priceMin = next.priceMin;
  let priceMax = next.priceMax;

  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
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

  const uniquePetTypes = Array.from(new Set(petTypes));
  const commuteAddresses = next.commuteAddresses
    .map((address) => address.trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    ...next,
    moveInEnd: next.moveInStart || next.moveInEnd,
    priceMin,
    priceMax,
    petPolicyFilters,
    hasPets: uniquePetTypes.length > 0,
    petTypes: uniquePetTypes,
    commuteAddresses: commuteAddresses.length > 0 ? commuteAddresses : [""],
  };
}

function summaryLabel(tab: FilterTab, preferences: PreferencesState): string {
  if (tab === "price") {
    if (preferences.priceMin === null && preferences.priceMax === null) {
      return "Price";
    }

    return `${formatPrice(preferences.priceMin)} - ${formatPrice(preferences.priceMax)}`;
  }

  if (tab === "bedsBaths") {
    const bedLabel = preferences.beds === "studio" ? "Studio" : preferences.beds;
    return `${bedLabel} bd, ${preferences.baths} ba`;
  }

  if (tab === "moveInDate") {
    const date = new Date(preferences.moveInStart);
    if (Number.isNaN(date.getTime())) {
      return "Move-In Date";
    }

    return format(date, "MMM d, yyyy");
  }

  if (tab === "homeType") {
    return preferences.homeTypes.length > 0 ? `Home Type (${preferences.homeTypes.length})` : "Home Type";
  }

  if (tab === "amenities") {
    return preferences.amenities.length > 0 ? `Amenities (${preferences.amenities.length})` : "Amenities";
  }

  if (tab === "pets") {
    return preferences.petPolicyFilters.length > 0 ? `Pets (${preferences.petPolicyFilters.length})` : "Pets";
  }

  if (tab === "view") {
    return preferences.viewPreferences.length > 0 ? `View (${preferences.viewPreferences.length})` : "View";
  }

  if (tab === "commute") {
    return preferences.commuteAddresses.some((address) => address.trim())
      ? `Commute (${preferences.commuteAddresses.filter((address) => address.trim()).length})`
      : "Commute";
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
    case "amenities":
      return "Other Amenities";
    case "pets":
      return "Pets";
    case "view":
      return "View";
    case "commute":
      return "Commute Time";
    default:
      return "Filters";
  }
}

export function PreferencesCard({ preferences, onPreferencesChange }: PreferencesCardProps) {
  const [activeTab, setActiveTab] = useState<FilterTab | null>(null);
  const [draft, setDraft] = useState<PreferencesState>(preferences);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setActiveTab(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const activeTitle = useMemo(() => (activeTab ? panelTitle(activeTab) : ""), [activeTab]);

  function openTab(tab: FilterTab) {
    setDraft(preferences);
    setActiveTab((current) => (current === tab ? null : tab));
  }

  function applyCurrentDraft() {
    onPreferencesChange(normalizeAppliedPreferences(draft));
    setActiveTab(null);
  }

  function resetTabFilters(tab: FilterTab) {
    if (tab === "homeType") {
      setDraft((current) => ({ ...current, homeTypes: [] }));
      return;
    }

    if (tab === "amenities") {
      setDraft((current) => ({ ...current, amenities: [] }));
      return;
    }

    if (tab === "pets") {
      setDraft((current) => ({ ...current, petPolicyFilters: [] }));
      return;
    }

    if (tab === "view") {
      setDraft((current) => ({ ...current, viewPreferences: [] }));
      return;
    }

    if (tab === "commute") {
      setDraft((current) => ({ ...current, commuteAddresses: [""] }));
      return;
    }
  }

  return (
    <section ref={containerRef} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => openTab(tab.key)}
              className={`inline-flex min-h-12 items-center gap-2 rounded-lg border px-4 py-3 text-[15px] font-semibold transition ${
                isActive
                  ? "border-zillowBlue bg-blue-50 text-zillowBlue"
                  : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
              }`}
            >
              <span>{summaryLabel(tab.key, preferences)}</span>
              <span className="text-xs">v</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPreferencesChange(normalizeAppliedPreferences(draft))}
          className="ml-auto min-h-12 rounded-lg bg-zillowBlue px-5 py-3 text-[15px] font-semibold text-white hover:brightness-95"
        >
          Save search
        </button>
      </div>

      {activeTab ? (
        <div className="mt-3 w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-soft">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h3 className="text-2xl font-semibold text-slate-700">{activeTitle}</h3>
          </div>

          <div className="space-y-5 px-5 py-5">
            {activeTab === "price" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="price-min" className="block text-sm font-semibold text-slate-700">
                      Min
                    </label>
                    <input
                      id="price-min"
                      type="number"
                      min={0}
                      value={draft.priceMin ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          priceMin: toNumberOrNull(event.target.value),
                        }))
                      }
                      placeholder="No min"
                      className="w-full rounded-lg border border-slate-300 px-3 py-3 text-lg text-slate-700 outline-none ring-zillowBlue focus:ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="price-max" className="block text-sm font-semibold text-slate-700">
                      Max
                    </label>
                    <input
                      id="price-max"
                      type="number"
                      min={0}
                      value={draft.priceMax ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          priceMax: toNumberOrNull(event.target.value),
                        }))
                      }
                      placeholder="No max"
                      className="w-full rounded-lg border border-slate-300 px-3 py-3 text-lg text-slate-700 outline-none ring-zillowBlue focus:ring"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={applyCurrentDraft}
                  className="w-full rounded-lg bg-zillowBlue px-4 py-3 text-xl font-semibold text-white"
                >
                  Apply
                </button>
              </>
            ) : null}

            {activeTab === "bedsBaths" ? (
              <>
                <div className="space-y-3">
                  <h4 className="text-xl font-semibold text-slate-700">Bedrooms</h4>
                  <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-300 sm:grid-cols-6">
                    {bedroomOptions.map((option) => {
                      const selected = draft.beds === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, beds: option.value }))}
                          className={`border-r border-slate-300 px-3 py-3 text-lg font-semibold last:border-r-0 ${
                            selected ? "bg-blue-50 text-zillowBlue" : "bg-white text-slate-800"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <label className="inline-flex items-center gap-2 text-lg text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.bedsExactMatch}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          bedsExactMatch: event.target.checked,
                        }))
                      }
                      className="h-5 w-5 accent-zillowBlue"
                    />
                    Use exact match
                  </label>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xl font-semibold text-slate-700">Bathrooms</h4>
                  <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-300 sm:grid-cols-6">
                    {bathroomOptions.map((option) => {
                      const selected = draft.baths === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, baths: option.value }))}
                          className={`border-r border-slate-300 px-3 py-3 text-lg font-semibold last:border-r-0 ${
                            selected ? "bg-blue-50 text-zillowBlue" : "bg-white text-slate-800"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={applyCurrentDraft}
                  className="w-full rounded-lg bg-zillowBlue px-4 py-3 text-xl font-semibold text-white"
                >
                  Apply
                </button>
              </>
            ) : null}

            {activeTab === "moveInDate" ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="move-in-date" className="block text-sm font-semibold text-slate-700">
                    Move-In Date
                  </label>
                  <input
                    id="move-in-date"
                    type="date"
                    value={draft.moveInStart}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        moveInStart: event.target.value,
                        moveInEnd: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 text-lg text-slate-700 outline-none ring-zillowBlue focus:ring"
                  />
                </div>

                <button
                  type="button"
                  onClick={applyCurrentDraft}
                  className="w-full rounded-lg bg-zillowBlue px-4 py-3 text-xl font-semibold text-white"
                >
                  Apply
                </button>
              </>
            ) : null}

            {activeTab === "homeType" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {homeTypeOptions.map((option) => (
                    <label key={option.value} className="inline-flex items-center gap-2 text-lg text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.homeTypes.includes(option.value)}
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            homeTypes: toggleItem(current.homeTypes, option.value),
                          }))
                        }
                        className="h-5 w-5 accent-zillowBlue"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => resetTabFilters("homeType")}
                    className="text-lg font-semibold text-blue-800"
                  >
                    Reset all filters
                  </button>
                  <button
                    type="button"
                    onClick={applyCurrentDraft}
                    className="rounded-lg bg-zillowBlue px-8 py-3 text-xl font-semibold text-white"
                  >
                    Apply
                  </button>
                </div>
              </>
            ) : null}

            {activeTab === "amenities" ? (
              <>
                <div className="max-h-[420px] space-y-2 overflow-auto pr-2">
                  {amenityOptions.map((option) => (
                    <label key={option.value} className="inline-flex w-full items-center gap-2 text-lg text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.amenities.includes(option.value)}
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            amenities: toggleItem(current.amenities, option.value),
                          }))
                        }
                        className="h-5 w-5 accent-zillowBlue"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => resetTabFilters("amenities")}
                    className="text-lg font-semibold text-blue-800"
                  >
                    Reset all filters
                  </button>
                  <button
                    type="button"
                    onClick={applyCurrentDraft}
                    className="rounded-lg bg-zillowBlue px-8 py-3 text-xl font-semibold text-white"
                  >
                    Apply
                  </button>
                </div>
              </>
            ) : null}

            {activeTab === "pets" ? (
              <>
                <div className="space-y-3">
                  {petPolicyOptions.map((option) => (
                    <label key={option.value} className="inline-flex w-full items-center gap-2 text-lg text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.petPolicyFilters.includes(option.value)}
                        onChange={() => {
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
                          });
                        }}
                        className="h-5 w-5 accent-zillowBlue"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => resetTabFilters("pets")}
                    className="text-lg font-semibold text-blue-800"
                  >
                    Reset all filters
                  </button>
                  <button
                    type="button"
                    onClick={applyCurrentDraft}
                    className="rounded-lg bg-zillowBlue px-8 py-3 text-xl font-semibold text-white"
                  >
                    Apply
                  </button>
                </div>
              </>
            ) : null}

            {activeTab === "view" ? (
              <>
                <div className="space-y-3">
                  {viewOptions.map((option) => (
                    <label key={option.value} className="inline-flex w-full items-center gap-2 text-lg text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.viewPreferences.includes(option.value)}
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            viewPreferences: toggleItem(current.viewPreferences, option.value),
                          }))
                        }
                        className="h-5 w-5 accent-zillowBlue"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => resetTabFilters("view")}
                    className="text-lg font-semibold text-blue-800"
                  >
                    Reset all filters
                  </button>
                  <button
                    type="button"
                    onClick={applyCurrentDraft}
                    className="rounded-lg bg-zillowBlue px-8 py-3 text-xl font-semibold text-white"
                  >
                    Apply
                  </button>
                </div>
              </>
            ) : null}

            {activeTab === "commute" ? (
              <>
                <div className="space-y-3">
                  {draft.commuteAddresses.map((address, index) => (
                    <div key={`address-${index}`} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={address}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDraft((current) => ({
                            ...current,
                            commuteAddresses: current.commuteAddresses.map((item, itemIndex) =>
                              itemIndex === index ? value : item,
                            ),
                          }));
                        }}
                        placeholder="Enter address, city, state and ZIP code"
                        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-lg text-slate-700 outline-none ring-zillowBlue focus:ring"
                      />

                      {index > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              commuteAddresses: current.commuteAddresses.filter((_, itemIndex) => itemIndex !== index),
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        commuteAddresses: [...current.commuteAddresses, ""],
                      }))
                    }
                    className="text-base font-semibold text-zillowBlue"
                  >
                    + Add More
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => resetTabFilters("commute")}
                    className="text-lg font-semibold text-blue-800"
                  >
                    Reset all filters
                  </button>
                  <button
                    type="button"
                    onClick={applyCurrentDraft}
                    className="rounded-lg bg-zillowBlue px-8 py-3 text-xl font-semibold text-white"
                  >
                    Apply
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
