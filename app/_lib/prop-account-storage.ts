import type {
  ChallengeType,
  PropAccountStatus,
  PropFirmName,
  PropPhase,
} from "@/app/_lib/trading-types";

export const lifecycleAccountTypes = [
  "Challenge v1",
  "Challenge v2",
  "Verification",
  "Funded",
  "Personal",
] as const;
export type LifecycleAccountType = (typeof lifecycleAccountTypes)[number];

export const lifecycleAccountStatuses = [
  "Active",
  "Passed",
  "Failed",
  "Breached",
  "Archived",
] as const;
export type LifecycleAccountStatus = (typeof lifecycleAccountStatuses)[number];

export type PropAccount = {
  id: string;
  firmName: PropFirmName;
  accountName: string;
  lifecycleType: Exclude<LifecycleAccountType, "Personal">;
  accountSize: number;
  challengeType: ChallengeType;
  phase: PropPhase;
  status: PropAccountStatus;
  lifecycleStatus: LifecycleAccountStatus;
  startDate: string;
  challengeStartDate: string;
  challengeEndDate: string;
  targetProfit: number;
  minimumTradingDays: number;
  profitTargetPercent: number;
  dailyLossLimitPercent: number;
  maxLossLimitPercent: number;
};

const storageKey = "tnpa.prop-accounts.v1";
const storageEvent = "tnpa:prop-accounts-updated";
const payoutStorageKey = "tnpa.ftmo-payouts.v1";
const payoutStorageEvent = "tnpa:ftmo-payouts-updated";
export const emptyPropAccounts: PropAccount[] = [];
export type FtmoPayout = {
  id: string;
  accountName: string;
  date: string;
  amount: number;
  note: string;
};
export const emptyFtmoPayouts: FtmoPayout[] = [];

let lastRaw: string | null = null;
let lastParsed: PropAccount[] = emptyPropAccounts;
let lastPayoutRaw: string | null = null;
let lastPayoutParsed: FtmoPayout[] = emptyFtmoPayouts;

export const demoPropAccountIds = [
  "DEMO-FTMO-V1-100K",
  "DEMO-FTMO-V1-200K",
  "DEMO-FTMO-V2-100K-A",
  "DEMO-FTMO-V2-100K-B",
  "DEMO-PROP-FTMO-LIVE-50K",
];

export const demoPropAccounts: PropAccount[] = [
  {
    id: demoPropAccountIds[0],
    firmName: "FTMO",
    accountName: "FTMO V1 100K",
    lifecycleType: "Challenge v1",
    accountSize: 100000,
    challengeType: "FTMO Challenge V1",
    phase: "Phase 1",
    status: "Active",
    lifecycleStatus: "Active",
    startDate: "",
    challengeStartDate: "",
    challengeEndDate: "",
    targetProfit: 10000,
    minimumTradingDays: 4,
    profitTargetPercent: 10,
    dailyLossLimitPercent: 5,
    maxLossLimitPercent: 10,
  },
  {
    id: demoPropAccountIds[1],
    firmName: "FTMO",
    accountName: "FTMO V1 200K",
    lifecycleType: "Challenge v1",
    accountSize: 200000,
    challengeType: "FTMO Challenge V1",
    phase: "Phase 1",
    status: "Active",
    lifecycleStatus: "Active",
    startDate: "",
    challengeStartDate: "",
    challengeEndDate: "",
    targetProfit: 20000,
    minimumTradingDays: 4,
    profitTargetPercent: 10,
    dailyLossLimitPercent: 5,
    maxLossLimitPercent: 10,
  },
  {
    id: demoPropAccountIds[2],
    firmName: "FTMO",
    accountName: "FTMO V2 100K A",
    lifecycleType: "Challenge v2",
    accountSize: 100000,
    challengeType: "FTMO Challenge V2",
    phase: "Phase 1",
    status: "Active",
    lifecycleStatus: "Active",
    startDate: "",
    challengeStartDate: "",
    challengeEndDate: "",
    targetProfit: 10000,
    minimumTradingDays: 4,
    profitTargetPercent: 10,
    dailyLossLimitPercent: 5,
    maxLossLimitPercent: 10,
  },
  {
    id: demoPropAccountIds[3],
    firmName: "FTMO",
    accountName: "FTMO V2 100K B",
    lifecycleType: "Challenge v2",
    accountSize: 100000,
    challengeType: "FTMO Challenge V2",
    phase: "Phase 1",
    status: "Active",
    lifecycleStatus: "Active",
    startDate: "",
    challengeStartDate: "",
    challengeEndDate: "",
    targetProfit: 10000,
    minimumTradingDays: 4,
    profitTargetPercent: 10,
    dailyLossLimitPercent: 5,
    maxLossLimitPercent: 10,
  },
  {
    id: demoPropAccountIds[4],
    firmName: "FTMO",
    accountName: "FTMO Live 50K",
    lifecycleType: "Funded",
    accountSize: 50000,
    challengeType: "FTMO Funded",
    phase: "Funded",
    status: "Active",
    lifecycleStatus: "Active",
    startDate: "",
    challengeStartDate: "",
    challengeEndDate: "",
    targetProfit: 5000,
    minimumTradingDays: 0,
    profitTargetPercent: 10,
    dailyLossLimitPercent: 5,
    maxLossLimitPercent: 10,
  },
];

function lifecycleTypeFromLegacy(account: Partial<PropAccount> & { lifecycleType?: unknown }): PropAccount["lifecycleType"] {
  if (
    account.lifecycleType === "Challenge v1" ||
    account.lifecycleType === "Challenge v2" ||
    account.lifecycleType === "Verification" ||
    account.lifecycleType === "Funded"
  ) {
    return account.lifecycleType;
  }

  if (account.phase === "Funded" || account.challengeType === "FTMO Funded") return "Funded";
  if (account.phase === "Phase 2") return "Verification";
  if (account.challengeType === "FTMO Challenge V1") return "Challenge v1";
  return "Challenge v2";
}

function lifecycleStatusFromLegacy(status: unknown): LifecycleAccountStatus {
  if (
    status === "Active" ||
    status === "Passed" ||
    status === "Failed" ||
    status === "Breached" ||
    status === "Archived"
  ) {
    return status;
  }

  return "Active";
}

function tradeStatusFromLegacy(status: unknown): PropAccountStatus {
  if (status === "Passed" || status === "Failed" || status === "Funded" || status === "Archived") {
    return status;
  }

  return "Active";
}

function sanitizeAccount(value: unknown): PropAccount | null {
  if (!value || typeof value !== "object") return null;

  const account = value as Partial<PropAccount>;
  if (!account.id || !account.accountName || !account.firmName) return null;

  const accountSize =
    typeof account.accountSize === "number" && Number.isFinite(account.accountSize)
      ? account.accountSize
      : 100000;
  const profitTargetPercent =
    typeof account.profitTargetPercent === "number" && Number.isFinite(account.profitTargetPercent)
      ? account.profitTargetPercent
      : 10;

  return {
    id: account.id,
    firmName: account.firmName,
    accountName: account.accountName,
    lifecycleType: lifecycleTypeFromLegacy(account),
    accountSize,
    challengeType: account.challengeType ?? "FTMO Challenge V2",
    phase: account.phase ?? "Phase 1",
    status: tradeStatusFromLegacy(account.status),
    lifecycleStatus: lifecycleStatusFromLegacy(account.lifecycleStatus ?? account.status),
    startDate: account.startDate ?? account.challengeStartDate ?? "",
    challengeStartDate: account.challengeStartDate ?? account.startDate ?? "",
    challengeEndDate: account.challengeEndDate ?? "",
    targetProfit:
      typeof account.targetProfit === "number" && Number.isFinite(account.targetProfit)
        ? account.targetProfit
        : accountSize * (profitTargetPercent / 100),
    minimumTradingDays:
      typeof account.minimumTradingDays === "number" && Number.isFinite(account.minimumTradingDays)
        ? account.minimumTradingDays
        : 4,
    profitTargetPercent,
    dailyLossLimitPercent:
      typeof account.dailyLossLimitPercent === "number" && Number.isFinite(account.dailyLossLimitPercent)
        ? account.dailyLossLimitPercent
        : 5,
    maxLossLimitPercent:
      typeof account.maxLossLimitPercent === "number" && Number.isFinite(account.maxLossLimitPercent)
        ? account.maxLossLimitPercent
        : 10,
  };
}

function sanitizeAccounts(value: unknown) {
  if (!Array.isArray(value)) return emptyPropAccounts;
  return value
    .map((account) => sanitizeAccount(account))
    .filter((account): account is PropAccount => Boolean(account));
}

export function readStoredPropAccounts() {
  if (typeof window === "undefined") return emptyPropAccounts;

  const raw = window.localStorage.getItem(storageKey);
  if (raw === lastRaw) return lastParsed;

  lastRaw = raw;
  if (!raw) {
    lastParsed = emptyPropAccounts;
    return lastParsed;
  }

  try {
    lastParsed = sanitizeAccounts(JSON.parse(raw));
  } catch {
    lastParsed = emptyPropAccounts;
  }

  return lastParsed;
}

export function writePropAccounts(accounts: PropAccount[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(accounts));
  window.dispatchEvent(new Event(storageEvent));
}

export function subscribeToPropAccounts(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const listener = () => callback();
  window.addEventListener("storage", listener);
  window.addEventListener(storageEvent, listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(storageEvent, listener);
  };
}

export function loadDemoPropAccounts() {
  const currentAccounts = readStoredPropAccounts();
  writePropAccounts([
    ...currentAccounts.filter((account) => !demoPropAccountIds.includes(account.id)),
    ...demoPropAccounts,
  ]);
}

export function clearDemoPropAccounts() {
  writePropAccounts(
    readStoredPropAccounts().filter((account) => !demoPropAccountIds.includes(account.id)),
  );
}

export const loadDemoFtmoAccounts = loadDemoPropAccounts;
export const clearDemoFtmoAccounts = clearDemoPropAccounts;

export function readStoredFtmoPayouts() {
  if (typeof window === "undefined") return emptyFtmoPayouts;

  const raw = window.localStorage.getItem(payoutStorageKey);
  if (raw === lastPayoutRaw) return lastPayoutParsed;

  lastPayoutRaw = raw;
  if (!raw) {
    lastPayoutParsed = emptyFtmoPayouts;
    return lastPayoutParsed;
  }

  try {
    lastPayoutParsed = JSON.parse(raw) as FtmoPayout[];
  } catch {
    lastPayoutParsed = emptyFtmoPayouts;
  }

  return lastPayoutParsed;
}

export function writeFtmoPayouts(payouts: FtmoPayout[]) {
  window.localStorage.setItem(payoutStorageKey, JSON.stringify(payouts));
  window.dispatchEvent(new Event(payoutStorageEvent));
}

export function subscribeToFtmoPayouts(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const listener = () => callback();
  window.addEventListener("storage", listener);
  window.addEventListener(payoutStorageEvent, listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(payoutStorageEvent, listener);
  };
}
