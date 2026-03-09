import OpenAI from "openai";

export interface TradeoffExplanationPayload {
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

export interface LlmTradeoffExplanation {
  one_liner: string;
  why_it_fits_you: string[];
  tradeoffs: string[];
  note: string[];
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeResponse(raw: unknown): LlmTradeoffExplanation {
  const candidate = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const oneLiner = typeof candidate.one_liner === "string" ? candidate.one_liner.trim() : "";

  return {
    one_liner: oneLiner || "This listing balances your priorities with a few tradeoffs.",
    why_it_fits_you: normalizeStringArray(candidate.why_it_fits_you),
    tradeoffs: normalizeStringArray(candidate.tradeoffs),
    note: normalizeStringArray(candidate.note),
  };
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    const withoutFence = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    return JSON.parse(withoutFence);
  }

  return JSON.parse(trimmed);
}

export async function generateTradeoffExplanation(
  payload: TradeoffExplanationPayload,
): Promise<LlmTradeoffExplanation> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "rental_tradeoff_explanation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            one_liner: { type: "string" },
            why_it_fits_you: {
              type: "array",
              items: { type: "string" },
              maxItems: 3,
            },
            tradeoffs: {
              type: "array",
              items: { type: "string" },
              maxItems: 3,
            },
            note: {
              type: "array",
              items: { type: "string" },
              maxItems: 3,
            },
          },
          required: ["one_liner", "why_it_fits_you", "tradeoffs", "note"],
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You generate concise tradeoff explanations for rental listings. Use only supplied listing attributes, preference weights, and contribution data. Do not invent attributes or facts. Return strict JSON matching the schema.",
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  return normalizeResponse(parseJsonContent(content));
}
