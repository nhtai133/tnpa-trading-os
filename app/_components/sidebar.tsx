"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationGroups = [
  {
    label: "TRADING",
    items: [
      { label: "Dashboard", href: "/" },
      { label: "Trades", href: "/trades" },
      { label: "Analytics", href: "/analytics" },
      { label: "Risk Monitor", href: "/risk" },
      { label: "Import MT5", href: "/import-mt5" },
    ],
  },
  {
    label: "WEALTH",
    items: [
      { label: "Net Worth", href: "/net-worth" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Bank Accounts", href: "/bank-accounts" },
      { label: "Savings", href: "/savings" },
      { label: "Broker Accounts", href: "/broker-accounts" },
      { label: "Real Estate", href: "/real-estate" },
    ],
  },
  {
    label: "SYSTEM",
    items: [{ label: "Settings", href: "/settings" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-white/10 bg-[#080b12]/95 px-5 py-6 lg:block">
      <div className="mb-10">
        <div className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300">
          TNPA
        </div>
        <div className="mt-2 text-2xl font-semibold text-white">
          Trading OS
        </div>
      </div>

      <nav className="space-y-6">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              {group.label}
            </div>
            <div className="space-y-2">
              {group.items.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    className={`flex h-11 items-center justify-between rounded-md px-3 text-sm font-medium transition ${
                      active
                        ? "bg-emerald-400/12 text-emerald-200 ring-1 ring-emerald-300/20"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                    }`}
                    href={item.href}
                    key={item.href}
                  >
                    <span>{item.label}</span>
                    {active ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-10 rounded-md border border-white/10 bg-white/[0.03] p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Account
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              FTMO Swing
            </div>
            <div className="text-xs text-slate-500">MT5 connected</div>
          </div>
          <div className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            Live
          </div>
        </div>
      </div>
    </aside>
  );
}
