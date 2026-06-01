import type { RiskSettings } from "@/app/_lib/trading-types";

export const defaultRiskSettings: RiskSettings = {
  dailyLossLimitPercent: 5,
  maxLossLimitPercent: 10,
  profitTargetPercent: 10,
};

export const riskSettingsStorageKey = "tnpa.risk-settings.v1";
export const riskSettingsUpdatedEvent = "tnpa:risk-settings-updated";

let lastRaw: string | null = null;
let lastParsed: RiskSettings = defaultRiskSettings;

function sanitizeSettings(value: unknown): RiskSettings {
  if (!value || typeof value !== "object") {
    return defaultRiskSettings;
  }

  const settings = value as Partial<RiskSettings>;

  return {
    dailyLossLimitPercent:
      typeof settings.dailyLossLimitPercent === "number"
        ? settings.dailyLossLimitPercent
        : defaultRiskSettings.dailyLossLimitPercent,
    maxLossLimitPercent:
      typeof settings.maxLossLimitPercent === "number"
        ? settings.maxLossLimitPercent
        : defaultRiskSettings.maxLossLimitPercent,
    profitTargetPercent:
      typeof settings.profitTargetPercent === "number"
        ? settings.profitTargetPercent
        : defaultRiskSettings.profitTargetPercent,
  };
}

export function readRiskSettings() {
  if (typeof window === "undefined") {
    return defaultRiskSettings;
  }

  const raw = window.localStorage.getItem(riskSettingsStorageKey);

  if (raw === lastRaw) {
    return lastParsed;
  }

  if (!raw) {
    lastRaw = raw;
    lastParsed = defaultRiskSettings;
    return lastParsed;
  }

  try {
    lastRaw = raw;
    lastParsed = sanitizeSettings(JSON.parse(raw));
    return lastParsed;
  } catch {
    window.localStorage.removeItem(riskSettingsStorageKey);
    lastRaw = null;
    lastParsed = defaultRiskSettings;
    return lastParsed;
  }
}

export function writeRiskSettings(settings: RiskSettings) {
  const sanitized = sanitizeSettings(settings);
  const raw = JSON.stringify(sanitized);
  lastRaw = raw;
  lastParsed = sanitized;
  window.localStorage.setItem(riskSettingsStorageKey, raw);
  window.dispatchEvent(
    new CustomEvent(riskSettingsUpdatedEvent, { detail: sanitized }),
  );
}

export function subscribeToRiskSettings(onStoreChange: () => void) {
  window.addEventListener(riskSettingsUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(riskSettingsUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
