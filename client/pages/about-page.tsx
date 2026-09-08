"use client";

import {
  BrainCircuit, Database, LineChart, Server, Workflow,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@client/components/page-header";
import { GlassCard } from "@client/components/glass-card";
import { LeafPattern, Logo } from "@client/assets/logo";
import { useApi } from "@client/hooks/use-api";
import { forestApi } from "@client/services/forest-api";
import type { DatasetSummary } from "@client/src/types";

const PIPELINE_STEPS = [
  { icon: Database, title: "Data Collection", desc: "4,030 synthetic forest-plot records across 6 ecoregions, generated with realistic multivariate relationships and stored in SQLite." },
  { icon: Workflow, title: "Preprocessing", desc: "Duplicate removal, median imputation, IQR-based outlier winsorization, type optimization and one-hot encoding of the categorical region feature." },
  { icon: LineChart, title: "EDA & Mining", desc: "Descriptive statistics, Pearson correlation analysis, distribution studies and K-Means clustering with PCA projection." },
  { icon: BrainCircuit, title: "Modeling", desc: "Five supervised classifiers trained on an 80/20 stratified split with a sklearn ColumnTransformer pipeline (impute → scale → encode)." },
  { icon: Server, title: "Evaluation", desc: "Accuracy, macro precision/recall/F1, ROC-AUC (OvR), 5-fold cross-validation, confusion matrices and feature importance — all benchmarked in the dashboard." },
];

const STACK = [
  { group: "Frontend", items: ["React 19", "TypeScript 5", "Next.js 16", "Tailwind CSS 4", "shadcn/ui", "Recharts", "Framer Motion"] },
  { group: "Backend", items: ["Python 3.12", "FastAPI", "Pandas", "NumPy", "scikit-learn", "Joblib", "Uvicorn"] },
  { group: "Data", items: ["SQLite", "CSV import/export", "synthetic generator", "4,030 × 27 dataset"] },
];

const LEARNING = [
  "Designing a realistic multivariate dataset with embedded class signal",
  "Building an end-to-end data-mining pipeline (SQL → cleaning → mining → modeling)",
  "Comparing classifier families fairly with cross-validated metrics",
  "Explaining predictions with sensitivity-based feature attribution",
  "Serving ML through a typed REST API consumed by a modern dashboard",
];

export function AboutPage() {
  const summary = useApi<DatasetSummary>(() => forestApi.datasetSummary(), []);
  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="About ForestGuard AI"
        description="A full-stack data-mining project: from synthetic dataset design to an explainable machine-learning API and a premium analytics dashboard."
      />

      {/* hero */}
      <GlassCard className="relative overflow-hidden p-6 md:p-8">
        <LeafPattern className="absolute -right-4 top-0 opacity-70" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
            <Logo size={56} />
          </div>
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold text-white">
              Forest intelligence for a data-driven world
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-emerald-100/60">
              ForestGuard AI monitors forest plots worldwide and classifies their
              <b className="text-emerald-200"> deforestation risk</b> (Low / Medium / High) from
              27 environmental, climate, biodiversity and socio-economic features. The project covers the
              complete data-mining lifecycle — collection, cleaning, exploratory analysis, descriptive
              mining, supervised modeling, evaluation and deployment — wrapped in a glassmorphism
              analytics UI.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* dataset card */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <GlassCard className="p-5 md:col-span-1">
          <SectionTitle>Dataset</SectionTitle>
          <div className="space-y-2.5 text-sm">
            <Row k="Records" v={(s?.n_rows ?? 4030).toLocaleString()} />
            <Row k="Features" v="27" />
            <Row k="Target" v="deforestation_risk" />
            <Row k="Classes" v="Low · Medium · High" />
            <Row k="Storage" v="SQLite + CSV" />
            <Row k="Regions" v="6 ecoregions" />
          </div>
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-emerald-100/40">
            The synthetic generator embeds real-world causal structure: vegetation health responds to
            climate and human pressure, and the risk label emerges from the same drivers — so models
            learn genuine patterns rather than noise.
          </p>
        </GlassCard>

        {/* pipeline */}
        <GlassCard className="p-5 md:col-span-2">
          <SectionTitle>Data-Mining Pipeline</SectionTitle>
          <div className="space-y-3">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-2">
                    <step.icon className="h-4 w-4 text-emerald-300" />
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && <div className="mt-1 w-px flex-1 bg-gradient-to-b from-emerald-400/30 to-transparent" />}
                </div>
                <div className="pb-2">
                  <p className="text-[13px] font-semibold text-emerald-50/90">
                    <span className="mr-1.5 text-emerald-400/60">{i + 1}.</span>{step.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/50">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* stack */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {STACK.map((s2) => (
          <GlassCard key={s2.group} className="p-5">
            <SectionTitle>{s2.group}</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {s2.items.map((it) => (
                <span key={it} className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-emerald-100/70">
                  {it}
                </span>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* learning outcomes */}
      <GlassCard className="mt-4 p-5">
        <SectionTitle>Learning Outcomes</SectionTitle>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {LEARNING.map((l, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.03] px-3 py-2.5">
              <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-[10px] font-bold text-emerald-300">
                {i + 1}
              </span>
              <p className="text-[13px] leading-relaxed text-emerald-100/65">{l}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] pb-1.5">
      <span className="text-xs text-emerald-100/45">{k}</span>
      <span className="font-mono text-[13px] text-emerald-100/85">{v}</span>
    </div>
  );
}
