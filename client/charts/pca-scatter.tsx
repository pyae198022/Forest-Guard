"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE } from "./chart-card";

interface PcaScatterProps {
  points: { x: number; y: number; cluster: number }[];
  variance: number[];
  height?: number;
}

const CLUSTER_COLORS = ["#34d399", "#f59e0b", "#60a5fa", "#f472b6", "#a78bfa"];

/** PCA 2-D scatter of K-Means clusters (book Figure 3.1.2.3.2). */
export function PcaScatter({ points, variance, height = 320 }: PcaScatterProps) {
  const clusters = [...new Set(points.map((p) => p.cluster))].sort((a, b) => a - b);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          type="number"
          dataKey="x"
          name="PC1"
          {...AXIS_PROPS}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => v.toFixed(1)}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="PC2"
          {...AXIS_PROPS}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => v.toFixed(1)}
        />
        <ZAxis range={[36, 36]} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number, n: string) => [v.toFixed(3), n]}
          labelFormatter={() => ""}
        />
        {clusters.map((c) => (
          <Scatter
            key={c}
            name={`Cluster ${c}`}
            data={points.filter((p) => p.cluster === c)}
            fill={CLUSTER_COLORS[c % CLUSTER_COLORS.length]}
            fillOpacity={0.55}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

interface LiftScatterProps {
  points: { support: number; confidence: number; lift: number }[];
  height?: number;
}

/** Support-vs-confidence rules scatter, coloured by lift (Fig 3.1.1.2). */
export function LiftScatter({ points, height = 320 }: LiftScatterProps) {
  const lifts = points.map((p) => p.lift);
  const lo = Math.min(...lifts);
  const hi = Math.max(...lifts);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          type="number"
          dataKey="support"
          name="Support"
          {...AXIS_PROPS}
          domain={[0, "auto"]}
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
        />
        <YAxis
          type="number"
          dataKey="confidence"
          name="Confidence"
          {...AXIS_PROPS}
          domain={[0, 1.02]}
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
        />
        <ZAxis dataKey="lift" range={[24, 130]} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: number, n: string) =>
            n === "lift" ? [v.toFixed(2), "Lift"] : [`${(v * 100).toFixed(1)}%`, n]
          }
          labelFormatter={() => ""}
        />
        <Scatter
          name="Rules"
          data={points}
          fill="#34d399"
        >
          {points.map((p, i) => (
            <circle
              key={i}
              // colour interpolates from steel to gold as lift grows
              fill={
                hi === lo
                  ? "#34d399"
                  : `hsl(${160 - (120 * (p.lift - lo)) / (hi - lo)}, 70%, ${55 - 8 * ((p.lift - lo) / (hi - lo))}%)`
              }
              fillOpacity={0.55}
              r={4 + 8 * ((p.lift - lo) / (hi - lo || 1))}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
