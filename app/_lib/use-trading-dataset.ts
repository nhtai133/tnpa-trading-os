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
  ChallengeType,
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  PropAccountStatus,
  PropFirmName,
  PropPhase,
  StrategyType,
  TradeSource,
  Trade,
} from "@/app/_lib/trading-types";

const emptySetupTagOverrides: SetupTagOverrides = {};
const emptyPlaybookOverrides: PlaybookOverrides = {};
const emptyTradeJournalOverrides: TradeJournalOverrides = {};
const emptyManualTrades: Trade[] = [];

function normalizeAccountType(value: unknown, source: TradeSource): AccountType {
  if (value === "prop-firm" || value === "Prop Firm") {
    return "prop-firm";
  }

  if (value === "broker" || value === "Broker") {
    return "broker";
  }

  return source === "manual" ? "broker" : "prop-firm";
}

function defaultAccountName(source: TradeSource, report: Mt5AccountReport | null) {
  if (source === "manual") {
    return "ICMarkets";
  }

  return report?.accountName ?? report?.firmName ?? report?.name ?? "FTMO";
}

function defaultStrategyType(source: TradeSource): StrategyType {
  return source === "manual" ? "Swing" : "Intraweek";
}

function defaultPropFirmName(report: Mt5AccountReport | null): PropFirmName {
  return report?.firmName ?? "FTMO";
}

function defaultChallengeType(report: Mt5AccountReport | null): ChallengeType {
  return report?.challengeType ?? "FTMO Challenge V2";
}

function defaultPhase(report: Mt5AccountReport | null): PropPhase {
  return report?.phase ?? "Phase 1";
}

function defaultPropStatus(report: Mt5AccountReport | null): PropAccountStatus {
  return report?.propStatus ?? "Active";
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
      firmName: trade.firmName ?? report?.firmName,
      accountSize: trade.accountSize ?? report?.accountSize,
      challengeType: trade.challengeType ?? report?.challengeType,
      phase: trade.phase ?? report?.phase,
      profitTargetPercent: trade.profitTargetPercent ?? report?.profitTargetPercent,
      dailyLossLimitPercent: trade.dailyLossLimitPercent ?? report?.dailyLossLimitPercent,
      maxLossLimitPercent: trade.maxLossLimitPercent ?? report?.maxLossLimitPercent,
      minimumTradingDays: trade.minimumTradingDays ?? report?.minimumTradingDays,
      startDate: trade.startDate ?? report?.startDate,
      propStatus: trade.propStatus ?? report?.propStatus,
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

      const accountType = normalizeAccountType(trade.accountType, source);

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
        accountType,
        accountName: trade.accountName ?? defaultAccountName(source, report),
        strategyType: trade.strategyType ?? defaultStrategyType(source),
        firmName: accountType === "prop-firm" ? trade.firmName ?? defaultPropFirmName(report) : undefined,
        accountSize: accountType === "prop-firm" ? trade.accountSize ?? report?.accountSize ?? 100000 : undefined,
        challengeType: accountType === "prop-firm" ? trade.challengeType ?? defaultChallengeType(report) : undefined,
        phase: accountType === "prop-firm" ? trade.phase ?? defaultPhase(report) : undefined,
        profitTargetPercent: accountType === "prop-firm" ? trade.profitTargetPercent ?? report?.profitTargetPercent ?? 10 : undefined,
        dailyLossLimitPercent: accountType === "prop-firm" ? trade.dailyLossLimitPercent ?? report?.dailyLossLimitPercent ?? 5 : undefined,
        maxLossLimitPercent: accountType === "prop-firm" ? trade.maxLossLimitPercent ?? report?.maxLossLimitPercent ?? 10 : undefined,
        minimumTradingDays: accountType === "prop-firm" ? trade.minimumTradingDays ?? report?.minimumTradingDays ?? 4 : undefined,
        startDate: accountType === "prop-firm" ? trade.startDate ?? report?.startDate : undefined,
        propStatus: accountType === "prop-firm" ? trade.propStatus ?? defaultPropStatus(report) : undefined,
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
