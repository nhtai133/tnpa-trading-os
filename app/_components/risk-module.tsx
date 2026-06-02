"use client";

import { useState, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  emptyPropAccounts,
  readStoredPropAccounts,
  subscribeToPropAccounts,
} from "@/app/_lib/prop-account-storage";
import { buildRiskMetrics, type DailyRiskMetric } from "@/app/_lib/risk-metrics";
import { useRiskSettings } from "@/app/_lib/use-risk-settings";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import type {
  AccountType,
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  RiskLevel,
  Trade,
} from "@/app/_lib/trading-types";

function money(value: number) {
  const sign = value >= 0 ? "" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function signedMoney(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function percent(value: number) {
  return `${Math.max(0, value).toFixed(1)}%`;
}

function riskTone(level: RiskLevel) {
  if (level === "Breach") {
    return "border-rose-300/30 bg-rose-400/10 text-rose-200";
  }

  if (level === "Danger") {
    return "border-orange-300/30 bg-orange-400/10 text-orange-200";
  }

  if (level === "Warning") {
    return "border-amber-300/30 bg-amber-400/10 text-amber-200";
  }

  return "border-emerald-300/30 bg-emerald-400/10 text-emerald-200";
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className={`mt-3 text-2xl font-semibold ${tone ?? "text-white"}`}>
        {value}
      </div>
    </section>
  );
}

function UsageCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const level = value >= 100 ? "Breach" : value >= 85 ? "Danger" : value >= 70 ? "Warning" : "Safe";

  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-400">{label}</div>
        <div className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${riskTone(level)}`}>
          {level}
        </div>
      </div>
      <div className="mt-4 text-2xl font-semibold text-white">{percent(value)}</div>
      <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
        <div
          className={`h-2 rounded-full ${
            value >= 85 ? "bg-rose-400" : value >= 70 ? "bg-amber-300" : "bg-emerald-400"
          }`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </section>
  );
}

function Heatmap({ days }: { days: DailyRiskMetric[] }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <h2 className="text-base font-semibold text-white">Daily P/L Heatmap</h2>
      <div className="mt-5 grid grid-cols-7 gap-2">
        {days.slice(0, 42).map((day) => {
          const positive = day.pnl >= 0;
          const intensity = Math.min(1, Math.abs(day.dailyLossUsage) / 100);

          return (
            <div
              className={`aspect-square rounded-md border border-white/10 p-2 text-[10px] font-semibold ${
                positive ? "text-emerald-100" : "text-rose-100"
              }`}
              key={day.date}
              style={{
                background: positive
                  ? `rgba(52, 211, 153, ${0.12 + intensity * 0.35})`
                  : `rgba(251, 113, 133, ${0.12 + intensity * 0.45})`,
              }}
              title={`${day.date}: ${signedMoney(day.pnl)}`}
            >
              <div className="truncate">{day.date.split(",")[0]}</div>
              <div className="mt-1 truncate">{signedMoney(day.pnl)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function RiskModule({
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  initialReport,
  initialTrades,
  scopeAccountType,
  title = "Risk Monitor",
  eyebrow = "FTMO Discipline Layer",
}: {
  fallbackEquityCurve: EquityPoint[];
  fallbackMonthlyPerformance: MonthlyPerformance[];
  initialReport: Mt5AccountReport | null;
  initialTrades: Trade[];
  scopeAccountType?: AccountType;
  title?: string;
  eyebrow?: string;
}) {
  const settings = useRiskSettings();
  const { accountReport, tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport,
    initialTrades,
  });
  const propAccounts = useSyncExternalStore(
    subscribeToPropAccounts,
    readStoredPropAccounts,
    () => emptyPropAccounts,
  );
  const registryAccountNames = propAccounts.map((account) => account.accountName);
  const [selectedRegistryAccountName, setSelectedRegistryAccountName] = useState("");
  const activeRegistryAccountName =
    scopeAccountType === "prop-firm"
      ? selectedRegistryAccountName || registryAccountNames[0] || ""
      : "";
  const scopedTradeHistory = scopeAccountType
    ? tradeHistory.filter(
        (trade) =>
          trade.accountType === scopeAccountType &&
          (!activeRegistryAccountName || trade.accountName === activeRegistryAccountName),
      )
    : tradeHistory;
  const riskTrades = scopedTradeHistory.filter((trade) => {
    const source = String(trade.source ?? "mt5");
    return source === "mt5" || (source === "manual" && trade.status === "Open");
  });
  const risk = buildRiskMetrics({
    report: accountReport,
    settings,
    trades: riskTrades,
  });
  const mt5Trades = scopedTradeHistory.filter((trade) => String(trade.source ?? "mt5") === "mt5");
  const manualTrades = scopedTradeHistory.filter((trade) => String(trade.source ?? "mt5") === "manual");
  const manualOpenTrades = manualTrades.filter((trade) => trade.status === "Open");
  const manualClosedTrades = manualTrades.filter((trade) => trade.status !== "Open");
  const selectedPropAccount =
    scopeAccountType === "prop-firm"
      ? propAccounts.find((account) => account.accountName === activeRegistryAccountName) ?? null
      : null;
  const selectedPropTrade = scopeAccountType === "prop-firm" ? scopedTradeHistory[0] : null;

  return (
    <AppShell
      eyebrow={eyebrow}
      title={title}
      action={
        <div className="flex flex-wrap items-center gap-3">
          {scopeAccountType === "prop-firm" && registryAccountNames.length ? (
            <label className="block">
              <span className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Prop Account
              </span>
              <select
                className="h-10 rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                value={activeRegistryAccountName}
                onChange={(event) => setSelectedRegistryAccountName(event.target.value)}
              >
                {registryAccountNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className={`rounded-md border px-4 py-2 text-sm font-semibold ${riskTone(risk.riskLevel)}`}>
            {risk.riskLevel}
          </div>
        </div>
      }
    >
      {selectedPropAccount || selectedPropTrade ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Challenge Status" value={selectedPropAccount?.status ?? selectedPropTrade?.propStatus ?? "Active"} />
          <MetricCard label="Challenge Type" value={selectedPropAccount?.challengeType ?? selectedPropTrade?.challengeType ?? "2-Step Challenge"} />
          <MetricCard label="Phase" value={selectedPropAccount?.phase ?? selectedPropTrade?.phase ?? "Phase 1"} />
          <MetricCard label="Account Size" value={money(selectedPropAccount?.accountSize ?? selectedPropTrade?.accountSize ?? risk.accountBalance)} />
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Account Balance" value={money(risk.accountBalance)} />
        <MetricCard label="Equity" value={money(risk.equity)} />
        <MetricCard
          label="Closed Net Profit"
          value={signedMoney(risk.closedNetProfit)}
          tone={risk.closedNetProfit >= 0 ? "text-emerald-300" : "text-rose-300"}
        />
        <MetricCard
          label="Floating P/L"
          value={signedMoney(risk.floatingPnl)}
          tone={risk.floatingPnl >= 0 ? "text-emerald-300" : "text-rose-300"}
        />
        <MetricCard label="Peak Equity" value={money(risk.peakEquity)} />
        <MetricCard label="Max Daily Loss" value={money(risk.maxDailyLoss)} />
        <MetricCard label="Max Total Drawdown" value={money(risk.maxTotalDrawdown)} />
        <MetricCard label="Current Drawdown" value={money(risk.currentDrawdown)} />
        <MetricCard
          label="Daily P/L"
          value={signedMoney(risk.dailyPnl)}
          tone={risk.dailyPnl >= 0 ? "text-emerald-300" : "text-rose-300"}
        />
        <MetricCard label="Best Day" value={risk.bestDay ? signedMoney(risk.bestDay.pnl) : "$0"} />
        <MetricCard label="Worst Day" value={risk.worstDay ? signedMoney(risk.worstDay.pnl) : "$0"} />
        <MetricCard label="Risk Status" value={risk.riskLevel} />
        <MetricCard label="FTMO Discipline Score" value={`${risk.disciplineScore}/100`} />
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="MT5 Trades" value={String(mt5Trades.length)} />
        <MetricCard label="Manual Trades" value={String(manualTrades.length)} />
        <MetricCard label="Manual Open Positions" value={String(manualOpenTrades.length)} />
        <MetricCard label="Manual Closed Trades" value={String(manualClosedTrades.length)} />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-4">
        <UsageCard label="Daily Loss Usage" value={risk.dailyLossUsage} />
        <UsageCard label="Max Loss Usage" value={risk.maxLossUsage} />
        <UsageCard label="Profit Target Progress" value={risk.profitTargetProgress} />
        <section className={`rounded-md border p-5 shadow-2xl shadow-black/20 ${riskTone(risk.riskLevel)}`}>
          <div className="text-sm font-medium">Risk Level</div>
          <div className="mt-3 text-3xl font-semibold">{risk.riskLevel}</div>
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em]">
            Rules {settings.dailyLossLimitPercent}% daily / {settings.maxLossLimitPercent}% max / {settings.profitTargetPercent}% target
          </div>
        </section>
      </section>

      {risk.warnings.length > 0 ? (
        <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
          <h2 className="text-base font-semibold text-white">Risk Warnings</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {risk.warnings.map((warning) => (
              <div
                className={`rounded-md border p-4 text-sm ${riskTone(warning.level)}`}
                key={`${warning.label}-${warning.detail}`}
              >
                <div className="font-semibold">{warning.label}</div>
                <div className="mt-1 opacity-85">{warning.detail}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-base font-semibold text-white">Daily Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Date</th>
                  <th className="px-5 py-4 font-semibold">Closed P/L</th>
                  <th className="px-5 py-4 font-semibold">Trades</th>
                  <th className="px-5 py-4 font-semibold">Win Rate</th>
                  <th className="px-5 py-4 font-semibold">Daily Loss Usage</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {risk.dailyMetrics.slice(0, 14).map((day) => (
                  <tr className="text-slate-300" key={day.date}>
                    <td className="px-5 py-4 font-semibold text-white">{day.date}</td>
                    <td className={`px-5 py-4 font-semibold ${day.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {signedMoney(day.pnl)}
                    </td>
                    <td className="px-5 py-4">{day.trades}</td>
                    <td className="px-5 py-4">{percent(day.winRate)}</td>
                    <td className="px-5 py-4">{percent(day.dailyLossUsage)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${riskTone(day.status)}`}>
                        {day.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Heatmap days={risk.dailyMetrics} />
      </section>
    </AppShell>
  );
}
