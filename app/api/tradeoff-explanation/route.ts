import { NextResponse } from "next/server";

import {
  generateTradeoffExplanation,
  TradeoffExplanationPayload,
} from "@/lib/generateTradeoffExplanation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as TradeoffExplanationPayload;
    const explanation = await generateTradeoffExplanation(payload);
    return NextResponse.json(explanation);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate tradeoff explanation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
