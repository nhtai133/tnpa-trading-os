import { buildKpis } from "@/app/_lib/trading-metrics";
import type {
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  Trade,
} from "@/app/_lib/trading-types";

export type { EquityPoint, Kpi, MonthlyPerformance, Trade } from "@/app/_lib/trading-types";

export const importedMt5Report: Mt5AccountReport | null = null;
export const tradeHistory: Trade[] = [];
export const recentTrades: Trade[] = [];
export const kpis = buildKpis(tradeHistory, importedMt5Report);
export const mockEquityCurveFallback: EquityPoint[] = [];
export const mockMonthlyPerformanceFallback: MonthlyPerformance[] = [];
export const equityCurve: EquityPoint[] = [];
export const monthlyPerformance: MonthlyPerformance[] = [];
