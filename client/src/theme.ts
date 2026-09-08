/** ForestGuard AI design tokens: palette, risk colors, chart series. */

export const RISK_COLORS: Record<string, string> = {
  Low: "#34d399", // emerald-400
  Medium: "#fbbf24", // amber-400
  High: "#fb7185", // rose-400
};

export const CHART_PALETTE = [
  "#34d399", // emerald
  "#a7f3d0", // emerald-200
  "#2dd4bf", // teal
  "#84cc16", // lime
  "#facc15", // yellow
  "#38bdf8", // sky (kept minimal, non-indigo)
  "#e879f9", // fuchsia
  "#fb7185", // rose
];

export const REGION_COLORS: Record<string, string> = {
  "Amazon Basin": "#34d399",
  "Congo Basin": "#84cc16",
  "Southeast Asia": "#2dd4bf",
  "Boreal North": "#38bdf8",
  "East Africa": "#facc15",
  "Temperate Europe": "#e879f9",
};

/** Glassmorphism utility class composition shared across cards. */
export const GLASS = {
  card: "rounded-2xl border border-white/10 bg-white/[0.055] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
  chip: "rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs backdrop-blur-md",
} as const;
