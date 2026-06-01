"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  readStoredMt5Report,
  subscribeToStoredMt5Report,
} from "@/app/_lib/mt5-local-storage";
import {
  getDefaultSetupTag,
  readSetupTagOverrides,
  subscribeToSetupTagOverrides,
  type SetupTagOverrides,
} from "@/app/_lib/setup-tag-storage";
import { createTradingDataset } from "@/app/_lib/trading-metrics";
import type {
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  Trade,
} from "@/app/_lib/trading-types";

const emptySetupTagOverrides: SetupTagOverrides = {};

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
  const setupTagOverrides = useSyncExternalStore(
    subscribeToSetupTagOverrides,
    readSetupTagOverrides,
    () => emptySetupTagOverrides,
  );

  return useMemo(() => {
    const report = storedReport ?? initialReport;
    const trades = (report?.trades ?? initialTrades).map((trade) => ({
      ...trade,
      setupTag:
        setupTagOverrides[trade.id] ??
        trade.setupTag ??
        getDefaultSetupTag(trade.setup),
    }));

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
    setupTagOverrides,
    storedReport,
  ]);
}
