"use client";

import { AppShell } from "@/app/_components/app-shell";
import { EquityCurveChart } from "@/app/_components/equity-curve-chart";
import { KpiCard } from "@/app/_components/kpi-card";
import { MonthlyPerformanceChart } from "@/app/_components/monthly-performance-chart";
import { RecentTradesTable } from "@/app/_components/recent-trades-table";
import { buildRiskMetrics } from "@/app/_lib/risk-metrics";
import { useRiskSettings } from "@/app/_lib/use-risk-settings";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import type {
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  SetupTag,
  Trade,
} from "@/app/_lib/trading-types";

function formatMoney(value: number) {
  const sign = value >= 0 ? "" : "-";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function SetupPerformanceCard({
  label,
  netProfit,
  setupTag,
  trades,
}: {
  label: string;
  netProfit: number;
  setupTag: SetupTag;
  trades: number;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className="mt-3 text-xl font-semibold text-white">{setupTag}</div>
      <div
        className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          netProfit >= 0
            ? "bg-emerald-400/10 text-emerald-300"
            : "bg-rose-400/10 text-rose-300"
        }`}
      >
        {formatMoney(netProfit)} - {trades} trades
      </div>
    </section>
  );
}

function DashboardRiskCard({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  detail: string;
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-400/10 text-emerald-300"
      : tone === "negative"
        ? "bg-rose-400/10 text-rose-300"
        : "bg-amber-400/10 text-amber-300";

  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <div className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
        {detail}
      </div>
    </section>
  );
}

export function DashboardShell({
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
  const settings = useRiskSettings();
  const {
    accountReport,
    bestSetup,
    equityCurve,
    kpis,
    monthlyPerformance,
    recentTrades,
    tradeHistory,
    worstSetup,
  } =
    useTradingDataset({
      fallbackEquityCurve,
      fallbackMonthlyPerformance,
      initialReport,
      initialTrades,
    });
  const risk = buildRiskMetrics({
    report: accountReport,
    settings,
    trades: tradeHistory,
  });

  return (
    <AppShell
      eyebrow="Professional Trading Journal"
      title="TNPA Trading OS"
      action={
        <button className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white">
          Export Report
        </button>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </section>

      {bestSetup && worstSetup ? (
        <section className="mt-4 grid gap-4 xl:grid-cols-4">
          <SetupPerformanceCard
            label="Best Setup"
            setupTag={bestSetup.setupTag}
            netProfit={bestSetup.netProfit}
            trades={bestSetup.trades}
          />
          <SetupPerformanceCard
            label="Worst Setup"
            setupTag={worstSetup.setupTag}
            netProfit={worstSetup.netProfit}
            trades={worstSetup.trades}
          />
          <DashboardRiskCard
            label="FTMO Risk Status"
            value={risk.riskLevel}
            tone={
              risk.riskLevel === "Safe"
                ? "positive"
                : risk.riskLevel === "Warning"
                  ? "neutral"
                  : "negative"
            }
            detail={`Daily ${risk.dailyLossUsage.toFixed(1)}% / Max ${risk.maxLossUsage.toFixed(1)}%`}
          />
          <DashboardRiskCard
            label="Discipline Score"
            value={`${risk.disciplineScore}/100`}
            tone={
              risk.disciplineScore >= 80
                ? "positive"
                : risk.disciplineScore >= 60
                  ? "neutral"
                  : "negative"
            }
            detail="FTMO control model"
          />
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <EquityCurveChart data={equityCurve} />
        <MonthlyPerformanceChart data={monthlyPerformance} />
      </section>

      <div className="mt-6">
        <RecentTradesTable trades={recentTrades} />
      </div>
    </AppShell>
  );
}
