"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";

import {
  clampEndDate,
  defaultMoveInRange,
  generateInvalidDateMessage,
  isDateRangeWithinLimit,
  parseDateRangeFromSpeech,
} from "@/lib/dateRange";
import { BedBathOption, PetType, PreferencesState } from "@/lib/types";

interface PreferencesCardProps {
  preferences: PreferencesState;
  onPreferencesChange: (next: PreferencesState) => void;
}

const bedBathScale: BedBathOption[] = ["1", "2", "3", "3+"];
const petOptions: PetType[] = ["cat", "smallDog", "largeDog", "other"];

function labelPetType(pet: PetType): string {
  switch (pet) {
    case "smallDog":
      return "Small dog";
    case "largeDog":
      return "Large dog";
    default:
      return pet.charAt(0).toUpperCase() + pet.slice(1);
  }
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Select move-in dates";
  }

  return `${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`;
}

function updateDateRange(
  preferences: PreferencesState,
  onPreferencesChange: (next: PreferencesState) => void,
  nextStart: string,
  nextEnd: string,
): string | null {
  if (!nextStart || !nextEnd) {
    return "Please select both a start and end date.";
  }

  const adjustedEnd = clampEndDate(nextStart, nextEnd, 60);
  if (!isDateRangeWithinLimit(nextStart, adjustedEnd, 60)) {
    return "Date range must be valid and no longer than 60 days.";
  }

  onPreferencesChange({
    ...preferences,
    moveInStart: nextStart,
    moveInEnd: adjustedEnd,
  });
  return null;
}

export function PreferencesCard({ preferences, onPreferencesChange }: PreferencesCardProps) {
  const [speechText, setSpeechText] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechStatus, setSpeechStatus] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const dateSummary = useMemo(
    () => formatDateRange(preferences.moveInStart, preferences.moveInEnd),
    [preferences.moveInStart, preferences.moveInEnd],
  );

  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zillowSlate">Preferences</h2>
          <p className="text-sm text-slate-500">Set your fixed shortlist preferences (saved automatically).</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-zillowBlue">
          {dateSummary}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Move-in date range</h3>

          <details className="group rounded-lg border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-zillowSlate">
              Calendar dropdown
            </summary>
            <div className="space-y-3 border-t border-slate-200 px-3 py-3">
              <p className="text-xs text-slate-500">You can pick any valid range up to 60 days.</p>
              <label htmlFor="move-in-start" className="block text-xs font-medium text-slate-500">
                Start date
              </label>
              <input
                id="move-in-start"
                type="date"
                value={preferences.moveInStart}
                onChange={(event) => {
                  const nextStart = event.target.value;
                  const nextEnd = clampEndDate(nextStart, preferences.moveInEnd, 60);
                  const maybeError = updateDateRange(
                    preferences,
                    onPreferencesChange,
                    nextStart,
                    nextEnd,
                  );
                  setDateError(maybeError);
                  setSpeechError(null);
                  setSpeechStatus(null);
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-zillowBlue focus:ring"
              />

              <label htmlFor="move-in-end" className="block text-xs font-medium text-slate-500">
                End date
              </label>
              <input
                id="move-in-end"
                type="date"
                min={preferences.moveInStart || defaultMoveInRange().start}
                value={preferences.moveInEnd}
                onChange={(event) => {
                  const maybeError = updateDateRange(
                    preferences,
                    onPreferencesChange,
                    preferences.moveInStart,
                    event.target.value,
                  );
                  setDateError(maybeError);
                  setSpeechError(null);
                  setSpeechStatus(null);
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-zillowBlue focus:ring"
              />
              {dateError ? (
                <p className="text-xs text-rose-600" role="alert">
                  {dateError}
                </p>
              ) : null}
            </div>
          </details>

          <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-white p-3">
            <label htmlFor="speech-date-range" className="text-xs font-medium text-slate-500">
              Say your move-in range (v2-ready)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-500"
                title="Audio capture will be added in v2"
              >
                Mic
              </button>
              <input
                id="speech-date-range"
                value={speechText}
                onChange={(event) => {
                  setSpeechText(event.target.value);
                  setSpeechError(null);
                }}
                placeholder="Sep 1 to Sep 10 2026"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-zillowBlue focus:ring"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const parsed = parseDateRangeFromSpeech(speechText);
                if (!parsed) {
                  setSpeechError(generateInvalidDateMessage());
                  setSpeechStatus(null);
                  return;
                }

                const maybeError = updateDateRange(
                  preferences,
                  onPreferencesChange,
                  parsed.start,
                  parsed.end,
                );

                if (maybeError) {
                  setSpeechError(maybeError);
                  setSpeechStatus(null);
                  return;
                }

                setSpeechError(null);
                setDateError(null);
                setSpeechStatus(`Applied ${formatDateRange(parsed.start, parsed.end)}.`);
              }}
              className="rounded-md bg-zillowBlue px-3 py-2 text-sm font-medium text-white"
            >
              Apply spoken range
            </button>
            {speechError ? (
              <p className="text-xs text-rose-600" role="alert">
                {speechError}
              </p>
            ) : null}
            {speechStatus ? (
              <p className="text-xs text-emerald-600" aria-live="polite">
                {speechStatus}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Preferred bed / bath</h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500">Beds: {preferences.beds}</label>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={bedBathScale.indexOf(preferences.beds) + 1}
              onChange={(event) => {
                const nextBeds = bedBathScale[Number(event.target.value) - 1] ?? "1";
                onPreferencesChange({ ...preferences, beds: nextBeds });
              }}
              className="w-full accent-zillowBlue"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              {bedBathScale.map((option) => (
                <span key={`beds-${option}`}>{option}</span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500">Baths: {preferences.baths}</label>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={bedBathScale.indexOf(preferences.baths) + 1}
              onChange={(event) => {
                const nextBaths = bedBathScale[Number(event.target.value) - 1] ?? "1";
                onPreferencesChange({ ...preferences, baths: nextBaths });
              }}
              className="w-full accent-zillowBlue"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              {bedBathScale.map((option) => (
                <span key={`baths-${option}`}>{option}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Pets</h3>

          <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">Has pets?</span>
            <input
              type="checkbox"
              checked={preferences.hasPets}
              onChange={(event) => {
                onPreferencesChange({
                  ...preferences,
                  hasPets: event.target.checked,
                  petTypes: event.target.checked ? preferences.petTypes : [],
                });
              }}
              className="h-4 w-4 accent-zillowBlue"
            />
          </label>

          {preferences.hasPets ? (
            <div className="grid grid-cols-2 gap-2">
              {petOptions.map((pet) => {
                const checked = preferences.petTypes.includes(pet);
                return (
                  <label
                    key={pet}
                    className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const nextTypes = event.target.checked
                          ? [...preferences.petTypes, pet]
                          : preferences.petTypes.filter((type) => type !== pet);

                        onPreferencesChange({
                          ...preferences,
                          petTypes: nextTypes,
                        });
                      }}
                      className="h-4 w-4 accent-zillowBlue"
                    />
                    <span>{labelPetType(pet)}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No pet restrictions selected.</p>
          )}
        </div>
      </div>
    </section>
  );
}
