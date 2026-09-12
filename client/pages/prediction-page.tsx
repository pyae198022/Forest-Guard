"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, Leaf, Loader2, Sparkles, TreePine, Wand2, Zap } from "lucide-react";
import { PageHeader } from "@client/components/page-header";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { ChartCard } from "@client/charts/chart-card";
import { ProbabilityBars } from "@client/charts/probability-bars";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import type {
  FeatureMeta,
  ModelOption,
  PredictResult,
  Presets,
  Risk,
} from "@client/src/types";
import { prettyName, RISK_COLORS } from "@client/src/theme";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

/** Exact slider labels for the fixed Top-13 scenario layout. */
const SCENARIO_LABELS: Record<string, string> = {
  "Biodiversity_Impact_Index": "Biodiversity Impact Index",
  "Environmental_Impact_Score": "Environmental Impact Score",
  "Forest_Fragmentation_Index": "Forest Fragmentation Index",
};

/** Fixed group layout for the Top-13 Random Forest regression scenario. */
const SCENARIO_GROUPS: { name: string; features: string[] }[] = [
  {
    name: "Temporal & Socio-Economic",
    features: [
      "Population_Density",
      "GDP_Per_Capita",
      "Poverty_Rate_Pct",
      "Employment_Agri_Pct",
    ],
  },
  {
    name: "Land & Forest",
    features: [
      "Agricultural_Land_Pct",
      "Forest_Cover_Pct",
      "Forest_Fragmentation_Index",
    ],
  },
  {
    name: "Climate & Air Quality",
    features: [
      "PM25_Mean_Exposure_ug_m3",
      "Temperature_Anomaly_C",
      "Extreme_Heat_Days_Count",
    ],
  },
  {
    name: "Biodiversity & Environmental Impact",
    features: [
      "Biodiversity_Impact_Index",
      "IUCN_Threatened_Species_Count",
      "Environmental_Impact_Score",
    ],
  },
];

function fallbackGroup(name: string): string {
  if (name === "Year" || /Population|GDP|Poverty|Employment|Rural/.test(name))
    return "Temporal & Socio-Economic";
  if (/Forest|Agricultural|Fragmentation/.test(name)) return "Land & Forest";
  if (/Temperature|Precipitation|Drought|Heat|PM25|PM10|SPEI|CO2|Carbon/.test(name))
    return "Climate & Air Quality";
  return "Biodiversity & Environmental Impact";
}

/** Group features (in model order) using the fixed layout, with a regex
 *  fallback for features outside the pinned Top-13 set (other models). */
function groupFeatures(fs: FeatureMeta[]): Record<string, FeatureMeta[]> {
  const groups: Record<string, FeatureMeta[]> = {};
  const byName = new Map(fs.map((f) => [f.name, f]));
  const placed = new Set<string>();
  for (const g of SCENARIO_GROUPS) {
    const arr: FeatureMeta[] = [];
    for (const n of g.features) {
      const f = byName.get(n);
      if (f) {
        arr.push(f);
        placed.add(n);
      }
    }
    if (arr.length) groups[g.name] = arr;
  }
  for (const f of fs) {
    if (!placed.has(f.name)) (groups[fallbackGroup(f.name)] ??= []).push(f);
  }
  return groups;
}

export function PredictionPage() {
  const models = useApi<ModelOption[]>(() => forestApi.models(), []);
  const meta = useApi(() => forestApi.featureMeta(), []);
  const presets = useApi<Presets>(() => forestApi.presets(), []);

  const [modelKey, setModelKey] = useState("rf_top13");
  const [values, setValues] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PredictResult | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);

  const allFeatures = meta.data?.features ?? [];
  const activeModel = models.data?.find((m) => m.key === modelKey);

  // Feature schema consumed by the active model, in the exact model order.
  const modelFeatureNames = useMemo(() => {
    if (activeModel?.features?.length) return activeModel.features;
    return allFeatures.map((f) => f.name);
  }, [activeModel, allFeatures]);

  // Slider metadata now restricted to the active model's inputs only.
  const features = useMemo(() => {
    const byName = new Map(allFeatures.map((f) => [f.name, f]));
    return modelFeatureNames
      .map((n) => byName.get(n))
      .filter((f): f is FeatureMeta => Boolean(f));
  }, [allFeatures, modelFeatureNames]);

  const grouped = useMemo(() => groupFeatures(features), [features]);

  useEffect(() => {
    if (allFeatures.length && Object.keys(values).length === 0) {
      const init: Record<string, number> = {};
      for (const f of allFeatures) init[f.name] = f.median ?? f.mean;
      setValues(init);
    }
  }, [allFeatures, values]);

  const isClassification = activeModel?.task === "classification";

  const applyPreset = (key: "healthy" | "degraded") => {
    const p = presets.data?.[key];
    if (p) setValues({ ...p });
  };

  const predict = async () => {
    setPredicting(true);
    setPredictError(null);
    try {
      // Build the payload in the exact model feature order — no extra
      // features, no Year, and missing values fall back to the training
      // median (never 0).
      const byName = new Map(allFeatures.map((f) => [f.name, f]));
      const payload: Record<string, number> = {};
      for (const name of modelFeatureNames) {
        const metaFor = byName.get(name);
        payload[name] = values[name] ?? metaFor?.median ?? metaFor?.mean ?? 0;
      }
      setResult(await forestApi.predict(modelKey, payload));
    } catch (e) {
      setPredictError(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setPredicting(false);
    }
  };

  if ((models.loading || meta.loading) && !meta.data)
    return <LoadingPanel label="Loading model registry..." />;
  if (meta.error)
    return <ErrorPanel message={meta.error} onRetry={meta.refresh} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Model Prediction"
        description="Build your own country scenario with the sliders, then let the trained models estimate deforestation in hectares or classify Low/High risk. Presets give you a realistic starting point in one click."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline"
              onClick={() => applyPreset("healthy")}
              className="gap-1.5 border-emerald-400/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20">
              <Leaf className="h-3.5 w-3.5" /> Low-risk preset
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => applyPreset("degraded")}
              className="gap-1.5 border-rose-400/25 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20">
              <Zap className="h-3.5 w-3.5" /> High-risk preset
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* feature console */}
        <div className="space-y-4 xl:col-span-2">
          <ChartCard
            title="Scenario Console"
            subtitle={`${features.length} selected environmental & socio-economic features · set values and predict`}
            actions={
              <select
                value={modelKey}
                onChange={(e) => { setModelKey(e.target.value); setResult(null); }}
                className="h-8 rounded-md border border-white/10 bg-[#0a1f16] px-2 text-xs text-emerald-100"
              >
                {(models.data ?? []).map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            }
            contentClassName="space-y-4"
          >
            {!features.length ? (
              <LoadingPanel compact label="Loading feature metadata..." />
            ) : (
              Object.entries(grouped).map(([group, feats]) =>
                feats.length === 0 ? null : (
                  <div key={group}>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-100/45">
                      {group}
                    </div>
                    <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
                      {feats.map((f) => (
                        <div key={f.name}>
                          <div className="mb-1 flex items-center justify-between text-[11px]">
                            <span className="text-emerald-100/70">{SCENARIO_LABELS[f.name] ?? prettyName(f.name)}</span>
                            <span className="font-mono text-emerald-300">
                              {values[f.name]?.toLocaleString?.() ?? f.median}
                            </span>
                          </div>
                          <Slider
                            min={f.name === "Year" ? 1990 : f.min}
                            max={f.name === "Year" ? 2020 : f.max}
                            step={f.step}
                            value={[values[f.name] ?? f.median]}
                            onValueChange={(v) =>
                              setValues((s) => ({ ...s, [f.name]: v[0] }))
                            }
                            className="[&_[data-slot=slider-range]]:bg-emerald-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )
            )}
          </ChartCard>
        </div>

        {/* result panel */}
        <div className="space-y-4">
          <ChartCard
            title="Prediction"
            subtitle={activeModel?.label}
            footer={
              <Button
                onClick={predict}
                disabled={predicting}
                className="w-full gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm text-white hover:from-emerald-400 hover:to-teal-400"
              >
                {predicting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {predicting ? "Running inference..." : "Predict"}
              </Button>
            }
          >
            {!result ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <TreePine className="h-10 w-10 text-emerald-400/30" />
                <p className="max-w-[240px] text-xs leading-relaxed text-emerald-100/40">
                  Configure a scenario and run inference — results are computed
                  by the live Random Forest / MLP pipelines trained on the
                  temporal split.
                </p>
              </div>
            ) : result.task === "regression" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4 text-center"
              >
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-emerald-100/45">
                    Predicted deforestation
                  </div>
                  <div className="mt-1 text-4xl font-semibold text-white">
                    {result.predicted_deforestation_ha?.toLocaleString()}
                    <span className="ml-1 text-base font-normal text-emerald-100/50">ha</span>
                  </div>
                </div>
                <div
                  className="mx-auto flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
                  style={{
                    background: `${RISK_COLORS[result.implied_risk ?? "Low"]}1f`,
                    color: RISK_COLORS[result.implied_risk ?? "Low"],
                  }}
                >
                  <Gauge className="h-4 w-4" />
                  implied risk: {result.implied_risk}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-emerald-100/45">
                  The model works on a log scale internally and converts the
                  result back to hectares. Implied risk compares the prediction
                  against the Low/High threshold learned from training data.
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="text-center">
                  <div className="text-[11px] uppercase tracking-wide text-emerald-100/45">
                    Risk classification
                  </div>
                  <div
                    className="mt-1 text-3xl font-semibold"
                    style={{ color: RISK_COLORS[result.prediction ?? "Low"] }}
                  >
                    {result.prediction} deforestation risk
                  </div>
                  <div className="text-xs text-emerald-100/50">
                    confidence {(100 * (result.confidence ?? 0)).toFixed(1)}%
                  </div>
                </div>
                <ProbabilityBars
                  probabilities={Object.fromEntries(
                    (result.probabilities ?? []).map((p) => [p.class, p.probability]),
                  ) as Record<Risk, number>}
                  prediction={(result.prediction ?? "Low") as Risk}
                />
              </motion.div>
            )}
          </ChartCard>

          {predictError && <ErrorPanel message={predictError} onRetry={predict} />}

          <ChartCard title="How this works" subtitle="Good to know">
            <ul className="space-y-2 text-[11px] leading-relaxed text-emerald-100/55">
              <li className="flex gap-2"><Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/60" />
                Any slider you leave untouched is filled with the median from the training years, then scaled exactly like during training.</li>
              <li className="flex gap-2"><Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/60" />
                The regression champion (Random Forest, 13 best features) reaches ~97% R² on years it has never seen.</li>
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/60" />
                The risk classifier exceeds 98% accuracy on the 2016–2020 test window.</li>
            </ul>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
