"use client";

import { prettyName } from "@client/src/theme";

interface BoxChartProps {
  /** One or more boxes: min/q1/median/q3/max (+ optional mean). */
  boxes: {
    label: string;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    mean?: number;
    count?: number;
  }[];
  height?: number;
  logScale?: boolean;
  unit?: string;
}

/**
 * Hand-drawn SVG box-and-whisker plot (glass theme).
 * Used for single-feature distribution boxes and the
 * per-region deforestation spread.
 */
export function BoxplotChart({
  boxes,
  height = 300,
  logScale = true,
  unit = "ha",
}: BoxChartProps) {
  const tf = (v: number) => (logScale ? Math.log10(Math.max(v, 1)) : v);
  const lo = Math.min(...boxes.map((b) => tf(b.min)));
  const hi = Math.max(...boxes.map((b) => tf(b.max)));
  const pad = (hi - lo) * 0.08 || 1;
  const min = lo - pad;
  const max = hi + pad;

  const W = 100; // viewBox width in % terms
  const rowH = height / Math.max(boxes.length, 1);
  const fmt = (v: number) =>
    v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
        ? `${(v / 1_000).toFixed(0)}k`
        : v.toFixed(0);

  const scale = (v: number) => ((tf(v) - min) / (max - min)) * W;

  const ticks: number[] = [];
  for (let t = 0; t <= 8; t++) {
    const raw = min + ((max - min) * t) / 8;
    const real = logScale ? Math.pow(10, raw) : raw;
    ticks.push(real);
  }

  return (
    <div className="w-full overflow-hidden" data-unit={unit}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-auto w-full"
        style={{ height }}
      >
        {ticks.map((t, i) => {
          const x = scale(t);
          return (
            <line
              key={i}
              x1={x}
              x2={x}
              y1={0}
              y2={height}
              stroke="rgba(167,243,208,0.08)"
              strokeWidth={0.3}
            />
          );
        })}
        {boxes.map((b, i) => {
          const y = rowH * i + rowH / 2;
          const x0 = scale(b.min);
          const x1 = scale(b.q1);
          const x2 = scale(b.median);
          const x3 = scale(b.q3);
          const x4 = scale(b.max);
          const boxW = Math.max(x3 - x1, 0.6);
          const color = i % 2 === 0 ? "#34d399" : "#6ee7b7";
          return (
            <g key={b.label}>
              {/* whiskers */}
              <line x1={x0} x2={x1} y1={y} y2={y} stroke={color} strokeWidth={0.5} opacity={0.7} />
              <line x1={x3} x2={x4} y1={y} y2={y} stroke={color} strokeWidth={0.5} opacity={0.7} />
              <line x1={x0} x2={x0} y1={y - rowH * 0.18} y2={y + rowH * 0.18} stroke={color} strokeWidth={0.5} opacity={0.7} />
              <line x1={x4} x2={x4} y1={y - rowH * 0.18} y2={y + rowH * 0.18} stroke={color} strokeWidth={0.5} opacity={0.7} />
              {/* box */}
              <rect
                x={x1}
                y={y - rowH * 0.22}
                width={boxW}
                height={rowH * 0.44}
                rx={1.2}
                fill="url(#boxfill)"
                stroke={color}
                strokeWidth={0.5}
              />
              {/* median */}
              <line x1={x2} x2={x2} y1={y - rowH * 0.22} y2={y + rowH * 0.22} stroke="#ecfdf5" strokeWidth={0.7} />
              {/* label */}
              <text
                x={1}
                y={y - rowH * 0.3}
                fill="rgba(209,250,229,0.75)"
                fontSize={rowH > 46 ? 3.4 : 2.6}
                className="select-none"
              >
                {prettyName(b.label)}
                {b.count !== undefined && (
                  <tspan fill="rgba(209,250,229,0.4)"> ({b.count})</tspan>
                )}
              </text>
              <text
                x={1}
                y={y + rowH * 0.36}
                fill="rgba(209,250,229,0.45)"
                fontSize={2.4}
                className="select-none"
              >
                med {fmt(b.median)} · q1 {fmt(b.q1)} · q3 {fmt(b.q3)} · max {fmt(b.max)}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="boxfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(52,211,153,0.35)" />
            <stop offset="100%" stopColor="rgba(52,211,153,0.12)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[10px] text-emerald-100/40">
        {ticks.map((t, i) => (
          <span key={i}>{fmt(t)}</span>
        ))}
      </div>
    </div>
  );
}
