"use client";

import Image from "next/image";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { RankingExplanationModal } from "@/components/RankingExplanationModal";
import { attributeSchema } from "@/data/attributeSchema";
import { defaultMoveInRange } from "@/lib/dateRange";
import { computeScores, getWeightForAttribute } from "@/lib/scoring";
import {
  AmenityKey,
  AttributeKey,
  HomeType,
  House,
  ListingStage,
  NeighborhoodScore,
  PetPolicyFilter,
  PreferencesState,
  ScoreBreakdown,
  ViewPreference,
} from "@/lib/types";

interface DashboardTableProps {
  houses: House[];
  selectedAttributes: AttributeKey[];
  weights: Partial<Record<AttributeKey, number>>;
  preferences: PreferencesState;
  rowOrder: string[];
  listingStages: Record<string, ListingStage>;
  aiInsightsEnabled: boolean;
  onAiInsightsEnabledChange: (enabled: boolean) => void;
  onRowOrderChange: (next: string[]) => void;
  onListingStageChange: (houseId: string, stage: ListingStage) => void;
}

interface TradeoffInsight {
  oneLiner: string;
  whyItFitsYou: string[];
  tradeoffs: string[];
  note: string[];
}

interface TradeoffExplanationPayload {
  listing: {
    id: string;
    name: string;
    rank: number;
    price: number;
    bedrooms: number;
    bathrooms: number;
    commuteTime: number;
    walkScore: number;
    transitScore: number;
    bikeScore: number;
    naturalLight: number;
    noiseLevel: number;
    safety: number;
    hoaFees: number;
    parking: boolean;
    inUnitLaundry: boolean;
  };
  user_preferences: {
    selected_attributes: string[];
    weights: Record<string, number>;
    move_in_start: string;
    move_in_end: string;
    beds: string;
    baths: string;
    has_pets: boolean;
  };
  contribution_ranking: Array<{
    attribute: string;
    contribution: number;
    normalized: number;
    weight: number;
  }>;
  top_attributes: string[];
  lowest_attribute: string | null;
}

interface LlmTradeoffExplanationResponse {
  one_liner: string;
  why_it_fits_you: string[];
  tradeoffs: string[];
  note: string[];
}

interface RankModalState {
  house: House;
  rank: number;
  breakdown: ScoreBreakdown;
}

interface PreferenceColumn {
  id: string;
  label: string;
  value: (house: House) => string;
}

const statuses: ListingStage[] = [
  "Scouting",
  "Contacted",
  "Tour Scheduled",
  "Visited",
  "Interested",
  "Applied",
  "Lease Signed",
];

const statusStyles: Record<ListingStage, string> = {
  Scouting: "bg-slate-100 text-slate-700",
  Contacted: "bg-blue-100 text-blue-700",
  "Tour Scheduled": "bg-indigo-100 text-indigo-700",
  Visited: "bg-cyan-100 text-cyan-700",
  Interested: "bg-amber-100 text-amber-800",
  Applied: "bg-violet-100 text-violet-700",
  "Lease Signed": "bg-emerald-100 text-emerald-700",
};

const columnWidths = {
  rank: 86,
  explainer: 180,
  property: 170,
  price: 92,
  bedsBaths: 96,
  preference: 106,
  status: 120,
};

const defaultMoveIn = defaultMoveInRange();

const homeTypeLabelMap: Record<HomeType, string> = {
  apartment: "Apartment",
  condo: "Condo",
  townhome: "Townhome",
  house: "House",
};

const amenityLabelMap: Record<AmenityKey, string> = {
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

const neighborhoodViewLabelMap: Record<ViewPreference, string> = {
  city: "City View",
  water: "Water View",
  mountain: "Mountain View",
  park: "Park View",
};

const petPolicyLabelMap: Record<PetPolicyFilter, string> = {
  largeDog: "Allows large dogs",
  smallDog: "Allows small dogs",
  cat: "Allows cats",
  noPets: "No pets",
};

const neighborhoodScoreLabelMap: Record<NeighborhoodScore, string> = {
  walkScore: "Walk Score",
  transitScore: "Transit Score",
  bikeScore: "Bike Score",
};

const amenityAttributeMap: Partial<Record<AmenityKey, AttributeKey>> = {
  parking: "parking",
  inUnitLaundry: "inUnitLaundry",
};

function formatAttributeValue(house: House, attribute: AttributeKey): string {
  const value = house[attribute];

  switch (attribute) {
    case "price":
    case "hoaFees":
      return `$${Number(value).toLocaleString()}`;
    case "squareFootage":
      return `${value} sqft`;
    case "commuteTime":
      return `${value} min`;
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

function splitAddress(address: string): { line1: string; line2: string } {
  const [line1, ...rest] = address.split(",").map((part) => part.trim());
  return {
    line1: line1 ?? address,
    line2: rest.length > 0 ? rest.join(", ") : "",
  };
}

function formatShortDate(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatYesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function derivePreferenceColumns(preferences: PreferencesState): PreferenceColumn[] {
  const columns: PreferenceColumn[] = [];
  const seen = new Set<string>();

  function addColumn(column: PreferenceColumn): void {
    if (seen.has(column.id)) {
      return;
    }

    seen.add(column.id);
    columns.push(column);
  }

  const hasCustomMoveInRange =
    preferences.moveInStart !== defaultMoveIn.start || preferences.moveInEnd !== defaultMoveIn.end;
  if (hasCustomMoveInRange) {
    const moveInLabel = `${formatShortDate(preferences.moveInStart)} - ${formatShortDate(preferences.moveInEnd)}`;
    addColumn({
      id: "move-in-date",
      label: "Move-in",
      value: () => moveInLabel,
    });
  }

  for (const homeType of preferences.homeTypes) {
    const label = homeTypeLabelMap[homeType];
    addColumn({
      id: `home-type-${homeType}`,
      label,
      value: (house) => formatYesNo(house.homeType === homeType),
    });
  }

  for (const petFilter of preferences.petPolicyFilters) {
    addColumn({
      id: `pet-filter-${petFilter}`,
      label: petPolicyLabelMap[petFilter],
      value: (house) => {
        if (petFilter === "noPets") {
          return formatYesNo(house.petFriendly.length === 0);
        }

        const petType = petFilter === "cat" ? "cat" : petFilter;
        return formatYesNo(house.petFriendly.includes(petType));
      },
    });
  }

  for (const view of preferences.viewPreferences) {
    addColumn({
      id: `view-${view}`,
      label: neighborhoodViewLabelMap[view],
      value: (house) => formatYesNo(house.viewTags.includes(view)),
    });
  }

  for (const score of preferences.neighborhoodScores) {
    addColumn({
      id: `score-${score}`,
      label: neighborhoodScoreLabelMap[score],
      value: (house) => formatAttributeValue(house, score),
    });
  }

  const activeCommutes = preferences.commuteDestinations.filter((destination) => destination.address.trim());
  activeCommutes.forEach((destination, index) => {
    const destinationLabel =
      destination.type === "other" ? destination.label.trim() || "Other" : "Office";
    const label =
      activeCommutes.length > 1
        ? `Commute (${destinationLabel} ${index + 1})`
        : `Commute (${destinationLabel})`;

    addColumn({
      id: `commute-${index}`,
      label,
      value: (house) => formatAttributeValue(house, "commuteTime"),
    });
  });

  for (const amenity of preferences.amenities) {
    const mappedAttribute = amenityAttributeMap[amenity];
    addColumn({
      id: `amenity-${amenity}`,
      label: amenityLabelMap[amenity] ?? amenity,
      value: (house) => {
        if (mappedAttribute) {
          return formatAttributeValue(house, mappedAttribute);
        }

        return formatYesNo(house.amenityTags.includes(amenity));
      },
    });
  }

  return columns;
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

function summarizeTradeoff(attribute: AttributeKey): string {
  if (attribute === "price") {
    return "higher rent";
  }

  if (attribute === "hoaFees") {
    return "higher monthly fees";
  }

  if (attribute === "commuteTime") {
    return "a longer commute";
  }

  if (attribute === "noiseLevel") {
    return "higher noise levels";
  }

  return attributeSchema[attribute].displayName.toLowerCase();
}

function joinAsPhrase(values: string[]): string {
  if (values.length === 0) {
    return "your selected priorities";
  }

  if (values.length === 1) {
    return values[0];
  }

  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

function normalizeBullets(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function stripTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?]+$/, "");
}

function composeCollapsedOneLiner(
  whyItFitsYou: string[],
  tradeoffs: string[],
  fallback: string,
): string {
  const why = stripTrailingPunctuation(whyItFitsYou[0] ?? "");
  const tradeoff = stripTrailingPunctuation(tradeoffs[0] ?? "");

  if (why && tradeoff) {
    return `Best for ${why}; main tradeoff: ${tradeoff}.`;
  }

  if (why) {
    return `Best for ${why}.`;
  }

  if (tradeoff) {
    return `Main tradeoff: ${tradeoff}.`;
  }

  const cleanFallback = fallback.trim();
  if (!cleanFallback) {
    return "Balanced match with a few tradeoffs.";
  }

  return /[.!?]$/.test(cleanFallback) ? cleanFallback : `${cleanFallback}.`;
}

function rankAttributesByContribution(
  selectedAttributes: AttributeKey[],
  weights: Partial<Record<AttributeKey, number>>,
  breakdown: ScoreBreakdown,
): AttributeKey[] {
  return [...selectedAttributes]
    .filter((attribute) => getWeightForAttribute(attribute, weights) > 0)
    .sort((left, right) => breakdown.contributions[right] - breakdown.contributions[left]);
}

function buildTradeoffPayload(
  house: House,
  selectedAttributes: AttributeKey[],
  weights: Partial<Record<AttributeKey, number>>,
  breakdown: ScoreBreakdown,
  preferences: PreferencesState,
): TradeoffExplanationPayload {
  const ranked = rankAttributesByContribution(selectedAttributes, weights, breakdown);
  const topAttributes = ranked.slice(0, 2);
  const weakest = ranked.length > 0 ? ranked[ranked.length - 1] : null;

  return {
    listing: {
      id: house.id,
      name: house.name,
      rank: breakdown.rank,
      price: house.price,
      bedrooms: house.bedrooms,
      bathrooms: house.bathrooms,
      commuteTime: house.commuteTime,
      walkScore: house.walkScore,
      transitScore: house.transitScore,
      bikeScore: house.bikeScore,
      naturalLight: house.naturalLight,
      noiseLevel: house.noiseLevel,
      safety: house.safety,
      hoaFees: house.hoaFees,
      parking: house.parking,
      inUnitLaundry: house.inUnitLaundry,
    },
    user_preferences: {
      selected_attributes: ranked.map((attribute) => attributeSchema[attribute].displayName),
      weights: Object.fromEntries(
        ranked.map((attribute) => [attributeSchema[attribute].displayName, getWeightForAttribute(attribute, weights)]),
      ),
      move_in_start: preferences.moveInStart,
      move_in_end: preferences.moveInEnd,
      beds: preferences.beds,
      baths: preferences.baths,
      has_pets: preferences.hasPets,
    },
    contribution_ranking: ranked.map((attribute) => ({
      attribute: attributeSchema[attribute].displayName,
      contribution: Number((breakdown.contributions[attribute] ?? 0).toFixed(4)),
      normalized: Number((breakdown.normalized[attribute] ?? 0).toFixed(4)),
      weight: Number(getWeightForAttribute(attribute, weights).toFixed(2)),
    })),
    top_attributes: topAttributes.map((attribute) => attributeSchema[attribute].displayName),
    lowest_attribute: weakest ? attributeSchema[weakest].displayName : null,
  };
}

function isLlmTradeoffResponse(value: unknown): value is LlmTradeoffExplanationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.one_liner === "string" &&
    Array.isArray(candidate.why_it_fits_you) &&
    Array.isArray(candidate.tradeoffs) &&
    Array.isArray(candidate.note)
  );
}

function mapLlmToTradeoffInsight(response: LlmTradeoffExplanationResponse): TradeoffInsight {
  const whyItFitsYou = normalizeBullets(response.why_it_fits_you);
  const tradeoffs = normalizeBullets(response.tradeoffs);
  const note = normalizeBullets(response.note);

  return {
    oneLiner: composeCollapsedOneLiner(
      whyItFitsYou,
      tradeoffs,
      response.one_liner.trim() || "This listing balances your priorities with some tradeoffs",
    ),
    whyItFitsYou,
    tradeoffs,
    note,
  };
}

function buildTradeoffInsight(
  house: House,
  selectedAttributes: AttributeKey[],
  weights: Partial<Record<AttributeKey, number>>,
  breakdown: ScoreBreakdown,
  preferences: PreferencesState,
): TradeoffInsight {
  const ranked = rankAttributesByContribution(selectedAttributes, weights, breakdown);

  const topAttributes = ranked.slice(0, 2);
  const tradeoffAttribute =
    [...ranked].reverse().find((attribute) => !topAttributes.includes(attribute)) ?? null;

  const topLabels = topAttributes.map((attribute) => attributeSchema[attribute].displayName.toLowerCase());
  const strengths = normalizeBullets(topAttributes.map((attribute) => {
    const fit = Math.round((breakdown.normalized[attribute] ?? 0) * 100);
    return `${attributeSchema[attribute].displayName}: ${fit}% fit for your weighting`;
  }));
  const tradeoffs = tradeoffAttribute
    ? normalizeBullets([`${attributeSchema[tradeoffAttribute].displayName}: ${formatAttributeValue(house, tradeoffAttribute)}`])
    : [];
  const note: string[] = [];

  if (preferences.hasPets && preferences.petTypes.length > 0) {
    const missing = preferences.petTypes.filter((petType) => !house.petFriendly.includes(petType));
    if (missing.length > 0) {
      note.push(`Pet fit may be limited for ${missing.join(", ")}.`);
    }
  } else {
    const selectedBeds = bedroomToNumber(preferences.beds);
    const minBaths = bathroomToNumber(preferences.baths);
    const bedMatch = preferences.bedsExactMatch
      ? house.bedrooms === selectedBeds
      : house.bedrooms >= selectedBeds;

    if (!bedMatch || house.bathrooms < minBaths) {
      const bedsLabel = preferences.beds === "studio" ? "Studio" : preferences.beds;
      note.push(`Layout may miss your ${bedsLabel} bd / ${preferences.baths} ba target.`);
    }
  }

  return {
    oneLiner: composeCollapsedOneLiner(
      [joinAsPhrase(topLabels)],
      tradeoffAttribute ? [summarizeTradeoff(tradeoffAttribute)] : [],
      "Balanced match with a few tradeoffs",
    ),
    whyItFitsYou: strengths,
    tradeoffs: tradeoffs.length > 0 ? tradeoffs : ["No major tradeoff across your selected priorities."],
    note,
  };
}

async function requestLlmTradeoffExplanation(
  payload: TradeoffExplanationPayload,
): Promise<LlmTradeoffExplanationResponse> {
  const response = await fetch("/api/tradeoff-explanation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to generate tradeoff explanation");
  }

  const body = (await response.json()) as unknown;
  if (!isLlmTradeoffResponse(body)) {
    throw new Error("Invalid tradeoff explanation response");
  }

  return body;
}

function StickyCell({
  left,
  right,
  isHeader,
  className,
  children,
}: {
  left?: number;
  right?: number;
  isHeader?: boolean;
  className: string;
  children: ReactNode;
}) {
  const Comp = isHeader ? "th" : "td";
  const style: CSSProperties = {};
  if (left !== undefined) {
    style.left = `${left}px`;
  }
  if (right !== undefined) {
    style.right = `${right}px`;
  }

  return (
    <Comp
      className={`sticky border-b border-slate-200 ${isHeader ? "top-0 z-30 bg-slate-50" : "z-20 bg-white group-hover:bg-slate-50"} ${className}`}
      style={style}
    >
      {children}
    </Comp>
  );
}

function SortableRow({
  house,
  rank,
  stage,
  onStageChange,
  onRankClick,
  preferenceColumns,
  showTradeoffExplainer,
  insight,
  tradeoffExpanded,
  onToggleTradeoff,
  leftOffsets,
}: {
  house: House;
  rank: number;
  stage: ListingStage;
  onStageChange: (stage: ListingStage) => void;
  onRankClick: () => void;
  preferenceColumns: PreferenceColumn[];
  showTradeoffExplainer: boolean;
  insight: TradeoffInsight;
  tradeoffExpanded: boolean;
  onToggleTradeoff: () => void;
  leftOffsets: {
    rank: number;
    explainer: number;
    property: number;
    price: number;
    bedsBaths: number;
  };
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: house.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(
      transform
        ? {
            ...transform,
            scaleX: isDragging ? 1.01 : 1,
            scaleY: isDragging ? 1.01 : 1,
          }
        : null,
    ),
    transition,
    boxShadow: isDragging ? "0 14px 30px rgba(15, 23, 42, 0.15)" : undefined,
  };

  const address = splitAddress(house.address);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="group border-b border-slate-100 bg-white hover:bg-slate-50"
    >
      <StickyCell left={leftOffsets.rank} className="w-[86px] px-2 py-3 align-top">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag to reorder ${house.name}`}
            title="Drag to reorder"
            className="inline-flex h-7 w-4 flex-none cursor-grab items-center justify-center rounded-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
          >
            <span className="grid grid-cols-2 gap-[2px]">
              {Array.from({ length: 6 }).map((_, index) => (
                <span key={`${house.id}-drag-dot-${index}`} className="h-[2px] w-[2px] rounded-full bg-current" />
              ))}
            </span>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRankClick();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-zillowBlue"
          >
            #{rank}
          </button>
        </div>
      </StickyCell>

      {showTradeoffExplainer ? (
        <StickyCell left={leftOffsets.explainer} className="w-[180px] px-2 py-3 align-top">
          {tradeoffExpanded ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <div>
                <p className="font-semibold text-slate-900">Why it fits you</p>
                <ul className="mt-1 space-y-1">
                  {insight.whyItFitsYou.map((item) => (
                    <li key={`${house.id}-${item}`}>• {item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-semibold text-slate-900">Tradeoffs</p>
                <ul className="mt-1 space-y-1">
                  {insight.tradeoffs.map((item) => (
                    <li key={`${house.id}-tradeoff-${item}`}>• {item}</li>
                  ))}
                </ul>
              </div>

              {insight.note.length > 0 ? (
                <div>
                  <p className="font-semibold text-slate-900">Note</p>
                  <ul className="mt-1 space-y-1">
                    {insight.note.map((item) => (
                      <li key={`${house.id}-note-${item}`}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleTradeoff();
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                className="pt-1 text-xs font-semibold text-zillowBlue"
              >
                Collapse
              </button>
            </div>
          ) : (
            <div className="space-y-1 text-xs text-slate-700">
              <p>{insight.oneLiner}</p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleTradeoff();
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                className="pt-1 font-semibold text-zillowBlue"
              >
                Explain why
              </button>
            </div>
          )}
        </StickyCell>
      ) : null}

      <StickyCell left={leftOffsets.property} className="w-[170px] px-2 py-3 align-top">
        <div className="w-[144px] space-y-1.5">
          <Image
            src={house.imageUrl}
            alt={house.name}
            width={144}
            height={86}
            className="h-[86px] w-[144px] rounded-md object-cover"
          />
          <p className="text-sm font-semibold text-slate-900 leading-5 break-words">{house.name}</p>
          <p className="text-xs text-slate-500 leading-4 break-words">{address.line1}</p>
          {address.line2 ? <p className="text-xs text-slate-500 leading-4 break-words">{address.line2}</p> : null}
        </div>
      </StickyCell>

      <StickyCell left={leftOffsets.price} className="w-[92px] px-2 py-3 text-sm font-semibold text-slate-900 align-top">
        ${house.price.toLocaleString()}
      </StickyCell>

      <StickyCell left={leftOffsets.bedsBaths} className="w-[96px] px-2 py-3 text-sm text-slate-700 align-top">
        {house.bedrooms} bd / {house.bathrooms} ba
      </StickyCell>

      {preferenceColumns.map((column) => (
        <td
          key={`${house.id}-${column.id}`}
          className="w-[106px] min-w-[106px] max-w-[106px] border-b border-slate-100 px-2 py-3 text-sm text-slate-700 align-top break-words"
        >
          {column.value(house)}
        </td>
      ))}

      <StickyCell right={0} className="w-[120px] px-2 py-3 align-top">
        <select
          value={stage}
          onChange={(event) => {
            event.stopPropagation();
            onStageChange(event.target.value as ListingStage);
          }}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className={`w-full rounded-full border border-transparent px-2 py-1 text-xs font-semibold ${statusStyles[stage]}`}
        >
          {statuses.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </StickyCell>
    </tr>
  );
}

export function DashboardTable({
  houses,
  selectedAttributes,
  weights,
  preferences,
  rowOrder,
  listingStages,
  aiInsightsEnabled,
  onAiInsightsEnabledChange,
  onRowOrderChange,
  onListingStageChange,
}: DashboardTableProps) {
  const [expandedTradeoffRows, setExpandedTradeoffRows] = useState<Record<string, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rankModalState, setRankModalState] = useState<RankModalState | null>(null);
  const [, setTradeoffVersion] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const llmInsightCacheRef = useRef(new Map<string, TradeoffInsight>());
  const llmInsightsByHouseRef = useRef<Record<string, { key: string; insight: TradeoffInsight }>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const houseMap = useMemo(() => new Map(houses.map((house) => [house.id, house])), [houses]);

  const orderedHouses = useMemo(() => {
    const fromOrder = rowOrder
      .map((id) => houseMap.get(id))
      .filter((house): house is House => Boolean(house));

    const missing = houses.filter((house) => !rowOrder.includes(house.id));
    return [...fromOrder, ...missing];
  }, [houses, rowOrder, houseMap]);

  const scoreMap = useMemo(
    () => computeScores(houses, selectedAttributes, weights),
    [houses, selectedAttributes, weights],
  );
  const hasMinimumAiSelections = selectedAttributes.length >= 2;
  const effectiveAiInsightsEnabled = aiInsightsEnabled && hasMinimumAiSelections;

  useEffect(() => {
    if (!hasMinimumAiSelections && aiInsightsEnabled) {
      onAiInsightsEnabledChange(false);
    }
  }, [aiInsightsEnabled, hasMinimumAiSelections, onAiInsightsEnabledChange]);

  const tradeoffMap = useMemo(() => {
    const map: Record<string, TradeoffInsight> = {};

    for (const house of houses) {
      const breakdown = scoreMap[house.id];
      if (!breakdown) {
        continue;
      }

      map[house.id] = buildTradeoffInsight(house, selectedAttributes, weights, breakdown, preferences);
    }

    return map;
  }, [houses, preferences, scoreMap, selectedAttributes, weights]);

  useEffect(() => {
    if (!effectiveAiInsightsEnabled) {
      return;
    }

    let cancelled = false;

    async function hydrateTradeoffExplanations() {
      await Promise.all(
        houses.map(async (house) => {
          const breakdown = scoreMap[house.id];
          if (!breakdown) {
            return;
          }

          const payload = buildTradeoffPayload(
            house,
            selectedAttributes,
            weights,
            breakdown,
            preferences,
          );
          const requestKey = JSON.stringify(payload);

          const existing = llmInsightsByHouseRef.current[house.id];
          if (existing?.key === requestKey) {
            return;
          }

          const cached = llmInsightCacheRef.current.get(requestKey);
          if (cached) {
            llmInsightsByHouseRef.current[house.id] = { key: requestKey, insight: cached };
            if (!cancelled) {
              setTradeoffVersion((current) => current + 1);
            }
            return;
          }

          try {
            const llmResponse = await requestLlmTradeoffExplanation(payload);
            const llmInsight = mapLlmToTradeoffInsight(llmResponse);
            llmInsightCacheRef.current.set(requestKey, llmInsight);

            if (!cancelled) {
              llmInsightsByHouseRef.current[house.id] = { key: requestKey, insight: llmInsight };
              setTradeoffVersion((current) => current + 1);
            }
          } catch {
            const fallbackInsight = buildTradeoffInsight(
              house,
              selectedAttributes,
              weights,
              breakdown,
              preferences,
            );
            llmInsightCacheRef.current.set(requestKey, fallbackInsight);

            if (!cancelled) {
              llmInsightsByHouseRef.current[house.id] = {
                key: requestKey,
                insight: fallbackInsight,
              };
              setTradeoffVersion((current) => current + 1);
            }
          }
        }),
      );
    }

    void hydrateTradeoffExplanations();

    return () => {
      cancelled = true;
    };
  }, [effectiveAiInsightsEnabled, houses, preferences, scoreMap, selectedAttributes, weights]);

  const preferenceColumns = useMemo(
    () => derivePreferenceColumns(preferences),
    [preferences],
  );

  const leftOffsets = useMemo(() => {
    const rankLeft = 0;
    const explainerLeft = rankLeft + columnWidths.rank;
    const propertyLeft = explainerLeft + (effectiveAiInsightsEnabled ? columnWidths.explainer : 0);
    const priceLeft = propertyLeft + columnWidths.property;
    const bedsBathsLeft = priceLeft + columnWidths.price;

    return {
      rank: rankLeft,
      property: propertyLeft,
      explainer: explainerLeft,
      price: priceLeft,
      bedsBaths: bedsBathsLeft,
    };
  }, [effectiveAiInsightsEnabled]);

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    if (!overId || activeId === overId) {
      return;
    }

    const oldIndex = rowOrder.indexOf(activeId);
    const newIndex = rowOrder.indexOf(overId);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onRowOrderChange(arrayMove(rowOrder, oldIndex, newIndex));
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (sectionRef.current?.requestFullscreen) {
        await sectionRef.current.requestFullscreen();
      }
    } catch {
      // Ignore browser fullscreen API failures.
    }
  }

  return (
    <section
      ref={sectionRef}
      className={`bg-white p-5 shadow-soft ring-1 ring-slate-100 md:p-6 ${
        isFullscreen ? "h-screen rounded-none" : "rounded-2xl"
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zillowSlate">Shortlists</h2>
          <p className="text-sm text-slate-500">
            Drag rows from anywhere to reorder. Middle preference columns scroll while key columns stay pinned.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm">
            <span className="font-medium text-slate-600">AI Tradeoff Explainer</span>
            <input
              type="checkbox"
              checked={effectiveAiInsightsEnabled}
              disabled={!hasMinimumAiSelections}
              onChange={(event) => {
                if (!hasMinimumAiSelections) {
                  return;
                }
                onAiInsightsEnabledChange(event.target.checked);
              }}
              className="h-4 w-4 accent-zillowBlue"
            />
          </label>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Expand screen"}
            title={isFullscreen ? "Exit full screen" : "Expand screen"}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50"
          >
            <Image
              src="/icons/expand-screen.avif"
              alt=""
              width={22}
              height={22}
              className="h-[22px] w-[22px]"
            />
          </button>
        </div>
      </div>

      {houses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No houses available.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div
            className={`overflow-auto rounded-xl border border-slate-200 ${
              isFullscreen ? "max-h-[calc(100vh-170px)]" : "max-h-[72vh]"
            }`}
          >
            <table
              className="border-collapse"
              style={{
                minWidth:
                  columnWidths.rank +
                  columnWidths.property +
                  (effectiveAiInsightsEnabled ? columnWidths.explainer : 0) +
                  columnWidths.price +
                  columnWidths.bedsBaths +
                  preferenceColumns.length * columnWidths.preference +
                  columnWidths.status,
              }}
            >
              <caption className="sr-only">
                Rental decision table with ranking, property status, dynamic preference columns, and tradeoff explanations.
              </caption>
              <thead>
                <tr>
                  <StickyCell isHeader left={leftOffsets.rank} className="w-[86px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rank
                  </StickyCell>
                  {effectiveAiInsightsEnabled ? (
                    <StickyCell isHeader left={leftOffsets.explainer} className="w-[180px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      AI Tradeoff Explainer
                    </StickyCell>
                  ) : null}
                  <StickyCell isHeader left={leftOffsets.property} className="w-[170px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Property
                  </StickyCell>
                  <StickyCell isHeader left={leftOffsets.price} className="w-[92px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Price
                  </StickyCell>
                  <StickyCell isHeader left={leftOffsets.bedsBaths} className="w-[96px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    B/B
                  </StickyCell>

                  {preferenceColumns.map((column) => (
                    <th
                      key={`head-${column.id}`}
                      className="sticky top-0 z-10 w-[106px] min-w-[106px] max-w-[106px] border-b border-slate-200 bg-slate-50 px-2 py-3 text-left text-[11px] font-semibold uppercase leading-tight tracking-wide text-slate-500 break-words"
                    >
                      {column.label}
                    </th>
                  ))}

                  <StickyCell isHeader right={0} className="w-[120px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </StickyCell>
                </tr>
              </thead>

              <tbody>
                <SortableContext
                  items={orderedHouses.map((house) => house.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {orderedHouses.map((house) => (
                    <SortableRow
                      key={house.id}
                      house={house}
                      rank={scoreMap[house.id]?.rank ?? 0}
                      stage={listingStages[house.id] ?? "Scouting"}
                      onStageChange={(stage) => onListingStageChange(house.id, stage)}
                      onRankClick={() => {
                        const breakdown = scoreMap[house.id];
                        if (!breakdown) {
                          return;
                        }

                        setRankModalState({
                          house,
                          rank: breakdown.rank,
                          breakdown,
                        });
                      }}
                      preferenceColumns={preferenceColumns}
                      showTradeoffExplainer={effectiveAiInsightsEnabled}
                      insight={
                        llmInsightsByHouseRef.current[house.id]?.insight ??
                        tradeoffMap[house.id] ?? {
                          oneLiner: "This listing has limited matching data right now.",
                          whyItFitsYou: [],
                          tradeoffs: ["Not enough selected attributes to explain tradeoffs."],
                          note: [],
                        }
                      }
                      tradeoffExpanded={Boolean(expandedTradeoffRows[house.id])}
                      onToggleTradeoff={() =>
                        setExpandedTradeoffRows((current) => ({
                          ...current,
                          [house.id]: !current[house.id],
                        }))
                      }
                      leftOffsets={{
                        rank: leftOffsets.rank,
                        explainer: leftOffsets.explainer,
                        property: leftOffsets.property,
                        price: leftOffsets.price,
                        bedsBaths: leftOffsets.bedsBaths,
                      }}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </div>
        </DndContext>
      )}

      {rankModalState ? (
        <RankingExplanationModal
          house={rankModalState.house}
          rank={rankModalState.rank}
          selectedAttributes={selectedAttributes}
          weights={weights}
          breakdown={rankModalState.breakdown}
          onClose={() => setRankModalState(null)}
        />
      ) : null}
    </section>
  );
}
