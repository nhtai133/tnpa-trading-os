"use client";

import { useState, useSyncExternalStore } from "react";
import { AppShell } from "@/app/_components/app-shell";
import {
  emptyReviewNotes,
  readReviewNotes,
  subscribeToReviewNotes,
  writeReviewNote,
  type ReviewNoteScope,
} from "@/app/_lib/review-notes-storage";
import {
  emptyTnpaPlaybookIntelligenceOverrides,
  evaluateTnpaGrade,
  readTnpaPlaybookIntelligenceOverrides,
  subscribeToTnpaPlaybookIntelligenceOverrides,
  tnpaGrades,
} from "@/app/_lib/tnpa-playbook-intelligence-storage";
import {
  emptyTradeAccountLinks,
  readTradeAccountLinks,
  subscribeToTradeAccountLinks,
} from "@/app/_lib/trade-account-link-storage";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import type {
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  Trade,
} from "@/app/_lib/trading-types";

type ReviewPeriod = {
  end: Date;
  key: string;
  label: string;
  start: Date;
};

function money(value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function parseTradeDate(trade: Trade) {
  const parsed = new Date(trade.closeTime || trade.openTime || trade.date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekNumber(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function currentPeriods(now = new Date()) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const day = todayStart.getDay() || 7;
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - day + 1);
  const weekEnd = endOfDay(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  return {
    daily: { end: todayEnd, key: isoDate(todayStart), label: isoDate(todayStart), start: todayStart },
    monthly: {
      end: monthEnd,
      key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      label: `${now.toLocaleString(undefined, { month: "long" })} ${now.getFullYear()}`,
      start: monthStart,
    },
    weekly: {
      end: weekEnd,
      key: `${weekStart.getFullYear()}-W${String(weekNumber(weekStart)).padStart(2, "0")}`,
      label: `${isoDate(weekStart)} to ${isoDate(weekEnd)}`,
      start: weekStart,
    },
  } satisfies Record<ReviewNoteScope, ReviewPeriod>;
}

function closedTrades(trades: Trade[]) {
  return trades.filter((trade) => trade.status !== "Open");
}

function tradesInPeriod(trades: Trade[], period: ReviewPeriod) {
  return closedTrades(trades).filter((trade) => {
    const date = parseTradeDate(trade);
    return date ? date >= period.start && date <= period.end : false;
  });
}

function netPnl(trades: Trade[]) {
  return trades.reduce((sum, trade) => sum + trade.pnl, 0);
}

function winRate(trades: Trade[]) {
  if (!trades.length) return 0;
  return (trades.filter((trade) => trade.result === "Win").length / trades.length) * 100;
}

function profitFactor(trades: Trade[]) {
  const grossProfit = trades.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(trades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0));
  if (grossLoss === 0) return grossProfit > 0 ? 99 : 0;
  return grossProfit / grossLoss;
}

function expectancy(trades: Trade[]) {
  return trades.length ? netPnl(trades) / trades.length : 0;
}

function bestTrade(trades: Trade[]) {
  return trades.reduce<Trade | null>((best, trade) => (!best || trade.pnl > best.pnl ? trade : best), null);
}

function worstTrade(trades: Trade[]) {
  return trades.reduce<Trade | null>((worst, trade) => (!worst || trade.pnl < worst.pnl ? trade : worst), null);
}

function groupedMetric(trades: Trade[], getKey: (trade: Trade) => string | undefined) {
  const grouped = new Map<string, Trade[]>();
  trades.forEach((trade) => {
    const key = getKey(trade);
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) ?? []), trade]);
  });

  return Array.from(grouped.entries())
    .map(([label, rows]) => ({
      expectancy: expectancy(rows),
      label,
      netPnl: netPnl(rows),
      trades: rows.length,
      winRate: winRate(rows),
    }))
    .sort((a, b) => b.netPnl - a.netPnl);
}

function violationsFor(trade: Trade, grades: ReturnType<typeof readTnpaPlaybookIntelligenceOverrides>) {
  const intelligence = grades[trade.id];
  if (!intelligence) return ["No TNPA review"];

  return [
    !intelligence.rules.tradeWithH4Trend ? "Traded against H4 trend" : "",
    !intelligence.rules.avoidEma21Ema34Entry ? "Entry between EMA21 and EMA34" : "",
    !(intelligence.rules.rrAtLeastTwo || trade.rr >= 2) ? "RR < 1:2" : "",
    !intelligence.rules.stopLossDefined ? "Missing stop loss" : "",
    !intelligence.rules.playbookMatched ? "Playbook mismatch" : "",
  ].filter(Boolean);
}

function commonLabel(labels: string[]) {
  const counts = new Map<string, number>();
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
}

function GradeDistribution({
  trades,
  intelligence,
}: {
  trades: Trade[];
  intelligence: ReturnType<typeof readTnpaPlaybookIntelligenceOverrides>;
}) {
  const rows = tnpaGrades.map((grade) => ({
    grade,
    trades: trades.filter((trade) => evaluateTnpaGrade(trade, intelligence[trade.id]).grade === grade).length,
  }));

  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {rows.map((row) => (
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2" key={row.grade}>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{row.grade}</div>
          <div className="mt-1 text-lg font-semibold text-white">{row.trades}</div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, sublabel, tone = "text-white" }: { label: string; value: string; sublabel?: string; tone?: string }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className={`mt-3 text-2xl font-semibold ${tone}`}>{value}</div>
      {sublabel ? <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{sublabel}</div> : null}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">{text}</div>;
}

function ReviewNotesEditor({
  label,
  note,
  onSave,
}: {
  label: string;
  note: string;
  onSave: (note: string) => void;
}) {
  const [draft, setDraft] = useState(note);

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm font-semibold text-white">{label}</div>
      <textarea
        className="mt-3 min-h-32 w-full rounded-md border border-white/10 bg-[#090d15] px-3 py-2 text-sm leading-6 text-slate-200 outline-none transition focus:border-emerald-300/50"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button
        className="mt-3 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
        onClick={() => onSave(draft)}
        type="button"
      >
        Save Notes
      </button>
    </div>
  );
}

export function TradingReviewModule({
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
  const tradeLinks = useSyncExternalStore(
    subscribeToTradeAccountLinks,
    readTradeAccountLinks,
    () => emptyTradeAccountLinks,
  );
  const intelligence = useSyncExternalStore(
    subscribeToTnpaPlaybookIntelligenceOverrides,
    readTnpaPlaybookIntelligenceOverrides,
    () => emptyTnpaPlaybookIntelligenceOverrides,
  );
  const reviewNotes = useSyncExternalStore(subscribeToReviewNotes, readReviewNotes, () => emptyReviewNotes);
  const periods = currentPeriods();
  const propTrades = tradeHistory.filter((trade) => (trade.accountType ?? "prop-firm") === "prop-firm");
  const dailyTrades = tradesInPeriod(propTrades, periods.daily);
  const weeklyTrades = tradesInPeriod(propTrades, periods.weekly);
  const monthlyTrades = tradesInPeriod(propTrades, periods.monthly);
  const dailyBest = bestTrade(dailyTrades);
  const dailyWorst = worstTrade(dailyTrades);
  const weeklyPlaybooks = groupedMetric(weeklyTrades, (trade) => intelligence[trade.id]?.corePlaybook ?? trade.playbook);
  const monthlySymbols = groupedMetric(monthlyTrades, (trade) => trade.symbol);
  const monthlyAccounts = groupedMetric(monthlyTrades, (trade) => tradeLinks[trade.id]?.accountName ?? trade.accountName);
  const mostCommonMistake = commonLabel(weeklyTrades.map((trade) => trade.mistake ?? "").filter(Boolean));
  const dailyViolations = dailyTrades.flatMap((trade) => violationsFor(trade, intelligence));
  const mostProfitableSetup = groupedMetric(propTrades, (trade) => intelligence[trade.id]?.corePlaybook ?? trade.playbook)[0] ?? null;
  const mostCostlyViolation = groupedMetric(propTrades.flatMap((trade) => violationsFor(trade, intelligence).map((violation) => ({ ...trade, setup: violation }))), (trade) => trade.setup).sort((a, b) => a.netPnl - b.netPnl)[0] ?? null;
  const mostConsistentAccount = groupedMetric(propTrades, (trade) => tradeLinks[trade.id]?.accountName ?? trade.accountName).sort((a, b) => b.winRate - a.winRate || b.trades - a.trades)[0] ?? null;
  const mostProfitableSymbol = groupedMetric(propTrades, (trade) => trade.symbol)[0] ?? null;

  return (
    <AppShell eyebrow="FTMO OS" title="Trading Review">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Today P/L" value={money(netPnl(dailyTrades))} sublabel={`${dailyTrades.length} trades`} tone={netPnl(dailyTrades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Weekly P/L" value={money(netPnl(weeklyTrades))} sublabel={`${percent(winRate(weeklyTrades))} win rate`} tone={netPnl(weeklyTrades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Monthly P/L" value={money(netPnl(monthlyTrades))} sublabel={`${money(expectancy(monthlyTrades))} expectancy`} tone={netPnl(monthlyTrades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
        <MetricCard label="Most Profitable Setup" value={mostProfitableSetup?.label ?? "-"} sublabel={mostProfitableSetup ? money(mostProfitableSetup.netPnl) : "No reviewed setup"} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Section title={`Daily Review / ${periods.daily.label}`}>
          {dailyTrades.length ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Trades Today" value={`${dailyTrades.length}`} />
                <MetricCard label="Net P/L" value={money(netPnl(dailyTrades))} tone={netPnl(dailyTrades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
                <MetricCard label="Best Trade" value={dailyBest ? `${dailyBest.symbol} ${money(dailyBest.pnl)}` : "-"} />
                <MetricCard label="Worst Trade" value={dailyWorst ? `${dailyWorst.symbol} ${money(dailyWorst.pnl)}` : "-"} tone="text-rose-200" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Rules Violated</div>
                {dailyViolations.length ? <div className="text-sm text-slate-300">{Array.from(new Set(dailyViolations)).join(", ")}</div> : <div className="text-sm text-slate-500">No rule violations detected.</div>}
              </div>
              <GradeDistribution trades={dailyTrades} intelligence={intelligence} />
            </div>
          ) : (
            <EmptyState text="No closed FTMO trades today." />
          )}
        </Section>

        <Section title={`Weekly Review / ${periods.weekly.label}`}>
          {weeklyTrades.length ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Weekly P/L" value={money(netPnl(weeklyTrades))} tone={netPnl(weeklyTrades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
                <MetricCard label="Win Rate" value={percent(winRate(weeklyTrades))} />
                <MetricCard label="Profit Factor" value={profitFactor(weeklyTrades) >= 99 ? "No losses" : profitFactor(weeklyTrades).toFixed(2)} />
                <MetricCard label="Most Common Mistake" value={mostCommonMistake?.[0] ?? "-"} sublabel={mostCommonMistake ? `${mostCommonMistake[1]} trades` : "No mistake tags"} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Best Playbook" value={weeklyPlaybooks[0]?.label ?? "-"} sublabel={weeklyPlaybooks[0] ? money(weeklyPlaybooks[0].netPnl) : "No playbook data"} />
                <MetricCard label="Worst Playbook" value={weeklyPlaybooks.at(-1)?.label ?? "-"} sublabel={weeklyPlaybooks.at(-1) ? money(weeklyPlaybooks.at(-1)?.netPnl ?? 0) : "No playbook data"} tone="text-rose-200" />
              </div>
            </div>
          ) : (
            <EmptyState text="No closed FTMO trades this week." />
          )}
        </Section>

        <Section title={`Monthly Review / ${periods.monthly.label}`}>
          {monthlyTrades.length ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Monthly P/L" value={money(netPnl(monthlyTrades))} tone={netPnl(monthlyTrades) >= 0 ? "text-emerald-300" : "text-rose-300"} />
                <MetricCard label="Expectancy" value={money(expectancy(monthlyTrades))} />
                <MetricCard label="Best Symbol" value={monthlySymbols[0]?.label ?? "-"} sublabel={monthlySymbols[0] ? money(monthlySymbols[0].netPnl) : "No symbol data"} />
                <MetricCard label="Worst Symbol" value={monthlySymbols.at(-1)?.label ?? "-"} sublabel={monthlySymbols.at(-1) ? money(monthlySymbols.at(-1)?.netPnl ?? 0) : "No symbol data"} tone="text-rose-200" />
                <MetricCard label="Best Account" value={monthlyAccounts[0]?.label ?? "-"} sublabel={monthlyAccounts[0] ? money(monthlyAccounts[0].netPnl) : "No account data"} />
                <MetricCard label="Worst Account" value={monthlyAccounts.at(-1)?.label ?? "-"} sublabel={monthlyAccounts.at(-1) ? money(monthlyAccounts.at(-1)?.netPnl ?? 0) : "No account data"} tone="text-rose-200" />
              </div>
            </div>
          ) : (
            <EmptyState text="No closed FTMO trades this month." />
          )}
        </Section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Section title="TNPA Lessons Learned">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Most Profitable Setup" value={mostProfitableSetup?.label ?? "-"} sublabel={mostProfitableSetup ? money(mostProfitableSetup.netPnl) : "No setup data"} />
            <MetricCard label="Most Costly Violation" value={mostCostlyViolation?.label ?? "-"} sublabel={mostCostlyViolation ? money(mostCostlyViolation.netPnl) : "No violation data"} tone="text-rose-200" />
            <MetricCard label="Most Consistent Account" value={mostConsistentAccount?.label ?? "-"} sublabel={mostConsistentAccount ? `${percent(mostConsistentAccount.winRate)} win rate` : "No account data"} />
            <MetricCard label="Most Profitable Symbol" value={mostProfitableSymbol?.label ?? "-"} sublabel={mostProfitableSymbol ? money(mostProfitableSymbol.netPnl) : "No symbol data"} />
          </div>
        </Section>

        <Section title="Review Notes">
          <div className="grid gap-4">
            <ReviewNotesEditor label={`Daily Notes / ${periods.daily.label}`} note={reviewNotes.daily[periods.daily.key] ?? ""} onSave={(note) => writeReviewNote("daily", periods.daily.key, note)} />
            <ReviewNotesEditor label={`Weekly Notes / ${periods.weekly.key}`} note={reviewNotes.weekly[periods.weekly.key] ?? ""} onSave={(note) => writeReviewNote("weekly", periods.weekly.key, note)} />
            <ReviewNotesEditor label={`Monthly Notes / ${periods.monthly.label}`} note={reviewNotes.monthly[periods.monthly.key] ?? ""} onSave={(note) => writeReviewNote("monthly", periods.monthly.key, note)} />
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
