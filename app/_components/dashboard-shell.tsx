import { EquityCurveChart } from "@/app/_components/equity-curve-chart";
import { KpiCard } from "@/app/_components/kpi-card";
import { MonthlyPerformanceChart } from "@/app/_components/monthly-performance-chart";
import { RecentTradesTable } from "@/app/_components/recent-trades-table";
import { Sidebar } from "@/app/_components/sidebar";
import {
  equityCurve,
  kpis,
  monthlyPerformance,
  recentTrades,
} from "@/app/_lib/trading-data";

export function DashboardShell() {
  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_32rem)]" />
      <div className="relative flex">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.03] px-5 py-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                Professional Trading Journal
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                TNPA Trading OS
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Active Broker
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-100">
                  IC Markets Raw
                </div>
              </div>
              <button className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/40 hover:text-white">
                Export Report
              </button>
            </div>
          </header>

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
        </main>
      </div>
    </div>
  );
}
