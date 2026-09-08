"use client";

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ZAxis } from "recharts";
import { CHART_PALETTE, RISK_COLORS } from "@client/src/theme";
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE } from "./chart-card";
import type { Risk } from "@client/src/types";

interface ClusterScatterProps {
  points: { x: number; y: number; cluster: number; risk: Risk }[];
  variance: number[];
  height?: number;
}

/** PCA projection of K-Means clusters, colored by cluster id. */
export function ClusterScatter({ points, variance, height = 320 }: ClusterScatterProps) {
  const clusters = [...new Set(points.map((p) => p.cluster))].sort((a, b) => a - b);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
          <CartesianGrid {...GRID_PROPS} vertical />
          <XAxis
            type="number" dataKey="x" name="PC1" {...AXIS_PROPS}
            label={{ value: `PC1 (${((variance[0] ?? 0) * 100).toFixed(0)}%)`, position: "insideBottom", offset: -4, fill: "rgba(209,250,229,0.4)", fontSize: 11 }}
          />
          <YAxis
            type="number" dataKey="y" name="PC2" {...AXIS_PROPS}
            label={{ value: `PC2 (${((variance[1] ?? 0) * 100).toFixed(0)}%)`, angle: -90, position: "insideLeft", fill: "rgba(209,250,229,0.4)", fontSize: 11 }}
          />
          <ZAxis range={[30, 30]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ strokeDasharray: "3 3", stroke: "rgba(167,243,208,0.2)" }} />
          {clusters.map((c) => (
            <Scatter
              key={c}
              name={`Cluster ${c}`}
              data={points.filter((p) => p.cluster === c)}
              fill={CHART_PALETTE[c % CHART_PALETTE.length]}
              fillOpacity={0.6}
            />
          ))}
          <Legend iconType="circle" iconSize={8} formatter={(v: string) => (
            <span className="text-xs text-emerald-100/60">{v}</span>
          )} />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-[11px] text-emerald-100/45">
        {clusters.map((c) => {
          const dominant = points.filter((p) => p.cluster === c);
          const counts = dominant.reduce<Record<string, number>>((acc, p) => {
            acc[p.risk] = (acc[p.risk] ?? 0) + 1;
            return acc;
          }, {});
          const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as Risk | undefined;
          return top ? (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: RISK_COLORS[top] }} />
              Cluster {c}: mostly <b className="text-emerald-200">{top}</b> risk
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}
