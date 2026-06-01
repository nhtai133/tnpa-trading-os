import type { ReactNode } from "react";
import { Sidebar } from "@/app/_components/sidebar";

type AppShellProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

export function AppShell({ action, children, eyebrow, title }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_32rem)]" />
      <div className="relative flex">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.03] px-5 py-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                {eyebrow}
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Active Broker
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-100">
                  IC Markets Raw
                </div>
              </div>
              {action}
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
