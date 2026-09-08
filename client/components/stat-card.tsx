"use client";

import { GlassCard } from "./glass-card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  hint?: string;
  tone?: "emerald" | "amber" | "rose" | "teal";
  index?: number;
}

const TONES = {
  emerald: "from-emerald-400/25 to-emerald-400/5 text-emerald-300",
  amber: "from-amber-400/25 to-amber-400/5 text-amber-300",
  rose: "from-rose-400/25 to-rose-400/5 text-rose-300",
  teal: "from-teal-400/25 to-teal-400/5 text-teal-300",
} as const;

export function StatCard({ label, value, unit, icon: Icon, hint, tone = "emerald", index = 0 }: StatCardProps) {
  return (
    <GlassCard
      className="p-5"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-emerald-100/60">{label}</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="truncate text-2xl font-semibold tracking-tight text-white md:text-[28px]">
              {value}
            </span>
            {unit && <span className="text-sm text-emerald-200/50">{unit}</span>}
          </div>
          {hint && <p className="mt-1.5 text-xs text-emerald-100/40">{hint}</p>}
        </div>
        <div
          className={cn(
            "shrink-0 rounded-xl border border-white/10 bg-gradient-to-br p-2.5",
            TONES[tone],
          )}
        >
          {Icon && <Icon className="h-5 w-5" strokeWidth={2} />}
        </div>
      </div>
    </GlassCard>
  );
}

export function StatCardSkeleton() {
  return (
    <GlassCard className="p-5" glow={false}>
      <div className="animate-pulse space-y-3">
        <div className="h-3.5 w-24 rounded-full bg-white/10" />
        <div className="h-7 w-32 rounded-lg bg-white/10" />
        <div className="h-3 w-20 rounded-full bg-white/5" />
      </div>
    </GlassCard>
  );
}
