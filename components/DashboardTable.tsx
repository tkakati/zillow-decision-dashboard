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

import { attributeSchema } from "@/data/attributeSchema";
import { computeScores, getWeightForAttribute } from "@/lib/scoring";
import { AttributeKey, House, ListingStage, PreferencesState, ScoreBreakdown } from "@/lib/types";

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
  topLine: string;
  tradeoffLine: string;
  heading: string;
  becauseLine: string;
  strengths: string[];
  tradeoff: string;
  note?: string;
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
  rank: 62,
  explainer: 180,
  property: 170,
  price: 92,
  bedsBaths: 96,
  preference: 106,
  status: 120,
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

function buildTradeoffInsight(
  house: House,
  selectedAttributes: AttributeKey[],
  weights: Partial<Record<AttributeKey, number>>,
  breakdown: ScoreBreakdown,
  preferences: PreferencesState,
): TradeoffInsight {
  const ranked = [...selectedAttributes]
    .filter((attribute) => getWeightForAttribute(attribute, weights) > 0)
    .sort((left, right) => breakdown.contributions[right] - breakdown.contributions[left]);

  const topAttributes = ranked.slice(0, 2);
  const weakest = ranked.length > 0 ? ranked[ranked.length - 1] : null;

  const topLabels = topAttributes.map((attribute) => attributeSchema[attribute].displayName.toLowerCase());
  const topWithWeights = topAttributes.map((attribute) => {
    const weight = Math.round(getWeightForAttribute(attribute, weights));
    return `${attributeSchema[attribute].displayName.toLowerCase()} (${weight}/10)`;
  });

  const strengths = topAttributes.map((attribute) => {
    const fit = Math.round((breakdown.normalized[attribute] ?? 0) * 100);
    return `${attributeSchema[attribute].displayName}: ${fit}% fit`;
  });

  let note: string | undefined;

  if (preferences.hasPets && preferences.petTypes.length > 0) {
    const missing = preferences.petTypes.filter((petType) => !house.petFriendly.includes(petType));
    if (missing.length > 0) {
      note = `Pet fit may be limited for ${missing.join(", ")}.`;
    }
  } else {
    const selectedBeds = bedroomToNumber(preferences.beds);
    const minBaths = bathroomToNumber(preferences.baths);
    const bedMatch = preferences.bedsExactMatch
      ? house.bedrooms === selectedBeds
      : house.bedrooms >= selectedBeds;

    if (!bedMatch || house.bathrooms < minBaths) {
      const bedsLabel = preferences.beds === "studio" ? "Studio" : preferences.beds;
      note = `Layout may miss your ${bedsLabel} bd / ${preferences.baths} ba target.`;
    }
  }

  return {
    topLine: `Best match for your priorities: ${joinAsPhrase(topLabels)}`,
    tradeoffLine: `Main tradeoff: ${weakest ? summarizeTradeoff(weakest) : "limited signal"}`,
    heading: `Why this ranks #${breakdown.rank} for you`,
    becauseLine: `Because you prioritized ${joinAsPhrase(topWithWeights)}, this home scores strongly on both.`,
    strengths,
    tradeoff: weakest ? `${attributeSchema[weakest].displayName}: ${formatAttributeValue(house, weakest)}` : "Not enough selected attributes to flag a tradeoff.",
    note,
  };
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
  preferenceAttributes,
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
  preferenceAttributes: AttributeKey[];
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
      {...attributes}
      {...listeners}
      className="group border-b border-slate-100 bg-white hover:bg-slate-50 cursor-grab active:cursor-grabbing"
    >
      <StickyCell left={leftOffsets.rank} className="w-[62px] px-2 py-3 align-top">
        <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-zillowBlue">
          #{rank}
        </span>
      </StickyCell>

      {showTradeoffExplainer ? (
        <StickyCell left={leftOffsets.explainer} className="w-[180px] px-2 py-3 align-top">
          {tradeoffExpanded ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="text-sm font-semibold text-slate-900">{insight.heading}</p>
              <p>{insight.becauseLine}</p>

              <div>
                <p className="font-semibold text-slate-900">Strengths</p>
                <ul className="mt-1 space-y-1">
                  {insight.strengths.map((item) => (
                    <li key={`${house.id}-${item}`}>• {item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-semibold text-slate-900">Tradeoff</p>
                <p className="mt-1">• {insight.tradeoff}</p>
              </div>

              {insight.note ? (
                <div>
                  <p className="font-semibold text-slate-900">Note</p>
                  <p className="mt-1">• {insight.note}</p>
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
              <p>{insight.topLine}</p>
              <p>{insight.tradeoffLine}</p>
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

      {preferenceAttributes.map((attribute) => (
        <td
          key={`${house.id}-${attribute}`}
          className="w-[106px] min-w-[106px] border-b border-slate-100 px-2 py-3 text-sm text-slate-700 align-top"
        >
          {formatAttributeValue(house, attribute)}
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
  const sectionRef = useRef<HTMLElement | null>(null);

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

  const preferenceAttributes = useMemo(
    () => selectedAttributes.filter((attribute) => attribute !== "price"),
    [selectedAttributes],
  );

  const leftOffsets = useMemo(() => {
    const rankLeft = 0;
    const explainerLeft = rankLeft + columnWidths.rank;
    const propertyLeft = explainerLeft + (aiInsightsEnabled ? columnWidths.explainer : 0);
    const priceLeft = propertyLeft + columnWidths.property;
    const bedsBathsLeft = priceLeft + columnWidths.price;

    return {
      rank: rankLeft,
      property: propertyLeft,
      explainer: explainerLeft,
      price: priceLeft,
      bedsBaths: bedsBathsLeft,
    };
  }, [aiInsightsEnabled]);

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
              checked={aiInsightsEnabled}
              onChange={(event) => onAiInsightsEnabledChange(event.target.checked)}
              className="h-4 w-4 accent-zillowBlue"
            />
          </label>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Expand screen"}
            title={isFullscreen ? "Exit full screen" : "Expand screen"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50"
          >
            <Image
              src="/icons/expand-screen.avif"
              alt=""
              width={14}
              height={14}
              className="h-3.5 w-3.5"
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
                  (aiInsightsEnabled ? columnWidths.explainer : 0) +
                  columnWidths.price +
                  columnWidths.bedsBaths +
                  preferenceAttributes.length * columnWidths.preference +
                  columnWidths.status,
              }}
            >
              <caption className="sr-only">
                Rental decision table with ranking, property status, dynamic preference columns, and tradeoff explanations.
              </caption>
              <thead>
                <tr>
                  <StickyCell isHeader left={leftOffsets.rank} className="w-[62px] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rank
                  </StickyCell>
                  {aiInsightsEnabled ? (
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

                  {preferenceAttributes.map((attribute) => (
                    <th
                      key={`head-${attribute}`}
                      className="sticky top-0 z-10 w-[106px] min-w-[106px] whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {attributeSchema[attribute].displayName}
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
                      preferenceAttributes={preferenceAttributes}
                      showTradeoffExplainer={aiInsightsEnabled}
                      insight={
                        tradeoffMap[house.id] ?? {
                          topLine: "Best match for your priorities: not enough data",
                          tradeoffLine: "Main tradeoff: not enough data",
                          heading: "Why this ranks for you",
                          becauseLine: "Select more preferences to generate explanation details.",
                          strengths: [],
                          tradeoff: "Not enough selected attributes to flag a tradeoff.",
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
    </section>
  );
}
