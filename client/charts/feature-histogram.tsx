"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE } from "./chart-card";

interface FeatureHistogramProps {
  data: { bin: string; count: number }[];
  color?: string;
  height?: number;
}

/** Distribution histogram for a single numeric feature. */
export function FeatureHistogram({ data, color = "#34d399", height = 280 }: FeatureHistogramProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 8 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="bin" {...AXIS_PROPS} minTickGap={28} angle={-20} textAnchor="end" height={52} />
          <YAxis {...AXIS_PROPS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={color} fillOpacity={0.45 + 0.55 * (i / Math.max(1, data.length - 1))} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
