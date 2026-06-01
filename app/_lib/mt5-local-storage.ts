import type { Mt5AccountReport } from "@/app/_lib/trading-types";

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
    lastParsed = JSON.parse(raw) as Mt5AccountReport;
    return lastParsed;
  } catch {
    window.localStorage.removeItem(mt5ImportStorageKey);
    lastRaw = null;
    lastParsed = null;
    return null;
  }
}

export function writeStoredMt5Report(report: Mt5AccountReport) {
  const raw = JSON.stringify(report);
  lastRaw = raw;
  lastParsed = report;
  window.localStorage.setItem(mt5ImportStorageKey, raw);
  window.dispatchEvent(new CustomEvent(mt5ImportUpdatedEvent, { detail: report }));
}

export function subscribeToStoredMt5Report(onStoreChange: () => void) {
  window.addEventListener(mt5ImportUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(mt5ImportUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
