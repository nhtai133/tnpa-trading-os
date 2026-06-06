import type { AccountType } from "@/app/_lib/trading-types";

export type TradeAccountSource = "prop" | "personal";

export type TradeAccountLink = {
  accountSource: TradeAccountSource;
  accountId: string;
  accountName: string;
  accountType: AccountType;
};

export type TradeAccountLinks = Record<string, TradeAccountLink>;

export const tradeAccountLinksStorageKey = "tnpa.trade-account-links.v1";
export const tradeAccountLinksUpdatedEvent = "tnpa:trade-account-links-updated";

let lastRaw: string | null = null;
let lastParsed: TradeAccountLinks = {};

function sanitizeLink(value: unknown): TradeAccountLink | null {
  if (!value || typeof value !== "object") return null;

  const link = value as Partial<TradeAccountLink>;
  if (
    (link.accountSource !== "prop" && link.accountSource !== "personal") ||
    !link.accountId ||
    !link.accountName ||
    (link.accountType !== "prop-firm" && link.accountType !== "broker")
  ) {
    return null;
  }

  if (
    (link.accountSource === "prop" && link.accountType !== "prop-firm") ||
    (link.accountSource === "personal" && link.accountType !== "broker")
  ) {
    return null;
  }

  return {
    accountSource: link.accountSource,
    accountId: link.accountId.trim(),
    accountName: link.accountName.trim(),
    accountType: link.accountType,
  };
}

function sanitizeLinks(value: unknown): TradeAccountLinks {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([tradeId]) => tradeId.trim().length > 0)
      .map(([tradeId, link]) => [tradeId, sanitizeLink(link)] as const)
      .filter((entry): entry is readonly [string, TradeAccountLink] => Boolean(entry[1])),
  );
}

export function readTradeAccountLinks() {
  if (typeof window === "undefined") return {};

  const raw = window.localStorage.getItem(tradeAccountLinksStorageKey);
  if (raw === lastRaw) return lastParsed;

  lastRaw = raw;
  if (!raw) {
    lastParsed = {};
    return lastParsed;
  }

  try {
    lastParsed = sanitizeLinks(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(tradeAccountLinksStorageKey);
    lastRaw = null;
    lastParsed = {};
  }

  return lastParsed;
}

export function writeTradeAccountLink(tradeId: string, link: TradeAccountLink | null) {
  const normalizedTradeId = tradeId.trim();
  if (!normalizedTradeId) return;

  const current = readTradeAccountLinks();
  const next = { ...current };
  const sanitizedLink = sanitizeLink(link);

  if (sanitizedLink) {
    next[normalizedTradeId] = sanitizedLink;
  } else {
    delete next[normalizedTradeId];
  }

  const raw = JSON.stringify(next);
  lastRaw = raw;
  lastParsed = next;
  window.localStorage.setItem(tradeAccountLinksStorageKey, raw);
  window.dispatchEvent(new CustomEvent(tradeAccountLinksUpdatedEvent, { detail: next }));
}

export function subscribeToTradeAccountLinks(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener(tradeAccountLinksUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(tradeAccountLinksUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
