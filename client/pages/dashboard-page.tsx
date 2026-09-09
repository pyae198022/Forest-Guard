"use client";

import { motion } from "framer-motion";
import {
  CalendarRange,
  Database,
  FlaskConical,
  Globe2,
  Scale,
  Sparkles,
  TrendingDown,
  TreePine,
} from "lucide-react";
import { PageHeader } from "@client/components/page-header";
import { StatCard, StatCardSkeleton } from "@client/components/stat-card";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { ChartCard } from "@client/charts/chart-card";
import { TrendArea } from "@client/charts/trend-area";
import { MetricBars } from "@client/charts/metric-bars";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import type { DatasetSummary, EvalSummary, TrendData, RecordsByRegion } from "@client/src/types";
import { RISK_COLORS } from "@client/src/theme";

export function DashboardPage() {
  const summary = useApi<DatasetSummary>(() => forestApi.datasetSummary(), []);
  const evaluation = useApi<EvalSummary>(() => forestApi.evalSummary(), []);
  const trend = useApi<TrendData>(() => forestApi.trend(), []);
  const byRegion = useApi<RecordsByRegion>(() => forestApi.recordsByRegion(), []);

  const loading = summary.loading || evaluation.loading;
  const error = summary.error || evaluation.error;

  if (loading && !summary.data)
    return <LoadingPanel label="Loading dashboard..." />;
  if (error && !summary.data)
    return (
      <ErrorPanel
        message={error}
        onRetry={() => {
          summary.refresh();
          evaluation.refresh();
        }}
      />
    );

  const s = summary.data;
  const ev = evaluation.data;
  const rows = s?.rows ?? 0;
  const targetSkew = s?.target_stats.skew ?? 0;
  const classDist = (s?.split.train ?? { Low: 0, High: 0 });
  const classData = [
    { name: "Train (≤2015)", Low: classDist.Low, High: classDist.High },
    { name: "Test (>2015)", Low: s?.split.test.Low ?? 0, High: s?.split.test.High ?? 0 },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deforestation Intelligence Dashboard"
        description="Explore 30 years of global forest loss — 4,030 country-year records across 130 countries and 27 environmental, climate and socio-economic indicators. Every number on this page is computed live from the dataset."
        actions={
          <span className="glass-chip inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-emerald-200/80">
            <TreePine className="h-3.5 w-3.5 text-emerald-300" /> Live data · live models
          </span>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!s ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              index={0}
              label="Dataset Panel"
              value={rows.toLocaleString()}
              icon={Database}
              hint={`${s.columns} attributes · ${s.entities} countries · ${s.regions} regions`}
            />
            <StatCard
              index={1}
              label="Temporal Split"
              value={`${s.split.train_rows} / ${s.split.test_rows}`}
              tone="teal"
              icon={CalendarRange}
              hint={`train ≤${ev?.split_year ?? 2015} · test >${ev?.split_year ?? 2015} (no shuffle)`}
            />
            <StatCard
              index={2}
              label="Mean Deforestation"
              value={`${(s.target_stats.mean / 1000).toFixed(1)}k`}
              unit="ha/yr"
              tone="rose"
              icon={TrendingDown}
              hint={`median ${s.target_stats.median.toLocaleString()} ha · skew ${targetSkew.toFixed(1)}`}
            />
            <StatCard
              index={3}
              label="Best Classifier"
              value={`${((ev?.best_classification.accuracy ?? 0) * 100).toFixed(2)}%`}
              tone="amber"
              icon={Sparkles}
              hint={`${ev?.best_classification.model ?? "-"} · macro-F1 ${((ev?.best_classification.macro_f1 ?? 0) * 100).toFixed(2)}%`}
            />
          </>
        )}
      </div>

      {/* charts row 1 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Global Deforestation Trend"
          subtitle="Average hectares of forest lost per year, 1990–2020"
          className="xl:col-span-2"
        >
          {trend.loading || !trend.data ? (
            <LoadingPanel compact label="Loading trend..." />
          ) : (
            <TrendArea
              data={trend.data.data as unknown as Record<string, number | string>[]}
              xKey="year"
              series={[{ key: "value", color: "#34d399", label: "Avg hectares" }]}
              height={272}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Binary Risk Target"
          subtitle={`threshold = train median (${(s?.split.threshold ?? 0).toLocaleString()} ha)`}
        >
          <div className="flex h-full flex-col justify-center gap-3">
            {[
              { label: "Train ≤ 2015", Low: classDist.Low, High: classDist.High },
              { label: "Test > 2015", Low: s?.split.test.Low ?? 0, High: s?.split.test.High ?? 0 },
            ].map((row) => {
              const total = row.Low + row.High;
              return (
                <div key={row.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-emerald-100/60">
                    <span>{row.label}</span>
                    <span>{total.toLocaleString()} rows</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(row.Low / total) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      style={{ background: RISK_COLORS.Low }}
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(row.High / total) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
                      style={{ background: RISK_COLORS.High }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px]">
                    <span className="text-emerald-300">{row.Low.toLocaleString()} Low</span>
                    <span className="text-rose-300">{row.High.toLocaleString()} High</span>
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] leading-relaxed text-emerald-100/45">
              Each country-year is labelled Low or High risk using the training
              median as the cut-off — the test years stay completely unseen.
            </p>
          </div>
        </ChartCard>
      </div>

      {/* charts row 2 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Records by Region"
          subtitle="How the observations are spread across world regions"
        >
          {byRegion.loading || !byRegion.data ? (
            <LoadingPanel compact label="Loading..." />
          ) : (
            <MetricBars
              data={byRegion.data.data.map((d) => ({
                name: d.region.replace("Other/Global", "Other"),
                count: d.count,
              }))}
              metrics={[{ key: "count", label: "Records" }]}
              height={250}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Regression Champion"
          subtitle="Best R² on the untouched 2016-2020 test years"
        >
          <div className="flex h-full flex-col justify-center gap-4">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
              <div className="flex items-center gap-2 text-xs text-emerald-200/70">
                <FlaskConical className="h-3.5 w-3.5" /> {ev?.best_regression.model}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "R²", value: ev?.best_regression.r2?.toFixed(4) ?? "-" },
                  { label: "MAE", value: ev?.best_regression.mae?.toLocaleString() ?? "-" },
                  { label: "RMSE", value: ev?.best_regression.rmse?.toLocaleString() ?? "-" },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="text-lg font-semibold text-white">{m.value}</div>
                    <div className="text-[10px] uppercase tracking-wide text-emerald-100/45">{m.label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-emerald-100/50">
                The model predicts on a log scale for stability — values are
                converted back to hectares for reporting.
              </p>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Methodology Chain"
          subtitle="Every dashboard number follows this protocol"
        >
          <ol className="space-y-2.5 text-xs leading-relaxed text-emerald-100/70">
            {[
              "Temporal split — train ≤ 2015, test > 2015 (no shuffling)",
              "Leakage filter — CO₂, carbon sink, PM emissions, impact score excluded",
              "log1p transform on 5 skewed features · Min-Max on training split",
              "Descriptive mining — Apriori (qcut bins) + K-Means (silhouette)",
              "Models — RF / MLP for regression (Top-13) & classification (Top-10)",
              "Evaluation — hectares-scale metrics, ROC-AUC, 5-fold CV",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 px-1.5 text-[10px] font-semibold text-emerald-300">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </ChartCard>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-emerald-100/35">
        <Globe2 className="h-3.5 w-3.5" />
        <Scale className="h-3.5 w-3.5" />
        All results computed live from the SQLite mirror of the uploaded
        Excel dataset — nothing is hard-coded.
      </div>
    </div>
  );
}
