"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { RISK_COLORS } from "@client/src/theme";
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE } from "./chart-card";

interface RegionBarsProps {
  data: Record<string, number | string>[];
  height?: number;
  stacked?: boolean;
}

/** Records per region, stacked by risk class. */
export function RegionBars({ data, height = 280, stacked = true }: RegionBarsProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="region" {...AXIS_PROPS} interval={0} angle={-14} textAnchor="end" height={54} />
          <YAxis {...AXIS_PROPS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend iconType="circle" iconSize={8} formatter={(v: string) => (
            <span className="text-xs text-emerald-100/60">{v}</span>
          )} />
          <Bar dataKey="Low" stackId="risk" fill={RISK_COLORS.Low} fillOpacity={0.9} radius={[0, 0, 3, 3]} />
          <Bar dataKey="Medium" stackId="risk" fill={RISK_COLORS.Medium} fillOpacity={0.9} />
          <Bar dataKey="High" stackId="risk" fill={RISK_COLORS.High} fillOpacity={0.9} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
