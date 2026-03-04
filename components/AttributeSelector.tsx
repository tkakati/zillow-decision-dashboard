"use client";

import { attributeOrder, attributeSchema } from "@/data/attributeSchema";
import { AttributeKey } from "@/lib/types";

interface AttributeSelectorProps {
  selectedAttributes: AttributeKey[];
  weights: Partial<Record<AttributeKey, number>>;
  onSelectedAttributesChange: (next: AttributeKey[]) => void;
  onWeightChange: (attribute: AttributeKey, weight: number) => void;
  onResetWeights: () => void;
}

export function AttributeSelector({
  selectedAttributes,
  weights,
  onSelectedAttributesChange,
  onWeightChange,
  onResetWeights,
}: AttributeSelectorProps) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zillowSlate">Attributes & Weights</h2>
          <p className="text-sm text-slate-500">Choose attributes to evaluate and tune their influence.</p>
        </div>
        <button
          type="button"
          onClick={onResetWeights}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Reset weights
        </button>
      </div>

      <details className="rounded-lg border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-zillowSlate">
          Attribute selection ({selectedAttributes.length} selected)
        </summary>
        <div className="border-t border-slate-200 px-3 py-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectedAttributesChange(attributeOrder)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => onSelectedAttributesChange([])}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
            >
              Clear all
            </button>
            <p className="text-xs text-slate-500">Select at least 3 attributes to unlock AI rank and explanation.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {attributeOrder.map((attribute) => {
            const checked = selectedAttributes.includes(attribute);
            return (
              <label
                key={attribute}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selectedAttributes, attribute]
                      : selectedAttributes.filter((item) => item !== attribute);
                    onSelectedAttributesChange(next);
                  }}
                  className="h-4 w-4 accent-zillowBlue"
                />
                <span>{attributeSchema[attribute].displayName}</span>
              </label>
            );
          })}
          </div>
        </div>
      </details>

      <div className="mt-4 space-y-3">
        {selectedAttributes.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Select attributes to enable scoring.
          </p>
        ) : null}

        {selectedAttributes.map((attribute) => {
          const currentWeight = weights[attribute] ?? 5;
          const sliderId = `weight-${attribute}`;
          return (
            <div key={attribute} className="rounded-lg border border-slate-200 px-3 py-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <label htmlFor={sliderId} className="font-medium text-slate-700">
                  {attributeSchema[attribute].displayName}
                </label>
                <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-zillowBlue">
                  Weight {currentWeight}
                </span>
              </div>
              <input
                id={sliderId}
                type="range"
                min={0}
                max={10}
                step={1}
                value={currentWeight}
                onChange={(event) => onWeightChange(attribute, Number(event.target.value))}
                className="w-full accent-zillowBlue"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>0</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
