"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  readStoredMt5Report,
  subscribeToStoredMt5Report,
} from "@/app/_lib/mt5-local-storage";
import { createTradingDataset } from "@/app/_lib/trading-metrics";
import type {
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  Trade,
} from "@/app/_lib/trading-types";

export function useTradingDataset({
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  initialReport,
  initialTrades,
}: {
  fallbackEquityCurve: EquityPoint[];
  fallbackMonthlyPerformance: MonthlyPerformance[];
  initialReport: Mt5AccountReport | null;
  initialTrades: Trade[];
}) {
  const storedReport = useSyncExternalStore(
    subscribeToStoredMt5Report,
    readStoredMt5Report,
    () => null,
  );

  return useMemo(() => {
    const report = storedReport ?? initialReport;
    const trades = report?.trades ?? initialTrades;

    return createTradingDataset({
      fallbackEquityCurve,
      fallbackMonthlyPerformance,
      report,
      trades,
    });
  }, [
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport,
    initialTrades,
    storedReport,
  ]);
}
