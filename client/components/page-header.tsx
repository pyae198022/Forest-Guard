"use client";

import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
}

/** Consistent page title block with entrance animation. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[28px]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-emerald-100/55">
          {description}
        </p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

/** Small section label used inside pages. */
export function SectionTitle({
  children,
  right,
  title,
  subtitle,
}: {
  children?: React.ReactNode;
  right?: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const heading = title ?? (typeof children === "string" ? children : null);
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-200/70">
          {heading ?? children}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-emerald-100/40">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}
