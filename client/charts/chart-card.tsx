"use client";

import { GlassCard } from "@client/components/glass-card";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  footer?: React.ReactNode;
}

/** Glass container for every chart, with consistent typography. */
export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  className,
  contentClassName,
  footer,
}: ChartCardProps) {
  return (
    <GlassCard className={cn("flex flex-col p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-emerald-100/45">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      <div className={cn("min-h-0 flex-1", contentClassName)}>{children}</div>
      {footer && <div className="mt-3 border-t border-white/[0.06] pt-3">{footer}</div>}
    </GlassCard>
  );
}

/** Shared Recharts styling so every chart feels like the same product. */
export const AXIS_PROPS = {
  stroke: "rgba(209,250,229,0.35)",
  tick: { fill: "rgba(209,250,229,0.55)", fontSize: 11 },
  tickLine: false,
} as const;

export const GRID_PROPS = {
  strokeDasharray: "3 6",
  stroke: "rgba(167,243,208,0.10)",
  vertical: false,
} as const;

export const TOOLTIP_STYLE = {
  backgroundColor: "rgba(6, 23, 15, 0.92)",
  border: "1px solid rgba(52, 211, 153, 0.25)",
  borderRadius: 12,
  backdropFilter: "blur(12px)",
  color: "#ecfdf5",
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
} as const;
