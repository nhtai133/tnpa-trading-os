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

export type TradeSource = "mt5" | "manual";

export const accountTypes = ["prop-firm", "broker"] as const;
export type AccountType = (typeof accountTypes)[number];

export function accountTypeLabel(accountType: AccountType) {
  return accountType === "prop-firm" ? "Prop Firm" : "Broker";
}

export const strategyTypes = [
  "Intraweek",
  "Swing",
  "Position",
  "Scalp",
  "Crypto Spot",
  "Other",
] as const;
export type StrategyType = (typeof strategyTypes)[number];

export const propFirmAccountNames = [
  "FTMO V1 100K",
  "FTMO V1 200K",
  "FTMO V2 100K A",
  "FTMO V2 100K B",
  "FTMO Live 50K",
] as const;

export const brokerAccountNames = [
  "Exness",
  "ICMarkets",
  "XM",
  "HFM",
  "Other",
] as const;

export const challengeTypes = [
  "FTMO Challenge V1",
  "FTMO Challenge V2",
  "FTMO Funded",
  "Other",
] as const;
export type ChallengeType = (typeof challengeTypes)[number];

export const propFirmNames = ["FTMO"] as const;
export type PropFirmName = (typeof propFirmNames)[number];

export const propPhases = ["Phase 1", "Phase 2", "Funded"] as const;
export type PropPhase = (typeof propPhases)[number];

export const propAccountStatuses = ["Active", "Passed", "Failed", "Funded", "Archived"] as const;
export type PropAccountStatus = (typeof propAccountStatuses)[number];

export type TradingAccount = {
  accountType: AccountType;
  accountName: string;
  strategyType: StrategyType;
  firmName?: PropFirmName;
  accountSize?: number;
  challengeType?: ChallengeType;
  phase?: PropPhase;
  profitTargetPercent?: number;
  dailyLossLimitPercent?: number;
  maxLossLimitPercent?: number;
  minimumTradingDays?: number;
  startDate?: string;
  propStatus?: PropAccountStatus;
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

export const playbooks = [
  "London Breakout Trendline",
  "NY Continuation",
  "Rectangle Range",
  "Supply Demand Reversal",
  "Trading Range Reversal",
  "TD9 Reversal",
  "TD13 Reversal",
  "Elliott Wave Continuation",
  "Other",
] as const;

export type Playbook = (typeof playbooks)[number];

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
  source?: TradeSource;
  accountId?: string;
  account_id?: string;
  brokerTradeIdentifier?: string;
  broker_trade_identifier?: string;
  positionId?: string;
  position_id?: string;
  dealId?: string;
  deal_id?: string;
  orderId?: string;
  order_id?: string;
  ticket?: string;
  accountType?: AccountType;
  accountName?: string;
  strategyType?: StrategyType;
  firmName?: PropFirmName;
  accountSize?: number;
  challengeType?: ChallengeType;
  phase?: PropPhase;
  profitTargetPercent?: number;
  dailyLossLimitPercent?: number;
  maxLossLimitPercent?: number;
  minimumTradingDays?: number;
  startDate?: string;
  propStatus?: PropAccountStatus;
  symbol: string;
  setup: string;
  setup_id?: string;
  setupTag: SetupTag;
  setup_tag?: SetupTag;
  playbook: Playbook;
  review_status?: string;
  trade_grade?: string;
  notes?: string;
  mistakes?: string[];
  lessons?: string;
  screenshots?: string[];
  emotional_state?: string;
  rule_followed?: boolean;
  rule_violations?: string[];
  tags?: string[];
  status: "Open" | "Closed";
  side: "Long" | "Short";
  date: string;
  session: "Asia" | "London" | "New York";
  openTime?: string;
  closeTime?: string;
  volume?: string;
  openPrice?: number;
  closePrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  commission?: number;
  swap?: number;
  rawImportPayload?: Record<string, string | number | undefined>;
  raw_import_payload?: Record<string, string | number | undefined>;
  importedAt?: string;
  imported_at?: string;
  importBatchId?: string;
  import_batch_id?: string;
  entry: number;
  exit: number;
  rr: number;
  pnl: number;
  floatingPnl?: number;
  result: "Win" | "Loss";
} & TradeJournal;

export type Mt5AccountReport = {
  sourceFile: string;
  accountId?: string;
  account_id?: string;
  accountType?: AccountType;
  accountName?: string;
  strategyType?: StrategyType;
  firmName?: PropFirmName;
  accountSize?: number;
  challengeType?: ChallengeType;
  phase?: PropPhase;
  profitTargetPercent?: number;
  dailyLossLimitPercent?: number;
  maxLossLimitPercent?: number;
  minimumTradingDays?: number;
  startDate?: string;
  propStatus?: PropAccountStatus;
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
