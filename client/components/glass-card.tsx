"use client";

import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  /** subtle top highlight line, on by default */
  glow?: boolean;
}

/** Core glassmorphism surface used across the whole dashboard. */
export function GlassCard({ children, className, glow = true, ...rest }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
        className,
      )}
      {...rest}
    >
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent"
        />
      )}
      {children}
    </motion.div>
  );
}
