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
export const emptyPropAccounts: PropAccount[] = [];

let lastRaw: string | null = null;
let lastParsed: PropAccount[] = emptyPropAccounts;

export const demoPropAccountIds = [
  "DEMO-PROP-FTMO-V2-A",
  "DEMO-PROP-FTMO-V2-B",
  "DEMO-PROP-FTMO-V1-A",
  "DEMO-PROP-FTMO-V1-B",
  "DEMO-PROP-FTMO-LIVE-50K",
];

export const demoPropAccounts: PropAccount[] = [
  {
    id: demoPropAccountIds[0],
    firmName: "FTMO",
    accountName: "FTMO V2 Challenge A",
    accountSize: 100000,
    challengeType: "2-Step Challenge",
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
    accountName: "FTMO V2 Challenge B",
    accountSize: 100000,
    challengeType: "2-Step Challenge",
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
    accountName: "FTMO V1 Challenge A",
    accountSize: 50000,
    challengeType: "1-Step Challenge",
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
    accountName: "FTMO V1 Challenge B",
    accountSize: 50000,
    challengeType: "1-Step Challenge",
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
    challengeType: "Funded Account",
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
