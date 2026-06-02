import { WealthSummary } from "../_components/wealth-summary";
import { WealthDashboardV2 } from "../_components/wealth-dashboard-v2";

export default function WealthPage() {
  return (
    <div className="space-y-6">
      <WealthSummary />
      <WealthDashboardV2 tradingAccountEquity={0} tradingAccountName="" />
    </div>
  );
}
