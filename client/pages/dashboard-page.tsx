"use client";

import { motion } from "framer-motion";
import { Database, Flame, Radar as RadarIcon, Sparkles, TrendingUp, TreePine } from "lucide-react";
import { PageHeader, SectionTitle } from "@client/components/page-header";
import { StatCard, StatCardSkeleton } from "@client/components/stat-card";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { ChartCard } from "@client/charts/chart-card";
import { RiskDonut } from "@client/charts/risk-donut";
import { RegionBars } from "@client/charts/region-bars";
import { TrendArea } from "@client/charts/trend-area";
import { RegionRadar } from "@client/charts/region-radar";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import type { DatasetSummary, EvaluationSummary, VizOverview } from "@client/src/types";

export function DashboardPage() {
  const summary = useApi<DatasetSummary>(() => forestApi.datasetSummary(), []);
  const viz = useApi<VizOverview>(() => forestApi.vizOverview(), []);
  const evaluation = useApi<EvaluationSummary>(() => forestApi.evaluation(), []);

  const loading = summary.loading || viz.loading || evaluation.loading;
  const error = summary.error || viz.error || evaluation.error;

  if (loading && !summary.data) return <LoadingPanel label="Loading forest intelligence..." />;
  if (error && !summary.data && !viz.data)
    return <ErrorPanel message={error} onRetry={() => { summary.refresh(); viz.refresh(); evaluation.refresh(); }} />;

  const s = summary.data;
  const v = viz.data;
  const ev = evaluation.data;
  const total = s?.n_rows ?? 0;
  const highPct = s ? ((s.class_distribution.High ?? 0) / total) * 100 : 0;
  const avgNdvi = v
    ? v.region_environment.reduce((acc, r) => acc + r.avg_ndvi, 0) / Math.max(1, v.region_environment.length)
    : 0;
  const bestAccuracy = ev
    ? Math.max(...ev.models.map((m) => m.accuracy))
    : 0;

  const radarAxes = ["NDVI", "Canopy", "Rainfall", "Biomass", "Species", "Fire risk"];
  const radarSeries = (v?.region_environment ?? []).slice(0, 4).map((r) => {
    const raw = [r.avg_ndvi, r.avg_canopy, r.avg_rainfall / 40, r.avg_biomass / 5, r.avg_species / 5, r.avg_fire_risk * 100];
    const max = Math.max(...raw);
    return { region: r.region, values: raw.map((x) => (x / max) * 100) };
  });

  return (
    <div>
      <PageHeader
        title="Forest Health Dashboard"
        description="Live overview of the ForestGuard dataset — 4,030 forest plots monitored across 6 global ecoregions, with 27 environmental, climate, biodiversity and socio-economic features."
        actions={
          <span className="glass-chip inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-emerald-200/80">
            <TreePine className="h-3.5 w-3.5 text-emerald-300" /> Ecosystem monitoring
          </span>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!s ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : (
          <>
            <StatCard index={0} label="Total Records" value={total.toLocaleString()} icon={Database}
              hint={`${s.n_cols} columns · ${s.n_features} features`} />
            <StatCard index={1} label="High Risk Plots" value={`${highPct.toFixed(1)}%`} tone="rose" icon={Flame}
              hint={`${s.class_distribution.High ?? 0} plots flagged High`} />
            <StatCard index={2} label="Average NDVI" value={avgNdvi.toFixed(3)} unit="index" tone="teal" icon={TrendingUp}
              hint="Vegetation greenness across regions" />
            <StatCard index={3} label="Best Model Accuracy" value={`${(bestAccuracy * 100).toFixed(1)}%`} tone="amber" icon={Sparkles}
              hint={ev ? `leader: ${ev.models.find((m) => m.accuracy === bestAccuracy)?.name}` : "training..."} />
          </>
        )}
      </div>

      {/* Charts row 1 */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {v ? (
          <ChartCard title="Deforestation Risk Balance" subtitle="Distribution of the target variable"
            className="lg:col-span-1">
            <RiskDonut data={v.risk_donut} centerLabel="forest plots" />
          </ChartCard>
        ) : <LoadingPanel className="lg:col-span-1" />}
        {v ? (
          <ChartCard title="Risk by Ecoregion" subtitle="Stacked records per region and risk class"
            className="lg:col-span-2">
            <RegionBars data={v.region_risk} />
          </ChartCard>
        ) : <LoadingPanel className="lg:col-span-2" />}
      </div>

      {/* Charts row 2 */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {v ? (
          <ChartCard title="Vegetation Gradient" subtitle="Canopy & biomass response along the NDVI gradient">
            <TrendArea
              data={v.ndvi_curve}
              xKey="ndvi_band"
              series={[
                { key: "avg_canopy", color: "#34d399", label: "Canopy cover (%)" },
                { key: "avg_biomass", color: "#facc15", label: "Biomass (t/ha)" },
                { key: "avg_moisture", color: "#2dd4bf", label: "Soil moisture (%)" },
              ]}
            />
          </ChartCard>
        ) : <LoadingPanel />}
        {v ? (
          <ChartCard title="Ecoregion Profiles" subtitle="Normalized environmental signature per region (top 4)">
            <RegionRadar axes={radarAxes} series={radarSeries} />
          </ChartCard>
        ) : <LoadingPanel />}
      </div>

      {/* insight strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-4 rounded-2xl border border-emerald-400/20 bg-gradient-to-r from-emerald-400/[0.10] via-emerald-400/[0.04] to-transparent p-5 backdrop-blur-xl"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2.5">
            <RadarIcon className="h-5 w-5 text-emerald-300" />
            <h3 className="text-sm font-semibold text-white">Mining Insight</h3>
          </div>
          <p className="text-sm leading-relaxed text-emerald-100/65">
            Vegetation health (<b className="text-emerald-200">NDVI</b>) and human pressure
            (<b className="text-emerald-200">logging & agriculture indices</b>) are the strongest
            deforestation signals in this dataset — protected reserves show markedly lower High-risk
            share. Open <b className="text-emerald-200">Descriptive Mining</b> to explore the full
            correlation structure or <b className="text-emerald-200">AI Prediction</b> to classify a new plot.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
