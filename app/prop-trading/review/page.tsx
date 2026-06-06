import { TradingReviewModule } from "@/app/_components/trading-review-module";
import {
  importedMt5Report,
  mockEquityCurveFallback,
  mockMonthlyPerformanceFallback,
  tradeHistory,
} from "@/app/_lib/trading-data";

export default function PropTradingReviewPage() {
  return (
    <TradingReviewModule
      fallbackEquityCurve={mockEquityCurveFallback}
      fallbackMonthlyPerformance={mockMonthlyPerformanceFallback}
      initialReport={importedMt5Report}
      initialTrades={tradeHistory}
    />
  );
}
