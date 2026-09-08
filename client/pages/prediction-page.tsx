"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Leaf, Shuffle, Sparkles, TreePine, Wand2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@client/components/page-header";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { GlassCard } from "@client/components/glass-card";
import { ProbabilityBars } from "@client/charts/probability-bars";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import { RISK_COLORS } from "@client/src/theme";
import { cn } from "@/lib/utils";
import type { FeatureMeta, PredictResult } from "@client/src/types";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function PredictionPage() {
  const features = useApi<FeatureMeta[]>(() => forestApi.predictFeatures(), []);
  const models = useApi<{ key: string; name: string }[]>(() => forestApi.modelList(), []);
  const presets = useApi<{
    healthy: Record<string, number>;
    degraded: Record<string, number>;
    healthy_region: string;
    degraded_region: string;
  }>(() => forestApi.presets(), []);

  const [model, setModel] = useState("random_forest");
  const [values, setValues] = useState<Record<string, number | string>>({});
  const [result, setResult] = useState<PredictResult | null>(null);
  const [predicting, setPredicting] = useState(false);

  // seed form defaults from feature medians once metadata arrives
  useEffect(() => {
    if (!features.data || Object.keys(values).length > 0) return;
    const seed: Record<string, number | string> = {};
    for (const f of features.data) {
      if (f.type === "select") seed[f.name] = f.options?.[0] ?? "Amazon Basin";
      else if (f.type === "toggle") seed[f.name] = 0;
      else seed[f.name] = f.median ?? f.mean ?? 0;
    }
    setValues(seed);
  }, [features.data, values]);

  const groups = useMemo(() => {
    const map = new Map<string, FeatureMeta[]>();
    for (const f of features.data ?? []) {
      if (!map.has(f.group)) map.set(f.group, []);
      map.get(f.group)!.push(f);
    }
    return [...map.entries()];
  }, [features.data]);

  const applyPreset = (kind: "healthy" | "degraded") => {
    const p = presets.data;
    if (!p) return;
    const next: Record<string, number | string> = { ...p[kind] };
    next.region = kind === "healthy" ? p.healthy_region : p.degraded_region;
    setValues(next);
    setResult(null);
    toast({ title: kind === "healthy" ? "Healthy forest profile applied" : "At-risk forest profile applied" });
  };

  const randomize = () => {
    if (!features.data) return;
    const next: Record<string, number | string> = {};
    for (const f of features.data) {
      if (f.type === "select") next[f.name] = f.options?.[Math.floor(Math.random() * (f.options?.length ?? 1))] ?? "";
      else if (f.type === "toggle") next[f.name] = Math.random() < 0.35 ? 1 : 0;
      else {
        const lo = f.min ?? 0;
        const hi = f.max ?? 1;
        next[f.name] = Number((lo + Math.random() * (hi - lo)).toFixed(2));
      }
    }
    setValues(next);
    setResult(null);
  };

  const predict = async () => {
    if (!features.data) return;
    setPredicting(true);
    try {
      const payload: Record<string, number | string> = {};
      for (const f of features.data) {
        const v = values[f.name];
        payload[f.name] = f.type === "toggle" ? Number(v) : v;
      }
      const res = await forestApi.predict(model, payload);
      setResult(res);
    } catch (e) {
      toast({ title: "Prediction failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setPredicting(false);
    }
  };

  if (features.error && !features.data)
    return <ErrorPanel message={features.error} onRetry={features.refresh} />;
  if (features.loading && !features.data)
    return <LoadingPanel label="Loading feature metadata..." />;

  const form = (
    <Accordion type="multiple" defaultValue={groups.map(([g]) => g)} className="space-y-2.5">
      {groups.map(([group, feats]) => (
        <AccordionItem key={group} value={group} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 last:border-b">
          <AccordionTrigger className="py-3 text-[13px] font-medium capitalize text-emerald-50/90 hover:no-underline [&[data-state=open]>svg]:rotate-180">
            <span className="flex items-center gap-2">
              {group === "Biodiversity" ? <Leaf className="h-4 w-4 text-emerald-400" /> :
                group === "Climate" ? <Sparkles className="h-4 w-4 text-teal-400" /> :
                  group === "Socio-economic" ? <Wand2 className="h-4 w-4 text-amber-400" /> :
                    <TreePine className="h-4 w-4 text-emerald-400" />}
              {group.replace(/_/g, " ")}
              <span className="text-[11px] font-normal text-emerald-100/35">({feats.length} features)</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-emerald-100/40 transition-transform duration-200" />
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {feats.map((f) => (
                <FeatureInput key={f.name} meta={f}
                  value={values[f.name]}
                  onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );

  return (
    <div>
      <PageHeader
        title="AI Prediction"
        description="Classify the deforestation risk of a forest plot. Adjust the 27 features below (or load a preset profile), pick a trained model, and get an explainable prediction with per-class probabilities."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => applyPreset("healthy")}
              className="h-9 gap-1.5 rounded-lg border-emerald-400/30 bg-emerald-400/10 text-xs text-emerald-200 hover:bg-emerald-400/20">
              <TreePine className="h-3.5 w-3.5" /> Healthy preset
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset("degraded")}
              className="h-9 gap-1.5 rounded-lg border-rose-400/30 bg-rose-400/10 text-xs text-rose-200 hover:bg-rose-400/20">
              <Leaf className="h-3.5 w-3.5" /> At-risk preset
            </Button>
            <Button size="sm" variant="outline" onClick={randomize}
              className="h-9 gap-1.5 rounded-lg border-white/10 bg-white/[0.05] text-xs text-emerald-100/70 hover:bg-white/[0.09]">
              <Shuffle className="h-3.5 w-3.5" /> Randomize
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* form column */}
        <div className="xl:col-span-2">
          {form}
        </div>

        {/* control column */}
        <div className="space-y-4 xl:sticky xl:top-24 xl:h-fit">
          <GlassCard className="p-5">
            <label className="mb-1.5 block text-[13px] font-medium text-emerald-50/85">Model</label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full border-white/10 bg-white/[0.05] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#0a1f16] text-emerald-50">
                {(models.data ?? []).map((m) => (
                  <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={predict}
              disabled={predicting}
              className="mt-4 h-12 w-full gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(52,211,153,0.35)] transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60"
            >
              {predicting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Classifying…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Predict deforestation risk
                </>
              )}
            </Button>
          </GlassCard>

          {result && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>
              <GlassCard className="overflow-hidden p-5" key={result.prediction + result.confidence}>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-emerald-100/55">Predicted risk</p>
                  <span className="rounded-full px-3 py-1 text-lg font-bold"
                    style={{
                      color: RISK_COLORS[result.prediction],
                      backgroundColor: `${RISK_COLORS[result.prediction]}18`,
                      border: `1px solid ${RISK_COLORS[result.prediction]}44`,
                    }}>
                    {result.prediction}
                  </span>
                </div>
                <div className="my-4">
                  <ProbabilityBars probabilities={result.probabilities} prediction={result.prediction} />
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-200/60">
                    Top contributing factors
                  </p>
                  <div className="space-y-1.5">
                    {result.contributions.map((c) => {
                      const raises = c.impact > 0;
                      return (
                        <div key={c.feature} className="flex items-center gap-2 text-[11px]">
                          <span className="w-32 truncate text-emerald-100/65">{c.feature.replace(/_/g, " ")}</span>
                          <div className="relative h-1.5 flex-1 rounded-full bg-white/[0.06]">
                            <div className="absolute left-1/2 top-0 h-full w-px bg-white/25" />
                            <div
                              className="absolute top-0 h-full rounded-full"
                              style={{
                                left: raises ? "50%" : `${50 - Math.min(50, Math.abs(c.impact) * 400)}%`,
                                width: `${Math.min(50, Math.abs(c.impact) * 400)}%`,
                                backgroundColor: raises ? "#fb7185" : "#34d399",
                              }}
                            />
                          </div>
                          <span className={cn("w-14 text-right font-mono", raises ? "text-rose-300/80" : "text-emerald-300/80")}>
                            {c.impact > 0 ? "+" : ""}{(c.impact * 100).toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-emerald-100/35">
                    Sensitivity analysis: change in predicted-class probability when the feature increases slightly.
                    Red = pushes risk up, green = pushes risk down.
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureInput({ meta, value, onChange }: {
  meta: FeatureMeta;
  value: number | string | undefined;
  onChange: (v: number | string) => void;
}) {
  if (meta.type === "select") {
    return (
      <div>
        <label className="mb-1.5 block text-[11px] font-medium text-emerald-100/60">
          {meta.label} <span className="text-emerald-100/30">{meta.unit}</span>
        </label>
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger className="h-9 w-full border-white/10 bg-white/[0.05] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#0a1f16] text-emerald-50">
            {(meta.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (meta.type === "toggle") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
        <div>
          <p className="text-[11px] font-medium text-emerald-100/60">{meta.label}</p>
          <p className="text-[10px] text-emerald-100/30">protected reserve</p>
        </div>
        <Switch checked={Number(value) === 1} onCheckedChange={(v) => onChange(v ? 1 : 0)}
          className="data-[state=checked]:bg-emerald-500" />
      </div>
    );
  }
  const num = Number(value ?? 0);
  const min = meta.min ?? 0;
  const max = meta.max ?? 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[11px] font-medium text-emerald-100/60">
          {meta.label} <span className="text-emerald-100/30">{meta.unit}</span>
        </label>
        <input
          type="number"
          value={num}
          min={min}
          max={max}
          step={meta.step ?? 0.1}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-6 w-20 rounded-md border border-white/10 bg-white/[0.05] px-1.5 text-right font-mono text-[11px] text-emerald-100/85 focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
        />
      </div>
      <Slider
        value={[Math.min(Math.max(num, min), max)]}
        min={min} max={max} step={meta.step ?? 0.1}
        onValueChange={([v]) => onChange(Number(v.toFixed(3)))}
        className="*:data-[slot=slider-range]:bg-emerald-400"
      />
    </div>
  );
}
