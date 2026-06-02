"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/app/_components/app-shell";
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

function percent(value: number) {
  return `${Math.max(0, value).toFixed(1)}%`;
}

function uniqueAccountNames(trades: Trade[], accountType: AccountType) {
  return Array.from(
    new Set(
      trades
        .filter((trade) => (trade.accountType ?? "Broker") === accountType)
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

function UsageCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-400">{label}</div>
        <div className="text-sm font-semibold text-slate-200">{percent(value)}</div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
        <div
          className={`h-2 rounded-full ${value >= 85 ? "bg-rose-400" : value >= 70 ? "bg-amber-300" : "bg-emerald-400"}`}
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

export function PropFirmDashboard() {
  const settings = useRiskSettings();
  const { accountReport, tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport: initialTradingReport,
    initialTrades: fallbackTradeHistory,
  });
  const accountNames = uniqueAccountNames(tradeHistory, "Prop Firm");
  const [accountName, setAccountName] = useState("");
  const trades = useMemo(
    () =>
      tradeHistory.filter(
        (trade) =>
          (trade.accountType ?? "Prop Firm") === "Prop Firm" &&
          (!accountName || trade.accountName === accountName),
      ),
    [accountName, tradeHistory],
  );
  const risk = buildRiskMetrics({
    report: accountReport,
    settings,
    trades,
  });

  return (
    <AppShell
      eyebrow="Prop Firm"
      title="Prop Firm Dashboard"
      action={<AccountSelector accountName={accountName} accountNames={accountNames} onChange={setAccountName} />}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="FTMO Risk Status" value={risk.riskLevel} />
        <MetricCard label="Discipline Score" value={`${risk.disciplineScore}/100`} />
        <UsageCard label="Daily Loss Usage" value={risk.dailyLossUsage} />
        <UsageCard label="Max Loss Usage" value={risk.maxLossUsage} />
        <UsageCard label="Profit Target Progress" value={risk.profitTargetProgress} />
      </section>
    </AppShell>
  );
}

export function BrokerTradingDashboard() {
  const { tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport: initialTradingReport,
    initialTrades: fallbackTradeHistory,
  });
  const accountNames = uniqueAccountNames(tradeHistory, "Broker");
  const [accountName, setAccountName] = useState("");
  const trades = useMemo(
    () =>
      tradeHistory.filter(
        (trade) =>
          (trade.accountType ?? "Broker") === "Broker" &&
          (!accountName || trade.accountName === accountName),
      ),
    [accountName, tradeHistory],
  );
  const closedTrades = trades.filter((trade) => trade.status !== "Open");
  const openPositions = trades.filter((trade) => trade.status === "Open");
  const netProfit = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const floatingPnl = openPositions.reduce((sum, trade) => sum + (trade.floatingPnl ?? 0), 0);

  return (
    <AppShell
      eyebrow="Broker Trading"
      title="Broker Trading Dashboard"
      action={<AccountSelector accountName={accountName} accountNames={accountNames} onChange={setAccountName} />}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Net Profit" value={money(netProfit)} tone={netProfit >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Open Positions" value={`${openPositions.length}`} />
        <MetricCard label="Floating P/L" value={money(floatingPnl)} tone={floatingPnl >= 0 ? "text-emerald-300" : "text-rose-300"} />
      </section>
      <div className="mt-6">
        <MonthlyTable rows={monthlyPerformance(trades)} />
      </div>
    </AppShell>
  );
}
