import { AppShell } from "@/app/_components/app-shell";
import { WealthSummary } from "@/app/_components/wealth-summary";

export default function PortfolioPage() {
  return (
    <AppShell eyebrow="Wealth" title="Portfolio">
      <WealthSummary />
    </AppShell>
  );
}
