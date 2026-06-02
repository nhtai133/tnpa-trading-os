import { RiskModule } from "@/app/_components/risk-module";
import {
  importedMt5Report,
  mockEquityCurveFallback,
  mockMonthlyPerformanceFallback,
  tradeHistory,
} from "@/app/_lib/trading-data";

export default function PropRiskPage() {
  return (
    <RiskModule
      eyebrow="FTMO OS"
      fallbackEquityCurve={mockEquityCurveFallback}
      fallbackMonthlyPerformance={mockMonthlyPerformanceFallback}
      initialReport={importedMt5Report}
      initialTrades={tradeHistory}
      scopeAccountType="prop-firm"
      title="FTMO Risk Monitor"
    />
  );
}
