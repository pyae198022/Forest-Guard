"use client";

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis } from "recharts";
import { RISK_COLORS } from "@client/src/theme";
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE } from "./chart-card";
import type { Risk } from "@client/src/types";

interface RiskScatterProps {
  x: string;
  y: string;
  points: Record<string, number | string | Risk>[];
  height?: number;
}

/** 2-D scatter colored by deforestation risk class. */
export function RiskScatter({ x, y, points, height = 320 }: RiskScatterProps) {
  const groups = ["Low", "Medium", "High"] as const;
  const label = (k: string) => k.replace(/_/g, " ");
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
          <CartesianGrid {...GRID_PROPS} vertical />
          <XAxis type="number" dataKey={x} name={label(x)} {...AXIS_PROPS} domain={["auto", "auto"]} />
          <YAxis type="number" dataKey={y} name={label(y)} {...AXIS_PROPS} domain={["auto", "auto"]} />
          <ZAxis range={[36, 36]} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ strokeDasharray: "3 3", stroke: "rgba(167,243,208,0.25)" }}
            formatter={(value: number, name: string) => [value, label(name)]}
          />
          {groups.map((risk) => (
            <Scatter
              key={risk}
              name={risk}
              data={points.filter((p) => p.risk === risk)}
              fill={RISK_COLORS[risk]}
              fillOpacity={0.55}
              stroke="transparent"
            />
          ))}
          <Legend iconType="circle" iconSize={8} formatter={(v: string) => (
            <span className="text-xs text-emerald-100/60">{v}</span>
          )} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
