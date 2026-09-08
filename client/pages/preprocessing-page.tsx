"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, Copy, CopyX, FileWarning, PlayCircle, Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PageHeader, SectionTitle } from "@client/components/page-header";
import { StatCard, StatCardSkeleton } from "@client/components/stat-card";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { GlassCard } from "@client/components/glass-card";
import { forestApi, type PipelineOptions } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import { cn } from "@/lib/utils";
import type { PipelineResult, QualityOverview } from "@client/src/types";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function PreprocessingPage() {
  const overview = useApi<QualityOverview>(() => forestApi.qualityOverview(), []);
  const [options, setOptions] = useState<PipelineOptions>({
    missing_strategy: "median",
    scaling: "standard",
    outlier_handling: "winsorize",
    drop_duplicates: true,
    drop_high_missing: true,
    missing_threshold: 30,
    save_result: true,
  });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);

  const runPipeline = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await forestApi.runPipeline(options);
      // small stagger so the step animation is perceivable
      await new Promise((r) => setTimeout(r, 400));
      setResult(res);
      toast({ title: "Pipeline complete", description: `${res.rows_in} → ${res.rows_out} rows · quality ${res.quality_before} → ${res.quality_after}` });
      overview.refresh();
    } catch (e) {
      toast({ title: "Pipeline failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  if (overview.error && !overview.data)
    return <ErrorPanel message={overview.error} onRetry={overview.refresh} />;

  const o = overview.data;

  return (
    <div>
      <PageHeader
        title="Data Preprocessing"
        description="Audit data quality, then configure and execute the cleaning pipeline: duplicate removal, missing-value imputation, outlier winsorization and type optimization. Results are persisted to SQLite for model training."
      />

      {/* quality overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!o ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : (
          <>
            <StatCard index={0} label="Quality Score" value={`${o.quality_score}`} unit="/100" tone="teal" icon={Wand2} hint="missing + duplicates + outliers" />
            <StatCard index={1} label="Missing Cells" value={o.missing_total} tone="amber" icon={FileWarning} hint={`${o.missing_by_column.length} columns affected`} />
            <StatCard index={2} label="Duplicate Rows" value={o.duplicates} tone="rose" icon={CopyX} hint="identical feature vectors" />
            <StatCard index={3} label="Rows × Columns" value={`${o.rows.toLocaleString()} × ${o.columns}`} icon={Copy} hint={Object.entries(o.dtype_counts).map(([k, v]) => `${v} ${k}`).join(" · ")} />
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* quality detail */}
        <div className="space-y-4 lg:col-span-2">
          {o && (
            <GlassCard className="p-5">
              <SectionTitle>Missing values by column</SectionTitle>
              {o.missing_by_column.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-emerald-200/70">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> No missing values detected.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {o.missing_by_column.map((m) => (
                    <div key={m.column} className="flex items-center gap-3 text-xs">
                      <span className="w-44 truncate text-emerald-100/65">{m.column}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(4, m.pct * 12)}%` }}
                          className="h-full rounded-full bg-gradient-to-r from-amber-400/60 to-amber-400" />
                      </div>
                      <span className="w-16 text-right font-mono text-emerald-100/50">{m.missing} ({m.pct}%)</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5">
                <SectionTitle>Outlier candidates (IQR × 1.5)</SectionTitle>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {o.outlier_summary.map((out) => (
                    <div key={out.column} className="rounded-lg border border-rose-400/15 bg-rose-400/[0.06] p-2.5">
                      <p className="truncate text-[11px] font-medium text-rose-200/85">{out.column.replace(/_/g, " ")}</p>
                      <p className="mt-0.5 font-mono text-xs text-rose-100/60">{out.count} cells · {out.pct}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          )}

          {/* pipeline result */}
          <AnimatePresence>
            {result && (
              <GlassCard className="p-5" key="result">
                <SectionTitle right={
                  <span className="text-xs text-emerald-300/80">{result.rows_in} → {result.rows_out} rows</span>
                }>
                  Pipeline result
                </SectionTitle>

                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Missing", before: result.missing_before, after: result.missing_after },
                    { label: "Duplicates", before: result.duplicates_before, after: result.duplicates_after },
                    { label: "Quality", before: result.quality_before, after: result.quality_after },
                    { label: "Rows", before: result.rows_in, after: result.rows_out },
                  ].map((cmp) => (
                    <div key={cmp.label} className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3">
                      <p className="text-[11px] text-emerald-100/45">{cmp.label}</p>
                      <p className="mt-1 text-sm">
                        <span className="text-emerald-100/40">{cmp.before.toLocaleString()}</span>
                        <span className="mx-1.5 text-emerald-400">→</span>
                        <b className="text-white">{cmp.after.toLocaleString()}</b>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {result.steps.map((step, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.14 }}
                      className="flex items-start gap-3 rounded-lg border border-emerald-400/10 bg-emerald-400/[0.04] px-3.5 py-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-emerald-50/90">{step.step}</p>
                        <p className="text-xs text-emerald-100/45">{step.detail}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4">
                  <SectionTitle>Cleaned preview (first 10 rows)</SectionTitle>
                  <div className="max-h-56 overflow-auto rounded-lg border border-white/[0.06]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="sticky top-0 bg-[#071b12]/95 text-emerald-200/60">
                        <tr>
                          {result.preview_columns.map((c) => (
                            <th key={c} className="whitespace-nowrap px-2.5 py-2 font-medium">{c.replace(/_/g, " ")}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="text-emerald-50/75">
                        {result.preview.map((row, i) => (
                          <tr key={i} className="border-t border-white/[0.04]">
                            {result.preview_columns.map((c) => (
                              <td key={c} className="whitespace-nowrap px-2.5 py-1.5 font-mono">
                                {typeof row[c] === "number" ? (row[c] as number).toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(row[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </GlassCard>
            )}
          </AnimatePresence>
        </div>

        {/* options panel */}
        <GlassCard className="h-fit p-5 lg:sticky lg:top-24">
          <SectionTitle>Pipeline configuration</SectionTitle>
          {running ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-400" />
              </div>
              <p className="text-sm text-emerald-100/60">Running pipeline…</p>
            </div>
          ) : (
            <div className="space-y-4">
              <OptionRow label="Imputation" hint="how missing cells are filled">
                <Select value={options.missing_strategy} onValueChange={(v) => setOptions((o2) => ({ ...o2, missing_strategy: v as PipelineOptions["missing_strategy"] }))}>
                  <SelectTrigger className="w-32 border-white/10 bg-white/[0.05] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0a1f16] text-emerald-50">
                    <SelectItem value="mean">Mean</SelectItem>
                    <SelectItem value="median">Median</SelectItem>
                    <SelectItem value="most_frequent">Mode</SelectItem>
                  </SelectContent>
                </Select>
              </OptionRow>
              <OptionRow label="Scaling" hint="applied at training time">
                <Select value={options.scaling} onValueChange={(v) => setOptions((o2) => ({ ...o2, scaling: v as PipelineOptions["scaling"] }))}>
                  <SelectTrigger className="w-32 border-white/10 bg-white/[0.05] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0a1f16] text-emerald-50">
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="minmax">MinMax</SelectItem>
                    <SelectItem value="robust">Robust</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </OptionRow>
              <OptionRow label="Outliers" hint="extreme value handling">
                <Select value={options.outlier_handling} onValueChange={(v) => setOptions((o2) => ({ ...o2, outlier_handling: v as PipelineOptions["outlier_handling"] }))}>
                  <SelectTrigger className="w-32 border-white/10 bg-white/[0.05] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0a1f16] text-emerald-50">
                    <SelectItem value="winsorize">Winsorize</SelectItem>
                    <SelectItem value="none">Keep</SelectItem>
                  </SelectContent>
                </Select>
              </OptionRow>
              <div className="border-t border-white/[0.06] pt-3" />
              <ToggleRow label="Drop duplicate rows" checked={options.drop_duplicates}
                onChange={(v) => setOptions((o2) => ({ ...o2, drop_duplicates: v }))} />
              <ToggleRow label="Drop high-missing columns" checked={options.drop_high_missing}
                onChange={(v) => setOptions((o2) => ({ ...o2, drop_high_missing: v }))} />
              <ToggleRow label="Save result to SQLite" checked={options.save_result}
                onChange={(v) => setOptions((o2) => ({ ...o2, save_result: v }))} />

              <Button
                onClick={runPipeline}
                className="mt-2 h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(52,211,153,0.35)] transition hover:from-emerald-400 hover:to-teal-400"
              >
                <PlayCircle className="h-4.5 w-4.5" /> Run preprocessing pipeline
              </Button>

              {o && o.constant_columns.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3 text-[11px] text-amber-200/80">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Constant columns detected: {o.constant_columns.join(", ")} — consider dropping before training.
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function OptionRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[13px] font-medium text-emerald-50/85">{label}</p>
        <p className="text-[11px] text-emerald-100/40">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[13px] text-emerald-50/85">{label}</p>
      <Switch checked={checked} onCheckedChange={onChange}
        className="data-[state=checked]:bg-emerald-500" />
    </div>
  );
}
