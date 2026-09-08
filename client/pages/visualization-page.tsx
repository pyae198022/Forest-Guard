"use client";

import { useState } from "react";
import { AlertTriangle, Flame } from "lucide-react";
import { PageHeader, SectionTitle } from "@client/components/page-header";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { ChartCard } from "@client/charts/chart-card";
import { FeatureHistogram } from "@client/charts/feature-histogram";
import { CorrelationHeatmap } from "@client/charts/correlation-heatmap";
import { TrendArea } from "@client/charts/trend-area";
import { MetricBars } from "@client/charts/metric-bars";
import { BoxplotChart } from "@client/charts/boxplot-chart";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import type {
  BoxplotData,
  HistogramData,
  RecordsByRegion,
  RegionBoxplot,
  StatsRow,
  TargetCorrelation,
  TrendData,
} from "@client/src/types";
import { prettyName, RISK_COLORS } from "@client/src/theme";

const NUMERIC_FEATURES = [
  "Deforestation_Ha",
  "Forest_Cover_Pct",
  "Agricultural_Land_Pct",
  "GDP_Per_Capita",
  "Population_Density",
  "Precipitation_mm",
  "Temperature_Anomaly_C",
  "PM25_Mean_Exposure_ug_m3",
  "Biodiversity_Impact_Index",
  "Poverty_Rate_Pct",
];

export function VisualizationPage() {
  const stats = useApi<StatsRow[]>(() => forestApi.stats(), []);
  const [histFeature, setHistFeature] = useState("Deforestation_Ha");
  const [boxFeature, setBoxFeature] = useState("Deforestation_Ha");

  const hist = useApi<HistogramData>(
    () => forestApi.histogram(histFeature, 28), [histFeature]);
  const box = useApi<BoxplotData>(
    () => forestApi.boxplot(boxFeature), [boxFeature]);
  const regionBox = useApi<RegionBoxplot>(() => forestApi.regionBoxplot(), []);
  const trend = useApi<TrendData>(() => forestApi.trend(), []);
  const byRegion = useApi<RecordsByRegion>(() => forestApi.recordsByRegion(), []);
  const corr = useApi(() => forestApi.correlation(0.3), []);
  const topCorr = useApi<TargetCorrelation>(() => forestApi.targetCorrelation(12), []);

  const loading = stats.loading;
  const error = stats.error;

  if (loading && !stats.data) return <LoadingPanel label="Preparing visualisations..." />;
  if (error && !stats.data) return <ErrorPanel message={error} onRetry={stats.refresh} />;

  const featureOptions = (stats.data ?? []).map((s) => s.feature)
    .filter((f) => f !== "Year");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Visualization"
        description="Chapter 2.3 — exploratory figures that sit between preprocessing and modelling: distributions, outliers, regional spreads, temporal trends and the correlation structure that guides feature selection."
      />

      {/* Fig 2.2.2.1 distribution + skewness */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Feature Distribution & Skewness"
          subtitle="Figure 2.2.2.1 — heavy right tails motivate the log1p transform"
          actions={
            <select
              value={histFeature}
              onChange={(e) => setHistFeature(e.target.value)}
              className="h-8 rounded-md border border-white/10 bg-[#0a1f16] px-2 text-xs text-emerald-100"
            >
              {(featureOptions.length ? featureOptions : NUMERIC_FEATURES).map((f) => (
                <option key={f} value={f}>{prettyName(f)}</option>
              ))}
            </select>
          }
          footer={
            hist.data ? (
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-emerald-100/55">
                  skewness <span className={Math.abs(hist.data.skew ?? 0) > 3 ? "font-semibold text-rose-300" : "text-emerald-300"}>
                    {hist.data.skew?.toFixed(2) ?? "n/a"}
                  </span>
                </span>
                {hist.data.log_transformed && (
                  <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-emerald-300">
                    log-scaled axis
                  </span>
                )}
                <span className="text-emerald-100/35">|skew| &gt; 3 → transformed before modelling</span>
              </div>
            ) : null
          }
        >
          {hist.loading || !hist.data ? (
            <LoadingPanel compact label="Binning..." />
          ) : (
            <FeatureHistogram data={hist.data.data} height={300} />
          )}
        </ChartCard>

        {/* Fig 2.3.1 box plot + outliers */}
        <ChartCard
          title="Box Plot & Outlier Detection"
          subtitle="Figure 2.3.1 — IQR fences flag extreme observations"
          actions={
            <select
              value={boxFeature}
              onChange={(e) => setBoxFeature(e.target.value)}
              className="h-8 rounded-md border border-white/10 bg-[#0a1f16] px-2 text-xs text-emerald-100"
            >
              {(featureOptions.length ? featureOptions : NUMERIC_FEATURES).map((f) => (
                <option key={f} value={f}>{prettyName(f)}</option>
              ))}
            </select>
          }
          footer={
            box.data ? (
              <div className="flex items-center gap-2 text-[11px] text-emerald-100/55">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                <span>
                  <span className="font-semibold text-amber-300">{box.data.outliers_count}</span> outliers
                  beyond fences [{box.data.lower_fence.toLocaleString()}, {box.data.upper_fence.toLocaleString()}]
                  ({box.data.outliers_pct}% of rows)
                </span>
              </div>
            ) : null
          }
        >
          {box.loading || !box.data ? (
            <LoadingPanel compact label="Measuring..." />
          ) : (
            <BoxplotChart
              boxes={[{
                label: box.data.feature,
                min: box.data.min, q1: box.data.q1, median: box.data.median,
                q3: box.data.q3, max: box.data.max,
              }]}
              height={210}
            />
          )}
        </ChartCard>
      </div>

      {/* Fig 2.3.2 region spread + Fig 2.3.3 trend */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Deforestation Spread by Region"
          subtitle="Figure 2.3.2 — South America shows the widest and highest range"
        >
          {regionBox.loading || !regionBox.data ? (
            <LoadingPanel compact label="Aggregating..." />
          ) : (
            <BoxplotChart
              boxes={regionBox.data.groups.map((g) => ({
                label: g.region,
                min: Math.max(g.min, 1), q1: Math.max(g.q1, 1),
                median: Math.max(g.median, 1), q3: Math.max(g.q3, 1),
                max: Math.max(g.max, 1), count: g.count,
              }))}
              height={340}
            />
          )}
        </ChartCard>

        <div className="space-y-4">
          <ChartCard
            title="Global Annual Trend"
            subtitle="Figure 2.3.3 — sustained decline 1990-2020"
          >
            {trend.loading || !trend.data ? (
              <LoadingPanel compact label="Loading..." />
            ) : (
              <TrendArea
                data={trend.data.data as unknown as Record<string, number | string>[]}
                xKey="year"
                series={[{ key: "value", color: "#34d399", label: "Avg ha" }]}
                height={190}
              />
            )}
          </ChartCard>

          <ChartCard
            title="Records by Region"
            subtitle="Figure 2.3.4 — Other/Global dominates the panel"
          >
            {byRegion.loading || !byRegion.data ? (
              <LoadingPanel compact label="Counting..." />
            ) : (
              <MetricBars
                data={byRegion.data.data.map((d) => ({
                  name: d.region.replace("Other/Global", "Other"),
                  count: d.count,
                }))}
                metrics={[{ key: "count", label: "Records" }]}
                height={170}
              />
            )}
          </ChartCard>
        </div>
      </div>

      {/* Fig 2.3.5 heatmap + Fig 2.3.6 top correlations */}
      <SectionTitle
        title="Correlation Structure"
        subtitle="Spearman coefficients — collinearity clusters feed the feature-selection step"
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <ChartCard
          title="Correlation Heat-map"
          subtitle="Figure 2.3.5 — emissions & carbon-sink move together (ρ ≈ 1)"
          className="xl:col-span-3"
        >
          {corr.loading || !corr.data ? (
            <LoadingPanel compact label="Computing..." />
          ) : (
            <CorrelationHeatmap
              columns={corr.data.columns}
              matrix={corr.data.matrix}
              height={430}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Top Features vs Target"
          subtitle="Figure 2.3.6 — |Spearman| with Deforestation_Ha"
          className="xl:col-span-2"
          contentClassName="max-h-[470px] space-y-1.5 overflow-y-auto"
        >
          {topCorr.loading || !topCorr.data ? (
            <LoadingPanel compact label="Ranking..." />
          ) : (
            topCorr.data.data.map((r) => (
              <div key={r.feature} className="flex items-center gap-2 text-xs">
                <span className={`w-44 truncate ${r.leakage ? "text-rose-300/80" : "text-emerald-100/80"}`}>
                  {prettyName(r.feature)}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${r.abs * 100}%`,
                      background: r.leakage
                        ? "linear-gradient(90deg,#fb7185,#fda4af)"
                        : "linear-gradient(90deg,#059669,#6ee7b7)",
                    }}
                  />
                </div>
                <span className="w-12 text-right text-emerald-100/55">{r.corr}</span>
                {r.leakage && <Flame className="h-3 w-3 text-rose-400/70" />}
              </div>
            ))
          )}
          {topCorr.data && (
            <p className="pt-2 text-[11px] leading-relaxed text-rose-200/60">
              <Flame className="mr-1 inline h-3 w-3" />Red bars mark the four
              leakage columns (ρ ≈ 1.0) plus Environmental_Impact_Score —
              excluded from prediction features per book section 3.2.2.
            </p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
