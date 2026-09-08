"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE } from "./chart-card";

interface TrendAreaProps {
  data: Record<string, number | string>[];
  xKey: string;
  series: { key: string; color: string; label: string }[];
  height?: number;
}

/** Smoothed multi-series area chart (e.g., canopy vs biomass across NDVI bands). */
export function TrendArea({ data, xKey, series, height = 280 }: TrendAreaProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey={xKey} {...AXIS_PROPS} minTickGap={24} />
          <YAxis {...AXIS_PROPS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "rgba(167,243,208,0.2)" }} />
          <Legend iconType="circle" iconSize={8} formatter={(v: string) => (
            <span className="text-xs text-emerald-100/60">{v}</span>
          )} />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
