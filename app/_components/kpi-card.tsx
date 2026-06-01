import type { Kpi } from "@/app/_lib/trading-data";

const toneStyles = {
  positive: "text-emerald-300 bg-emerald-400/10",
  negative: "text-rose-300 bg-rose-400/10",
  neutral: "text-sky-300 bg-sky-400/10",
};

export function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-slate-400">{kpi.label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{kpi.value}</div>
      <div
        className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneStyles[kpi.tone]}`}
      >
        {kpi.change}
      </div>
    </section>
  );
}
