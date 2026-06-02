import type {
  ChallengeType,
  PropAccountStatus,
  PropFirmName,
  PropPhase,
} from "@/app/_lib/trading-types";

export type PropAccount = {
  id: string;
  firmName: PropFirmName;
  accountName: string;
  accountSize: number;
  challengeType: ChallengeType;
  phase: PropPhase;
  status: PropAccountStatus;
  startDate: string;
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
    accountSize: 100000,
    challengeType: "FTMO Challenge V1",
    phase: "Phase 1",
    status: "Active",
    startDate: "",
    minimumTradingDays: 4,
    profitTargetPercent: 10,
    dailyLossLimitPercent: 5,
    maxLossLimitPercent: 10,
  },
  {
    id: demoPropAccountIds[1],
    firmName: "FTMO",
    accountName: "FTMO V1 200K",
    accountSize: 200000,
    challengeType: "FTMO Challenge V1",
    phase: "Phase 1",
    status: "Active",
    startDate: "",
    minimumTradingDays: 4,
    profitTargetPercent: 10,
    dailyLossLimitPercent: 5,
    maxLossLimitPercent: 10,
  },
  {
    id: demoPropAccountIds[2],
    firmName: "FTMO",
    accountName: "FTMO V2 100K A",
    accountSize: 100000,
    challengeType: "FTMO Challenge V2",
    phase: "Phase 1",
    status: "Active",
    startDate: "",
    minimumTradingDays: 4,
    profitTargetPercent: 10,
    dailyLossLimitPercent: 5,
    maxLossLimitPercent: 10,
  },
  {
    id: demoPropAccountIds[3],
    firmName: "FTMO",
    accountName: "FTMO V2 100K B",
    accountSize: 100000,
    challengeType: "FTMO Challenge V2",
    phase: "Phase 1",
    status: "Active",
    startDate: "",
    minimumTradingDays: 4,
    profitTargetPercent: 10,
    dailyLossLimitPercent: 5,
    maxLossLimitPercent: 10,
  },
  {
    id: demoPropAccountIds[4],
    firmName: "FTMO",
    accountName: "FTMO Live 50K",
    accountSize: 50000,
    challengeType: "FTMO Funded",
    phase: "Funded",
    status: "Funded",
    startDate: "",
    minimumTradingDays: 0,
    profitTargetPercent: 10,
    dailyLossLimitPercent: 5,
    maxLossLimitPercent: 10,
  },
];

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
    lastParsed = JSON.parse(raw) as PropAccount[];
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
