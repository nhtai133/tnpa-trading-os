import { TradesModule } from "@/app/_components/trades-module";
import {
  importedMt5Report,
  mockEquityCurveFallback,
  mockMonthlyPerformanceFallback,
  tradeHistory,
} from "@/app/_lib/trading-data";

export default function PropTradesPage() {
  return (
    <TradesModule
      eyebrow="FTMO OS"
      fallbackEquityCurve={mockEquityCurveFallback}
      fallbackMonthlyPerformance={mockMonthlyPerformanceFallback}
      initialReport={importedMt5Report}
      scopeAccountType="prop-firm"
      title="FTMO Trades"
      trades={tradeHistory}
    />
  );
}
