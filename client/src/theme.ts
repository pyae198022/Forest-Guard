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
  "Other/Global": "#34d399",
  Africa: "#facc15",
  Asia: "#2dd4bf",
  Europe: "#38bdf8",
  "North America": "#a7f3d0",
  "South America": "#fb7185",
  Oceania: "#e879f9",
};

/** Glassmorphism utility class composition shared across cards. */
export const GLASS = {
  card: "rounded-2xl border border-white/10 bg-white/[0.055] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
  chip: "rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs backdrop-blur-md",
} as const;

/** Humanise a raw column name: Population_Density -> Population Density. */
export function prettyName(name: string): string {
  if (!name) return "";
  return name
    .replace(/_ha$/i, " (ha)")
    .replace(/_pct$/i, " %")
    .replace(/_mm$/i, " (mm)")
    .replace(/_mt$/i, " (Mt)")
    .replace(/_kt$/i, " (kt)")
    .replace(/_c$/i, " (°C)")
    .replace(/_m3$/i, " (µg/m³)")
    .replace(/_ug_m3$/i, " (µg/m³)")
    .replace(/_count$/i, "")
    .replace(/_index$/i, "")
    .replace(/_score$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
