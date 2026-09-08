"use client";

import { useEffect, useState } from "react";
import { Award, Crown, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PageHeader, SectionTitle } from "@client/components/page-header";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { ChartCard } from "@client/charts/chart-card";
import { MetricBars } from "@client/charts/metric-bars";
import { ConfusionMatrix } from "@client/charts/confusion-matrix";
import { RocChart } from "@client/charts/roc-chart";
import { ImportanceBars } from "@client/charts/importance-bars";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import { cn } from "@/lib/utils";
import type { EvaluationSummary } from "@client/src/types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function ModelEvaluationPage() {
  const evaluation = useApi<EvaluationSummary>(() => forestApi.evaluation(), []);
  const [selected, setSelected] = useState("random_forest");
  const [usePreprocessed, setUsePreprocessed] = useState(false);
  const [retraining, setRetraining] = useState(false);

  const models = evaluation.data?.models ?? [];
  const active = models.find((m) => m.key === selected) ?? models[0];

  // default select to the best model once loaded
  useEffect(() => {
    if (evaluation.data?.best_model) setSelected(evaluation.data.best_model);
  }, [evaluation.data?.best_model]);

  const retrain = async () => {
    setRetraining(true);
    try {
      const res = await forestApi.retrain(usePreprocessed ? "preprocessed" : "raw");
      toast({
        title: "Retraining complete",
        description: `Best model: ${res.best_model.replace(/_/g, " ")} — trained on ${usePreprocessed ? "preprocessed" : "raw"} data.`,
      });
      evaluation.refresh();
    } catch (e) {
      toast({ title: "Retraining failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setRetraining(false);
    }
  };

  if (evaluation.error && !evaluation.data)
    return <ErrorPanel message={evaluation.error} onRetry={evaluation.refresh} />;
  if (evaluation.loading && !evaluation.data)
    return <LoadingPanel label="Loading model metrics..." />;

  const chartData = models.map((m) => ({
    name: m.name.replace("K-Nearest Neighbors", "KNN"),
    Accuracy: m.accuracy,
    Precision: m.precision_macro,
    Recall: m.recall_macro,
    F1: m.f1_macro,
  }));

  return (
    <div>
      <PageHeader
        title="Model Evaluation"
        description="Five supervised classifiers benchmarked on an 80/20 stratified split — accuracy, macro precision/recall/F1, 5-fold cross-validation, ROC-AUC, confusion matrices and feature importance."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-emerald-100/60">
              train on preprocessed
              <Switch checked={usePreprocessed} onCheckedChange={setUsePreprocessed}
                className="data-[state=checked]:bg-emerald-500" />
            </label>
            <Button size="sm" onClick={retrain} disabled={retraining}
              className="h-9 gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-semibold text-white hover:from-emerald-400 hover:to-teal-400">
              <RefreshCw className={cn("h-3.5 w-3.5", retraining && "animate-spin")} />
              {retraining ? "Retraining…" : "Retrain all models"}
            </Button>
          </div>
        }
      />

      {/* leaderboard */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
          <div>
            <h3 className="text-[15px] font-semibold text-white">Model Leaderboard</h3>
            <p className="mt-0.5 text-xs text-emerald-100/45">
              trained on {evaluation.data?.train_rows?.toLocaleString()} rows · {evaluation.data?.test_rows?.toLocaleString()} test rows ·
              source: {evaluation.data?.data_source}
            </p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-200 sm:inline-flex">
            <Crown className="h-3.5 w-3.5" />
            best: {(evaluation.data?.best_model ?? "").replace(/_/g, " ")}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wide text-emerald-200/60">
                <th className="px-4 py-2.5 font-medium">Model</th>
                <th className="px-3 py-2.5 text-right font-medium">Accuracy</th>
                <th className="px-3 py-2.5 text-right font-medium">Precision</th>
                <th className="px-3 py-2.5 text-right font-medium">Recall</th>
                <th className="px-3 py-2.5 text-right font-medium">F1 (macro)</th>
                <th className="px-3 py-2.5 text-right font-medium">ROC-AUC</th>
                <th className="px-3 py-2.5 text-right font-medium">CV ± std</th>
                <th className="px-4 py-2.5 text-right font-medium">Fit time</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const isBest = m.key === evaluation.data?.best_model;
                return (
                  <tr key={m.key} onClick={() => setSelected(m.key)}
                    className={cn(
                      "cursor-pointer border-b border-white/[0.03] transition-colors",
                      m.key === selected ? "bg-emerald-400/[0.08]" : "hover:bg-white/[0.03]",
                    )}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 font-medium text-emerald-50/90">
                        {m.name}
                        {isBest && <Award className="h-3.5 w-3.5 text-amber-300" />}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-200">{(m.accuracy * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-100/70">{m.precision_macro.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-100/70">{m.recall_macro.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-100/70">{m.f1_macro.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-100/70">{m.roc_auc_ovr?.toFixed(3) ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-100/70">
                      {(m.cv_accuracy_mean * 100).toFixed(1)}% ± {(m.cv_accuracy_std * 100).toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-100/45">{m.train_seconds.toFixed(1)}s</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* comparison charts */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Metric Comparison" subtitle="Grouped scores per classifier">
          <MetricBars
            data={chartData}
            metrics={[
              { key: "Accuracy", label: "Accuracy" },
              { key: "Precision", label: "Precision (macro)" },
              { key: "Recall", label: "Recall (macro)" },
              { key: "F1", label: "F1 (macro)" },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Per-class metrics"
          subtitle={active ? `precision & recall of ${active.name} per risk class` : ""}
        >
          {active && (
            <div className="space-y-3">
              {Object.entries(active.per_class).map(([cls, m]) => (
                <div key={cls} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="mb-1.5 flex items-center justify-between text-[13px]">
                    <span className="font-medium text-emerald-50/90">{cls}</span>
                    <span className="font-mono text-[11px] text-emerald-100/45">support {m.support}</span>
                  </div>
                  {([["precision", m.precision], ["recall", m.recall]] as const).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-[11px]">
                      <span className="w-14 text-emerald-100/45">{k}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400/60 to-emerald-400" style={{ width: `${v * 100}%` }} />
                      </div>
                      <span className="w-10 text-right font-mono text-emerald-100/70">{v.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* per-model artifacts */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="ROC Curves (one-vs-rest)"
          subtitle={active?.name}
          actions={
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="h-8 w-44 border-white/10 bg-white/[0.05] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0a1f16] text-emerald-50">
                {models.map((m) => <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          }
        >
          <RocWrapper modelKey={selected} />
        </ChartCard>

        <ChartCard
          title="Feature Importance"
          subtitle={active ? `top drivers of ${active.name}` : ""}
          actions={
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="h-8 w-44 border-white/10 bg-white/[0.05] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0a1f16] text-emerald-50">
                {models.map((m) => <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          }
        >
          <ImportanceWrapper modelKey={selected} />
        </ChartCard>
      </div>

      {active && (
        <ChartCard title="Confusion Matrix" subtitle={`${active.name} on the held-out test set`} className="mt-4">
          <ConfusionMatrix matrix={active.confusion_matrix} classes={evaluation.data?.classes ?? ["Low", "Medium", "High"]} />
        </ChartCard>
      )}
    </div>
  );
}

function RocWrapper({ modelKey }: { modelKey: string }) {
  const roc = useApi<{ curves: Record<string, { fpr: number[]; tpr: number[] }> }>(
    () => forestApi.evaluation().then(() => fetchRoc(modelKey)), [modelKey]);
  return <RocChart curves={roc.data?.curves ?? {}} />;
}

async function fetchRoc(modelKey: string) {
  const res = await fetch(`/api/evaluation/roc?model=${modelKey}&XTransformPort=3010`);
  const body = await res.json();
  if (!body.success) throw new Error(body.error ?? "ROC fetch failed");
  return body.data as { curves: Record<string, { fpr: number[]; tpr: number[] }> };
}

function ImportanceWrapper({ modelKey }: { modelKey: string }) {
  const [data, setData] = useState<{ feature: string; importance: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData([]);
    (async () => {
      try {
        const res = await fetch(`/api/evaluation/feature-importance?model=${modelKey}&top=10&XTransformPort=3010`);
        const body = await res.json();
        if (cancelled) return;
        if (!body.success) throw new Error(body.error);
        setData(body.data.importances);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "failed");
      }
    })();
    return () => { cancelled = true; };
  }, [modelKey]);

  if (error) return <p className="p-6 text-center text-xs text-amber-300/70">{error} — this model type may not expose importances.</p>;
  if (!data.length) return <div className="flex h-56 items-center justify-center text-xs text-emerald-100/40">loading importances…</div>;
  return <ImportanceBars data={data} />;
}
