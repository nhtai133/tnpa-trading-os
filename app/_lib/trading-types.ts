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

export type Trade = {
  id: string;
  symbol: string;
  setup: string;
  side: "Long" | "Short";
  date: string;
  session: "Asia" | "London" | "New York";
  entry: number;
  exit: number;
  rr: number;
  pnl: number;
  result: "Win" | "Loss";
};

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
