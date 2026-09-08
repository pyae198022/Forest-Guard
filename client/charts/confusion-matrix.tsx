"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

interface ConfusionMatrixProps {
  matrix: number[][];
  classes: string[];
}

/** Diagonal-highlighted confusion matrix with per-cell rates. */
export function ConfusionMatrix({ matrix, classes }: ConfusionMatrixProps) {
  const total = matrix.flat().reduce((a, b) => a + b, 0) || 1;
  const maxVal = Math.max(...matrix.flat());

  return (
    <div className="mx-auto w-fit">
      <div
        className="grid items-center gap-1.5"
        style={{
          gridTemplateColumns: `auto repeat(${classes.length}, minmax(88px, 1fr))`,
        }}
      >
        {/* header row: corner + predicted-class labels */}
        <div />
        {classes.map((c) => (
          <div key={`h-${c}`} className="pb-1 text-center text-[11px] font-medium text-emerald-100/55">
            {c}
          </div>
        ))}

        {/* data rows: actual-class label + cells */}
        {matrix.map((row, i) => (
          <Fragment key={classes[i]}>
            <div className="pr-3 text-right text-[11px] font-medium text-emerald-100/55">
              {classes[i]}
            </div>
            {row.map((v, j) => {
              const correct = i === j;
              const intensity = v / maxVal;
              return (
                <div
                  key={`${i}-${j}`}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-lg border py-3 transition-transform hover:scale-[1.04]"
                  style={{
                    backgroundColor: correct
                      ? `rgba(52,211,153,${0.15 + intensity * 0.5})`
                      : `rgba(251,113,133,${0.10 + intensity * 0.45})`,
                    borderColor: correct ? "rgba(52,211,153,0.35)" : "rgba(251,113,133,0.25)",
                  }}
                >
                  <span className={cn("text-lg font-semibold", correct ? "text-emerald-100" : "text-rose-100")}>
                    {v}
                  </span>
                  <span className="text-[10px] text-white/45">
                    {((v / total) * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-emerald-100/40">
        Rows = actual class · Columns = predicted class · diagonal = correct predictions
      </p>
    </div>
  );
}
