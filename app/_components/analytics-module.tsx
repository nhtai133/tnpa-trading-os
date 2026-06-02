"use client";

import { AppShell } from "@/app/_components/app-shell";
import { useState, useSyncExternalStore } from "react";
import {
  emptyPropAccounts,
  readStoredPropAccounts,
  subscribeToPropAccounts,
} from "@/app/_lib/prop-account-storage";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import type {
  AccountType,
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  Trade,
} from "@/app/_lib/trading-types";

type GroupMetric = {
  label: string;
  trades: number;
  winRate: number;
  profitFactor: number;
  pnl: number;
  averageRr: number;
  expectancy: number;
};

type JournalMetric = {
  label: string;
  trades: number;
  winRate: number;
  profitFactor: number;
};

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString()}`;
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function optionLabel(value: string) {
  if (value === "prop-firm") {
    return "Prop Firm";
  }

  if (value === "broker") {
    return "Broker";
  }

  return value;
}

function profitFactor(trades: Trade[]) {
  const grossWin = trades
    .filter((trade) => trade.pnl > 0)
    .reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(
    trades
      .filter((trade) => trade.pnl < 0)
      .reduce((sum, trade) => sum + trade.pnl, 0),
  );

  return grossLoss === 0 ? grossWin : grossWin / grossLoss;
}

function winRate(trades: Trade[]) {
  return trades.length === 0
    ? 0
    : (trades.filter((trade) => trade.result === "Win").length / trades.length) *
        100;
}

function groupJournalMetrics(
  trades: Trade[],
  key: keyof Pick<Trade, "emotion" | "mistake">,
) {
  const groups = new Map<string, Trade[]>();

  trades.forEach((trade) => {
    const value = trade[key] ?? "Unreviewed";
    groups.set(value, [...(groups.get(value) ?? []), trade]);
  });

  return Array.from(groups.entries())
    .map<JournalMetric>(([label, group]) => ({
      label,
      trades: group.length,
      winRate: winRate(group),
      profitFactor: profitFactor(group),
    }))
    .sort((a, b) => b.trades - a.trades);
}

function groupMetrics(
  trades: Trade[],
  key: keyof Pick<Trade, "symbol" | "setupTag" | "side" | "playbook">,
) {
  const groups = new Map<string, Trade[]>();

  trades.forEach((trade) => {
    groups.set(trade[key], [...(groups.get(trade[key]) ?? []), trade]);
  });

  return Array.from(groups.entries())
    .map<GroupMetric>(([label, group]) => {
      const pnl = group.reduce((sum, trade) => sum + trade.pnl, 0);

      return {
        label,
        trades: group.length,
        winRate: winRate(group),
        profitFactor: profitFactor(group),
        pnl,
        averageRr:
          group.length === 0
            ? 0
            : group.reduce((sum, trade) => sum + trade.rr, 0) / group.length,
        expectancy: group.length === 0 ? 0 : pnl / group.length,
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

function maxConsecutive(trades: Trade[], result: Trade["result"]) {
  let current = 0;
  let best = 0;

  trades.forEach((trade) => {
    if (trade.result === result) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });

  return best;
}

function uniqueValues(
  trades: Trade[],
  key: keyof Pick<Trade, "accountType" | "accountName" | "strategyType" | "challengeType" | "phase">,
) {
  return Array.from(new Set(trades.map((trade) => trade[key]).filter(Boolean))).sort() as string[];
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

function RankingTable({
  metric,
  rows,
  title,
}: {
  metric: "winRate" | "profitFactor";
  rows: GroupMetric[];
  title: string;
}) {
  const max = Math.max(...rows.map((row) => row[metric]), 1);

  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="mt-5 space-y-4">
        {rows.map((row) => {
          const value = row[metric];
          const formatted =
            metric === "winRate" ? percent(value) : value.toFixed(2);

          return (
            <div key={row.label}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-200">{row.label}</span>
                <span className="text-slate-400">
                  {formatted} - {row.trades} trades
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06]">
                <div
                  className="h-2 rounded-full bg-emerald-400"
                  style={{ width: `${Math.max(8, (value / max) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function JournalRankingTable({
  metric,
  rows,
  title,
}: {
  metric: "winRate" | "profitFactor";
  rows: JournalMetric[];
  title: string;
}) {
  const max = Math.max(...rows.map((row) => row[metric]), 1);

  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="mt-5 space-y-4">
        {rows.map((row) => {
          const value = row[metric];
          const formatted =
            metric === "winRate" ? percent(value) : value.toFixed(2);

          return (
            <div key={row.label}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-200">{row.label}</span>
                <span className="text-slate-400">
                  {formatted} - {row.trades} trades
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06]">
                <div
                  className="h-2 rounded-full bg-sky-400"
                  style={{ width: `${Math.max(8, (value / max) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SetupMetricTable({
  labelHeader = "Setup",
  metric,
  rows,
  title,
}: {
  labelHeader?: string;
  metric: "netProfit" | "averageRr" | "expectancy" | "trades";
  rows: GroupMetric[];
  title: string;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="py-3 pr-4 font-semibold">{labelHeader}</th>
              <th className="py-3 pr-4 font-semibold">Value</th>
              <th className="py-3 pr-4 font-semibold">Trades</th>
              <th className="py-3 pr-4 font-semibold">Win Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row) => {
              const value =
                metric === "netProfit"
                  ? money(row.pnl)
                  : metric === "averageRr"
                    ? `${row.averageRr.toFixed(2)}R`
                    : metric === "expectancy"
                      ? money(row.expectancy)
                      : row.trades.toLocaleString();

              return (
                <tr className="text-slate-300" key={row.label}>
                  <td className="py-3 pr-4 font-semibold text-white">
                    {row.label}
                  </td>
                  <td
                    className={`py-3 pr-4 font-semibold ${
                      (metric === "netProfit" && row.pnl < 0) ||
                      (metric === "expectancy" && row.expectancy < 0)
                        ? "text-rose-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {value}
                  </td>
                  <td className="py-3 pr-4">{row.trades}</td>
                  <td className="py-3 pr-4">{percent(row.winRate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

}

function SetupLeaderboard({ rows }: { rows: GroupMetric[] }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <h2 className="text-base font-semibold text-white">Setup Leaderboard</h2>
      <div className="mt-5 space-y-3">
        {rows.map((row, index) => (
          <div
            className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-4 py-3"
            key={row.label}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400/10 text-sm font-semibold text-emerald-300">
                {index + 1}
              </div>
              <div>
                <div className="font-semibold text-white">{row.label}</div>
                <div className="text-xs text-slate-500">
                  {percent(row.winRate)} win rate - PF {row.profitFactor.toFixed(2)}
                </div>
              </div>
            </div>
            <div
              className={`text-sm font-semibold ${
                row.pnl >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {money(row.pnl)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SetupDistributionChart({ rows }: { rows: GroupMetric[] }) {
  const maxTrades = Math.max(...rows.map((row) => row.trades), 1);

  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <h2 className="text-base font-semibold text-white">
        Setup Distribution
      </h2>
      <div className="mt-5 space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-200">{row.label}</span>
              <span className="text-slate-400">{row.trades} trades</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06]">
              <div
                className="h-2 rounded-full bg-sky-400"
                style={{
                  width: `${Math.max(8, (row.trades / maxTrades) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DirectionAnalysis({ rows }: { rows: GroupMetric[] }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <h2 className="text-base font-semibold text-white">
        Long vs Short Analysis
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            className="rounded-md border border-white/10 bg-white/[0.03] p-4"
            key={row.label}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-white">{row.label}</div>
              <div
                className={`text-sm font-semibold ${
                  row.pnl >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {money(row.pnl)}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-slate-500">Win Rate</div>
                <div className="mt-1 font-semibold text-slate-100">
                  {percent(row.winRate)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">PF</div>
                <div className="mt-1 font-semibold text-slate-100">
                  {row.profitFactor.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Trades</div>
                <div className="mt-1 font-semibold text-slate-100">
                  {row.trades}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AnalyticsModule({
  fallbackEquityCurve,
  fallbackMonthlyPerformance,
  initialReport,
  initialTrades,
  scopeAccountType,
  title = "Analytics",
  eyebrow = "Performance Intelligence",
}: {
  fallbackEquityCurve: EquityPoint[];
  fallbackMonthlyPerformance: MonthlyPerformance[];
  initialReport: Mt5AccountReport | null;
  initialTrades: Trade[];
  scopeAccountType?: AccountType;
  title?: string;
  eyebrow?: string;
}) {
  const [sourceFilter, setSourceFilter] = useState<"all" | "mt5" | "manual">("all");
  const [accountTypeFilter, setAccountTypeFilter] = useState(scopeAccountType ?? "");
  const [accountNameFilter, setAccountNameFilter] = useState("");
  const [strategyTypeFilter, setStrategyTypeFilter] = useState("");
  const [challengeTypeFilter, setChallengeTypeFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
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
  const { tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport,
    initialTrades,
  });
  const scopedTradeHistory = scopeAccountType
    ? tradeHistory.filter(
        (trade) =>
          trade.accountType === scopeAccountType &&
          (!activeRegistryAccountName || trade.accountName === activeRegistryAccountName),
      )
    : tradeHistory;
  const accountTypeOptions = uniqueValues(scopedTradeHistory, "accountType");
  const accountNameOptions = uniqueValues(scopedTradeHistory, "accountName");
  const strategyTypeOptions = uniqueValues(scopedTradeHistory, "strategyType");
  const challengeTypeOptions = uniqueValues(scopedTradeHistory, "challengeType");
  const phaseOptions = uniqueValues(scopedTradeHistory, "phase");
  const analyticsTrades = scopedTradeHistory.filter((trade) => {
    const source = String(trade.source ?? "mt5");
    if (sourceFilter === "mt5") return source === "mt5";
    if (sourceFilter === "manual") return source === "manual";
    return true;
  }).filter((trade) => {
    return (
      (!accountTypeFilter || trade.accountType === accountTypeFilter) &&
      (!accountNameFilter || trade.accountName === accountNameFilter) &&
      (!strategyTypeFilter || trade.strategyType === strategyTypeFilter) &&
      (!challengeTypeFilter || trade.challengeType === challengeTypeFilter) &&
      (!phaseFilter || trade.phase === phaseFilter) &&
      trade.status !== "Open"
    );
  });
  const bySymbol = groupMetrics(analyticsTrades, "symbol");
  const bySetup = groupMetrics(analyticsTrades, "setupTag");
  const byPlaybook = groupMetrics(analyticsTrades, "playbook");
  const byDirection = groupMetrics(analyticsTrades, "side");
  const byEmotion = groupJournalMetrics(analyticsTrades, "emotion");
  const byMistake = groupJournalMetrics(analyticsTrades, "mistake");
  const reviewedTrades = analyticsTrades.filter(
    (trade) => trade.emotion || trade.mistake || trade.entryReason || trade.exitReason,
  ).length;
  const mostCommonEmotion = byEmotion.find((row) => row.label !== "Unreviewed");
  const mostCommonMistake = byMistake.find((row) => row.label !== "Unreviewed");
  const bestPlaybook = byPlaybook[0] ?? null;
  const worstPlaybook = byPlaybook.at(-1) ?? null;
  const bestTrade = analyticsTrades.reduce<Trade | null>(
    (best, trade) => (!best || trade.pnl > best.pnl ? trade : best),
    null,
  );
  const worstTrade = analyticsTrades.reduce<Trade | null>(
    (worst, trade) => (!worst || trade.pnl < worst.pnl ? trade : worst),
    null,
  );
  const averageRr =
    analyticsTrades.length === 0
      ? 0
      : analyticsTrades.reduce((sum, trade) => sum + trade.rr, 0) /
        analyticsTrades.length;
  const expectancy =
    analyticsTrades.length === 0
      ? 0
      : analyticsTrades.reduce((sum, trade) => sum + trade.pnl, 0) /
        analyticsTrades.length;
  const consecutiveWins = maxConsecutive(analyticsTrades, "Win");
  const consecutiveLosses = maxConsecutive(analyticsTrades, "Loss");

  return (
    <AppShell
      eyebrow={eyebrow}
      title={title}
      action={
        <div className="flex items-center gap-3">
          {scopeAccountType === "prop-firm" && registryAccountNames.length ? (
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span className="mr-2">Prop Account</span>
              <select
                className="h-10 rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                value={activeRegistryAccountName}
                onChange={(event) => {
                  setSelectedRegistryAccountName(event.target.value);
                  setAccountNameFilter("");
                }}
              >
                {registryAccountNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span className="mr-2">Source</span>
            <select
              className="h-10 rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as "all" | "mt5" | "manual")}
            >
              <option value="all">All</option>
              <option value="mt5">MT5 Only</option>
              <option value="manual">Manual Only</option>
            </select>
          </label>
          <button className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white">
            Export Analytics
          </button>
        </div>
      }
    >
      <section className="mb-6 rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {scopeAccountType ? null : (
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Account Type
              </span>
              <select
                className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                value={accountTypeFilter}
                onChange={(event) => setAccountTypeFilter(event.target.value)}
              >
                <option value="">All</option>
                {accountTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {optionLabel(option)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Account Name
            </span>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              value={accountNameFilter}
              onChange={(event) => setAccountNameFilter(event.target.value)}
            >
              <option value="">All</option>
              {accountNameOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Strategy Type
            </span>
            <select
              className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
              value={strategyTypeFilter}
              onChange={(event) => setStrategyTypeFilter(event.target.value)}
            >
              <option value="">All</option>
              {strategyTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {scopeAccountType === "prop-firm" ? (
            <>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Challenge Type
                </span>
                <select
                  className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50"
                  value={challengeTypeFilter}
                  onChange={(event) => setChallengeTypeFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {challengeTypeOptions.map((option) => (
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
                  value={phaseFilter}
                  onChange={(event) => setPhaseFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {phaseOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Best Trade"
          value={bestTrade ? money(bestTrade.pnl) : "$0"}
          sublabel={bestTrade ? `${bestTrade.symbol} - ${bestTrade.rr}R` : "No closed trades"}
        />
        <MetricCard
          label="Worst Trade"
          value={worstTrade ? money(worstTrade.pnl) : "$0"}
          sublabel={worstTrade ? `${worstTrade.symbol} - ${worstTrade.rr}R` : "No closed trades"}
        />
        <MetricCard
          label="Average RR"
          value={`${averageRr.toFixed(2)}R`}
          sublabel="Across closed trades"
        />
        <MetricCard
          label="Expectancy"
          value={money(Math.round(expectancy))}
          sublabel="Average P/L per trade"
        />
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="Consecutive Wins"
          value={`${consecutiveWins}`}
          sublabel="Best winning streak"
        />
        <MetricCard
          label="Consecutive Losses"
          value={`${consecutiveLosses}`}
          sublabel="Longest losing streak"
        />
        <MetricCard
          label="Most Common Mistake"
          value={mostCommonMistake?.label ?? "None"}
          sublabel={`${mostCommonMistake?.trades ?? 0} reviewed trades`}
        />
        <MetricCard
          label="Most Common Emotion"
          value={mostCommonEmotion?.label ?? "None"}
          sublabel={`${mostCommonEmotion?.trades ?? 0} reviewed trades`}
        />
        <MetricCard
          label="Reviewed Trades"
          value={`${reviewedTrades}`}
          sublabel={`${analyticsTrades.length} closed trades`}
        />
        <MetricCard
          label="Best Playbook"
          value={bestPlaybook?.label ?? "None"}
          sublabel={
            bestPlaybook
              ? `${money(bestPlaybook.pnl)} - ${bestPlaybook.trades} trades`
              : "No closed trades"
          }
        />
        <MetricCard
          label="Worst Playbook"
          value={worstPlaybook?.label ?? "None"}
          sublabel={
            worstPlaybook
              ? `${money(worstPlaybook.pnl)} - ${worstPlaybook.trades} trades`
              : "No closed trades"
          }
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <RankingTable
          title="Win Rate by Symbol"
          rows={bySymbol}
          metric="winRate"
        />
        <RankingTable
          title="Profit Factor by Symbol"
          rows={bySymbol}
          metric="profitFactor"
        />
        <RankingTable title="Win Rate by Setup" rows={bySetup} metric="winRate" />
        <RankingTable
          title="Profit Factor by Setup"
          rows={bySetup}
          metric="profitFactor"
        />
        <RankingTable
          title="Win Rate by Playbook"
          rows={byPlaybook}
          metric="winRate"
        />
        <RankingTable
          title="Profit Factor by Playbook"
          rows={byPlaybook}
          metric="profitFactor"
        />
        <SetupMetricTable
          title="Expectancy by Playbook"
          labelHeader="Playbook"
          rows={byPlaybook}
          metric="expectancy"
        />
        <SetupMetricTable
          title="Net Profit by Playbook"
          labelHeader="Playbook"
          rows={byPlaybook}
          metric="netProfit"
        />
        <SetupMetricTable
          title="Trade Count by Playbook"
          labelHeader="Playbook"
          rows={byPlaybook}
          metric="trades"
        />
        <SetupMetricTable
          title="Net Profit by Setup"
          rows={bySetup}
          metric="netProfit"
        />
        <SetupMetricTable
          title="Average RR by Setup"
          rows={bySetup}
          metric="averageRr"
        />
        <SetupMetricTable
          title="Trade Count by Setup"
          rows={bySetup}
          metric="trades"
        />
        <SetupLeaderboard
          rows={bySetup}
        />
        <SetupDistributionChart rows={bySetup} />
        <JournalRankingTable
          title="Win Rate by Emotion"
          rows={byEmotion}
          metric="winRate"
        />
        <JournalRankingTable
          title="Profit Factor by Emotion"
          rows={byEmotion}
          metric="profitFactor"
        />
        <JournalRankingTable
          title="Win Rate by Mistake"
          rows={byMistake}
          metric="winRate"
        />
        <JournalRankingTable
          title="Profit Factor by Mistake"
          rows={byMistake}
          metric="profitFactor"
        />
        <DirectionAnalysis rows={byDirection} />
      </section>
    </AppShell>
  );
}
