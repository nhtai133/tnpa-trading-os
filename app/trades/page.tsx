import { AppShell } from "@/app/_components/app-shell";
import { TradesModule } from "@/app/_components/trades-module";
import {
  importedMt5Report,
  mockEquityCurveFallback,
  mockMonthlyPerformanceFallback,
  tradeHistory,
} from "@/app/_lib/trading-data";

export default function TradesPage() {
  return (
    <AppShell
      eyebrow="Execution Database"
      title="Trades"
      action={
        <button className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300">
          New Trade
        </button>
      }
    >
      <TradesModule
        fallbackEquityCurve={mockEquityCurveFallback}
        fallbackMonthlyPerformance={mockMonthlyPerformanceFallback}
        initialReport={importedMt5Report}
        trades={tradeHistory}
      />
    </AppShell>
  );
}
