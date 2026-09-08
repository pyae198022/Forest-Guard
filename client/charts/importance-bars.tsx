"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE } from "./chart-card";

interface ImportanceBarsProps {
  data: { feature: string; importance: number }[];
  height?: number;
}

/** Horizontal top-k feature importance from the selected model. */
export function ImportanceBars({ data, height }: ImportanceBarsProps) {
  const h = height ?? Math.max(240, data.length * 30 + 40);
  const pretty = (f: string) => f.replace(/_/g, " ");
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 30, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />
          <XAxis type="number" {...AXIS_PROPS} domain={[0, "dataMax"]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
          <YAxis type="category" dataKey="feature" {...AXIS_PROPS} width={120} tickFormatter={pretty} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "importance"]}
          />
          <Bar dataKey="importance" radius={[0, 6, 6, 0]} maxBarSize={18}>
            {data.map((_, i) => (
              <Cell key={i} fill={`rgba(52,211,153,${0.95 - i * (0.6 / Math.max(1, data.length))})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
