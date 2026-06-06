"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  emptyPropAccounts,
  readStoredPropAccounts,
  subscribeToPropAccounts,
} from "@/app/_lib/prop-account-storage";
import {
  evaluateTnpaGrade,
  readTnpaPlaybookIntelligenceOverrides,
  subscribeToTnpaPlaybookIntelligenceOverrides,
  tnpaCorePlaybooks,
  tnpaGrades,
  type TnpaGrade,
  type TnpaPlaybookIntelligence,
  type TnpaPlaybookIntelligenceOverrides,
} from "@/app/_lib/tnpa-playbook-intelligence-storage";
import {
  readTradeAccountLinks,
  subscribeToTradeAccountLinks,
} from "@/app/_lib/trade-account-link-storage";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import type {
  ChallengeType,
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  PropPhase,
  Trade,
} from "@/app/_lib/trading-types";

type MetricRow = {
  label: string;
  trades: number;
  winRate: number;
  netPnl: number;
  averageR: number;
  profitFactor: number;
  expectancy: number;
  averageHoldingMs: number;
};

type RuleViolationKey =
  | "Traded against H4 trend"
  | "Entry between EMA21 and EMA34"
  | "RR < 1:2"
  | "Missing stop loss"
  | "Playbook mismatch";

type EnrichedTrade = {
  accountName: string;
  grade: ReturnType<typeof evaluateTnpaGrade>;
  intelligence?: TnpaPlaybookIntelligence;
  trade: Trade;
  violations: RuleViolationKey[];
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

function parseTradeDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinDateRange(trade: Trade, startDate: string, endDate: string) {
  const tradeDate = parseTradeDate(trade.closeTime || trade.openTime || trade.date);
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

function holdingMs(trade: Trade) {
  const open = parseTradeDate(trade.openTime);
  const close = parseTradeDate(trade.closeTime);
  if (!open || !close) return 0;
  return Math.max(0, close.getTime() - open.getTime());
}

function formatHolding(value: number) {
  if (!value) return "-";
  const minutes = Math.round(value / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function uniqueValues<T extends string>(values: Array<T | undefined>) {
  return Array.from(new Set(values.filter(Boolean))).sort() as T[];
}

function effectiveAccountName(trade: Trade, links: ReturnType<typeof readTradeAccountLinks>) {
  return links[trade.id]?.accountName ?? trade.accountName ?? "Unassigned";
}

function ruleViolations(trade: Trade, intelligence?: TnpaPlaybookIntelligence): RuleViolationKey[] {
  if (!intelligence) {
    return ["Playbook mismatch"];
  }

  return [
    !intelligence.rules.tradeWithH4Trend ? "Traded against H4 trend" : null,
    !intelligence.rules.avoidEma21Ema34Entry ? "Entry between EMA21 and EMA34" : null,
    !(intelligence.rules.rrAtLeastTwo || trade.rr >= 2) ? "RR < 1:2" : null,
    !intelligence.rules.stopLossDefined ? "Missing stop loss" : null,
    !intelligence.rules.playbookMatched ? "Playbook mismatch" : null,
  ].filter((value): value is RuleViolationKey => Boolean(value));
}

function enrichTrades(
  trades: Trade[],
  intelligence: TnpaPlaybookIntelligenceOverrides,
  links: ReturnType<typeof readTradeAccountLinks>,
): EnrichedTrade[] {
  return trades.map((trade) => {
    const row = intelligence[trade.id];

    return {
      accountName: effectiveAccountName(trade, links),
      grade: evaluateTnpaGrade(trade, row),
      intelligence: row,
      trade,
      violations: ruleViolations(trade, row),
    };
  });
}

function metricFromTrades(label: string, rows: EnrichedTrade[]): MetricRow {
  const trades = rows.map((row) => row.trade);
  const wins = trades.filter((trade) => trade.result === "Win").length;
  const holdingRows = trades.map(holdingMs).filter((value) => value > 0);
  const netPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);

  return {
    averageHoldingMs: holdingRows.reduce((sum, value) => sum + value, 0) / Math.max(1, holdingRows.length),
    averageR: trades.reduce((sum, trade) => sum + trade.rr, 0) / Math.max(1, trades.length),
    expectancy: netPnl / Math.max(1, trades.length),
    label,
    netPnl,
    profitFactor: profitFactor(trades),
    trades: trades.length,
    winRate: trades.length ? (wins / trades.length) * 100 : 0,
  };
}

function gradeTone(grade: TnpaGrade) {
  if (grade === "A+" || grade === "A") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-200";
  if (grade === "B") return "border-cyan-300/30 bg-cyan-400/10 text-cyan-200";
  if (grade === "C") return "border-amber-300/30 bg-amber-400/10 text-amber-200";
  return "border-rose-300/30 bg-rose-400/10 text-rose-200";
}

function Badge({ value }: { value: TnpaGrade | string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tnpaGrades.includes(value as TnpaGrade) ? gradeTone(value as TnpaGrade) : "border-sky-300/30 bg-sky-400/10 text-sky-200"}`}>
      {value}
    </span>
  );
}

function MetricCard({
  label,
  sublabel,
  value,
  tone = "text-white",
}: {
  label: string;
  sublabel: string;
  value: string;
  tone?: string;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className={`mt-3 text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {sublabel}
      </div>
    </section>
  );
}

function gradeDistribution(rows: EnrichedTrade[]) {
  const counts = new Map<TnpaGrade, number>();
  rows.forEach((row) => counts.set(row.grade.grade, (counts.get(row.grade.grade) ?? 0) + 1));
  return tnpaGrades
    .map((grade) => ({ grade, count: counts.get(grade) ?? 0 }))
    .filter((row) => row.count > 0);
}

function mostFrequentGrade(rows: EnrichedTrade[], direction: "best" | "worst") {
  const distribution = gradeDistribution(rows);
  const order = direction === "best" ? ["A+", "A", "B", "C", "Invalid"] : ["Invalid", "C", "B", "A", "A+"];
  return distribution.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return order.indexOf(a.grade) - order.indexOf(b.grade);
  })[0]?.grade ?? "-";
}

function mostCostlyBy<T extends string>(rows: EnrichedTrade[], getKey: (row: EnrichedTrade) => T | undefined) {
  const grouped = new Map<T, EnrichedTrade[]>();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  });

  return Array.from(grouped.entries())
    .map(([label, group]) => metricFromTrades(label, group))
    .sort((a, b) => a.netPnl - b.netPnl)[0] ?? null;
}

function mostProfitableBy<T extends string>(rows: EnrichedTrade[], getKey: (row: EnrichedTrade) => T | undefined) {
  const grouped = new Map<T, EnrichedTrade[]>();
  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  });

  return Array.from(grouped.entries())
    .map(([label, group]) => metricFromTrades(label, group))
    .sort((a, b) => b.netPnl - a.netPnl)[0] ?? null;
}

function buildInsights({
  bestGrade,
  bestPlaybook,
  emaViolation,
  rectangleRsi,
  totalNetPnl,
}: {
  bestGrade: MetricRow | null;
  bestPlaybook: MetricRow | null;
  emaViolation: MetricRow | null;
  rectangleRsi: MetricRow | null;
  totalNetPnl: number;
}) {
  const insights: string[] = [];

  if (bestGrade && bestGrade.trades > 0) {
    const contribution = totalNetPnl ? (bestGrade.netPnl / totalNetPnl) * 100 : 0;
    insights.push(`${bestGrade.label} trades have ${percent(bestGrade.winRate)} win rate and generate ${percent(contribution)} of total profits.`);
  }

  if (emaViolation && emaViolation.netPnl < 0) {
    insights.push(`Trades entered between EMA21 and EMA34 have produced ${money(emaViolation.netPnl)} net P/L and should be reduced.`);
  }

  if (rectangleRsi && rectangleRsi.trades > 0) {
    insights.push(`Rectangle Breakout with RSI confirmation is producing ${money(rectangleRsi.expectancy)} expectancy per trade.`);
  }

  if (bestPlaybook) {
    insights.push(`${bestPlaybook.label} is the highest expectancy TNPA playbook at ${money(bestPlaybook.expectancy)} per trade.`);
  }

  return insights.length ? insights : ["No TNPA intelligence insights yet. Review trades and save TNPA playbook fields to unlock the edge report."];
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
  const tradeAccountLinks = useSyncExternalStore(
    subscribeToTradeAccountLinks,
    readTradeAccountLinks,
    () => ({}),
  );
  const tnpaIntelligence = useSyncExternalStore(
    subscribeToTnpaPlaybookIntelligenceOverrides,
    readTnpaPlaybookIntelligenceOverrides,
    () => ({}),
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

  const propTrades = useMemo(
    () => tradeHistory.filter((trade) => (trade.accountType ?? "prop-firm") === "prop-firm" && trade.status !== "Open"),
    [tradeHistory],
  );
  const accountOptions = propAccounts.length
    ? propAccounts.map((account) => account.accountName)
    : uniqueValues(propTrades.map((trade) => effectiveAccountName(trade, tradeAccountLinks)));
  const challengeOptions = uniqueValues<ChallengeType>([
    ...propAccounts.map((account) => account.challengeType),
    ...propTrades.map((trade) => trade.challengeType),
  ]);
  const phaseOptions = uniqueValues<PropPhase>([
    ...propAccounts.map((account) => account.phase),
    ...propTrades.map((trade) => trade.phase),
  ]);

  const enrichedTrades = enrichTrades(propTrades, tnpaIntelligence, tradeAccountLinks).filter((row) => {
    const registryAccount = propAccounts.find((account) => account.accountName === row.accountName);
    const effectiveChallengeType = registryAccount?.challengeType ?? row.trade.challengeType;
    const effectivePhase = registryAccount?.phase ?? row.trade.phase;

    return (
      (!accountName || row.accountName === accountName) &&
      (!challengeType || effectiveChallengeType === challengeType) &&
      (!phase || effectivePhase === phase) &&
      isWithinDateRange(row.trade, startDate, endDate)
    );
  });
  const totalNetPnl = enrichedTrades.reduce((sum, row) => sum + row.trade.pnl, 0);
  const gradeRows = tnpaGrades.map((grade) => metricFromTrades(grade, enrichedTrades.filter((row) => row.grade.grade === grade)));
  const playbookRows = tnpaCorePlaybooks.map((playbook) => {
    const rows = enrichedTrades.filter((row) => row.intelligence?.corePlaybook === playbook);
    return {
      ...metricFromTrades(playbook, rows),
      bestGrade: mostFrequentGrade(rows, "best"),
      worstGrade: mostFrequentGrade(rows, "worst"),
    };
  });
  const violationRows = ([
    "Traded against H4 trend",
    "Entry between EMA21 and EMA34",
    "RR < 1:2",
    "Missing stop loss",
    "Playbook mismatch",
  ] as RuleViolationKey[]).map((violation) => ({
    ...metricFromTrades(violation, enrichedTrades.filter((row) => row.violations.includes(violation))),
    frequency: enrichedTrades.length
      ? (enrichedTrades.filter((row) => row.violations.includes(violation)).length / enrichedTrades.length) * 100
      : 0,
  }));
  const bestPlaybook = [...playbookRows].filter((row) => row.trades > 0).sort((a, b) => b.expectancy - a.expectancy)[0] ?? null;
  const bestGrade = [...gradeRows].filter((row) => row.trades > 0).sort((a, b) => b.expectancy - a.expectancy)[0] ?? null;
  const bestSetup = bestPlaybook;
  const worstSetup = [...playbookRows].filter((row) => row.trades > 0).sort((a, b) => a.expectancy - b.expectancy)[0] ?? null;
  const bestSymbol = mostProfitableBy(enrichedTrades, (row) => row.trade.symbol);
  const bestAccount = mostProfitableBy(enrichedTrades, (row) => row.accountName);
  const mostCostlyMistake = mostCostlyBy(enrichedTrades, (row) => row.trade.mistake);
  const mostViolatedRule = [...violationRows].sort((a, b) => b.trades - a.trades)[0] ?? null;
  const losingPattern = mostCostlyBy(
    enrichedTrades.filter((row) => row.trade.result === "Loss"),
    (row) => {
      const playbook = row.intelligence?.corePlaybook;
      const violation = row.violations[0];
      return playbook && violation ? `${playbook} / ${violation}` : violation;
    },
  );
  const rectangleRsi = metricFromTrades(
    "Rectangle Breakout + RSI confirmation",
    enrichedTrades.filter(
      (row) =>
        row.intelligence?.corePlaybook === "Rectangle Breakout" &&
        row.intelligence.rsiConfirmation &&
        row.intelligence.rsiConfirmation !== "No confirmation",
    ),
  );
  const insights = buildInsights({
    bestGrade,
    bestPlaybook,
    emaViolation: violationRows.find((row) => row.label === "Entry between EMA21 and EMA34") ?? null,
    rectangleRsi,
    totalNetPnl,
  });

  return (
    <AppShell eyebrow="FTMO OS" title="Setup Intelligence">
      <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">FTMO Account</span>
            <select className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50" value={accountName} onChange={(event) => setAccountName(event.target.value)}>
              <option value="">All Accounts</option>
              {accountOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Challenge Type</span>
            <select className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50" value={challengeType} onChange={(event) => setChallengeType(event.target.value)}>
              <option value="">All</option>
              {challengeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Phase</span>
            <select className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50" value={phase} onChange={(event) => setPhase(event.target.value)}>
              <option value="">All</option>
              {phaseOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Start Date</span>
            <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">End Date</span>
            <input className="h-11 w-full rounded-md border border-white/10 bg-[#090d15] px-3 text-sm text-slate-200 outline-none transition focus:border-emerald-300/50" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Best Setup" value={bestSetup?.label ?? "-"} sublabel={bestSetup ? `${money(bestSetup.expectancy)} expectancy` : "No reviewed setup"} />
        <MetricCard label="Worst Setup" value={worstSetup?.label ?? "-"} sublabel={worstSetup ? `${money(worstSetup.expectancy)} expectancy` : "No reviewed setup"} tone="text-rose-200" />
        <MetricCard label="Best Account" value={bestAccount?.label ?? "-"} sublabel={bestAccount ? money(bestAccount.netPnl) : "No account edge"} />
        <MetricCard label="Best Symbol" value={bestSymbol?.label ?? "-"} sublabel={bestSymbol ? money(bestSymbol.netPnl) : "No symbol edge"} />
        <MetricCard label="Most Costly Mistake" value={mostCostlyMistake?.label ?? "-"} sublabel={mostCostlyMistake ? money(mostCostlyMistake.netPnl) : "No mistake data"} tone="text-rose-200" />
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <h2 className="text-base font-semibold text-white">TNPA Edge Report</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Highest Expectancy Playbook" value={bestPlaybook?.label ?? "-"} sublabel={bestPlaybook ? money(bestPlaybook.expectancy) : "No playbook reviewed"} />
          <MetricCard label="Highest Expectancy Grade" value={bestGrade?.label ?? "-"} sublabel={bestGrade ? money(bestGrade.expectancy) : "No grade edge"} />
          <MetricCard label="Most Profitable Symbol" value={bestSymbol?.label ?? "-"} sublabel={bestSymbol ? money(bestSymbol.netPnl) : "No symbol edge"} />
          <MetricCard label="Most Profitable Account" value={bestAccount?.label ?? "-"} sublabel={bestAccount ? money(bestAccount.netPnl) : "No account edge"} />
          <MetricCard label="Most Violated Rule" value={mostViolatedRule?.label ?? "-"} sublabel={mostViolatedRule ? `${mostViolatedRule.trades} occurrences` : "No violations"} />
          <MetricCard label="Common Losing Pattern" value={losingPattern?.label ?? "-"} sublabel={losingPattern ? money(losingPattern.netPnl) : "No losing pattern"} tone="text-rose-200" />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
        <h2 className="text-base font-semibold text-white">Insight Engine</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {insights.map((insight) => (
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300" key={insight}>
              {insight}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-base font-semibold text-white">TNPA Grade Performance</h2>
          <p className="mt-1 text-sm text-slate-500">{enrichedTrades.length} closed FTMO trades match the current filters.</p>
        </div>
        <div className="overflow-x-auto">
          <MetricTable rows={gradeRows} />
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-base font-semibold text-white">Playbook Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Playbook</th>
                <th className="px-5 py-4 font-semibold">Trades</th>
                <th className="px-5 py-4 font-semibold">Win Rate</th>
                <th className="px-5 py-4 font-semibold">Net P/L</th>
                <th className="px-5 py-4 font-semibold">Profit Factor</th>
                <th className="px-5 py-4 font-semibold">Best Grade Distribution</th>
                <th className="px-5 py-4 font-semibold">Worst Grade Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {playbookRows.map((row) => (
                <tr className="text-slate-300" key={row.label}>
                  <td className="px-5 py-4 font-semibold text-white">{row.label}</td>
                  <td className="px-5 py-4">{row.trades}</td>
                  <td className="px-5 py-4">{percent(row.winRate)}</td>
                  <td className={`px-5 py-4 font-semibold ${row.netPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{money(row.netPnl)}</td>
                  <td className="px-5 py-4">{row.profitFactor >= 99 ? "No losses" : row.profitFactor.toFixed(2)}</td>
                  <td className="px-5 py-4"><Badge value={row.bestGrade} /></td>
                  <td className="px-5 py-4"><Badge value={row.worstGrade} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-base font-semibold text-white">Rule Violation Analytics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Violation</th>
                <th className="px-5 py-4 font-semibold">Frequency</th>
                <th className="px-5 py-4 font-semibold">Win Rate</th>
                <th className="px-5 py-4 font-semibold">Net P/L Impact</th>
                <th className="px-5 py-4 font-semibold">Trades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {violationRows.map((row) => (
                <tr className="text-slate-300" key={row.label}>
                  <td className="px-5 py-4 font-semibold text-white">{row.label}</td>
                  <td className="px-5 py-4">{percent(row.frequency)}</td>
                  <td className="px-5 py-4">{percent(row.winRate)}</td>
                  <td className={`px-5 py-4 font-semibold ${row.netPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{money(row.netPnl)}</td>
                  <td className="px-5 py-4">{row.trades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function MetricTable({ rows }: { rows: MetricRow[] }) {
  return (
    <table className="w-full min-w-[1040px] text-left text-sm">
      <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-slate-500">
        <tr>
          <th className="px-5 py-4 font-semibold">Grade</th>
          <th className="px-5 py-4 font-semibold">Trade Count</th>
          <th className="px-5 py-4 font-semibold">Win Rate</th>
          <th className="px-5 py-4 font-semibold">Net P/L</th>
          <th className="px-5 py-4 font-semibold">Average R</th>
          <th className="px-5 py-4 font-semibold">Profit Factor</th>
          <th className="px-5 py-4 font-semibold">Average Holding Time</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10">
        {rows.map((row) => (
          <tr className="text-slate-300" key={row.label}>
            <td className="px-5 py-4"><Badge value={row.label} /></td>
            <td className="px-5 py-4">{row.trades}</td>
            <td className="px-5 py-4">{percent(row.winRate)}</td>
            <td className={`px-5 py-4 font-semibold ${row.netPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{money(row.netPnl)}</td>
            <td className="px-5 py-4">{row.averageR.toFixed(2)}R</td>
            <td className="px-5 py-4">{row.profitFactor >= 99 ? "No losses" : row.profitFactor.toFixed(2)}</td>
            <td className="px-5 py-4">{formatHolding(row.averageHoldingMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
