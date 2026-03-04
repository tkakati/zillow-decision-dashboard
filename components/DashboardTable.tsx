"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
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
import { AttributeKey, House, PreferencesState, SortState } from "@/lib/types";

interface DashboardTableProps {
  houses: House[];
  selectedAttributes: AttributeKey[];
  weights: Partial<Record<AttributeKey, number>>;
  preferences: PreferencesState;
  rowOrder: string[];
  aiInsightsEnabled: boolean;
  onAiInsightsEnabledChange: (enabled: boolean) => void;
  onRowOrderChange: (next: string[]) => void;
}

const GATE_MESSAGE = "Add three or more houses AND 3 or more attributes";

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

function sortIcon(
  sortState: SortState | null,
  attribute: AttributeKey,
  sortable: boolean,
): string {
  if (!sortable) {
    return "";
  }

  if (!sortState || sortState.key !== attribute) {
    return "<>";
  }

  return sortState.direction === "asc" ? "^" : "v";
}

function getAriaSort(
  sortState: SortState | null,
  attribute: AttributeKey,
  sortable: boolean,
): "ascending" | "descending" | "none" | undefined {
  if (!sortable) {
    return undefined;
  }

  if (!sortState || sortState.key !== attribute) {
    return "none";
  }

  return sortState.direction === "asc" ? "ascending" : "descending";
}

function SortableRow({
  house,
  selectedAttributes,
  canShowAI,
  aiInsightsEnabled,
  rowIndex,
  rank,
  explanation,
}: {
  house: House;
  selectedAttributes: AttributeKey[];
  canShowAI: boolean;
  aiInsightsEnabled: boolean;
  rowIndex: number;
  rank?: number;
  explanation?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: house.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-slate-100 bg-white ${isDragging ? "opacity-70" : ""}`}
    >
      <td className="sticky left-0 z-10 bg-white px-3 py-3 align-top">
        <div className="flex items-start gap-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Drag to reorder"
          >
            Drag
          </button>
          <Image
            src={house.imageUrl}
            alt={house.name}
            width={64}
            height={48}
            className="h-12 w-16 rounded-md object-cover"
          />
          <div>
            <p className="text-sm font-semibold text-slate-800">{house.name}</p>
            <p className="text-xs text-slate-500">{house.address}</p>
          </div>
        </div>
      </td>

      {selectedAttributes.map((attribute) => (
        <td key={`${house.id}-${attribute}`} className="px-3 py-3 text-sm text-slate-700">
          {formatAttributeValue(house, attribute)}
        </td>
      ))}

      {aiInsightsEnabled ? (
        <>
          <td
            className={`px-3 py-3 text-sm font-medium ${
              canShowAI ? "text-zillowBlue" : "bg-slate-100 text-slate-500"
            }`}
          >
            {canShowAI
              ? `#${rank}`
              : rowIndex < 2
                ? GATE_MESSAGE
                : "-"}
          </td>
          <td className={`px-3 py-3 text-sm ${canShowAI ? "text-slate-700" : "bg-slate-100 text-slate-500"}`}>
            {canShowAI
              ? explanation
              : rowIndex < 2
                ? GATE_MESSAGE
                : "-"}
          </td>
        </>
      ) : null}
    </tr>
  );
}

function StaticRow({
  house,
  selectedAttributes,
  canShowAI,
  aiInsightsEnabled,
  rowIndex,
  rank,
  explanation,
}: {
  house: House;
  selectedAttributes: AttributeKey[];
  canShowAI: boolean;
  aiInsightsEnabled: boolean;
  rowIndex: number;
  rank?: number;
  explanation?: string;
}) {
  return (
    <tr className="border-b border-slate-100 bg-white">
      <td className="sticky left-0 z-10 bg-white px-3 py-3 align-top">
        <div className="flex items-start gap-3">
          <span className="mt-1 rounded p-1 text-slate-300">Drag</span>
          <Image
            src={house.imageUrl}
            alt={house.name}
            width={64}
            height={48}
            className="h-12 w-16 rounded-md object-cover"
          />
          <div>
            <p className="text-sm font-semibold text-slate-800">{house.name}</p>
            <p className="text-xs text-slate-500">{house.address}</p>
          </div>
        </div>
      </td>

      {selectedAttributes.map((attribute) => (
        <td key={`${house.id}-${attribute}`} className="px-3 py-3 text-sm text-slate-700">
          {formatAttributeValue(house, attribute)}
        </td>
      ))}

      {aiInsightsEnabled ? (
        <>
          <td
            className={`px-3 py-3 text-sm font-medium ${
              canShowAI ? "text-zillowBlue" : "bg-slate-100 text-slate-500"
            }`}
          >
            {canShowAI
              ? `#${rank}`
              : rowIndex < 2
                ? GATE_MESSAGE
                : "-"}
          </td>
          <td className={`px-3 py-3 text-sm ${canShowAI ? "text-slate-700" : "bg-slate-100 text-slate-500"}`}>
            {canShowAI
              ? explanation
              : rowIndex < 2
                ? GATE_MESSAGE
                : "-"}
          </td>
        </>
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
  aiInsightsEnabled,
  onAiInsightsEnabledChange,
  onRowOrderChange,
}: DashboardTableProps) {
  const [sortState, setSortState] = useState<SortState | null>(null);

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

  const canShowAI = houses.length >= 3 && selectedAttributes.length >= 3;

  const scoreMap = useMemo(() => {
    if (!canShowAI) {
      return {};
    }

    return computeScores(houses, selectedAttributes, weights);
  }, [canShowAI, houses, selectedAttributes, weights]);

  const displayHouses = useMemo(() => {
    if (!sortState) {
      return orderedHouses;
    }

    return [...orderedHouses].sort((a, b) => {
      const left = a[sortState.key] as number;
      const right = b[sortState.key] as number;

      if (sortState.direction === "asc") {
        return left - right;
      }
      return right - left;
    });
  }, [orderedHouses, sortState]);

  const explanations = useMemo(() => {
    if (!canShowAI) {
      return {} as Record<string, string>;
    }

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
  }, [canShowAI, houses, preferences, scoreMap, selectedAttributes, weights]);

  function toggleSort(attribute: AttributeKey) {
    const meta = attributeSchema[attribute];
    if (!meta.sortable) {
      return;
    }

    setSortState((current) => {
      if (!current || current.key !== attribute) {
        return { key: attribute, direction: "asc" };
      }

      if (current.direction === "asc") {
        return { key: attribute, direction: "desc" };
      }

      return null;
    });
  }

  function onDragEnd(event: DragEndEvent) {
    if (sortState) {
      return;
    }

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
            Drag to reorder rows. Numeric columns support sort.
            {sortState ? " Sorting is active, so drag reorder is temporarily disabled." : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {sortState ? `Sorted by ${attributeSchema[sortState.key].displayName}` : "Manual row order"}
          </span>
          <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm">
            <span className="font-medium text-slate-600">AI insights</span>
            <input
              type="checkbox"
              checked={aiInsightsEnabled}
              onChange={(event) => onAiInsightsEnabledChange(event.target.checked)}
              className="h-4 w-4 accent-zillowBlue"
            />
          </label>
        </div>
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
                Home comparison table with sortable numeric columns and draggable rows.
              </caption>
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    House
                  </th>

                  {selectedAttributes.map((attribute) => {
                    const meta = attributeSchema[attribute];
                    const sortable = meta.sortable;
                    return (
                      <th
                        key={`head-${attribute}`}
                        aria-sort={getAriaSort(sortState, attribute, sortable)}
                        className="sticky top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        <button
                          type="button"
                          disabled={!sortable}
                          onClick={() => toggleSort(attribute)}
                          className={`inline-flex items-center gap-1 ${
                            sortable ? "text-slate-700 hover:text-zillowBlue" : "cursor-not-allowed text-slate-400"
                          }`}
                        >
                          {meta.displayName}
                          <span className="text-[10px]">{sortIcon(sortState, attribute, sortable)}</span>
                          <span className="sr-only">
                            {sortable ? "Toggle sort" : "Not sortable"}
                          </span>
                        </button>
                      </th>
                    );
                  })}

                  {aiInsightsEnabled ? (
                    <>
                      <th className="sticky top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        AI Rank
                      </th>
                      <th className="sticky top-0 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        AI Tradeoff Explanation
                      </th>
                    </>
                  ) : null}
                </tr>
              </thead>

              <tbody>
                {sortState ? (
                  displayHouses.map((house, index) => {
                    const breakdown = scoreMap[house.id];
                    return (
                      <StaticRow
                        key={house.id}
                        house={house}
                        selectedAttributes={selectedAttributes}
                        canShowAI={canShowAI}
                        aiInsightsEnabled={aiInsightsEnabled}
                        rowIndex={index}
                        rank={breakdown?.rank}
                        explanation={explanations[house.id]}
                      />
                    );
                  })
                ) : (
                  <SortableContext
                    items={displayHouses.map((house) => house.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {displayHouses.map((house, index) => {
                      const breakdown = scoreMap[house.id];
                      return (
                        <SortableRow
                          key={house.id}
                          house={house}
                          selectedAttributes={selectedAttributes}
                          canShowAI={canShowAI}
                          aiInsightsEnabled={aiInsightsEnabled}
                          rowIndex={index}
                          rank={breakdown?.rank}
                          explanation={explanations[house.id]}
                        />
                      );
                    })}
                  </SortableContext>
                )}
              </tbody>
            </table>
          </div>
        </DndContext>
      )}
    </section>
  );
}
