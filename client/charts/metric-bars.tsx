"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { CHART_PALETTE } from "@client/src/theme";
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE } from "./chart-card";

interface MetricBarsProps {
  data: Record<string, string | number>[];
  metrics: { key: string; label: string }[];
  height?: number;
}

/** Grouped bars comparing model scores side by side. */
export function MetricBars({ data, metrics, height = 300 }: MetricBarsProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="name" {...AXIS_PROPS} interval={0} angle={-12} textAnchor="end" height={58} />
          <YAxis {...AXIS_PROPS} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend iconType="circle" iconSize={8} formatter={(v: string) => (
            <span className="text-xs text-emerald-100/60">{v}</span>
          )} />
          {metrics.map((m, i) => (
            <Bar
              key={m.key}
              dataKey={m.key}
              name={m.label}
              fill={CHART_PALETTE[i % CHART_PALETTE.length]}
              fillOpacity={0.85}
              radius={[4, 4, 0, 0]}
              maxBarSize={30}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
