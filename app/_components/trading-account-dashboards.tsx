"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  emptyPropAccounts,
  readStoredPropAccounts,
  subscribeToPropAccounts,
} from "@/app/_lib/prop-account-storage";
import { buildRiskMetrics } from "@/app/_lib/risk-metrics";
import { useRiskSettings } from "@/app/_lib/use-risk-settings";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import {
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  fallbackTradeHistory,
  initialTradingReport,
} from "@/app/_lib/trading-client-data";
import type { AccountType, MonthlyPerformance, Trade } from "@/app/_lib/trading-types";

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function plainMoney(value: number) {
  return `$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function percent(value: number) {
  return `${Math.max(0, value).toFixed(1)}%`;
}

function uniqueAccountNames(trades: Trade[], accountType: AccountType) {
  return Array.from(
    new Set(
      trades
        .filter((trade) => (trade.accountType ?? "broker") === accountType)
        .map((trade) => trade.accountName ?? "Unassigned"),
    ),
  ).sort();
}

function monthlyPerformance(trades: Trade[]): MonthlyPerformance[] {
  const grouped = new Map<string, number>();

  trades
    .filter((trade) => trade.status !== "Open")
    .forEach((trade) => {
      const month = trade.date.split(" ")[0] || "Unknown";
      grouped.set(month, (grouped.get(month) ?? 0) + trade.pnl);
    });

  return Array.from(grouped.entries()).map(([month, pnl]) => ({ month, pnl }));
}

function countTradingDays(trades: Trade[]) {
  return new Set(
    trades
      .filter((trade) => trade.status !== "Open")
      .map((trade) => trade.date.split(",")[0] || trade.date),
  ).size;
}

function nextPropAction({
  canTradeToday,
  phase,
  profitTargetProgress,
  riskLevel,
}: {
  canTradeToday: string;
  phase: string;
  profitTargetProgress: number;
  riskLevel: string;
}) {
  if (canTradeToday === "Stop") return "Stop Trading Today";
  if (riskLevel === "Breach" || riskLevel === "Danger") return "Rule Danger";
  if (phase === "Funded" && profitTargetProgress >= 10) return "Payout Ready";
  if (profitTargetProgress >= 100) return "Ready For Funded";
  if (profitTargetProgress >= 90) return "Close To Passing";
  return "Keep Trading";
}

function MetricCard({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className={`mt-3 text-2xl font-semibold ${tone}`}>{value}</div>
    </section>
  );
}

function BadgeCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-md border border-emerald-300/20 bg-emerald-400/10 p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-emerald-200">{label}</div>
      <div className="mt-3 inline-flex rounded-full border border-emerald-300/30 px-3 py-1 text-sm font-semibold text-emerald-100">
        {value}
      </div>
    </section>
  );
}

function AccountSelector({
  accountName,
  accountNames,
  onChange,
}: {
  accountName: string;
  accountNames: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Account
      </span>
      <select
        className="h-10 rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
        value={accountName}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All Accounts</option>
        {accountNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProgressCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-400">{label}</div>
        <div className="text-sm font-semibold text-slate-200">{percent(value)}</div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
        <div
          className={`h-2 rounded-full ${value >= 100 ? "bg-emerald-400" : value >= 70 ? "bg-amber-300" : "bg-sky-400"}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </section>
  );
}

function MonthlyTable({ rows }: { rows: MonthlyPerformance[] }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <h2 className="text-base font-semibold text-white">Monthly Performance</h2>
      <div className="mt-5 space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <div className="flex items-center justify-between gap-4" key={row.month}>
              <div className="text-sm font-medium text-slate-200">{row.month}</div>
              <div className={`text-sm font-semibold ${row.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {money(row.pnl)}
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-500">No closed trades for this account.</div>
        )}
      </div>
    </section>
  );
}

export function PropTradingDashboard() {
  const settings = useRiskSettings();
  const { accountReport, tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport: initialTradingReport,
    initialTrades: fallbackTradeHistory,
  });
  const propAccounts = useSyncExternalStore(
    subscribeToPropAccounts,
    readStoredPropAccounts,
    () => emptyPropAccounts,
  );
  const registryNames = propAccounts.map((account) => account.accountName);
  const accountNames = registryNames.length
    ? registryNames
    : uniqueAccountNames(tradeHistory, "prop-firm");
  const [accountName, setAccountName] = useState("");
  const selectedAccountName = accountName || accountNames[0] || "";
  const selectedRegistryAccount =
    propAccounts.find((account) => account.accountName === selectedAccountName) ?? null;
  const trades = useMemo(
    () =>
      tradeHistory.filter(
        (trade) =>
          (trade.accountType ?? "prop-firm") === "prop-firm" &&
          (!selectedAccountName || trade.accountName === selectedAccountName),
      ),
    [selectedAccountName, tradeHistory],
  );
  const selected = trades[0];
  const risk = buildRiskMetrics({ report: accountReport, settings, trades });
  const accountSize = selectedRegistryAccount?.accountSize ?? selected?.accountSize ?? accountReport?.accountSize ?? risk.accountBalance;
  const profitTargetPercent = selectedRegistryAccount?.profitTargetPercent ?? selected?.profitTargetPercent ?? 10;
  const dailyLossLimitPercent = selectedRegistryAccount?.dailyLossLimitPercent ?? selected?.dailyLossLimitPercent ?? 5;
  const maxLossLimitPercent = selectedRegistryAccount?.maxLossLimitPercent ?? selected?.maxLossLimitPercent ?? 10;
  const minimumTradingDays = selectedRegistryAccount?.minimumTradingDays ?? selected?.minimumTradingDays ?? 4;
  const tradingDays = countTradingDays(trades);
  const profitTarget = accountSize * (profitTargetPercent / 100);
  const profitTargetProgress = profitTarget === 0 ? 0 : (risk.closedNetProfit / profitTarget) * 100;
  const dailyLossLimit = accountSize * (dailyLossLimitPercent / 100);
  const maxLossLimit = accountSize * (maxLossLimitPercent / 100);
  const dailyLossRemaining = Math.max(0, dailyLossLimit - Math.max(0, -risk.dailyPnl));
  const maxLossRemaining = Math.max(0, maxLossLimit - Math.max(0, risk.currentDrawdown));
  const canTradeToday = risk.dailyLossUsage >= 100 || risk.riskLevel === "Breach" ? "Stop" : risk.dailyLossUsage >= 70 ? "Warning" : "Yes";
  const nextAction = nextPropAction({
    canTradeToday,
    phase: selectedRegistryAccount?.phase ?? selected?.phase ?? "Phase 1",
    profitTargetProgress,
    riskLevel: risk.riskLevel,
  });

  return (
    <AppShell
      eyebrow="FTMO OS"
      title="FTMO Dashboard"
      action={<AccountSelector accountName={selectedAccountName} accountNames={accountNames} onChange={setAccountName} />}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Account Size" value={plainMoney(accountSize)} />
        <BadgeCard label="Firm" value={selectedRegistryAccount?.firmName ?? selected?.firmName ?? "FTMO"} />
        <BadgeCard label="Challenge Type" value={selectedRegistryAccount?.challengeType ?? selected?.challengeType ?? "FTMO Challenge V2"} />
        <BadgeCard label="Phase" value={selectedRegistryAccount?.phase ?? selected?.phase ?? "Phase 1"} />
        <MetricCard label="Status" value={selectedRegistryAccount?.status ?? selected?.propStatus ?? "Active"} />
        <MetricCard
          label="Can Trade Today"
          value={canTradeToday}
          tone={canTradeToday === "Stop" ? "text-rose-300" : canTradeToday === "Warning" ? "text-amber-300" : "text-emerald-300"}
        />
        <MetricCard label="Next Action" value={nextAction} tone={nextAction.includes("Stop") || nextAction.includes("Danger") ? "text-rose-300" : "text-emerald-300"} />
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressCard label="Profit Target Progress" value={profitTargetProgress} />
        <MetricCard label="Daily Loss Remaining" value={plainMoney(dailyLossRemaining)} />
        <MetricCard label="Max Loss Remaining" value={plainMoney(maxLossRemaining)} />
        <ProgressCard label="Trading Days Progress" value={(tradingDays / Math.max(1, minimumTradingDays)) * 100} />
        <MetricCard label="Discipline Score" value={`${risk.disciplineScore}/100`} />
      </section>
    </AppShell>
  );
}

export function PersonalTradingDashboard() {
  const { tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport: initialTradingReport,
    initialTrades: fallbackTradeHistory,
  });
  const accountNames = uniqueAccountNames(tradeHistory, "broker");
  const [accountName, setAccountName] = useState("");
  const trades = useMemo(
    () =>
      tradeHistory.filter(
        (trade) =>
          (trade.accountType ?? "broker") === "broker" &&
          (!accountName || trade.accountName === accountName),
      ),
    [accountName, tradeHistory],
  );
  const closedTrades = trades.filter((trade) => trade.status !== "Open");
  const openPositions = trades.filter((trade) => trade.status === "Open");
  const netProfit = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const floatingPnl = openPositions.reduce((sum, trade) => sum + (trade.floatingPnl ?? 0), 0);
  const monthlyRows = monthlyPerformance(trades);
  const latestMonthlyReturn = monthlyRows.at(-1)?.pnl ?? 0;
  const swingTrades = trades.filter((trade) => trade.strategyType === "Swing");
  const intraweekTrades = trades.filter((trade) => trade.strategyType === "Intraweek");

  return (
    <AppShell
      eyebrow="Personal Trading OS"
      title="Personal Trading"
      action={<AccountSelector accountName={accountName} accountNames={accountNames} onChange={setAccountName} />}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Net Profit" value={money(netProfit)} tone={netProfit >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Monthly Return" value={money(latestMonthlyReturn)} tone={latestMonthlyReturn >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Open Positions" value={`${openPositions.length}`} />
        <MetricCard label="Floating P/L" value={money(floatingPnl)} tone={floatingPnl >= 0 ? "text-emerald-300" : "text-rose-300"} />
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <MetricCard label="Swing Trades" value={`${swingTrades.length}`} />
        <MetricCard label="Intraweek Trades" value={`${intraweekTrades.length}`} />
      </section>
      <div className="mt-6">
        <MonthlyTable rows={monthlyRows} />
      </div>
    </AppShell>
  );
}

export const PropFirmDashboard = PropTradingDashboard;
export const BrokerTradingDashboard = PersonalTradingDashboard;
