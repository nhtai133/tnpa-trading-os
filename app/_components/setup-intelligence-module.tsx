"use client";

import { useState, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  emptyPropAccounts,
  readStoredPropAccounts,
  subscribeToPropAccounts,
} from "@/app/_lib/prop-account-storage";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import type {
  ChallengeType,
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  PropPhase,
  SetupTag,
  Trade,
} from "@/app/_lib/trading-types";

type SetupMetric = {
  setup: SetupTag;
  trades: number;
  winRate: number;
  profitFactor: number;
  netProfit: number;
  averageR: number;
  expectancy: number;
  maxDrawdown: number;
  rating: "Elite" | "Good" | "Neutral" | "Weak" | "Avoid";
};

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function parseTradeDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinDateRange(trade: Trade, startDate: string, endDate: string) {
  const tradeDate = parseTradeDate(trade.date);
  if (!tradeDate) return true;

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (tradeDate < start) return false;
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`);
    if (tradeDate > end) return false;
  }

  return true;
}

function profitFactor(trades: Trade[]) {
  const grossProfit = trades
    .filter((trade) => trade.pnl > 0)
    .reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(
    trades
      .filter((trade) => trade.pnl < 0)
      .reduce((sum, trade) => sum + trade.pnl, 0),
  );

  if (grossLoss === 0) return grossProfit > 0 ? 99 : 0;
  return grossProfit / grossLoss;
}

function maxDrawdown(trades: Trade[]) {
  let equity = 0;
  let peak = 0;
  let maxDrop = 0;

  trades.forEach((trade) => {
    equity += trade.pnl;
    peak = Math.max(peak, equity);
    maxDrop = Math.max(maxDrop, peak - equity);
  });

  return maxDrop;
}

function ratingForSetup(metric: Omit<SetupMetric, "rating">): SetupMetric["rating"] {
  if (metric.expectancy > 1000 && metric.profitFactor >= 2 && metric.winRate >= 55) return "Elite";
  if (metric.expectancy > 0 && metric.profitFactor >= 1.4) return "Good";
  if (metric.expectancy >= 0 && metric.profitFactor >= 1) return "Neutral";
  if (metric.expectancy < 0 && metric.profitFactor < 1) return "Avoid";
  return "Weak";
}

function badgeTone(rating: string) {
  if (rating === "Elite") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-200";
  if (rating === "Good") return "border-cyan-300/30 bg-cyan-400/10 text-cyan-200";
  if (rating === "Neutral") return "border-slate-300/20 bg-slate-400/10 text-slate-200";
  if (rating === "Weak") return "border-amber-300/30 bg-amber-400/10 text-amber-200";
  return "border-rose-300/30 bg-rose-400/10 text-rose-200";
}

function RatingBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeTone(value)}`}>
      {value}
    </span>
  );
}

function buildSetupMetrics(trades: Trade[]) {
  const grouped = new Map<SetupTag, Trade[]>();
  trades.forEach((trade) => {
    grouped.set(trade.setupTag, [...(grouped.get(trade.setupTag) ?? []), trade]);
  });

  return Array.from(grouped.entries())
    .map<SetupMetric>(([setup, setupTrades]) => {
      const netProfit = setupTrades.reduce((sum, trade) => sum + trade.pnl, 0);
      const base = {
        setup,
        trades: setupTrades.length,
        winRate: (setupTrades.filter((trade) => trade.result === "Win").length / Math.max(1, setupTrades.length)) * 100,
        profitFactor: profitFactor(setupTrades),
        netProfit,
        averageR: setupTrades.reduce((sum, trade) => sum + trade.rr, 0) / Math.max(1, setupTrades.length),
        expectancy: netProfit / Math.max(1, setupTrades.length),
        maxDrawdown: maxDrawdown(setupTrades),
      };

      return {
        ...base,
        rating: ratingForSetup(base),
      };
    })
    .sort((a, b) => {
      if (b.expectancy !== a.expectancy) return b.expectancy - a.expectancy;
      return b.profitFactor - a.profitFactor;
    });
}

function uniqueValues<T extends string>(values: Array<T | undefined>) {
  return Array.from(new Set(values.filter(Boolean))).sort() as T[];
}

function MetricCard({
  label,
  sublabel,
  value,
}: {
  label: string;
  sublabel: string;
  value: string;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {sublabel}
      </div>
    </section>
  );
}

export function SetupIntelligenceModule({
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
  const propAccounts = useSyncExternalStore(
    subscribeToPropAccounts,
    readStoredPropAccounts,
    () => emptyPropAccounts,
  );
  const { tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport,
    initialTrades,
  });
  const [accountName, setAccountName] = useState("");
  const [challengeType, setChallengeType] = useState("");
  const [phase, setPhase] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const propTrades = tradeHistory.filter((trade) => (trade.accountType ?? "prop-firm") === "prop-firm");
  const accountOptions = propAccounts.length
    ? propAccounts.map((account) => account.accountName)
    : uniqueValues(propTrades.map((trade) => trade.accountName));
  const challengeOptions = uniqueValues<ChallengeType>([
    ...propAccounts.map((account) => account.challengeType),
    ...propTrades.map((trade) => trade.challengeType),
  ]);
  const phaseOptions = uniqueValues<PropPhase>([
    ...propAccounts.map((account) => account.phase),
    ...propTrades.map((trade) => trade.phase),
  ]);
  const filteredTrades = propTrades.filter((trade) => {
    const registryAccount = propAccounts.find((account) => account.accountName === trade.accountName);
    const effectiveChallengeType = registryAccount?.challengeType ?? trade.challengeType;
    const effectivePhase = registryAccount?.phase ?? trade.phase;

    return (
      trade.status !== "Open" &&
      (!accountName || trade.accountName === accountName) &&
      (!challengeType || effectiveChallengeType === challengeType) &&
      (!phase || effectivePhase === phase) &&
      isWithinDateRange(trade, startDate, endDate)
    );
  });
  const setupMetrics = buildSetupMetrics(filteredTrades);
  const bestSetup = setupMetrics[0] ?? null;
  const worstSetup = [...setupMetrics].sort((a, b) => a.expectancy - b.expectancy)[0] ?? null;
  const avoidSetups = setupMetrics.filter((metric) => metric.rating === "Avoid");
  const weakSetups = setupMetrics.filter((metric) => metric.rating === "Weak");

  return (
    <AppShell eyebrow="FTMO OS" title="Setup Intelligence">
      <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              FTMO Account
            </span>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
            >
              <option value="">All Accounts</option>
              {accountOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Challenge Type
            </span>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              value={challengeType}
              onChange={(event) => setChallengeType(event.target.value)}
            >
              <option value="">All</option>
              {challengeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Phase
            </span>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              value={phase}
              onChange={(event) => setPhase(event.target.value)}
            >
              <option value="">All</option>
              {phaseOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Start Date
            </span>
            <input
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              End Date
            </span>
            <input
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <MetricCard
          label="Best Setup"
          value={bestSetup?.setup ?? "None"}
          sublabel={bestSetup ? `${money(bestSetup.expectancy)} expectancy / PF ${bestSetup.profitFactor.toFixed(2)}` : "No closed trades"}
        />
        <MetricCard
          label="Worst Setup"
          value={worstSetup?.setup ?? "None"}
          sublabel={worstSetup ? `${money(worstSetup.expectancy)} expectancy / PF ${worstSetup.profitFactor.toFixed(2)}` : "No closed trades"}
        />
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <h2 className="text-base font-semibold text-white">Dashboard Insights</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
            {bestSetup ? `${bestSetup.setup} is your highest expectancy setup.` : "No setup data available yet."}
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
            {weakSetups[0] ? `${weakSetups[0].setup} has negative or fragile expectancy.` : "No weak setup detected in this filter."}
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
            {avoidSetups[0] ? `Avoid ${avoidSetups[0].setup} until performance improves.` : "No avoid-rated setup detected."}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-base font-semibold text-white">Setup Performance</h2>
          <p className="mt-1 text-sm text-slate-500">
            {filteredTrades.length} closed FTMO trades match the current filters.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Setup</th>
                <th className="px-5 py-4 font-semibold">Trades</th>
                <th className="px-5 py-4 font-semibold">Win Rate</th>
                <th className="px-5 py-4 font-semibold">Profit Factor</th>
                <th className="px-5 py-4 font-semibold">Net Profit</th>
                <th className="px-5 py-4 font-semibold">Avg R</th>
                <th className="px-5 py-4 font-semibold">Expectancy</th>
                <th className="px-5 py-4 font-semibold">Max Drawdown</th>
                <th className="px-5 py-4 font-semibold">Badge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {setupMetrics.map((metric) => (
                <tr className="text-slate-300" key={metric.setup}>
                  <td className="px-5 py-4 font-semibold text-white">{metric.setup}</td>
                  <td className="px-5 py-4">{metric.trades}</td>
                  <td className="px-5 py-4">{percent(metric.winRate)}</td>
                  <td className="px-5 py-4">{metric.profitFactor >= 99 ? "No losses" : metric.profitFactor.toFixed(2)}</td>
                  <td className={`px-5 py-4 font-semibold ${metric.netProfit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{money(metric.netProfit)}</td>
                  <td className="px-5 py-4">{metric.averageR.toFixed(2)}R</td>
                  <td className={`px-5 py-4 font-semibold ${metric.expectancy >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{money(metric.expectancy)}</td>
                  <td className="px-5 py-4 text-rose-200">{money(-metric.maxDrawdown)}</td>
                  <td className="px-5 py-4"><RatingBadge value={metric.rating} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <h2 className="text-base font-semibold text-white">Setup Ranking</h2>
        <div className="mt-5 space-y-3">
          {setupMetrics.map((metric, index) => (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3" key={metric.setup}>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400/10 text-sm font-semibold text-emerald-300">
                  {index + 1}
                </div>
                <div>
                  <div className="font-semibold text-white">{metric.setup}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Ranked by expectancy, then profit factor
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-sm">
                  <div className="font-semibold text-emerald-300">{money(metric.expectancy)}</div>
                  <div className="text-slate-500">PF {metric.profitFactor >= 99 ? "No losses" : metric.profitFactor.toFixed(2)}</div>
                </div>
                <RatingBadge value={metric.rating} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
