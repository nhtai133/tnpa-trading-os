import { getDefaultSetupTag } from "@/app/_lib/setup-tag-storage";
import type { SetupTag, Trade, TradeJournal } from "@/app/_lib/trading-types";

export type ManualTradeInput = TradeJournal & {
  status: "Open" | "Closed";
  symbol: string;
  side: "Long" | "Short";
  openTime: string;
  closeTime: string;
  volume: string;
  openPrice: string;
  closePrice: string;
  profit: string;
  floatingPnl: string;
  setupTag: SetupTag;
};

export const manualTradesStorageKey = "tnpa.manual-trades.v1";
export const manualTradesUpdatedEvent = "tnpa:manual-trades-updated";

let lastRaw: string | null = null;
let lastParsed: Trade[] = [];

function cleanText(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function sanitizeTrade(value: unknown): Trade | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const trade = value as Partial<Trade>;

  if (!trade.id || !trade.symbol || !trade.side) {
    return null;
  }
  const status = trade.status ?? "Closed";
  const pnl = typeof trade.pnl === "number" ? trade.pnl : 0;

  return {
    id: trade.id,
    symbol: trade.symbol,
    setup: trade.setup ?? "Manual trade",
    setupTag: trade.setupTag ?? getDefaultSetupTag(trade.setup ?? "Manual trade"),
    status,
    side: trade.side,
    date: trade.date ?? "",
    session: trade.session ?? "New York",
    entry: typeof trade.entry === "number" ? trade.entry : 0,
    exit: typeof trade.exit === "number" ? trade.exit : 0,
    rr: typeof trade.rr === "number" ? trade.rr : pnl >= 0 ? 1 : -1,
    pnl,
    floatingPnl:
      typeof trade.floatingPnl === "number" ? trade.floatingPnl : undefined,
    result: pnl >= 0 ? "Win" : "Loss",
    entryReason: cleanText(trade.entryReason),
    exitReason: cleanText(trade.exitReason),
    emotion: trade.emotion,
    mistake: trade.mistake,
    lessonLearned: cleanText(trade.lessonLearned),
  };
}

function sanitizeTrades(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((trade) => sanitizeTrade(trade))
    .filter((trade): trade is Trade => Boolean(trade));
}

export function readManualTrades() {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(manualTradesStorageKey);

  if (raw === lastRaw) {
    return lastParsed;
  }

  if (!raw) {
    lastRaw = raw;
    lastParsed = [];
    return lastParsed;
  }

  try {
    lastRaw = raw;
    lastParsed = sanitizeTrades(JSON.parse(raw));
    return lastParsed;
  } catch {
    window.localStorage.removeItem(manualTradesStorageKey);
    lastRaw = null;
    lastParsed = [];
    return lastParsed;
  }
}

export function writeManualTrade(input: ManualTradeInput) {
  const status = input.status;
  const pnl = status === "Closed" ? Number(input.profit) : 0;
  const floatingPnl = input.floatingPnl.trim()
    ? Number(input.floatingPnl)
    : undefined;
  const entry = Number(input.openPrice);
  const exit = Number(input.closePrice);
  const trade: Trade = {
    id: `MANUAL-${Date.now()}`,
    symbol: input.symbol.trim().toUpperCase(),
    setup: "Manual trade",
    setupTag: input.setupTag,
    status,
    side: input.side,
    date: input.closeTime || input.openTime,
    session: "New York",
    entry: Number.isFinite(entry) ? entry : 0,
    exit: Number.isFinite(exit) ? exit : 0,
    rr: pnl >= 0 ? 1 : -1,
    pnl,
    floatingPnl:
      floatingPnl !== undefined && Number.isFinite(floatingPnl)
        ? floatingPnl
        : undefined,
    result: pnl >= 0 ? "Win" : "Loss",
    entryReason: input.entryReason,
    exitReason: input.exitReason,
    emotion: input.emotion,
    mistake: input.mistake,
    lessonLearned: input.lessonLearned,
  };
  const next = [trade, ...readManualTrades()];
  const raw = JSON.stringify(next);
  lastRaw = raw;
  lastParsed = next;
  window.localStorage.setItem(manualTradesStorageKey, raw);
  window.dispatchEvent(
    new CustomEvent(manualTradesUpdatedEvent, { detail: next }),
  );
}

export function subscribeToManualTrades(onStoreChange: () => void) {
  window.addEventListener(manualTradesUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(manualTradesUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
