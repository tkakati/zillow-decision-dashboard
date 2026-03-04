import { addDays, differenceInCalendarDays, format, isValid } from "date-fns";

export interface ParsedDateRange {
  start: string;
  end: string;
}

export function generateInvalidDateMessage(): string {
  return "I couldn't find a valid range. Try formats like 'Sep 1 to Sep 10 2026' or '09/01/2026 - 09/10/2026'.";
}

function parseNumericDate(token: string, fallbackYear?: number): Date | null {
  const match = token.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const yearRaw = match[3];
  let year = fallbackYear;

  if (yearRaw) {
    const parsedYear = Number(yearRaw);
    year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
  }

  if (!year) {
    year = new Date().getFullYear();
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function extractYear(token: string): number | undefined {
  const match = token.match(/(\d{4})/);
  if (!match) {
    return undefined;
  }

  return Number(match[1]);
}

function parseMonthNameDate(token: string, fallbackYear?: number): Date | null {
  const hasYear = /\d{4}/.test(token);
  const withYear = hasYear || !fallbackYear ? token : `${token} ${fallbackYear}`;
  const parsed = new Date(withYear);
  if (!isValid(parsed)) {
    return null;
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseDateToken(token: string, fallbackYear?: number): Date | null {
  const trimmed = token.trim().replace(/,/g, "");
  return parseNumericDate(trimmed, fallbackYear) ?? parseMonthNameDate(trimmed, fallbackYear);
}

export function isDateRangeWithinLimit(
  startISO: string,
  endISO: string,
  maxDays = 60,
): boolean {
  const start = new Date(startISO);
  const end = new Date(endISO);

  if (!isValid(start) || !isValid(end) || end < start) {
    return false;
  }

  return differenceInCalendarDays(end, start) <= maxDays;
}

// v2-ready stub: deterministic text parser that can later be replaced by an LLM/audio pipeline.
export function parseDateRangeFromSpeech(text: string): ParsedDateRange | null {
  const cleaned = text.trim();
  if (!cleaned) {
    return null;
  }

  const parts = cleaned
    .split(/\s+(?:to|through)\s+|\s+-\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  const yearA = extractYear(parts[0]);
  const yearB = extractYear(parts[1]);

  const start = parseDateToken(parts[0], yearB);
  const end = parseDateToken(parts[1], yearA);

  if (!start || !end) {
    return null;
  }

  const orderedStart = start <= end ? start : end;
  const orderedEnd = start <= end ? end : start;

  if (differenceInCalendarDays(orderedEnd, orderedStart) > 60) {
    return null;
  }

  return {
    start: format(orderedStart, "yyyy-MM-dd"),
    end: format(orderedEnd, "yyyy-MM-dd"),
  };
}

export function defaultMoveInRange(): ParsedDateRange {
  return {
    start: "2026-09-01",
    end: "2026-09-10",
  };
}

export function clampEndDate(startISO: string, endISO: string, maxDays = 60): string {
  const start = new Date(startISO);
  const end = new Date(endISO);

  if (!isValid(start)) {
    return endISO;
  }

  if (!isValid(end) || end < start) {
    return startISO;
  }

  if (differenceInCalendarDays(end, start) <= maxDays) {
    return endISO;
  }

  return format(addDays(start, maxDays), "yyyy-MM-dd");
}
