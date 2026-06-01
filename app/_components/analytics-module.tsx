"use client";

import { AppShell } from "@/app/_components/app-shell";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import type {
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
  key: keyof Pick<Trade, "symbol" | "setupTag" | "side">,
) {
  const groups = new Map<string, Trade[]>();

  trades.forEach((trade) => {
    groups.set(trade[key], [...(groups.get(trade[key]) ?? []), trade]);
  });

  return Array.from(groups.entries())
    .map<GroupMetric>(([label, group]) => ({
      label,
      trades: group.length,
      winRate: winRate(group),
      profitFactor: profitFactor(group),
      pnl: group.reduce((sum, trade) => sum + trade.pnl, 0),
      averageRr:
        group.length === 0
          ? 0
          : group.reduce((sum, trade) => sum + trade.rr, 0) / group.length,
    }))
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
  metric,
  rows,
  title,
}: {
  metric: "netProfit" | "averageRr" | "trades";
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
              <th className="py-3 pr-4 font-semibold">Setup</th>
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
                    : row.trades.toLocaleString();

              return (
                <tr className="text-slate-300" key={row.label}>
                  <td className="py-3 pr-4 font-semibold text-white">
                    {row.label}
                  </td>
                  <td
                    className={`py-3 pr-4 font-semibold ${
                      metric === "netProfit" && row.pnl < 0
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
}: {
  fallbackEquityCurve: EquityPoint[];
  fallbackMonthlyPerformance: MonthlyPerformance[];
  initialReport: Mt5AccountReport | null;
  initialTrades: Trade[];
}) {
  const { closedTrades, setupMetrics } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport,
    initialTrades,
  });
  const analyticsTrades = closedTrades;
  const bySymbol = groupMetrics(analyticsTrades, "symbol");
  const bySetup = groupMetrics(analyticsTrades, "setupTag");
  const byDirection = groupMetrics(analyticsTrades, "side");
  const byEmotion = groupJournalMetrics(analyticsTrades, "emotion");
  const byMistake = groupJournalMetrics(analyticsTrades, "mistake");
  const reviewedTrades = analyticsTrades.filter(
    (trade) => trade.emotion || trade.mistake || trade.entryReason || trade.exitReason,
  ).length;
  const mostCommonEmotion = byEmotion.find((row) => row.label !== "Unreviewed");
  const mostCommonMistake = byMistake.find((row) => row.label !== "Unreviewed");
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
      eyebrow="Performance Intelligence"
      title="Analytics"
      action={
        <button className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white">
          Export Analytics
        </button>
      }
    >
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
          rows={setupMetrics.map((row) => ({
            label: row.setupTag,
            trades: row.trades,
            winRate: row.winRate,
            profitFactor: row.profitFactor,
            pnl: row.netProfit,
            averageRr: row.averageRr,
          }))}
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
