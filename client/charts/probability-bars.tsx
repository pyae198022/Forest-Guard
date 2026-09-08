"use client";

import { motion } from "framer-motion";
import { RISK_COLORS } from "@client/src/theme";
import type { Risk } from "@client/src/types";

interface ProbabilityBarsProps {
  probabilities: Record<Risk, number>;
  prediction: Risk;
}

/** Animated per-class probability bars for a prediction result. */
export function ProbabilityBars({ probabilities, prediction }: ProbabilityBarsProps) {
  const entries = Object.entries(probabilities) as [Risk, number][];
  return (
    <div className="space-y-3">
      {entries.map(([risk, pct], idx) => {
        const isWinner = risk === prediction;
        return (
          <div key={risk}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className={isWinner ? "font-semibold text-white" : "text-emerald-100/55"}>
                {risk} {isWinner && "· predicted"}
              </span>
              <span className={isWinner ? "font-semibold text-emerald-300" : "text-emerald-100/45"}>
                {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: idx * 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${RISK_COLORS[risk]}66, ${RISK_COLORS[risk]})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
