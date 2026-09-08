"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CorrelationHeatmapProps {
  columns: string[];
  matrix: number[][];
  height?: number;
}

function cellColor(v: number): string {
  if (v >= 0) {
    const t = Math.min(1, v);
    return `rgba(52, 211, 153, ${0.08 + t * 0.82})`;
  }
  const t = Math.min(1, -v);
  return `rgba(251, 113, 133, ${0.08 + t * 0.82})`;
}

/** CSS-grid correlation matrix with hover tooltips (green = +, rose = −). */
export function CorrelationHeatmap({ columns, matrix, height }: CorrelationHeatmapProps) {
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const short = (name: string) => name.replace(/_.*/g, "").slice(0, 7);

  return (
    <div className="overflow-auto" style={height ? { maxHeight: height } : undefined}>
      <div className="inline-block min-w-full">
        <div
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: `88px repeat(${columns.length}, minmax(34px, 1fr))` }}
        >
          <div />
          {columns.map((c, j) => (
            <div key={c} className="pb-1 text-center text-[9px] text-emerald-100/45" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 46 }}>
              {short(c)}
            </div>
          ))}
          {matrix.map((row, i) => (
            <div key={columns[i]} className="contents">
              <div className={cn(
                "pr-2 text-right text-[10px] leading-[26px] transition-colors",
                hover?.i === i ? "text-emerald-200" : "text-emerald-100/50",
              )}>
                {short(columns[i])}
              </div>
              {row.map((v, j) => (
                <div
                  key={`${i}-${j}`}
                  onMouseEnter={() => setHover({ i, j })}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    "flex h-[26px] cursor-default items-center justify-center rounded-[4px] text-[9px] font-medium transition-transform duration-100",
                    hover?.i === i && hover?.j === j && "z-10 scale-125 ring-1 ring-white/50",
                  )}
                  style={{ backgroundColor: cellColor(v) }}
                >
                  {Math.abs(v) >= 0.35 ? v.toFixed(1).replace("0.", ".") : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-100/50">
          <span>−1</span>
          <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-rose-400 via-[#0b2018] to-emerald-400" />
          <span>+1</span>
          {hover && (
            <span className="ml-3 rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5">
              {short(columns[hover.i])} × {short(columns[hover.j])} ={" "}
              <b className="text-emerald-200">{matrix[hover.i][hover.j].toFixed(3)}</b>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
