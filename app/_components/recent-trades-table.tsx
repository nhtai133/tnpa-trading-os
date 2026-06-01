import type { Trade } from "@/app/_lib/trading-data";

export function RecentTradesTable({ trades }: { trades: Trade[] }) {
  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
        <div>
          <h2 className="text-base font-semibold text-white">Recent Trades</h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest journaled executions from MT5
          </p>
        </div>
        <button className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300">
          Import MT5
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="px-5 py-4 font-semibold">Trade</th>
              <th className="px-5 py-4 font-semibold">Symbol</th>
              <th className="px-5 py-4 font-semibold">Setup</th>
              <th className="px-5 py-4 font-semibold">Side</th>
              <th className="px-5 py-4 font-semibold">RR</th>
              <th className="px-5 py-4 font-semibold">P/L</th>
              <th className="px-5 py-4 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {trades.map((trade) => {
              const positive = trade.pnl >= 0;

              return (
                <tr className="text-slate-300" key={trade.id}>
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-100">{trade.id}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {trade.date}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-white">
                    {trade.symbol}
                  </td>
                  <td className="px-5 py-4">{trade.setup}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-slate-200">
                      {trade.side}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-semibold">{trade.rr}R</td>
                  <td
                    className={`px-5 py-4 font-semibold ${
                      positive ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {positive ? "+" : "-"}${Math.abs(trade.pnl).toLocaleString()}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        trade.result === "Win"
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-rose-400/10 text-rose-300"
                      }`}
                    >
                      {trade.result}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
