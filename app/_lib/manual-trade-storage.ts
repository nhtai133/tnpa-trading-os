import { getDefaultPlaybook } from "@/app/_lib/playbook-storage";
import { getDefaultSetupTag } from "@/app/_lib/setup-tag-storage";
import type {
  AccountType,
  ChallengeType,
  Playbook,
  PropAccountStatus,
  PropFirmName,
  PropPhase,
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
  firmName: PropFirmName;
  accountSize: string;
  challengeType: ChallengeType;
  phase: PropPhase;
  profitTargetPercent: string;
  dailyLossLimitPercent: string;
  maxLossLimitPercent: string;
  minimumTradingDays: string;
  startDate: string;
  propStatus: PropAccountStatus;
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
let manualTradeIdCounter = 0;

function cleanText(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeAccountType(value: unknown): AccountType {
  if (value === "prop-firm" || value === "Prop Firm") {
    return "prop-firm";
  }

  return "broker";
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
  const accountType = normalizeAccountType(trade.accountType);

  return {
    id: trade.id,
    source: "manual",
    accountType,
    accountName: trade.accountName ?? (accountType === "prop-firm" ? "FTMO" : "ICMarkets"),
    strategyType: trade.strategyType ?? "Swing",
    firmName: accountType === "prop-firm" ? trade.firmName ?? "FTMO" : undefined,
    accountSize: accountType === "prop-firm" ? trade.accountSize ?? 100000 : undefined,
    challengeType: accountType === "prop-firm" ? trade.challengeType ?? "FTMO Challenge V2" : undefined,
    phase: accountType === "prop-firm" ? trade.phase ?? "Phase 1" : undefined,
    profitTargetPercent: accountType === "prop-firm" ? trade.profitTargetPercent ?? 10 : undefined,
    dailyLossLimitPercent: accountType === "prop-firm" ? trade.dailyLossLimitPercent ?? 5 : undefined,
    maxLossLimitPercent: accountType === "prop-firm" ? trade.maxLossLimitPercent ?? 10 : undefined,
    minimumTradingDays: accountType === "prop-firm" ? trade.minimumTradingDays ?? 4 : undefined,
    startDate: accountType === "prop-firm" ? cleanText(trade.startDate) : undefined,
    propStatus: accountType === "prop-firm" ? trade.propStatus ?? "Active" : undefined,
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

function normalizeDuplicateTradeId(tradeId: string, seenIds: Set<string>) {
  if (!seenIds.has(tradeId)) {
    seenIds.add(tradeId);
    return tradeId;
  }

  let nextId = `${tradeId}-DUPLICATE`;
  let index = 2;
  while (seenIds.has(nextId)) {
    nextId = `${tradeId}-DUPLICATE-${index}`;
    index += 1;
  }
  seenIds.add(nextId);
  return nextId;
}

function sanitizeTrades(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Set<string>();

  return value
    .map((trade) => sanitizeTrade(trade))
    .filter((trade): trade is Trade => Boolean(trade))
    .map((trade) => ({
      ...trade,
      id: normalizeDuplicateTradeId(trade.id, seenIds),
    }));
}

function toTrade(
  input: ManualTradeInput,
  tradeId: string,
  options: { includeAccountMetadata?: boolean } = {},
): Trade {
  const status = input.status;
  const pnl = status === "Closed" ? Number(input.profit) : Number(input.profit || 0);
  const floatingPnl = input.floatingPnl.trim() ? Number(input.floatingPnl) : undefined;
  const entry = Number(input.openPrice);
  const exit = Number(input.closePrice);
  const isPropFirm = input.accountType === "prop-firm";
  const includeAccountMetadata = options.includeAccountMetadata ?? true;

  return {
    id: tradeId,
    source: "manual",
    accountType: input.accountType,
    accountName: input.accountName,
    strategyType: input.strategyType,
    firmName: includeAccountMetadata && isPropFirm ? input.firmName : undefined,
    accountSize:
      includeAccountMetadata && isPropFirm && Number.isFinite(Number(input.accountSize))
        ? Number(input.accountSize)
        : undefined,
    challengeType: includeAccountMetadata && isPropFirm ? input.challengeType : undefined,
    phase: includeAccountMetadata && isPropFirm ? input.phase : undefined,
    profitTargetPercent:
      includeAccountMetadata && isPropFirm && Number.isFinite(Number(input.profitTargetPercent))
        ? Number(input.profitTargetPercent)
        : undefined,
    dailyLossLimitPercent:
      includeAccountMetadata && isPropFirm && Number.isFinite(Number(input.dailyLossLimitPercent))
        ? Number(input.dailyLossLimitPercent)
        : undefined,
    maxLossLimitPercent:
      includeAccountMetadata && isPropFirm && Number.isFinite(Number(input.maxLossLimitPercent))
        ? Number(input.maxLossLimitPercent)
        : undefined,
    minimumTradingDays:
      includeAccountMetadata && isPropFirm && Number.isFinite(Number(input.minimumTradingDays))
        ? Number(input.minimumTradingDays)
        : undefined,
    startDate: includeAccountMetadata && isPropFirm ? input.startDate || undefined : undefined,
    propStatus: includeAccountMetadata && isPropFirm ? input.propStatus : undefined,
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

export function writeManualTrade(
  input: ManualTradeInput,
  options: { includeAccountMetadata?: boolean } = {},
) {
  const currentTrades = readManualTrades();
  const existingIds = new Set(currentTrades.map((trade) => trade.id));
  let tradeId = "";

  do {
    manualTradeIdCounter += 1;
    const entropy =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().slice(0, 8)
        : `${manualTradeIdCounter}`;
    tradeId = `MANUAL-${Date.now()}-${manualTradeIdCounter}-${entropy}`;
  } while (existingIds.has(tradeId));

  const nextTrade = toTrade(input, tradeId, options);
  const next = [nextTrade, ...currentTrades];
  const raw = JSON.stringify(next);
  lastRaw = raw;
  lastParsed = next;
  window.localStorage.setItem(manualTradesStorageKey, raw);
  window.dispatchEvent(new CustomEvent(manualTradesUpdatedEvent, { detail: next }));
  return nextTrade.id;
}

export function updateManualTrade(
  tradeId: string,
  input: ManualTradeInput,
  options: { includeAccountMetadata?: boolean } = {},
) {
  const next = readManualTrades().map((trade) =>
    trade.id === tradeId ? toTrade(input, tradeId, options) : trade,
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
