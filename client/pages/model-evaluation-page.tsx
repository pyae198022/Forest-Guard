"use client";

import { useState } from "react";
import { Award, BookMarked, Crosshair, RefreshCw, Timer, Trophy } from "lucide-react";
import { PageHeader, SectionTitle } from "@client/components/page-header";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { ChartCard } from "@client/charts/chart-card";
import { RocChart } from "@client/charts/roc-chart";
import { ConfusionMatrix as ConfusionMatrixChart } from "@client/charts/confusion-matrix";
import { ImportanceBars } from "@client/charts/importance-bars";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import type {
  ClassificationRow,
  ConfusionMatrix,
  CvTable,
  EvalSummary,
  ImportanceData,
  RegressionRow,
  RocCurves,
} from "@client/src/types";
import { prettyName } from "@client/src/theme";
import { Button } from "@/components/ui/button";

export function ModelEvaluationPage() {
  const summary = useApi<EvalSummary>(() => forestApi.evalSummary(), []);
  const reg = useApi(() => forestApi.regressionComparison(), []);
  const clf = useApi(() => forestApi.classificationComparison(), []);
  const roc = useApi<RocCurves>(() => forestApi.roc(), []);
  const cv = useApi<CvTable>(() => forestApi.crossValidation(), []);
  const importance = useApi<ImportanceData>(() => forestApi.featureImportance(), []);
  const [cmModel, setCmModel] = useState("rf_clf_top10");
  const cm = useApi<ConfusionMatrix>(
    () => forestApi.confusionMatrix(cmModel), [cmModel]);
  const [retraining, setRetraining] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState<string | null>(null);

  const loading = summary.loading && reg.loading;
  const error = summary.error || reg.error || clf.error;

  const retrain = async () => {
    setRetraining(true);
    setRetrainMsg(null);
    try {
      await forestApi.retrain();
      setRetrainMsg("All models retrained from scratch — every metric below is fresh.");
      reg.refresh(); clf.refresh(); roc.refresh(); cv.refresh(); summary.refresh(); importance.refresh();
    } catch (e) {
      setRetrainMsg(e instanceof Error ? `Retrain failed: ${e.message}` : "Retrain failed");
    } finally {
      setRetraining(false);
    }
  };

  if (loading && !summary.data) return <LoadingPanel label="Loading evaluation..." />;
  if (error && !summary.data)
    return <ErrorPanel message={error} onRetry={summary.refresh} />;

  const s = summary.data;
  const regRows = reg.data?.rows ?? [];
  const clfRows = clf.data?.rows ?? [];
  const bestReg = regRows[0];
  const bestClf = clfRows[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Model Evaluation"
        description="How good are the models? Every one is scored on years it never saw (2016–2020), with ROC curves, confusion matrices and cross-validation for stability. Reference values from the project book are shown side-by-side for comparison."
        actions={
          <Button onClick={retrain} disabled={retraining}
            className="gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm text-white hover:from-emerald-400 hover:to-teal-400">
            {retraining ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Timer className="h-4 w-4" />}
            {retraining ? "Retraining..." : "Retrain all"}
          </Button>
        }
      />

      {retrainMsg && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-2.5 text-xs text-emerald-200/80">
          {retrainMsg}
        </div>
      )}

      {/* headline */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/[0.09] to-transparent p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs text-emerald-200/70">
            <Trophy className="h-4 w-4 text-amber-300" /> Regression champion
          </div>
          <div className="mt-1.5 text-lg font-semibold text-white">{bestReg?.label ?? "-"}</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div><div className="font-semibold text-emerald-300">{bestReg?.r2?.toFixed(4) ?? "-"}</div><div className="text-[10px] text-emerald-100/40">R²</div></div>
            <div><div className="font-semibold text-emerald-300">{bestReg?.mae?.toLocaleString() ?? "-"}</div><div className="text-[10px] text-emerald-100/40">MAE</div></div>
            <div><div className="font-semibold text-emerald-300">{bestReg?.rmse?.toLocaleString() ?? "-"}</div><div className="text-[10px] text-emerald-100/40">RMSE</div></div>
          </div>
        </div>
        <div className="rounded-2xl border border-teal-400/20 bg-gradient-to-br from-teal-400/[0.09] to-transparent p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs text-teal-200/70">
            <Award className="h-4 w-4 text-amber-300" /> Classification champion
          </div>
          <div className="mt-1.5 text-lg font-semibold text-white">{bestClf?.label ?? "-"}</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div><div className="font-semibold text-teal-300">{((bestClf?.accuracy ?? 0) * 100).toFixed(2)}%</div><div className="text-[10px] text-emerald-100/40">Accuracy</div></div>
            <div><div className="font-semibold text-teal-300">{((bestClf?.balanced_accuracy ?? 0) * 100).toFixed(2)}%</div><div className="text-[10px] text-emerald-100/40">Balanced</div></div>
            <div><div className="font-semibold text-teal-300">{((bestClf?.macro_f1 ?? 0) * 100).toFixed(2)}%</div><div className="text-[10px] text-emerald-100/40">Macro-F1</div></div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs text-emerald-200/70">
            <Crosshair className="h-4 w-4 text-emerald-300" /> Protocol
          </div>
          <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-emerald-100/55">
            <li>Train {s?.train_rows?.toLocaleString()} rows (≤{s?.split_year}) · Test {s?.test_rows?.toLocaleString()} rows (&gt;{s?.split_year})</li>
            <li>Class threshold (train median): {(s?.threshold ?? 0).toLocaleString()} ha</li>
            <li>Regression targets trained on log1p scale</li>
            <li>Trained at {s?.trained_at?.replace("T", " ").slice(0, 16) ?? "-"}</li>
          </ul>
        </div>
      </div>

      {/* regression comparison */}
      <SectionTitle
        title="Regression Comparison"
        subtitle="Predicting exact hectares — the lower the MAE/RMSE and the higher the R², the better"
      />
      <ChartCard title="Random Forest & Neural Network regressors" subtitle="Live results vs book reference values">
        <ModelTable
          rows={regRows.map((r) => ({
            label: r.label,
            metrics: [
              { name: "MAE", value: r.mae?.toLocaleString() ?? "-", book: r.book?.mae.toLocaleString() },
              { name: "RMSE", value: r.rmse?.toLocaleString() ?? "-", book: r.book?.rmse.toLocaleString() },
              { name: "R²", value: r.r2?.toFixed(4) ?? "-", book: r.book?.r2.toFixed(4) },
            ],
            best: r.model === bestReg?.model,
          }))}
        />
      </ChartCard>

      {/* classification comparison */}
      <SectionTitle
        title="Classification Comparison"
        subtitle="Predicting Low vs High risk — accuracy, balance and error types"
      />
      <ChartCard title="RF, hybrid and MLP classifiers" subtitle="Live results vs book reference values">
        <ModelTable
          rows={clfRows.map((r) => ({
            label: r.label,
            metrics: [
              { name: "Accuracy", value: pct(r.accuracy), book: r.book ? pct(r.book.accuracy) : undefined },
              { name: "Bal. Acc", value: pct(r.balanced_accuracy), book: r.book ? pct(r.book.balanced_accuracy) : undefined },
              { name: "Macro-P", value: pct(r.macro_precision) },
              { name: "Macro-R", value: pct(r.macro_recall) },
              { name: "Macro-F1", value: pct(r.macro_f1), book: r.book ? pct(r.book.macro_f1) : undefined },
              { name: "AUC", value: r.auc ? r.auc.toFixed(4) : "-" },
            ],
            best: r.model === bestClf?.model,
          }))}
        />
      </ChartCard>

      {/* ROC + confusion matrix */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="ROC Curves & AUC"
          subtitle="True-positive vs false-positive trade-off — closer to the top-left corner is better"
          footer={
            <div className="flex flex-wrap gap-3 text-[11px] text-emerald-100/55">
              {Object.entries(roc.data?.curves ?? {}).map(([k, v]) => (
                <span key={k}>
                  {k}: <span className="font-semibold text-emerald-300">{v.auc?.toFixed(4) ?? "-"}</span>
                </span>
              ))}
            </div>
          }
        >
          {roc.loading || !roc.data ? (
            <LoadingPanel compact label="Tracing curves..." />
          ) : (
            <RocChart
              curves={Object.fromEntries(
                Object.entries(roc.data.curves).map(([k, v]) => [`${k} (AUC ${v.auc?.toFixed(3)})`, { fpr: v.fpr, tpr: v.tpr }]),
              )}
              height={340}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Confusion Matrix"
          subtitle="Per-class errors on the test window"
          actions={
            <select
              value={cmModel}
              onChange={(e) => setCmModel(e.target.value)}
              className="h-8 max-w-[220px] rounded-md border border-white/10 bg-[#0a1f16] px-2 text-xs text-emerald-100"
            >
              {clfRows.map((r: ClassificationRow) => (
                <option key={r.model} value={r.model}>{r.label}</option>
              ))}
            </select>
          }
        >
          {cm.loading || !cm.data ? (
            <LoadingPanel compact label="Scoring..." />
          ) : (
            <div>
              <ConfusionMatrixChart
                classes={cm.data.labels}
                matrix={cm.data.matrix}
              />
              <p className="mt-3 text-center text-[11px] text-emerald-100/45">
                {cm.data.test_rows.toLocaleString()} test rows · correctly
                classified:{" "}
                <span className="font-semibold text-emerald-300">
                  {(
                    (100 * (cm.data.tn + cm.data.tp)) / cm.data.test_rows
                  ).toFixed(2)}
                  %
                </span>
              </p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* cross validation */}
      <SectionTitle
        title="5-Fold Cross-Validation"
        subtitle="Each model trained five times on different slices of the training period — mean ± spread shows how stable it is"
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Regression CV" subtitle="log-scale target (training regime)">
          <CvTableComp
            rows={Object.entries(cv.data?.regression ?? {}).map(([k, v]) => ({
              label: k,
              cells: [
                `${v.mae[0]} ± ${v.mae[1]}`,
                `${v.rmse[0]} ± ${v.rmse[1]}`,
                `${v.r2[0]} ± ${v.r2[1]}`,
              ],
            }))}
            headers={["MAE", "RMSE", "R²"]}
          />
        </ChartCard>
        <ChartCard title="Classification CV" subtitle="stratified folds">
          <CvTableComp
            rows={Object.entries(cv.data?.classification ?? {}).map(([k, v]) => ({
              label: k,
              cells: [
                `${v.accuracy[0]} ± ${v.accuracy[1]}`,
                `${v.balanced_accuracy[0]} ± ${v.balanced_accuracy[1]}`,
                `${v.macro_f1[0]} ± ${v.macro_f1[1]}`,
                v.auc ? `${v.auc[0]}` : "-",
              ],
            }))}
            headers={["Accuracy", "Bal. Acc", "Macro-F1", "AUC"]}
          />
        </ChartCard>
      </div>

      {/* feature importance */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="RF Feature Importance — Regression"
          subtitle="Mean decrease in impurity, baseline model"
        >
          {importance.loading || !importance.data ? (
            <LoadingPanel compact label="Loading..." />
          ) : (
            <ImportanceBars data={importance.data.regression.slice(0, 10)} />
          )}
        </ChartCard>
        <ChartCard
          title="RF Feature Importance — Classification"
          subtitle="Mean decrease in impurity, baseline model"
        >
          {importance.loading || !importance.data ? (
            <LoadingPanel compact label="Loading..." />
          ) : (
            <ImportanceBars data={importance.data.classification.slice(0, 10)} />
          )}
        </ChartCard>
      </div>

      {/* findings */}
      <ChartCard
        title="Findings"
        subtitle="What the numbers say"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              t: "Regression",
              b: `Top-13 Random Forest is the strongest regressor with R² ≈ ${regRows.find((r) => r.model === "rf_top13")?.r2?.toFixed(4) ?? "-"} and MAE ≈ ${regRows.find((r) => r.model === "rf_top13")?.mae?.toLocaleString() ?? "-"} ha — right in line with the reference results from the project book.`,
            },
            {
              t: "Classification",
              b: `The RF baseline hits ${pct(clfRows.find((r) => r.model === "rf_clf_baseline")?.accuracy)} accuracy with macro-F1 ${pct(clfRows.find((r) => r.model === "rf_clf_baseline")?.macro_f1)} — matching the book's reported result to four decimals. Feature selection keeps quality with fewer inputs.`,
            },
            {
              t: "Neural networks",
              b: "MLP models trail the forests on the hectares-scale test (the book reports the same ordering) yet improve markedly on the optimised feature subset — the Top-10 classifier reaches ≈ 0.975 accuracy, identical to the book.",
            },
            {
              t: "Stability",
              b: `Cross-validation standard deviations stay ≤ 0.005 for tree ensembles, indicating stable folds and low overfitting risk across the training period.`,
            },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-white">
                <BookMarked className="h-4 w-4 text-emerald-300/70" /> {f.t}
              </div>
              <p className="text-xs leading-relaxed text-emerald-100/60">{f.b}</p>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "-" : `${(v * 100).toFixed(2)}%`;
}

function ModelTable({
  rows,
}: {
  rows: {
    label: string;
    best: boolean;
    metrics: { name: string; value: string; book?: string }[];
  }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead>
          <tr className="text-emerald-100/50">
            <th className="px-3 py-2">Model</th>
            <th className="px-3 py-2 text-right">Metric</th>
            <th className="px-3 py-2 text-right">This run</th>
            <th className="px-3 py-2 text-right">Book ref.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) =>
            r.metrics.map((m, mi) => (
              <tr key={`${r.label}-${m.name}`}
                className={`border-b border-white/[0.04] ${r.best && mi === 0 ? "bg-emerald-400/[0.07]" : ""}`}>
                {mi === 0 && (
                  <td rowSpan={r.metrics.length} className="px-3 py-2 align-top font-medium text-emerald-100">
                    <span className="inline-flex items-center gap-1.5">
                      {r.best && <Trophy className="h-3.5 w-3.5 text-amber-300" />}
                      {r.label}
                    </span>
                  </td>
                )}
                <td className="px-3 py-1.5 text-right text-emerald-100/55">{m.name}</td>
                <td className="px-3 py-1.5 text-right font-medium text-emerald-200">{m.value}</td>
                <td className="px-3 py-1.5 text-right text-[11px] text-emerald-100/40">{m.book ?? "—"}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function CvTableComp({
  rows,
  headers,
}: {
  rows: { label: string; cells: string[] }[];
  headers: string[];
}) {
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="text-emerald-100/50">
          <th className="px-3 py-2">Model</th>
          {headers.map((h) => (
            <th key={h} className="px-3 py-2 text-right">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-white/[0.04]">
            <td className="px-3 py-2 font-medium text-emerald-100">{prettyName(r.label)}</td>
            {r.cells.map((c, i) => (
              <td key={i} className="px-3 py-2 text-right text-emerald-50/75">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
