export const tradingStorageKeys = [
  "tnpa.mt5.import.v1",
  "tnpa.manual-trades.v1",
  "tnpa.trade-journal.v1",
  "tnpa.setup-tags.v1",
  "tnpa.playbooks.v1",
  "tnpa.prop-accounts.v1",
  "tnpa.ftmo-payouts.v1",
  "tnpa.personal-trading-accounts.v1",
  "tnpa.personal-withdrawals.v1",
  "tnpa.trade-account-links.v1",
  "tnpa.playbook-intelligence.v1",
  "tnpa.review-notes.v1",
] as const;

const tradingStorageEvents: Record<(typeof tradingStorageKeys)[number], string> = {
  "tnpa.mt5.import.v1": "tnpa:mt5-import-updated",
  "tnpa.manual-trades.v1": "tnpa:manual-trades-updated",
  "tnpa.trade-journal.v1": "tnpa:trade-journal-updated",
  "tnpa.setup-tags.v1": "tnpa:setup-tags-updated",
  "tnpa.playbooks.v1": "tnpa:playbooks-updated",
  "tnpa.prop-accounts.v1": "tnpa:prop-accounts-updated",
  "tnpa.ftmo-payouts.v1": "tnpa:ftmo-payouts-updated",
  "tnpa.personal-trading-accounts.v1": "tnpa:personal-trading-accounts-updated",
  "tnpa.personal-withdrawals.v1": "tnpa:personal-withdrawals-updated",
  "tnpa.trade-account-links.v1": "tnpa:trade-account-links-updated",
  "tnpa.playbook-intelligence.v1": "tnpa:playbook-intelligence-updated",
  "tnpa.review-notes.v1": "tnpa:review-notes-updated",
};

const migrationKey = "tnpa.trading-demo-cleanup.v1";
const legacyDemoAccountNames = [
  "FTMO V1 Challenge A",
  "FTMO V1 Challenge B",
  "FTMO V2 Challenge A",
  "FTMO V2 Challenge B",
];

type MigrationResult = {
  changed: boolean;
  removedRecords: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function includesLegacyDemoName(value: unknown) {
  if (typeof value !== "string") return false;
  return legacyDemoAccountNames.some((name) => value.includes(name));
}

export function isDemoTradingRecord(value: unknown) {
  if (!isRecord(value)) return false;

  const id = value.id;
  const accountName = value.accountName;

  return (
    (typeof id === "string" && id.startsWith("DEMO-")) ||
    includesLegacyDemoName(accountName)
  );
}

function readJson(key: string) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function dispatchTradingStorageEvent(key: (typeof tradingStorageKeys)[number]) {
  window.dispatchEvent(new Event(tradingStorageEvents[key]));
}

function removeDemoArrayRecords(key: (typeof tradingStorageKeys)[number]): MigrationResult {
  const value = readJson(key);
  if (!Array.isArray(value)) return { changed: false, removedRecords: 0 };

  const next = value.filter((record) => !isDemoTradingRecord(record));
  const removedRecords = value.length - next.length;

  if (!removedRecords) return { changed: false, removedRecords: 0 };

  if (next.length) {
    writeJson(key, next);
  } else {
    window.localStorage.removeItem(key);
  }
  dispatchTradingStorageEvent(key);
  return { changed: true, removedRecords };
}

function removeDemoOverrideRecords(key: (typeof tradingStorageKeys)[number]): MigrationResult {
  const value = readJson(key);
  if (!isRecord(value)) return { changed: false, removedRecords: 0 };

  const next = Object.fromEntries(
    Object.entries(value).filter(([tradeId]) => !tradeId.startsWith("DEMO-")),
  );
  const removedRecords = Object.keys(value).length - Object.keys(next).length;

  if (!removedRecords) return { changed: false, removedRecords: 0 };

  if (Object.keys(next).length) {
    writeJson(key, next);
  } else {
    window.localStorage.removeItem(key);
  }
  dispatchTradingStorageEvent(key);
  return { changed: true, removedRecords };
}

function removeDemoMt5Import(): MigrationResult {
  const report = readJson("tnpa.mt5.import.v1");
  if (!isRecord(report)) return { changed: false, removedRecords: 0 };

  const trades = Array.isArray(report.trades) ? report.trades : [];
  const isDemoReport =
    isDemoTradingRecord(report) ||
    includesLegacyDemoName(report.accountName) ||
    includesLegacyDemoName(report.name);

  if (isDemoReport) {
    window.localStorage.removeItem("tnpa.mt5.import.v1");
    dispatchTradingStorageEvent("tnpa.mt5.import.v1");
    return { changed: true, removedRecords: Math.max(1, trades.length) };
  }

  const nextTrades = trades.filter((trade) => !isDemoTradingRecord(trade));
  const removedRecords = trades.length - nextTrades.length;
  if (!removedRecords) return { changed: false, removedRecords: 0 };

  if (nextTrades.length) {
    writeJson("tnpa.mt5.import.v1", { ...report, trades: nextTrades });
  } else {
    window.localStorage.removeItem("tnpa.mt5.import.v1");
  }
  dispatchTradingStorageEvent("tnpa.mt5.import.v1");
  return { changed: true, removedRecords };
}

export function runTradingDemoDataMigration() {
  if (typeof window === "undefined") return { changed: false, removedRecords: 0 };

  const results = [
    removeDemoMt5Import(),
    removeDemoArrayRecords("tnpa.manual-trades.v1"),
    removeDemoArrayRecords("tnpa.prop-accounts.v1"),
    removeDemoArrayRecords("tnpa.ftmo-payouts.v1"),
    removeDemoArrayRecords("tnpa.personal-trading-accounts.v1"),
    removeDemoOverrideRecords("tnpa.trade-journal.v1"),
    removeDemoOverrideRecords("tnpa.setup-tags.v1"),
    removeDemoOverrideRecords("tnpa.playbooks.v1"),
    removeDemoOverrideRecords("tnpa.trade-account-links.v1"),
    removeDemoOverrideRecords("tnpa.playbook-intelligence.v1"),
  ];

  const result = results.reduce<MigrationResult>(
    (total, item) => ({
      changed: total.changed || item.changed,
      removedRecords: total.removedRecords + item.removedRecords,
    }),
    { changed: false, removedRecords: 0 },
  );

  window.localStorage.setItem(migrationKey, "complete");
  return result;
}

export function resetTnpaTradingData() {
  if (typeof window === "undefined") return;

  tradingStorageKeys.forEach((key) => {
    window.localStorage.removeItem(key);
    dispatchTradingStorageEvent(key);
  });
  window.localStorage.setItem(migrationKey, "complete");
}
