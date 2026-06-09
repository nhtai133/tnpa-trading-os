import type {
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  Trade,
} from "@/app/_lib/trading-types";

export const initialTradingReport: Mt5AccountReport | null = null;
export const fallbackTradeHistory: Trade[] = [];
export const fallbackEquityCurve: EquityPoint[] = [];
export const fallbackMonthlyPerformance: MonthlyPerformance[] = [];
