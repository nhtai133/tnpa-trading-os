import { playbooks, type Playbook, type SetupTag } from "@/app/_lib/trading-types";

export type PlaybookOverrides = Record<string, Playbook>;

export const playbookStorageKey = "tnpa.playbooks.v1";
export const playbookUpdatedEvent = "tnpa:playbooks-updated";
export const emptyPlaybookOverrides: PlaybookOverrides = {};

let lastRaw: string | null = null;
let lastParsed: PlaybookOverrides = emptyPlaybookOverrides;

export function isPlaybook(value: string): value is Playbook {
  return playbooks.includes(value as Playbook);
}

export function getDefaultPlaybook(setup: string, setupTag?: SetupTag): Playbook {
  const normalized = setup.toLowerCase();

  if (normalized.includes("london") || setupTag === "Breakout Trendline") {
    return "London Breakout Trendline";
  }

  if (normalized.includes("ny") || normalized.includes("continuation")) {
    return "NY Continuation";
  }

  if (normalized.includes("rectangle")) {
    return "Rectangle Range";
  }

  if (normalized.includes("supply") || normalized.includes("order block")) {
    return "Supply Demand Reversal";
  }

  if (normalized.includes("range") || setupTag === "Trading Range") {
    return "Trading Range Reversal";
  }

  if (normalized.includes("td9") || setupTag === "TD Setup 9") {
    return "TD9 Reversal";
  }

  if (normalized.includes("td13") || setupTag === "TD Countdown 13") {
    return "TD13 Reversal";
  }

  if (normalized.includes("elliott") || setupTag === "Elliott Wave") {
    return "Elliott Wave Continuation";
  }

  return "Other";
}

function sanitizeOverrides(value: unknown): PlaybookOverrides {
  if (!value || typeof value !== "object") {
    return emptyPlaybookOverrides;
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Playbook] => {
      const [, playbook] = entry;
      return typeof playbook === "string" && isPlaybook(playbook);
    }),
  );
}

export function readPlaybookOverrides() {
  if (typeof window === "undefined") {
    return emptyPlaybookOverrides;
  }

  const raw = window.localStorage.getItem(playbookStorageKey);

  if (raw === lastRaw) {
    return lastParsed;
  }

  if (!raw) {
    lastRaw = raw;
    lastParsed = emptyPlaybookOverrides;
    return lastParsed;
  }

  try {
    lastRaw = raw;
    lastParsed = sanitizeOverrides(JSON.parse(raw));
    return lastParsed;
  } catch {
    window.localStorage.removeItem(playbookStorageKey);
    lastRaw = null;
    lastParsed = emptyPlaybookOverrides;
    return lastParsed;
  }
}

export function writePlaybookOverride(tradeId: string, playbook: Playbook) {
  const next = { ...readPlaybookOverrides(), [tradeId]: playbook };
  const raw = JSON.stringify(next);
  lastRaw = raw;
  lastParsed = next;
  window.localStorage.setItem(playbookStorageKey, raw);
  window.dispatchEvent(new CustomEvent(playbookUpdatedEvent, { detail: next }));
}

export function subscribeToPlaybookOverrides(onStoreChange: () => void) {
  window.addEventListener(playbookUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(playbookUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
