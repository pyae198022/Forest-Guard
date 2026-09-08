"use client";

import { GlassCard } from "./glass-card";
import { cn } from "@/lib/utils";

export function LoadingPanel({ label = "Loading data...", className, compact = false }: { label?: string; className?: string; compact?: boolean }) {
  return (
    <GlassCard className={cn(compact ? "min-h-[140px] p-6" : "min-h-[220px] p-8", "flex flex-col items-center justify-center gap-4", className)} glow={false}>
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
        <div className="absolute inset-1.5 animate-ping rounded-full bg-emerald-400/10" />
      </div>
      <p className="text-sm text-emerald-100/50">{label}</p>
    </GlassCard>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <GlassCard className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-8" glow={false}>
      <div className="rounded-full border border-rose-400/30 bg-rose-400/10 p-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fb7185" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      </div>
      <p className="max-w-sm text-center text-sm text-rose-200/80">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-emerald-100/80 transition hover:bg-white/10"
        >
          Retry
        </button>
      )}
    </GlassCard>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-2">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-8 flex-1 animate-pulse rounded-md bg-white/[0.06]"
              style={{ animationDelay: `${(r * cols + c) * 40}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
