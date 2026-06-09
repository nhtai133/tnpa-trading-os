import { setupTags, type SetupTag } from "@/app/_lib/trading-types";

export type SetupTagOverrides = Record<string, SetupTag>;

export const setupTagStorageKey = "tnpa.setup-tags.v1";
export const setupTagUpdatedEvent = "tnpa:setup-tags-updated";
export const emptySetupTagOverrides: SetupTagOverrides = {};

let lastRaw: string | null = null;
let lastParsed: SetupTagOverrides = emptySetupTagOverrides;

export function isSetupTag(value: string): value is SetupTag {
  return setupTags.includes(value as SetupTag);
}

export function getDefaultSetupTag(setup: string): SetupTag {
  const normalized = setup.toLowerCase();

  if (normalized.includes("breakout")) {
    return "Breakout Trendline";
  }

  if (normalized.includes("range") || normalized.includes("rectangle")) {
    return "Rectangle Range";
  }

  if (normalized.includes("order block") || normalized.includes("supply")) {
    return "Supply Demand";
  }

  if (normalized.includes("continuation")) {
    return "Trading Range";
  }

  return "Other";
}

function sanitizeOverrides(value: unknown): SetupTagOverrides {
  if (!value || typeof value !== "object") {
    return emptySetupTagOverrides;
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, SetupTag] => {
      const [, tag] = entry;
      return typeof tag === "string" && isSetupTag(tag);
    }),
  );
}

export function readSetupTagOverrides() {
  if (typeof window === "undefined") {
    return emptySetupTagOverrides;
  }

  const raw = window.localStorage.getItem(setupTagStorageKey);

  if (raw === lastRaw) {
    return lastParsed;
  }

  if (!raw) {
    lastRaw = raw;
    lastParsed = emptySetupTagOverrides;
    return lastParsed;
  }

  try {
    lastRaw = raw;
    lastParsed = sanitizeOverrides(JSON.parse(raw));
    return lastParsed;
  } catch {
    window.localStorage.removeItem(setupTagStorageKey);
    lastRaw = null;
    lastParsed = emptySetupTagOverrides;
    return lastParsed;
  }
}

export function writeSetupTagOverride(tradeId: string, tag: SetupTag) {
  const next = { ...readSetupTagOverrides(), [tradeId]: tag };
  const raw = JSON.stringify(next);
  lastRaw = raw;
  lastParsed = next;
  window.localStorage.setItem(setupTagStorageKey, raw);
  window.dispatchEvent(new CustomEvent(setupTagUpdatedEvent, { detail: next }));
}

export function subscribeToSetupTagOverrides(onStoreChange: () => void) {
  window.addEventListener(setupTagUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(setupTagUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
