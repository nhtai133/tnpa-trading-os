export type Kpi = {
  label: string;
  value: string;
  change: string;
  tone: "positive" | "negative" | "neutral";
};

export type EquityPoint = {
  label: string;
  equity: number;
};

export type MonthlyPerformance = {
  month: string;
  pnl: number;
};

export const setupTags = [
  "Breakout Trendline",
  "Rectangle Range",
  "Supply Demand",
  "Elliott Wave",
  "TD Setup 9",
  "TD Countdown 13",
  "Trading Range",
  "Other",
] as const;

export type SetupTag = (typeof setupTags)[number];

export const emotionOptions = [
  "Calm",
  "Confident",
  "Fear",
  "FOMO",
  "Revenge",
  "Greed",
  "Hesitation",
] as const;

export type TradeEmotion = (typeof emotionOptions)[number];

export const mistakeOptions = [
  "Early Entry",
  "Late Entry",
  "No Confirmation",
  "Overtrading",
  "Risk Violation",
  "Emotional Trade",
  "Other",
] as const;

export type TradeMistake = (typeof mistakeOptions)[number];

export type TradeJournal = {
  entryScreenshot?: string;
  exitScreenshot?: string;
  entryReason?: string;
  exitReason?: string;
  emotion?: TradeEmotion;
  mistake?: TradeMistake;
  lessonLearned?: string;
};

export type Trade = {
  id: string;
  symbol: string;
  setup: string;
  setupTag: SetupTag;
  status: "Open" | "Closed";
  side: "Long" | "Short";
  date: string;
  session: "Asia" | "London" | "New York";
  entry: number;
  exit: number;
  rr: number;
  pnl: number;
  floatingPnl?: number;
  result: "Win" | "Loss";
} & TradeJournal;

export type Mt5AccountReport = {
  sourceFile: string;
  name: string;
  account: string;
  company: string;
  generatedAt: string;
  balance: number;
  equity: number;
  totalNetProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  expectedPayoff: number;
  totalTrades: number;
  shortTrades: string;
  longTrades: string;
  maxDrawdown: string;
  trades: Trade[];
};

export type RiskSettings = {
  dailyLossLimitPercent: number;
  maxLossLimitPercent: number;
  profitTargetPercent: number;
};

export type RiskLevel = "Safe" | "Warning" | "Danger" | "Breach";
