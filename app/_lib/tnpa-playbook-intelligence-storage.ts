import type { Trade } from "@/app/_lib/trading-types";

export const tnpaCorePlaybooks = ["Rectangle Breakout", "Trendline Breakout"] as const;
export type TnpaCorePlaybook = (typeof tnpaCorePlaybooks)[number];

export const tnpaMarketBiasOptions = ["Bullish", "Bearish", "Neutral"] as const;
export type TnpaMarketBias = (typeof tnpaMarketBiasOptions)[number];

export const tnpaHigherTimeframeTrendOptions = [
  "D1 aligned",
  "H4 aligned",
  "H1 aligned",
  "Not aligned",
] as const;
export type TnpaHigherTimeframeTrend = (typeof tnpaHigherTimeframeTrendOptions)[number];

export const tnpaEmaStructureOptions = ["EMA21 / EMA34 / EMA89 aligned", "Mixed"] as const;
export type TnpaEmaStructure = (typeof tnpaEmaStructureOptions)[number];

export const tnpaRsiConfirmationOptions = [
  "RSI above SMA50",
  "RSI below SMA50",
  "RSI trendline break",
  "No confirmation",
] as const;
export type TnpaRsiConfirmation = (typeof tnpaRsiConfirmationOptions)[number];

export const tnpaTdSequentialOptions = ["Setup 9", "Countdown 13", "Exhaustion", "None"] as const;
export type TnpaTdSequential = (typeof tnpaTdSequentialOptions)[number];

export const tnpaVolumeConfirmationOptions = [
  "Breakout volume",
  "Dry-up before breakout",
  "Climax",
  "None",
] as const;
export type TnpaVolumeConfirmation = (typeof tnpaVolumeConfirmationOptions)[number];

export const tnpaZoneContextOptions = [
  "Supply",
  "Demand",
  "Support",
  "Resistance",
  "Trading Range",
  "None",
] as const;
export type TnpaZoneContext = (typeof tnpaZoneContextOptions)[number];

export const tnpaEntryQualityOptions = ["Early", "Confirmed", "Late", "FOMO"] as const;
export type TnpaEntryQuality = (typeof tnpaEntryQualityOptions)[number];

export const tnpaGrades = ["A+", "A", "B", "C", "Invalid"] as const;
export type TnpaGrade = (typeof tnpaGrades)[number];

export type TnpaRuleCompliance = {
  tradeWithH4Trend: boolean;
  avoidEma21Ema34Entry: boolean;
  rrAtLeastTwo: boolean;
  stopLossDefined: boolean;
  playbookMatched: boolean;
};

export type TnpaPlaybookIntelligence = {
  corePlaybook?: TnpaCorePlaybook;
  marketBias?: TnpaMarketBias;
  higherTimeframeTrend?: TnpaHigherTimeframeTrend;
  emaStructure?: TnpaEmaStructure;
  rsiConfirmation?: TnpaRsiConfirmation;
  tdSequentialConfirmation?: TnpaTdSequential;
  volumeConfirmation?: TnpaVolumeConfirmation;
  zoneContext?: TnpaZoneContext;
  entryQuality?: TnpaEntryQuality;
  rules: TnpaRuleCompliance;
};

export type TnpaPlaybookIntelligenceOverrides = Record<string, TnpaPlaybookIntelligence>;

export type TnpaGradeResult = {
  grade: TnpaGrade;
  score: number;
  explanation: string;
  violatedRules: string[];
};

export const tnpaPlaybookIntelligenceStorageKey = "tnpa.playbook-intelligence.v1";
export const tnpaPlaybookIntelligenceUpdatedEvent = "tnpa:playbook-intelligence-updated";

export const defaultTnpaRules: TnpaRuleCompliance = {
  avoidEma21Ema34Entry: false,
  playbookMatched: false,
  rrAtLeastTwo: false,
  stopLossDefined: false,
  tradeWithH4Trend: false,
};

export const emptyTnpaPlaybookIntelligenceOverrides: TnpaPlaybookIntelligenceOverrides = {};

let lastRaw: string | null = null;
let lastParsed: TnpaPlaybookIntelligenceOverrides = emptyTnpaPlaybookIntelligenceOverrides;

function includesOption<T extends readonly string[]>(options: T, value: unknown): value is T[number] {
  return typeof value === "string" && options.includes(value);
}

function cleanRule(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

export function createEmptyTnpaPlaybookIntelligence(): TnpaPlaybookIntelligence {
  return { rules: { ...defaultTnpaRules } };
}

function sanitizeIntelligence(value: unknown): TnpaPlaybookIntelligence {
  if (!value || typeof value !== "object") {
    return createEmptyTnpaPlaybookIntelligence();
  }

  const source = value as Partial<TnpaPlaybookIntelligence>;
  const rules = source.rules && typeof source.rules === "object"
    ? source.rules as Partial<TnpaRuleCompliance>
    : {};

  return {
    corePlaybook: includesOption(tnpaCorePlaybooks, source.corePlaybook) ? source.corePlaybook : undefined,
    marketBias: includesOption(tnpaMarketBiasOptions, source.marketBias) ? source.marketBias : undefined,
    higherTimeframeTrend: includesOption(tnpaHigherTimeframeTrendOptions, source.higherTimeframeTrend)
      ? source.higherTimeframeTrend
      : undefined,
    emaStructure: includesOption(tnpaEmaStructureOptions, source.emaStructure) ? source.emaStructure : undefined,
    rsiConfirmation: includesOption(tnpaRsiConfirmationOptions, source.rsiConfirmation)
      ? source.rsiConfirmation
      : undefined,
    tdSequentialConfirmation: includesOption(tnpaTdSequentialOptions, source.tdSequentialConfirmation)
      ? source.tdSequentialConfirmation
      : undefined,
    volumeConfirmation: includesOption(tnpaVolumeConfirmationOptions, source.volumeConfirmation)
      ? source.volumeConfirmation
      : undefined,
    zoneContext: includesOption(tnpaZoneContextOptions, source.zoneContext) ? source.zoneContext : undefined,
    entryQuality: includesOption(tnpaEntryQualityOptions, source.entryQuality) ? source.entryQuality : undefined,
    rules: {
      avoidEma21Ema34Entry: cleanRule(rules.avoidEma21Ema34Entry),
      playbookMatched: cleanRule(rules.playbookMatched),
      rrAtLeastTwo: cleanRule(rules.rrAtLeastTwo),
      stopLossDefined: cleanRule(rules.stopLossDefined),
      tradeWithH4Trend: cleanRule(rules.tradeWithH4Trend),
    },
  };
}

function sanitizeOverrides(value: unknown): TnpaPlaybookIntelligenceOverrides {
  if (!value || typeof value !== "object") {
    return emptyTnpaPlaybookIntelligenceOverrides;
  }

  return Object.fromEntries(
    Object.entries(value).map(([tradeId, intelligence]) => [
      tradeId,
      sanitizeIntelligence(intelligence),
    ]),
  );
}

export function readTnpaPlaybookIntelligenceOverrides() {
  if (typeof window === "undefined") {
    return emptyTnpaPlaybookIntelligenceOverrides;
  }

  const raw = window.localStorage.getItem(tnpaPlaybookIntelligenceStorageKey);
  if (raw === lastRaw) {
    return lastParsed;
  }

  if (!raw) {
    lastRaw = raw;
    lastParsed = emptyTnpaPlaybookIntelligenceOverrides;
    return lastParsed;
  }

  try {
    lastRaw = raw;
    lastParsed = sanitizeOverrides(JSON.parse(raw));
    return lastParsed;
  } catch {
    window.localStorage.removeItem(tnpaPlaybookIntelligenceStorageKey);
    lastRaw = null;
    lastParsed = emptyTnpaPlaybookIntelligenceOverrides;
    return lastParsed;
  }
}

export function writeTnpaPlaybookIntelligenceOverride(
  tradeId: string,
  intelligence: TnpaPlaybookIntelligence,
) {
  const next = {
    ...readTnpaPlaybookIntelligenceOverrides(),
    [tradeId]: sanitizeIntelligence(intelligence),
  };
  const raw = JSON.stringify(next);
  lastRaw = raw;
  lastParsed = next;
  window.localStorage.setItem(tnpaPlaybookIntelligenceStorageKey, raw);
  window.dispatchEvent(new CustomEvent(tnpaPlaybookIntelligenceUpdatedEvent, { detail: next }));
}

export function subscribeToTnpaPlaybookIntelligenceOverrides(onStoreChange: () => void) {
  window.addEventListener(tnpaPlaybookIntelligenceUpdatedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(tnpaPlaybookIntelligenceUpdatedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function evaluateTnpaGrade(
  trade: Trade,
  intelligence: TnpaPlaybookIntelligence | undefined,
): TnpaGradeResult {
  if (!intelligence || !intelligence.corePlaybook) {
    return {
      explanation: "No TNPA playbook review has been saved for this trade.",
      grade: "Invalid",
      score: 0,
      violatedRules: ["Playbook matched"],
    };
  }

  const rules = intelligence.rules;
  const violatedRules = [
    !rules.tradeWithH4Trend ? "Trade with H4 trend" : "",
    !rules.avoidEma21Ema34Entry ? "Avoid entry between EMA21 and EMA34" : "",
    !rules.rrAtLeastTwo ? "RR >= 1:2" : "",
    !rules.stopLossDefined ? "Stop loss defined" : "",
    !rules.playbookMatched ? "Playbook matched" : "",
  ].filter(Boolean);

  let score = 0;
  score += rules.tradeWithH4Trend || intelligence.higherTimeframeTrend === "H4 aligned" ? 20 : 0;
  score += rules.playbookMatched ? 20 : 0;
  score += intelligence.rsiConfirmation && intelligence.rsiConfirmation !== "No confirmation" ? 6 : 0;
  score += intelligence.tdSequentialConfirmation && intelligence.tdSequentialConfirmation !== "None" ? 5 : 0;
  score += intelligence.volumeConfirmation && intelligence.volumeConfirmation !== "None" ? 5 : 0;
  score += intelligence.emaStructure === "EMA21 / EMA34 / EMA89 aligned" ? 4 : 0;
  score += trade.rr >= 2 || rules.rrAtLeastTwo ? 15 : 0;
  score += rules.avoidEma21Ema34Entry ? 5 : 0;
  score += rules.stopLossDefined ? 5 : 0;
  score += intelligence.entryQuality === "Confirmed" ? 10 : intelligence.entryQuality === "Early" ? 5 : 0;

  const grade: TnpaGrade =
    violatedRules.includes("Playbook matched") || score < 50
      ? "Invalid"
      : score >= 90
        ? "A+"
        : score >= 80
          ? "A"
          : score >= 65
            ? "B"
            : "C";

  const strengths = [
    rules.playbookMatched ? `${intelligence.corePlaybook} matched` : "",
    rules.tradeWithH4Trend ? "aligned with H4 trend" : "",
    trade.rr >= 2 || rules.rrAtLeastTwo ? "RR met 1:2 minimum" : "",
    intelligence.entryQuality === "Confirmed" ? "entry was confirmed" : "",
  ].filter(Boolean);
  const issues = violatedRules.slice(0, 2);

  return {
    explanation: `${score}/100. ${strengths.length ? strengths.join(", ") : "Limited confirmation"}${issues.length ? `. Needs review: ${issues.join(", ")}.` : "."}`,
    grade,
    score,
    violatedRules,
  };
}
