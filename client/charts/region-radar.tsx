"use client";

import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend, Tooltip, ResponsiveContainer,
} from "recharts";
import { REGION_COLORS } from "@client/src/theme";
import { TOOLTIP_STYLE } from "./chart-card";

interface RegionRadarProps {
  /** one entry per axis; each series adds one region */
  axes: string[];
  series: { region: string; values: number[] }[];
  height?: number;
}

/** Normalized multi-region profile radar. */
export function RegionRadar({ axes, series, height = 300 }: RegionRadarProps) {
  const data = axes.map((axis, idx) => {
    const row: Record<string, number | string> = { axis };
    series.forEach((s) => {
      row[s.region] = s.values[idx] ?? 0;
    });
    return row;
  });

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(167,243,208,0.14)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "rgba(209,250,229,0.55)", fontSize: 10.5 }}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {series.map((s) => (
            <Radar
              key={s.region}
              name={s.region}
              dataKey={s.region}
              stroke={REGION_COLORS[s.region] ?? "#34d399"}
              fill={REGION_COLORS[s.region] ?? "#34d399"}
              fillOpacity={0.16}
              strokeWidth={2}
            />
          ))}
          <Legend iconType="circle" iconSize={8} formatter={(v: string) => (
            <span className="text-xs text-emerald-100/60">{v}</span>
          )} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
