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
  rr: number;
  pnl: number;
  result: "Win" | "Loss";
};

export const kpis: Kpi[] = [
  {
    label: "Net Profit",
    value: "$48,920",
    change: "+18.4% YTD",
    tone: "positive",
  },
  {
    label: "Win Rate",
    value: "62.8%",
    change: "+4.1% vs last 30d",
    tone: "positive",
  },
  {
    label: "Profit Factor",
    value: "2.31",
    change: "Gross win/loss",
    tone: "neutral",
  },
  {
    label: "Average RR",
    value: "1.84R",
    change: "+0.22R vs plan",
    tone: "positive",
  },
  {
    label: "Max Drawdown",
    value: "7.6%",
    change: "-2.4% improved",
    tone: "negative",
  },
];

export const equityCurve: EquityPoint[] = [
  { label: "Jan", equity: 100000 },
  { label: "Feb", equity: 103450 },
  { label: "Mar", equity: 101980 },
  { label: "Apr", equity: 109720 },
  { label: "May", equity: 116480 },
  { label: "Jun", equity: 114900 },
  { label: "Jul", equity: 121600 },
  { label: "Aug", equity: 128240 },
  { label: "Sep", equity: 126700 },
  { label: "Oct", equity: 136100 },
  { label: "Nov", equity: 141380 },
  { label: "Dec", equity: 148920 },
];

export const monthlyPerformance: MonthlyPerformance[] = [
  { month: "Jan", pnl: 3450 },
  { month: "Feb", pnl: 6120 },
  { month: "Mar", pnl: -1470 },
  { month: "Apr", pnl: 7740 },
  { month: "May", pnl: 6760 },
  { month: "Jun", pnl: -1580 },
  { month: "Jul", pnl: 6700 },
  { month: "Aug", pnl: 6640 },
  { month: "Sep", pnl: -1540 },
  { month: "Oct", pnl: 9400 },
  { month: "Nov", pnl: 5280 },
  { month: "Dec", pnl: 7540 },
];

export const recentTrades: Trade[] = [
  {
    id: "TNPA-2491",
    symbol: "XAUUSD",
    setup: "London liquidity sweep",
    side: "Long",
    date: "May 29, 2026",
    rr: 2.6,
    pnl: 4280,
    result: "Win",
  },
  {
    id: "TNPA-2488",
    symbol: "EURUSD",
    setup: "NY continuation",
    side: "Short",
    date: "May 28, 2026",
    rr: 1.9,
    pnl: 2140,
    result: "Win",
  },
  {
    id: "TNPA-2482",
    symbol: "NAS100",
    setup: "Opening range failure",
    side: "Short",
    date: "May 27, 2026",
    rr: -1,
    pnl: -1250,
    result: "Loss",
  },
  {
    id: "TNPA-2475",
    symbol: "GBPJPY",
    setup: "HTF order block",
    side: "Long",
    date: "May 24, 2026",
    rr: 3.1,
    pnl: 3860,
    result: "Win",
  },
  {
    id: "TNPA-2468",
    symbol: "US30",
    setup: "Rejection at value high",
    side: "Short",
    date: "May 22, 2026",
    rr: -0.8,
    pnl: -980,
    result: "Loss",
  },
];
