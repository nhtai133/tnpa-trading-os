"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  marker: string;
};

const tradingItems: NavItem[] = [
  { href: "/trading", label: "Trading Dashboard", marker: "TD" },
  { href: "/prop-firm", label: "Prop Firm", marker: "PF" },
  { href: "/broker-trading", label: "Broker Trading", marker: "BT" },
  { href: "/trades", label: "Trades", marker: "TR" },
  { href: "/analytics", label: "Analytics", marker: "AN" },
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

  return (
    <div className="space-y-2">
      <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{title}</div>
      <div className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
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
        <SidebarSection title="Trading" items={tradingItems} />
        <SidebarSection title="Wealth" items={wealthItems} />
        <SidebarSection title="System" items={systemItems} />
      </div>
    </aside>
  );
}
