"use client";

import { cn } from "@/lib/utils";
import { RISK_COLORS } from "@client/src/theme";
import type { Risk } from "@client/src/types";

/** Colored pill for Low / Medium / High risk labels. */
export function RiskBadge({ risk, className }: { risk: Risk; className?: string }) {
  const color = RISK_COLORS[risk] ?? "#94a3b8";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color,
        borderColor: `${color}44`,
        backgroundColor: `${color}14`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {risk}
    </span>
  );
}
