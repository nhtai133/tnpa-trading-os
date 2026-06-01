import type { EquityPoint } from "@/app/_lib/trading-data";

function buildPath(points: EquityPoint[], width: number, height: number) {
  const values = points.map((point) => point.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.equity - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  const width = 720;
  const height = 260;
  const linePath = buildPath(data, width, height);
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <section className="rounded-md border border-white/10 bg-[#0d121c] p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Equity Curve</h2>
          <p className="mt-1 text-sm text-slate-500">
            Growth of closed balance across the current year
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-500">Current Equity</div>
          <div className="text-xl font-semibold text-emerald-300">
            $148,920
          </div>
        </div>
      </div>

      <div className="mt-6 h-72 w-full overflow-hidden">
        <svg
          className="h-full w-full"
          preserveAspectRatio="none"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Equity curve chart"
        >
          <defs>
            <linearGradient id="equityArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((line) => (
            <line
              key={line}
              x1="0"
              x2={width}
              y1={(height / 4) * line}
              y2={(height / 4) * line}
              stroke="rgba(148, 163, 184, 0.12)"
              strokeWidth="1"
            />
          ))}
          <path d={areaPath} fill="url(#equityArea)" />
          <path
            d={linePath}
            fill="none"
            stroke="#34d399"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        </svg>
      </div>
    </section>
  );
}
