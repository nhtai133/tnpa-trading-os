import {
  emotionOptions,
  mistakeOptions,
  type TradeEmotion,
  type TradeJournal,
  type TradeMistake,
} from "@/app/_lib/trading-types";

export type TradeJournalOverrides = Record<string, TradeJournal>;

export const tradeJournalStorageKey = "tnpa.trade-journal.v1";
export const tradeJournalUpdatedEvent = "tnpa:trade-journal-updated";

let lastRaw: string | null = null;
let lastParsed: TradeJournalOverrides = {};

function isEmotion(value: unknown): value is TradeEmotion {
  return (
    typeof value === "string" &&
    emotionOptions.includes(value as TradeEmotion)
  );
}

function isMistake(value: unknown): value is TradeMistake {
  return (
    typeof value === "string" &&
    mistakeOptions.includes(value as TradeMistake)
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function sanitizeJournal(value: unknown): TradeJournal {
  if (!value || typeof value !== "object") {
    return {};
  }

  const journal = value as TradeJournal;

  return {
    entryScreenshot: cleanText(journal.entryScreenshot),
    exitScreenshot: cleanText(journal.exitScreenshot),
    entryReason: cleanText(journal.entryReason),
    exitReason: cleanText(journal.exitReason),
    emotion: isEmotion(journal.emotion) ? journal.emotion : undefined,
    mistake: isMistake(journal.mistake) ? journal.mistake : undefined,
    lessonLearned: cleanText(journal.lessonLearned),
  };
}

function sanitizeOverrides(value: unknown): TradeJournalOverrides {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([tradeId, journal]) => [
      tradeId,
      sanitizeJournal(journal),
    ]),
  );
}

export function readTradeJournalOverrides() {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(tradeJournalStorageKey);

  if (raw === lastRaw) {
    return lastParsed;
  }

  if (!raw) {
    lastRaw = raw;
    lastParsed = {};
    return lastParsed;
  }

  try {
    lastRaw = raw;
    lastParsed = sanitizeOverrides(JSON.parse(raw));
    return lastParsed;
  } catch {
    window.localStorage.removeItem(tradeJournalStorageKey);
    lastRaw = null;
    lastParsed = {};
    return lastParsed;
  }
}

export function writeTradeJournalOverride(
  tradeId: string,
  journal: TradeJournal,
) {
  const next = {
    ...readTradeJournalOverrides(),
    [tradeId]: sanitizeJournal(journal),
  };
  const raw = JSON.stringify(next);
  lastRaw = raw;
  lastParsed = next;
  window.localStorage.setItem(tradeJournalStorageKey, raw);
  window.dispatchEvent(
    new CustomEvent(tradeJournalUpdatedEvent, { detail: next }),
  );
}

export function subscribeToTradeJournalOverrides(onStoreChange: () => void) {
  window.addEventListener(tradeJournalUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(tradeJournalUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
