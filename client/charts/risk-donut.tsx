"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { RISK_COLORS } from "@client/src/theme";
import { TOOLTIP_STYLE } from "./chart-card";
import type { Risk } from "@client/src/types";

interface RiskDonutProps {
  data: { risk: Risk; value: number }[];
  height?: number;
  centerLabel?: string;
}

/** Donut showing the Low/Medium/High risk class balance. */
export function RiskDonut({ data, height = 240, centerLabel }: RiskDonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="risk"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={3}
            cornerRadius={6}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.risk} fill={RISK_COLORS[d.risk]} fillOpacity={0.9} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [
              `${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span className="text-xs text-emerald-100/60">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-7">
        <span className="text-2xl font-semibold text-white">{total.toLocaleString()}</span>
        <span className="text-[11px] text-emerald-100/45">{centerLabel ?? "records"}</span>
      </div>
    </div>
  );
}
