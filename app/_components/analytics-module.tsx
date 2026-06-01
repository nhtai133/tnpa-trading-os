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

function groupMetrics(
  trades: Trade[],
  key: keyof Pick<Trade, "symbol" | "setup" | "side">,
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
                  {formatted} · {row.trades} trades
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
  const { tradeHistory } = useTradingDataset({
    fallbackEquityCurve,
    fallbackMonthlyPerformance,
    initialReport,
    initialTrades,
  });
  const bySymbol = groupMetrics(tradeHistory, "symbol");
  const bySetup = groupMetrics(tradeHistory, "setup");
  const byDirection = groupMetrics(tradeHistory, "side");
  const bestTrade = tradeHistory.reduce((best, trade) =>
    trade.pnl > best.pnl ? trade : best,
  );
  const worstTrade = tradeHistory.reduce((worst, trade) =>
    trade.pnl < worst.pnl ? trade : worst,
  );
  const averageRr =
    tradeHistory.reduce((sum, trade) => sum + trade.rr, 0) / tradeHistory.length;
  const expectancy =
    tradeHistory.reduce((sum, trade) => sum + trade.pnl, 0) / tradeHistory.length;
  const consecutiveWins = maxConsecutive(tradeHistory, "Win");
  const consecutiveLosses = maxConsecutive(tradeHistory, "Loss");

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
          value={money(bestTrade.pnl)}
          sublabel={`${bestTrade.symbol} · ${bestTrade.rr}R`}
        />
        <MetricCard
          label="Worst Trade"
          value={money(worstTrade.pnl)}
          sublabel={`${worstTrade.symbol} · ${worstTrade.rr}R`}
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
        <DirectionAnalysis rows={byDirection} />
      </section>
    </AppShell>
  );
}
