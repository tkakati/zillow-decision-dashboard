"use client";

import Image from "next/image";
import { useMemo } from "react";
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
import { computeScores, generateTradeoffExplanation } from "@/lib/scoring";
import { AttributeKey, House, ListingStage, PreferencesState } from "@/lib/types";

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

const stages: ListingStage[] = [
  "Scouting",
  "Contacted",
  "Tour Scheduled",
  "Visited",
  "Interested",
  "Applied",
  "Lease Signed",
];

const stageStyles: Record<ListingStage, string> = {
  Scouting: "bg-slate-100 text-slate-700",
  Contacted: "bg-blue-100 text-blue-700",
  "Tour Scheduled": "bg-indigo-100 text-indigo-700",
  Visited: "bg-cyan-100 text-cyan-700",
  Interested: "bg-amber-100 text-amber-800",
  Applied: "bg-violet-100 text-violet-700",
  "Lease Signed": "bg-emerald-100 text-emerald-700",
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

function SortableRow({
  house,
  rank,
  explanation,
  showTradeoffExplainer,
  preferenceAttributes,
  stage,
  onStageChange,
}: {
  house: House;
  rank: number;
  explanation: string;
  showTradeoffExplainer: boolean;
  preferenceAttributes: AttributeKey[];
  stage: ListingStage;
  onStageChange: (stage: ListingStage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: house.id,
  });

  const style = {
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
  };

  const address = splitAddress(house.address);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`border-b border-slate-100 bg-white hover:bg-slate-50 ${
        isDragging ? "shadow-xl" : ""
      } cursor-grab active:cursor-grabbing`}
    >
      <td className="px-3 py-3 align-top">
        <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-zillowBlue">
          #{rank}
        </span>
      </td>

      <td className="px-3 py-3 align-top">
        <div className="flex items-start gap-3">
          <Image
            src={house.imageUrl}
            alt={house.name}
            width={72}
            height={54}
            className="h-[54px] w-[72px] rounded-md object-cover"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">{house.name}</p>
            <p className="text-xs text-slate-500">{address.line1}</p>
            {address.line2 ? <p className="text-xs text-slate-500">{address.line2}</p> : null}
          </div>
        </div>
      </td>

      <td className="px-3 py-3 align-top">
        <select
          value={stage}
          onChange={(event) => {
            event.stopPropagation();
            onStageChange(event.target.value as ListingStage);
          }}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className={`rounded-full border border-transparent px-2 py-1 text-xs font-semibold ${stageStyles[stage]}`}
        >
          {stages.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </td>

      <td className="px-3 py-3 text-sm font-semibold text-slate-900">${house.price.toLocaleString()}</td>

      {preferenceAttributes.map((attribute) => (
        <td key={`${house.id}-${attribute}`} className="px-3 py-3 text-sm text-slate-700">
          {formatAttributeValue(house, attribute)}
        </td>
      ))}

      {showTradeoffExplainer ? (
        <td className="px-3 py-3 text-sm text-slate-700">{explanation}</td>
      ) : null}
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
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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

  const explanations = useMemo(() => {
    const map: Record<string, string> = {};

    for (const house of houses) {
      const breakdown = scoreMap[house.id];
      if (!breakdown) {
        continue;
      }

      map[house.id] = generateTradeoffExplanation(
        house,
        selectedAttributes,
        weights,
        breakdown,
        preferences,
      );
    }

    return map;
  }, [houses, scoreMap, selectedAttributes, weights, preferences]);

  const preferenceAttributes = useMemo(
    () => selectedAttributes.filter((attribute) => attribute !== "price"),
    [selectedAttributes],
  );

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

  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zillowSlate">Dashboard Table</h2>
          <p className="text-sm text-slate-500">
            Drag rows from anywhere to reorder. Ranking updates automatically from preference weights.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm">
          <span className="font-medium text-slate-600">AI Tradeoff Explainer</span>
          <input
            type="checkbox"
            checked={aiInsightsEnabled}
            onChange={(event) => onAiInsightsEnabledChange(event.target.checked)}
            className="h-4 w-4 accent-zillowBlue"
          />
        </label>
      </div>

      {houses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No houses available.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse">
              <caption className="sr-only">
                Rental decision table with ranking, stage tracking, dynamic preference columns, and tradeoff explanations.
              </caption>
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rank
                  </th>
                  <th className="sticky top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Property
                  </th>
                  <th className="sticky top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Stage
                  </th>
                  <th className="sticky top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Rent
                  </th>

                  {preferenceAttributes.map((attribute) => (
                    <th
                      key={`head-${attribute}`}
                      className="sticky top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {attributeSchema[attribute].displayName}
                    </th>
                  ))}

                  {aiInsightsEnabled ? (
                    <th className="sticky top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      AI Tradeoff Explanation
                    </th>
                  ) : null}
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
                      explanation={explanations[house.id] ?? "No explanation available yet."}
                      showTradeoffExplainer={aiInsightsEnabled}
                      preferenceAttributes={preferenceAttributes}
                      stage={listingStages[house.id] ?? "Scouting"}
                      onStageChange={(stage) => onListingStageChange(house.id, stage)}
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
