import type { WealthBrokerAccount } from "@/app/_lib/wealth-types";
import {
  archiveReasons,
  brokerInstitutions,
  type ArchiveReason,
  type BrokerInstitution,
  type Currency,
  type PortfolioType,
  type WealthStatus,
} from "@/app/_lib/wealth-types";

export type BrokerAccountInput = {
  broker: BrokerInstitution;
  accountName: string;
  currency: Currency;
  cashBalance: string;
  stockMarketValue: string;
  fundEtfValue: string;
  portfolioType: PortfolioType;
};

export const brokerAccountsStorageKey = "tnpa.broker-accounts.v1";
export const brokerAccountsUpdatedEvent = "tnpa:broker-accounts-updated";
export const emptyBrokerAccounts: WealthBrokerAccount[] = [];

let lastRaw: string | null = null;
let lastParsed: WealthBrokerAccount[] = emptyBrokerAccounts;

export function isSupportedBroker(value: string): value is BrokerInstitution {
  return brokerInstitutions.includes(value as BrokerInstitution);
}

export function isBrokerArchiveReason(value: string): value is ArchiveReason {
  return archiveReasons.includes(value as ArchiveReason);
}

function sanitizeAccount(value: unknown): WealthBrokerAccount | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const account = value as Partial<WealthBrokerAccount> & {
    accountName?: string;
  };

  const cashBalance =
    typeof account.cashBalance === "number" && Number.isFinite(account.cashBalance)
      ? account.cashBalance
      : Number.NaN;
  const stockMarketValue =
    typeof account.stockMarketValue === "number" &&
    Number.isFinite(account.stockMarketValue)
      ? account.stockMarketValue
      : Number.NaN;
  const fundEtfValue =
    typeof account.fundEtfValue === "number" && Number.isFinite(account.fundEtfValue)
      ? account.fundEtfValue
      : Number.NaN;

  if (!account.id || !account.name || !account.broker || !account.currency) {
    return null;
  }

  const status: WealthStatus =
    account.status === "Archived" ? "Archived" : "Active";
  const totalEquity =
    typeof account.totalEquity === "number" && Number.isFinite(account.totalEquity)
      ? account.totalEquity
      : cashBalance + stockMarketValue + fundEtfValue;

  if (
    !Number.isFinite(cashBalance) ||
    !Number.isFinite(stockMarketValue) ||
    !Number.isFinite(fundEtfValue) ||
    !Number.isFinite(totalEquity)
  ) {
    return null;
  }

  return {
    id: account.id,
    name: account.name,
    broker: account.broker,
    currency: account.currency,
    cashBalance,
    stockMarketValue,
    fundEtfValue,
    totalEquity,
    portfolioType: account.portfolioType ?? "Other",
    status,
    archiveReason:
      status === "Archived" &&
      typeof account.archiveReason === "string" &&
      isBrokerArchiveReason(account.archiveReason)
        ? account.archiveReason
        : undefined,
    archivedAt:
      status === "Archived" && typeof account.archivedAt === "string"
        ? account.archivedAt
        : undefined,
    notes: typeof account.notes === "string" ? account.notes : undefined,
  };
}

function sanitizeAccounts(value: unknown) {
  if (!Array.isArray(value)) {
    return emptyBrokerAccounts;
  }

  return value
    .map((account) => sanitizeAccount(account))
    .filter((account): account is WealthBrokerAccount => Boolean(account));
}

export function readStoredBrokerAccounts() {
  if (typeof window === "undefined") {
    return emptyBrokerAccounts;
  }

  const raw = window.localStorage.getItem(brokerAccountsStorageKey);

  if (raw === lastRaw) {
    return lastParsed;
  }

  if (!raw) {
    lastRaw = raw;
    lastParsed = emptyBrokerAccounts;
    return lastParsed;
  }

  try {
    lastRaw = raw;
    lastParsed = sanitizeAccounts(JSON.parse(raw));
    return lastParsed;
  } catch {
    window.localStorage.removeItem(brokerAccountsStorageKey);
    lastRaw = null;
    lastParsed = emptyBrokerAccounts;
    return lastParsed;
  }
}

export function writeBrokerAccounts(accounts: WealthBrokerAccount[]) {
  const raw = JSON.stringify(accounts);
  lastRaw = raw;
  lastParsed = accounts;
  window.localStorage.setItem(brokerAccountsStorageKey, raw);
  window.dispatchEvent(
    new CustomEvent(brokerAccountsUpdatedEvent, { detail: accounts }),
  );
}

export function subscribeToBrokerAccounts(onStoreChange: () => void) {
  window.addEventListener(brokerAccountsUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(brokerAccountsUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
