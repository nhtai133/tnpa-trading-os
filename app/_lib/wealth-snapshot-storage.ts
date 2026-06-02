export type WealthSnapshot = {
  month: string;
  label: string;
  netWorth: number;
  cash: number;
  savings: number;
  stocks: number;
  crypto: number;
  realEstate: number;
  brokerCash: number;
  brokerEquity: number;
  bankCash: number;
  tradingAccounts: number;
  timestamp: string;
};

export const wealthSnapshotsStorageKey = "tnpa.wealth-snapshots.v1";
export const wealthSnapshotsUpdatedEvent = "tnpa:wealth-snapshots-updated";

let lastRaw: string | null = null;
let lastParsed: WealthSnapshot[] = [];

function sanitizeSnapshot(value: unknown): WealthSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<WealthSnapshot>;

  if (
    !snapshot.month ||
    !snapshot.label ||
    typeof snapshot.netWorth !== "number" ||
    typeof snapshot.cash !== "number" ||
    typeof snapshot.savings !== "number" ||
    typeof snapshot.stocks !== "number" ||
    typeof snapshot.crypto !== "number" ||
    typeof snapshot.realEstate !== "number" ||
    typeof snapshot.brokerCash !== "number" ||
    typeof snapshot.brokerEquity !== "number" ||
    typeof snapshot.bankCash !== "number" ||
    typeof snapshot.tradingAccounts !== "number" ||
    typeof snapshot.timestamp !== "string"
  ) {
    return null;
  }

  return {
    month: snapshot.month,
    label: snapshot.label,
    netWorth: snapshot.netWorth,
    cash: snapshot.cash,
    savings: snapshot.savings,
    stocks: snapshot.stocks,
    crypto: snapshot.crypto,
    realEstate: snapshot.realEstate,
    brokerCash: snapshot.brokerCash,
    brokerEquity: snapshot.brokerEquity,
    bankCash: snapshot.bankCash,
    tradingAccounts: snapshot.tradingAccounts,
    timestamp: snapshot.timestamp,
  };
}

function sanitizeSnapshots(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((snapshot) => sanitizeSnapshot(snapshot))
    .filter((snapshot): snapshot is WealthSnapshot => Boolean(snapshot));
}

export function readStoredWealthSnapshots() {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(wealthSnapshotsStorageKey);

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
    lastParsed = sanitizeSnapshots(JSON.parse(raw));
    return lastParsed;
  } catch {
    window.localStorage.removeItem(wealthSnapshotsStorageKey);
    lastRaw = null;
    lastParsed = [];
    return lastParsed;
  }
}

export function writeStoredWealthSnapshots(snapshots: WealthSnapshot[]) {
  const raw = JSON.stringify(snapshots);
  lastRaw = raw;
  lastParsed = snapshots;
  window.localStorage.setItem(wealthSnapshotsStorageKey, raw);
  window.dispatchEvent(
    new CustomEvent(wealthSnapshotsUpdatedEvent, { detail: snapshots }),
  );
}

export function upsertWealthSnapshot(snapshot: WealthSnapshot) {
  const snapshots = readStoredWealthSnapshots();
  const existing = snapshots.find((item) => item.month === snapshot.month);

  if (existing && JSON.stringify(existing) === JSON.stringify(snapshot)) {
    return;
  }

  const next = snapshots.some((item) => item.month === snapshot.month)
    ? snapshots.map((item) => (item.month === snapshot.month ? snapshot : item))
    : [...snapshots, snapshot].sort((a, b) => a.month.localeCompare(b.month));

  writeStoredWealthSnapshots(next);
}

export function subscribeToWealthSnapshots(onStoreChange: () => void) {
  window.addEventListener(wealthSnapshotsUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(wealthSnapshotsUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
