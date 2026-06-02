import { AppShell } from "@/app/_components/app-shell";
import { WealthSummary } from "@/app/_components/wealth-summary";

export default function NetWorthPage() {
  return (
    <AppShell eyebrow="Wealth" title="Net Worth">
      <WealthSummary />
    </AppShell>
  );
}
