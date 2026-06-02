import { AnalyticsModule } from "@/app/_components/analytics-module";
import {
  importedMt5Report,
  mockEquityCurveFallback,
  mockMonthlyPerformanceFallback,
  tradeHistory,
} from "@/app/_lib/trading-data";

export default function PropAnalyticsPage() {
  return (
    <AnalyticsModule
      eyebrow="FTMO OS"
      fallbackEquityCurve={mockEquityCurveFallback}
      fallbackMonthlyPerformance={mockMonthlyPerformanceFallback}
      initialReport={importedMt5Report}
      initialTrades={tradeHistory}
      scopeAccountType="prop-firm"
      title="FTMO Analytics"
    />
  );
}
