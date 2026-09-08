"use client";

import { useState } from "react";
import { PageHeader } from "@client/components/page-header";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { ChartCard } from "@client/charts/chart-card";
import { RiskDonut } from "@client/charts/risk-donut";
import { RegionBars } from "@client/charts/region-bars";
import { TrendArea } from "@client/charts/trend-area";
import { FeatureHistogram } from "@client/charts/feature-histogram";
import { RiskScatter } from "@client/charts/risk-scatter";
import { CorrelationHeatmap } from "@client/charts/correlation-heatmap";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import { cn } from "@/lib/utils";
import type { VizOverview } from "@client/src/types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const NUMERIC_FEATURES = [
  "ndvi", "canopy_cover_pct", "annual_rainfall_mm", "avg_temperature_c",
  "elevation_m", "soil_moisture_pct", "fire_risk_index", "species_richness",
  "biomass_tons_ha", "logging_intensity_index", "population_density_per_km2",
  "humidity_pct", "drought_index", "invasive_species_pct", "wind_speed_kmh",
];

export function VisualizationPage() {
  const overview = useApi<VizOverview>(() => forestApi.vizOverview(), []);
  const [histFeature, setHistFeature] = useState("ndvi");
  const [histByRisk, setHistByRisk] = useState(false);
  const [scatterX, setScatterX] = useState("logging_intensity_index");
  const [scatterY, setScatterY] = useState("ndvi");

  const hist = useApi<{ data: { bin: string; risk?: string; count: number }[] }>(
    () => forestApi.histogram(histFeature, 24, histByRisk), [histFeature, histByRisk]);
  const scatter = useApi<{ x: string; y: string; points: Record<string, number | string>[] }>(
    () => forestApi.scatter(scatterX, scatterY, 800), [scatterX, scatterY]);
  const corr = useApi<{ columns: string[]; matrix: number[][]; top_pairs: { a: string; b: string; value: number }[] }>(
    () => forestApi.correlation(0.2), []);

  if (overview.error && !overview.data)
    return <ErrorPanel message={overview.error} onRetry={overview.refresh} />;

  const v = overview.data;

  const featureSelect = (value: string, onChange: (v: string) => void, className = "w-48") => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 border-white/10 bg-white/[0.05] text-xs", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-white/10 bg-[#0a1f16] text-emerald-50">
        {NUMERIC_FEATURES.map((f) => (
          <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div>
      <PageHeader
        title="Data Visualization"
        description="Interactive chart gallery over the full dataset — distributions, risk relationships, geographic composition and the correlation structure of all 27 features."
      />

      <Tabs defaultValue="distributions" className="space-y-4">
        <TabsList className="h-10 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur">
          {[
            ["distributions", "Distributions"],
            ["relationships", "Relationships"],
            ["correlations", "Correlations"],
            ["composition", "Composition"],
          ].map(([key, label]) => (
            <TabsTrigger key={key} value={key}
              className="rounded-lg px-4 text-xs font-medium text-emerald-100/55 data-[state=active]:bg-emerald-400/15 data-[state=active]:text-white">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ---------------- distributions ---------------- */}
        <TabsContent value="distributions" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title={`Histogram — ${histFeature.replace(/_/g, " ")}`}
              subtitle="Record counts across value bins"
              actions={featureSelect(histFeature, setHistFeature)}
            >
              {hist.loading && !hist.data ? (
                <div className="flex h-[280px] items-center justify-center text-xs text-emerald-100/40">computing bins…</div>
              ) : (
                <FeatureHistogram
                  data={aggregateBins(hist.data?.data ?? [])}
                  color="#34d399"
                />
              )}
            </ChartCard>

            {v && (
              <ChartCard title="Vegetation Gradient" subtitle="Canopy, biomass & moisture along NDVI bands">
                <TrendArea
                  data={v.ndvi_curve}
                  xKey="ndvi_band"
                  series={[
                    { key: "avg_canopy", color: "#34d399", label: "Canopy (%)" },
                    { key: "avg_biomass", color: "#facc15", label: "Biomass (t/ha)" },
                    { key: "avg_moisture", color: "#2dd4bf", label: "Moisture (%)" },
                  ]}
                />
              </ChartCard>
            )}
          </div>
        </TabsContent>

        {/* ---------------- relationships ---------------- */}
        <TabsContent value="relationships" className="space-y-4">
          <ChartCard
            title="Risk Scatter"
            subtitle={`Each dot is a forest plot, colored by risk — ${scatterX.replace(/_/g, " ")} vs ${scatterY.replace(/_/g, " ")}`}
            actions={
              <div className="flex gap-2">
                {featureSelect(scatterX, setScatterX, "w-44")}
                {featureSelect(scatterY, setScatterY, "w-44")}
              </div>
            }
          >
            {scatter.loading && !scatter.data ? (
              <div className="flex h-[320px] items-center justify-center text-xs text-emerald-100/40">sampling points…</div>
            ) : scatter.error ? (
              <p className="p-6 text-center text-xs text-rose-300/70">{scatter.error}</p>
            ) : (
              <RiskScatter x={scatterX} y={scatterY} points={scatter.data?.points ?? []} />
            )}
          </ChartCard>
        </TabsContent>

        {/* ---------------- correlations ---------------- */}
        <TabsContent value="correlations" className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard title="Correlation Matrix" subtitle="Pearson ρ over all numeric features"
            className="xl:col-span-2">
            {corr.loading && !corr.data ? (
              <div className="flex h-[420px] items-center justify-center text-xs text-emerald-100/40">computing matrix…</div>
            ) : corr.data ? (
              <CorrelationHeatmap columns={corr.data.columns} matrix={corr.data.matrix} height={460} />
            ) : null}
          </ChartCard>
          <ChartCard title="Strongest Pairs" subtitle="|ρ| ≥ 0.25 ranked by absolute value">
            <div className="space-y-2">
              {(corr.data?.top_pairs ?? []).slice(0, 12).map((p, i) => {
                const pos = p.value >= 0;
                return (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="w-36 truncate text-emerald-100/70">{p.a.replace(/_/g, " ")}</span>
                    <span className="text-emerald-100/30">×</span>
                    <span className="w-36 truncate text-emerald-100/70">{p.b.replace(/_/g, " ")}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full"
                        style={{ width: `${Math.abs(p.value) * 100}%`, backgroundColor: pos ? "#34d399" : "#fb7185" }} />
                    </div>
                    <span className="w-10 text-right font-mono" style={{ color: pos ? "#6ee7b7" : "#fda4af" }}>
                      {p.value.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </TabsContent>

        {/* ---------------- composition ---------------- */}
        <TabsContent value="composition" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {v && (
            <>
              <ChartCard title="Risk Balance" subtitle="Target class distribution">
                <RiskDonut data={v.risk_donut} />
              </ChartCard>
              <ChartCard title="Region × Risk" subtitle="Stacked composition per ecoregion" className="lg:col-span-2">
                <RegionBars data={v.region_risk} />
              </ChartCard>
              <ChartCard title="Elevation Bands × Risk" subtitle="How risk shifts with altitude" className="lg:col-span-2">
                <RegionBars data={v.elevation_risk} />
              </ChartCard>
              <ChartCard title="Regional Averages" subtitle="Mean NDVI vs canopy by region">
                <TrendArea
                  data={v.region_environment.map((r) => ({ region: r.region.replace(" ", "\n"), avg_canopy: r.avg_canopy, avg_ndvi: r.avg_ndvi * 100 }))}
                  xKey="region"
                  series={[
                    { key: "avg_canopy", color: "#34d399", label: "Canopy (%)" },
                    { key: "avg_ndvi", color: "#2dd4bf", label: "NDVI ×100" },
                  ]}
                  height={260}
                />
              </ChartCard>
            </>
          )}
          {!v && <LoadingPanel className="lg:col-span-3" />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** collapse per-risk binned rows into single-bin sums when not grouping */
function aggregateBins(data: { bin: string; risk?: string; count: number }[]) {
  if (!data.length || data[0].risk === undefined) return data;
  const merged = new Map<string, number>();
  for (const d of data) merged.set(d.bin, (merged.get(d.bin) ?? 0) + d.count);
  return [...merged.entries()].map(([bin, count]) => ({ bin, count }));
}
