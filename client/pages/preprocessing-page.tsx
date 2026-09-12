"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Filter,
  Play,
  RefreshCw,
  Split,
  Wand2,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@client/components/page-header";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { ChartCard } from "@client/charts/chart-card";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import type { PipelineResult, PreprocessingOverview } from "@client/src/types";
import { prettyName } from "@client/src/theme";
import { Button } from "@/components/ui/button";

export function PreprocessingPage() {
  const overview = useApi<PreprocessingOverview>(
    () => forestApi.preprocessingOverview(), [],
  );
  const [pipeline, setPipeline] = useState<PipelineResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const runPipeline = async () => {
    setRunning(true);
    setRunError(null);
    try {
      setPipeline(await forestApi.runPipeline());
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Pipeline failed");
    } finally {
      setRunning(false);
    }
  };

  if (overview.loading && !overview.data)
    return <LoadingPanel label="Loading preprocessing overview..." />;
  if (overview.error && !overview.data)
    return <ErrorPanel message={overview.error} onRetry={overview.refresh} />;

  const o = overview.data!;
  const ranking = pipeline?.hybrid_ranking ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Preprocessing"
        description="Transform raw data into a model-ready matrix in six guided steps: quality audit, skew correction, categorical encoding, scaling, feature ranking and a time-aware validation — all with strict rules to prevent information leakage."
        actions={
          <Button
            onClick={runPipeline}
            disabled={running}
            className="gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm text-white hover:from-emerald-400 hover:to-teal-400"
          >
            {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Running..." : "Run Full Pipeline"}
          </Button>
        }
      />

      {/* step timeline */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(pipeline?.steps ?? [
          { step: 1, name: "Data quality audit", detail: `${o.quality.total_records} records × ${o.quality.total_attributes} attributes · missing = ${o.quality.missing_values} · duplicates = ${o.quality.duplicate_records}` },
          { step: 2, name: "Skew correction (log1p)", detail: "Compresses extreme values in the 5 most skewed features so models aren't dominated by outliers" },
          { step: 3, name: "One-hot encoding", detail: `${o.onehot.features_encoded.join(", ")} → +${o.onehot.dummy_columns} numeric dummy columns` },
          { step: 4, name: "Min-Max scaling", detail: "All features rescaled to [0, 1] — fitted on training data only, never the future" },
          { step: 5, name: "Hybrid feature ranking", detail: "Three methods vote: correlation, information gain and permutation importance" },
          { step: 6, name: "Subset size validation", detail: "Feature counts 5/8/10/12/15 compared on a hold-out window to find the best size" },
        ]).map((s, i) => (
          <motion.div
            key={s.step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400/15 text-[11px] font-semibold text-emerald-300">
                {s.step}
              </span>
              {s.name}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-emerald-100/50">{s.detail}</p>
          </motion.div>
        ))}
      </div>

      {/* split + leakage */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Temporal Split — No Shuffling"
          subtitle={o.split.rule}
          footer={
            <p className="text-[11px] leading-relaxed text-emerald-100/45">
              Random shuffling would let future patterns leak into training.
              Training strictly on history (up to 2015) and testing on later
              years mimics a real forecasting deployment.
            </p>
          }
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-center">
              <div className="text-2xl font-semibold text-emerald-300">{o.split.train_rows.toLocaleString()}</div>
              <div className="text-[11px] text-emerald-100/50">training rows (1990-2015)</div>
            </div>
            <Split className="h-5 w-5 shrink-0 text-emerald-100/30" />
            <div className="flex-1 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-center">
              <div className="text-2xl font-semibold text-amber-300">{o.split.test_rows.toLocaleString()}</div>
              <div className="text-[11px] text-emerald-100/50">test rows (2016-2020)</div>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Leakage Exclusion List"
          subtitle={o.rationale}
        >
          <div className="space-y-2">
            {o.leakage_excluded.map((l) => (
              <div key={l.feature} className="flex items-center justify-between rounded-lg border border-rose-400/15 bg-rose-400/[0.05] px-3 py-2">
                <span className="flex items-center gap-2 text-xs text-rose-200/85">
                  <Filter className="h-3.5 w-3.5" /> {prettyName(l.feature)}
                </span>
                <span className="text-[11px] text-rose-200/50">ρ = {l.spearman_with_target}</span>
              </div>
            ))}
            <p className="pt-1 text-[11px] leading-relaxed text-emerald-100/45">
              These columns are downstream effects of deforestation itself
              (ρ ≈ 1.0 with the target). Keeping them would turn the model into
              an oracle that cheats with hindsight.
            </p>
          </div>
        </ChartCard>
      </div>

      {/* minmax normalisation */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <ChartCard
            title="Min-Max Normalisation Preview"
            subtitle="Values rescaled to [0, 1] — fit on the training split"
          >
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-emerald-100/50">
                  <th className="px-2 py-1.5">Column</th>
                  <th className="px-2 py-1.5 text-right">Raw (row 0)</th>
                  <th className="px-2 py-1.5 text-right">Scaled</th>
                  <th className="px-2 py-1.5 text-right">Min → Max</th>
                </tr>
              </thead>
              <tbody>
                {o.minmax.columns.map((c, i) => (
                  <tr key={c} className="border-b border-white/[0.04]">
                    <td className="px-2 py-1.5 text-emerald-100/85">{prettyName(c)}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-100/60">
                      {Number(o.minmax.before[0]?.[c] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium text-emerald-300">
                      {Number(o.minmax.after[0]?.[c] ?? 0).toFixed(4)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-emerald-100/40">
                      {o.minmax.min_[i].toLocaleString()} → {o.minmax.max_[i].toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>
        </div>
      </div>

      {/* hybrid feature selection */}
      <SectionTitle
        title="Hybrid Feature Selection"
        subtitle="Three ranking methods combined, then validated on a time-based window to pick the ideal number of features"
      />

      {!pipeline ? (
        <ChartCard title="Run the pipeline to compute the live ranking" subtitle="The button above executes the six-step chain on the real dataset">
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-emerald-100/40">
            <Wand2 className="h-4 w-4" /> Awaiting pipeline run...
          </div>
        </ChartCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Candidate Ranking (19 features)"
            subtitle="Combined hybrid score with per-method contributions"
            contentClassName="max-h-[420px] overflow-y-auto"
          >
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#0a1f16]/90 backdrop-blur">
                <tr className="text-emerald-100/50">
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Feature</th>
                  <th className="px-2 py-2 text-right">Spearman</th>
                  <th className="px-2 py-2 text-right">MI</th>
                  <th className="px-2 py-2 text-right">Perm.</th>
                  <th className="px-2 py-2 text-right">Hybrid</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.feature} className="border-b border-white/[0.04]">
                    <td className="px-2 py-1.5 text-emerald-100/40">{i + 1}</td>
                    <td className="px-2 py-1.5 font-medium text-emerald-100">{prettyName(r.feature)}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-100/60">{r.spearman}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-100/60">{r.mutual_info}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-100/60">{r.permutation}</td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.07]">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                            style={{ width: `${r.hybrid_score * 100}%` }} />
                        </div>
                        <span className="w-10 text-right font-medium text-emerald-300">{r.hybrid_score}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>

          <ChartCard
            title="Subset Size Validation"
            subtitle={`${pipeline.validation.validation_split.selection_train} → validation on ${pipeline.validation.validation_split.validation} (log-scale metrics)`}
          >
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-emerald-100/50">
                  <th className="px-2 py-2">Top-N</th>
                  <th className="px-2 py-2 text-right">MAE</th>
                  <th className="px-2 py-2 text-right">RMSE</th>
                  <th className="px-2 py-2 text-right">R²</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.validation.results.map((v) => {
                  const best = v.n_features === pipeline.validation.best.n_features;
                  return (
                    <tr key={v.n_features}
                      className={`border-b border-white/[0.04] ${best ? "bg-emerald-400/[0.08]" : ""}`}>
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center gap-1.5 font-medium ${best ? "text-emerald-300" : "text-emerald-100/80"}`}>
                          {best && <CheckCircle2 className="h-3.5 w-3.5" />}
                          Top-{v.n_features}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-emerald-100/65">{v.mae}</td>
                      <td className="px-2 py-2 text-right text-emerald-100/65">{v.rmse}</td>
                      <td className="px-2 py-2 text-right font-medium text-emerald-200">{v.r2}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-emerald-100/45">
              The production models use the Top-13 features for regression and
              the Top-10 for classification. This validation shows how each
              subset size behaves on unseen years before final training.
            </p>
          </ChartCard>
        </div>
      )}

      {runError && <ErrorPanel message={runError} onRetry={runPipeline} />}
    </div>
  );
}
