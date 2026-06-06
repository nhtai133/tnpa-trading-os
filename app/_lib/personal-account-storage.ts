import type { StrategyType } from "@/app/_lib/trading-types";
import type {
  LifecycleAccountStatus,
  LifecycleAccountType,
} from "@/app/_lib/prop-account-storage";

export type PersonalTradingAccountStatus = LifecycleAccountStatus;

export type PersonalTradingAccount = {
  id: string;
  lifecycleType: Extract<LifecycleAccountType, "Personal">;
  accountName: string;
  brokerName: string;
  strategyType: StrategyType;
  initialBalance: number;
  challengeStartDate: string;
  challengeEndDate: string;
  targetProfit: number;
  status: PersonalTradingAccountStatus;
  archivedAt?: string;
  notes?: string;
};

const storageKey = "tnpa.personal-trading-accounts.v1";
const storageEvent = "tnpa:personal-trading-accounts-updated";

export const emptyPersonalTradingAccounts: PersonalTradingAccount[] = [];

let lastRaw: string | null = null;
let lastParsed: PersonalTradingAccount[] = emptyPersonalTradingAccounts;

function sanitizeAccount(value: unknown): PersonalTradingAccount | null {
  if (!value || typeof value !== "object") return null;

  const account = value as Partial<PersonalTradingAccount>;
  if (!account.id || !account.accountName || !account.brokerName || !account.strategyType) {
    return null;
  }

  const initialBalance =
    typeof account.initialBalance === "number" && Number.isFinite(account.initialBalance)
      ? account.initialBalance
      : 0;

  return {
    id: account.id,
    lifecycleType: "Personal",
    accountName: account.accountName,
    brokerName: account.brokerName,
    strategyType: account.strategyType,
    initialBalance,
    challengeStartDate: typeof account.challengeStartDate === "string" ? account.challengeStartDate : "",
    challengeEndDate: typeof account.challengeEndDate === "string" ? account.challengeEndDate : "",
    targetProfit:
      typeof account.targetProfit === "number" && Number.isFinite(account.targetProfit)
        ? account.targetProfit
        : 0,
    status:
      account.status === "Passed" ||
      account.status === "Failed" ||
      account.status === "Breached" ||
      account.status === "Archived"
        ? account.status
        : "Active",
    archivedAt: typeof account.archivedAt === "string" ? account.archivedAt : undefined,
    notes: typeof account.notes === "string" ? account.notes : undefined,
  };
}

function sanitizeAccounts(value: unknown) {
  if (!Array.isArray(value)) return emptyPersonalTradingAccounts;
  return value
    .map((account) => sanitizeAccount(account))
    .filter((account): account is PersonalTradingAccount => Boolean(account));
}

export function readStoredPersonalTradingAccounts() {
  if (typeof window === "undefined") return emptyPersonalTradingAccounts;

  const raw = window.localStorage.getItem(storageKey);
  if (raw === lastRaw) return lastParsed;

  lastRaw = raw;
  if (!raw) {
    lastParsed = emptyPersonalTradingAccounts;
    return lastParsed;
  }

  try {
    lastParsed = sanitizeAccounts(JSON.parse(raw));
  } catch {
    lastParsed = emptyPersonalTradingAccounts;
  }

  return lastParsed;
}

export function writePersonalTradingAccounts(accounts: PersonalTradingAccount[]) {
  const raw = JSON.stringify(accounts);
  lastRaw = raw;
  lastParsed = accounts;
  window.localStorage.setItem(storageKey, raw);
  window.dispatchEvent(new Event(storageEvent));
}

export function subscribeToPersonalTradingAccounts(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const listener = () => callback();
  window.addEventListener("storage", listener);
  window.addEventListener(storageEvent, listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(storageEvent, listener);
  };
}
