"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHydrated } from "@/app/_lib/use-hydrated";

type NavItem = {
  href: string;
  label: string;
  marker: string;
};

const propTradingItems: NavItem[] = [
  { href: "/prop-trading", label: "FTMO Dashboard", marker: "FD" },
  { href: "/prop-trading/trades", label: "FTMO Trades", marker: "FT" },
  { href: "/prop-trading/analytics", label: "FTMO Analytics", marker: "FX" },
  { href: "/prop-trading/setup-intelligence", label: "Setup Intelligence", marker: "SI" },
  { href: "/prop-trading/risk", label: "FTMO Risk Monitor", marker: "FR" },
  { href: "/prop-trading/import-mt5", label: "FTMO Import MT5", marker: "FM" },
  { href: "/prop-trading/accounts", label: "FTMO Accounts", marker: "FA" },
  { href: "/prop-trading/challenges", label: "Challenges", marker: "PC" },
  { href: "/prop-trading/funded-accounts", label: "FTMO Funded", marker: "FF" },
  { href: "/prop-trading/payouts", label: "Payouts", marker: "PO" },
];

const personalTradingItems: NavItem[] = [
  { href: "/personal-trading", label: "Dashboard", marker: "TD" },
  { href: "/personal-trading/accounts", label: "Accounts", marker: "TA" },
  { href: "/personal-trading/performance", label: "Performance", marker: "TP" },
  { href: "/personal-trading/withdrawals", label: "Withdrawals", marker: "TW" },
  { href: "/personal-trading/analytics", label: "Analytics", marker: "TX" },
];

const sharedTradingItems: NavItem[] = [
  { href: "/trades", label: "Trades", marker: "TR" },
  { href: "/risk", label: "Risk Monitor", marker: "RM" },
  { href: "/import-mt5", label: "Import MT5", marker: "MT" },
];

const wealthItems: NavItem[] = [
  { href: "/wealth", label: "Wealth Dashboard", marker: "WD" },
  { href: "/net-worth", label: "Net Worth", marker: "NW" },
  { href: "/portfolio", label: "Portfolio", marker: "PF" },
  { href: "/bank-accounts", label: "Bank Accounts", marker: "BA" },
  { href: "/savings", label: "Savings", marker: "SV" },
  { href: "/broker-accounts", label: "Broker Accounts", marker: "BR" },
  { href: "/real-estate", label: "Real Estate", marker: "RE" },
  { href: "/archive-history", label: "Archive History", marker: "AH" },
];

const systemItems: NavItem[] = [{ href: "/settings", label: "Settings", marker: "ST" }];

function SidebarSection({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname();
  const hydrated = useHydrated();

  return (
    <div className="space-y-2">
      <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{title}</div>
      <div className="space-y-1">
        {items.map((item) => {
          const isSectionDashboard =
            item.href === "/prop-trading" ||
            item.href === "/personal-trading" ||
            item.href === "/wealth";
          const active =
            hydrated &&
            (pathname === item.href ||
            (item.href !== "/" &&
              !isSectionDashboard &&
              pathname.startsWith(`${item.href}/`)));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition",
                active
                  ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-100"
                  : "border-transparent text-slate-300 hover:border-white/10 hover:bg-slate-900/80 hover:text-white",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-semibold",
                  active ? "border-cyan-500/25 bg-cyan-500/15 text-cyan-300" : "border-white/10 bg-slate-900 text-slate-500",
                ].join(" ")}
              >
                {item.marker}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-white/10 bg-slate-950/95 px-4 py-5 backdrop-blur">
      <Link href="/" className="mb-6 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-4">
        <div className="text-xs uppercase tracking-[0.32em] text-cyan-300/80">TNPA OS</div>
        <div className="mt-1 text-lg font-semibold text-white">Trading + Wealth</div>
        <div className="mt-1 text-sm text-slate-400">Professional journal and portfolio ops</div>
      </Link>

      <div className="flex-1 space-y-6 overflow-y-auto">
        <SidebarSection title="FTMO OS" items={propTradingItems} />
        <SidebarSection title="Personal Trading" items={personalTradingItems} />
        <SidebarSection title="Shared Trading" items={sharedTradingItems} />
        <SidebarSection title="Wealth" items={wealthItems} />
        <SidebarSection title="System" items={systemItems} />
      </div>
    </aside>
  );
}
