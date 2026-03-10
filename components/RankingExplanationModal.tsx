"use client";

import { House, PreferenceScoreBreakdown, WeightedScoringDimension } from "@/lib/types";

interface RankingExplanationModalProps {
  house: House;
  rank: number;
  scoringDimensions: WeightedScoringDimension[];
  breakdown: PreferenceScoreBreakdown;
  onClose: () => void;
}

function toFixed(value: number): string {
  return value.toFixed(2);
}

export function RankingExplanationModal({
  house,
  rank,
  scoringDimensions,
  breakdown,
  onClose,
}: RankingExplanationModalProps) {
  const contributions = scoringDimensions.map((dimension) => {
    const weight = dimension.weightPercent;
    const normalizedValue = breakdown.normalized[dimension.id] ?? 0;
    const contribution = breakdown.contributions[dimension.id] ?? weight * normalizedValue;

    return {
      id: dimension.id,
      label: dimension.label,
      weight,
      normalizedValue,
      contribution,
    };
  });

  const totalScore = contributions.reduce((sum, item) => sum + item.contribution, 0);
  const topAttributes = [...contributions]
    .sort((left, right) => right.contribution - left.contribution)
    .slice(0, 2)
    .map((item) => item.label.toLowerCase());

  const shortExplanation =
    topAttributes.length > 0
      ? `This property ranks #${rank} because it performs strongly on your highest weighted attributes: ${topAttributes.join(" and ")}.`
      : `This property ranks #${rank} based on your current weighted score settings.`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/35 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 md:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zillowSlate">Why this property ranks #{rank}</h3>
            <p className="text-sm text-slate-500">{house.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Score = Σ (weight × normalized attribute value)</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Attribute</th>
                <th className="px-3 py-2">Weight</th>
                <th className="px-3 py-2">Normalized Value</th>
                <th className="px-3 py-2">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((item) => (
                <tr key={`${house.id}-${item.id}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-800">{item.label}</td>
                  <td className="px-3 py-2 text-slate-700">{toFixed(item.weight)}%</td>
                  <td className="px-3 py-2 text-slate-700">{toFixed(item.normalizedValue)}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{toFixed(item.contribution)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-slate-900">Final Score = {toFixed(totalScore)}</p>
          <p className="text-sm text-slate-700">{shortExplanation}</p>
        </div>
      </div>
    </div>
  );
}
