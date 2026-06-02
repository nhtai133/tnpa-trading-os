import { getDefaultPlaybook } from "@/app/_lib/playbook-storage";
import { getDefaultSetupTag } from "@/app/_lib/setup-tag-storage";
import type {
  AccountType,
  Playbook,
  SetupTag,
  StrategyType,
  Trade,
  TradeJournal,
} from "@/app/_lib/trading-types";

export type ManualTradeInput = TradeJournal & {
  status: "Open" | "Closed";
  accountType: AccountType;
  accountName: string;
  strategyType: StrategyType;
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
  playbook: Playbook;
};

export const manualTradesStorageKey = "tnpa.manual-trades.v1";
export const manualTradesUpdatedEvent = "tnpa:manual-trades-updated";

let lastRaw: string | null = null;
let lastParsed: Trade[] = [];

function cleanText(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
  const pnl = cleanNumber(trade.pnl) ?? 0;

  return {
    id: trade.id,
    source: "manual",
    accountType: trade.accountType ?? "Broker",
    accountName: trade.accountName ?? "ICMarkets Swing",
    strategyType: trade.strategyType ?? "Swing",
    symbol: trade.symbol,
    setup: trade.setup ?? "Manual trade",
    setupTag: trade.setupTag ?? getDefaultSetupTag(trade.setup ?? "Manual trade"),
    playbook:
      trade.playbook ??
      getDefaultPlaybook(
        trade.setup ?? "Manual trade",
        trade.setupTag ?? getDefaultSetupTag(trade.setup ?? "Manual trade"),
      ),
    status,
    side: trade.side,
    date: trade.date ?? trade.closeTime ?? trade.openTime ?? "",
    session: trade.session ?? "New York",
    openTime: cleanText(trade.openTime),
    closeTime: cleanText(trade.closeTime),
    volume: cleanText(trade.volume),
    openPrice: cleanNumber(trade.openPrice) ?? cleanNumber(trade.entry),
    closePrice: cleanNumber(trade.closePrice) ?? cleanNumber(trade.exit),
    entry: cleanNumber(trade.entry) ?? cleanNumber(trade.openPrice) ?? 0,
    exit: cleanNumber(trade.exit) ?? cleanNumber(trade.closePrice) ?? 0,
    rr: cleanNumber(trade.rr) ?? (pnl >= 0 ? 1 : -1),
    pnl,
    floatingPnl: cleanNumber(trade.floatingPnl),
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

function toTrade(input: ManualTradeInput, tradeId: string): Trade {
  const status = input.status;
  const pnl = status === "Closed" ? Number(input.profit) : Number(input.profit || 0);
  const floatingPnl = input.floatingPnl.trim() ? Number(input.floatingPnl) : undefined;
  const entry = Number(input.openPrice);
  const exit = Number(input.closePrice);

  return {
    id: tradeId,
    source: "manual",
    accountType: input.accountType,
    accountName: input.accountName,
    strategyType: input.strategyType,
    symbol: input.symbol.trim().toUpperCase(),
    setup: "Manual trade",
    setupTag: input.setupTag,
    playbook: input.playbook,
    status,
    side: input.side,
    date: input.closeTime || input.openTime,
    session: "New York",
    openTime: input.openTime || undefined,
    closeTime: input.closeTime || undefined,
    volume: input.volume || undefined,
    openPrice: Number.isFinite(entry) ? entry : undefined,
    closePrice: Number.isFinite(exit) ? exit : undefined,
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
    entryScreenshot: input.entryScreenshot,
    exitScreenshot: input.exitScreenshot,
  };
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
  const trade = toTrade(input, `MANUAL-${Date.now()}`);
  const next = [trade, ...readManualTrades()];
  const raw = JSON.stringify(next);
  lastRaw = raw;
  lastParsed = next;
  window.localStorage.setItem(manualTradesStorageKey, raw);
  window.dispatchEvent(new CustomEvent(manualTradesUpdatedEvent, { detail: next }));
}

export function updateManualTrade(tradeId: string, input: ManualTradeInput) {
  const next = readManualTrades().map((trade) =>
    trade.id === tradeId ? toTrade(input, tradeId) : trade,
  );
  const raw = JSON.stringify(next);
  lastRaw = raw;
  lastParsed = next;
  window.localStorage.setItem(manualTradesStorageKey, raw);
  window.dispatchEvent(new CustomEvent(manualTradesUpdatedEvent, { detail: next }));
}

export function subscribeToManualTrades(onStoreChange: () => void) {
  window.addEventListener(manualTradesUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(manualTradesUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
