"use client";

import { AppShell } from "@/app/_components/app-shell";
import { EquityCurveChart } from "@/app/_components/equity-curve-chart";
import { KpiCard } from "@/app/_components/kpi-card";
import { MonthlyPerformanceChart } from "@/app/_components/monthly-performance-chart";
import { RecentTradesTable } from "@/app/_components/recent-trades-table";
import { useTradingDataset } from "@/app/_lib/use-trading-dataset";
import type {
  EquityPoint,
  MonthlyPerformance,
  Mt5AccountReport,
  Trade,
} from "@/app/_lib/trading-types";

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
  const { equityCurve, kpis, monthlyPerformance, recentTrades } =
    useTradingDataset({
      fallbackEquityCurve,
      fallbackMonthlyPerformance,
      initialReport,
      initialTrades,
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
