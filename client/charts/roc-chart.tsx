"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { RISK_COLORS } from "@client/src/theme";
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE } from "./chart-card";
import type { Risk } from "@client/src/types";

interface RocChartProps {
  curves: Record<string, { fpr: number[]; tpr: number[] }>;
  height?: number;
}

/** One-vs-rest ROC curves; merges per-class point arrays into chart rows. */
export function RocChart({ curves, height = 320 }: RocChartProps) {
  const maxLen = Math.max(
    ...Object.values(curves).map((c) => Math.min(c.fpr.length, c.tpr.length)),
    2,
  );
  const data = Array.from({ length: maxLen }, (_, i) => {
    const row: Record<string, number> = { x: i / (maxLen - 1 || 1) };
    for (const [cls, c] of Object.entries(curves)) {
      const idx = Math.min(i, c.fpr.length - 1);
      row[cls] = c.tpr[idx];
      // align x with that class' own fpr
      row[`x_${cls}`] = c.fpr[idx];
    }
    return row;
  });

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
          <CartesianGrid {...GRID_PROPS} vertical />
          <XAxis
            type="number"
            dataKey="x"
            name="FPR"
            {...AXIS_PROPS}
            domain={[0, 1]}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{ value: "False Positive Rate", position: "insideBottom", offset: -4, fill: "rgba(209,250,229,0.4)", fontSize: 11 }}
          />
          <YAxis
            type="number"
            {...AXIS_PROPS}
            domain={[0, 1]}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{ value: "True Positive Rate", angle: -90, position: "insideLeft", fill: "rgba(209,250,229,0.4)", fontSize: 11 }}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => v?.toFixed(3)} />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
            stroke="rgba(255,255,255,0.22)"
            strokeDasharray="4 4"
          />
          {(Object.keys(curves) as Risk[]).map((cls) => (
            <Line
              key={cls}
              data={data}
              type="monotone"
              dataKey={cls}
              name={`${cls} vs rest`}
              stroke={RISK_COLORS[cls]}
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
          <Legend iconType="plainline" formatter={(v: string) => (
            <span className="text-xs text-emerald-100/60">{v}</span>
          )} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
