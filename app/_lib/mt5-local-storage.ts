import type { Mt5AccountReport } from "@/app/_lib/trading-types";
import {
  backfillMt5TradeIdentifiers,
  importMt5Report,
  type Mt5ImportResult,
} from "@/app/_lib/mt5-import-service";

export const mt5ImportStorageKey = "tnpa.mt5.import.v1";
export const mt5ImportUpdatedEvent = "tnpa:mt5-import-updated";

let lastRaw: string | null = null;
let lastParsed: Mt5AccountReport | null = null;

export function readStoredMt5Report() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(mt5ImportStorageKey);

  if (raw === lastRaw) {
    return lastParsed;
  }

  if (!raw) {
    lastRaw = raw;
    lastParsed = null;
    return null;
  }

  try {
    lastRaw = raw;
    lastParsed = backfillMt5TradeIdentifiers(JSON.parse(raw) as Mt5AccountReport);
    return lastParsed;
  } catch {
    window.localStorage.removeItem(mt5ImportStorageKey);
    lastRaw = null;
    lastParsed = null;
    return null;
  }
}

export function writeStoredMt5Report(report: Mt5AccountReport) {
  const migratedReport = backfillMt5TradeIdentifiers(report);
  const raw = JSON.stringify(migratedReport);
  lastRaw = raw;
  lastParsed = migratedReport;
  window.localStorage.setItem(mt5ImportStorageKey, raw);
  window.dispatchEvent(new CustomEvent(mt5ImportUpdatedEvent, { detail: migratedReport }));
}

export function importStoredMt5Report(
  report: Mt5AccountReport,
  options: { dryRun?: boolean } = {},
): Mt5ImportResult {
  const result = importMt5Report(report, readStoredMt5Report(), options);

  if (!options.dryRun) {
    writeStoredMt5Report(result.report);
  }

  return result;
}

export function subscribeToStoredMt5Report(onStoreChange: () => void) {
  window.addEventListener(mt5ImportUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(mt5ImportUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
