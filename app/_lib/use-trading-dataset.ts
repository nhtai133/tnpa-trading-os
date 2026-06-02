"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  readStoredMt5Report,
  subscribeToStoredMt5Report,
} from "@/app/_lib/mt5-local-storage";
import {
  readManualTrades,
  subscribeToManualTrades,
} from "@/app/_lib/manual-trade-storage";
import {
  getDefaultPlaybook,
  readPlaybookOverrides,
  subscribeToPlaybookOverrides,
  type PlaybookOverrides,
} from "@/app/_lib/playbook-storage";
import {
  getDefaultSetupTag,
  readSetupTagOverrides,
  subscribeToSetupTagOverrides,
  type SetupTagOverrides,
} from "@/app/_lib/setup-tag-storage";
import {
  readTradeJournalOverrides,
  subscribeToTradeJournalOverrides,
  type TradeJournalOverrides,
} from "@/app/_lib/trade-journal-storage";
import { createTradingDataset } from "@/app/_lib/trading-metrics";
import type {
  AccountType,
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  StrategyType,
  TradeSource,
  Trade,
} from "@/app/_lib/trading-types";

const emptySetupTagOverrides: SetupTagOverrides = {};
const emptyPlaybookOverrides: PlaybookOverrides = {};
const emptyTradeJournalOverrides: TradeJournalOverrides = {};
const emptyManualTrades: Trade[] = [];

function defaultAccountType(source: TradeSource): AccountType {
  return source === "manual" ? "Broker" : "Prop Firm";
}

function defaultAccountName(source: TradeSource, report: Mt5AccountReport | null) {
  if (source === "manual") {
    return "ICMarkets Swing";
  }

  return report?.accountName ?? report?.name ?? "FTMO Intraweek";
}

function defaultStrategyType(source: TradeSource): StrategyType {
  return source === "manual" ? "Swing" : "Intraweek";
}

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
  const playbookOverrides = useSyncExternalStore(
    subscribeToPlaybookOverrides,
    readPlaybookOverrides,
    () => emptyPlaybookOverrides,
  );
  const tradeJournalOverrides = useSyncExternalStore(
    subscribeToTradeJournalOverrides,
    readTradeJournalOverrides,
    () => emptyTradeJournalOverrides,
  );
  const manualTrades = useSyncExternalStore(
    subscribeToManualTrades,
    readManualTrades,
    () => emptyManualTrades,
  );

  return useMemo(() => {
    const report = storedReport ?? initialReport;
    const mt5Trades = (report?.trades ?? initialTrades).map((trade) => ({
      ...trade,
      source: (trade.source ?? "mt5") as TradeSource,
      accountType: trade.accountType ?? report?.accountType,
      accountName: trade.accountName ?? report?.accountName,
      strategyType: trade.strategyType ?? report?.strategyType,
    }));
    const manualTradesWithSource = manualTrades.map((trade) => ({
      ...trade,
      source: (trade.source ?? "manual") as TradeSource,
    }));
    const trades = [...manualTradesWithSource, ...mt5Trades].map((trade) => {
      const setupTag =
        setupTagOverrides[trade.id] ??
        trade.setupTag ??
        getDefaultSetupTag(trade.setup);

      const source = trade.source ?? "mt5";

      return {
        ...trade,
        ...tradeJournalOverrides[trade.id],
        playbook:
          playbookOverrides[trade.id] ??
          trade.playbook ??
          getDefaultPlaybook(trade.setup, setupTag),
        setupTag,
        status: trade.status ?? "Closed",
        source,
        accountType: trade.accountType ?? defaultAccountType(source),
        accountName: trade.accountName ?? defaultAccountName(source, report),
        strategyType: trade.strategyType ?? defaultStrategyType(source),
      };
    });

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
    manualTrades,
    playbookOverrides,
    setupTagOverrides,
    storedReport,
    tradeJournalOverrides,
  ]);
}
