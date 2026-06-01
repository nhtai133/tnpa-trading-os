import type { MonthlyPerformance } from "@/app/_lib/trading-data";

export function MonthlyPerformanceChart({
  data,
}: {
  data: MonthlyPerformance[];
}) {
  const max = Math.max(...data.map((item) => Math.abs(item.pnl)));

  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div>
        <h2 className="text-base font-semibold text-white">
          Monthly Performance
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Realized P/L by month, including losing periods
        </p>
      </div>

      <div className="mt-6 flex h-72 items-end gap-3 border-b border-white/10 pb-4">
        {data.map((item) => {
          const height = Math.max(12, (Math.abs(item.pnl) / max) * 210);
          const positive = item.pnl >= 0;

          return (
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={item.month}>
              <div className="flex h-56 w-full items-end justify-center">
                <div
                  className={`w-full max-w-9 rounded-t-sm ${
                    positive ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                  style={{ height }}
                  title={`$${item.pnl.toLocaleString()}`}
                />
              </div>
              <div className="text-xs font-medium text-slate-500">
                {item.month}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
