"use client";

import {
  BookOpen,
  CheckCircle2,
  Cpu,
  Database,
  GraduationCap,
  Layers,
  Radar,
  Server,
  TriangleAlert,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@client/components/page-header";
import { ChartCard } from "@client/charts/chart-card";

export function AboutPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="About This Project"
        description="ForestGuard turns a university data-mining study of global deforestation into a live, interactive application — explore the data, watch the preprocessing pipeline run, discover patterns and test the trained models, all in the browser."
        actions={
          <span className="glass-chip inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-emerald-200/80">
            <GraduationCap className="h-3.5 w-3.5 text-emerald-300" /> Data Mining · University Project
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Project Background"
          subtitle="Why deforestation prediction matters"
          className="xl:col-span-2"
        >
          <p className="text-sm leading-relaxed text-emerald-100/70">
            The rapid loss of forests damages ecological balance, accelerates
            biodiversity decline and undermines climate stability. Traditional
            assessment methods cannot make proactive predictions, so this
            project applies data mining techniques — association rule mining,
            K-Means clustering, Random Forests and neural networks — to a
            31-year country-level panel (1990-2020) in order to forecast
            deforestation trends and rank their drivers before critical
            thresholds are crossed.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            {[
              { icon: Database, label: "4,030", sub: "records" },
              { icon: Layers, label: "27", sub: "attributes" },
              { icon: Radar, label: "31", sub: "years covered" },
              { icon: Cpu, label: "10", sub: "trained models" },
            ].map((s) => (
              <div key={s.sub} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-center">
                <s.icon className="mx-auto mb-1.5 h-4 w-4 text-emerald-300/70" />
                <div className="text-lg font-semibold text-white">{s.label}</div>
                <div className="text-[10px] text-emerald-100/45">{s.sub}</div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Objectives" subtitle="What this project sets out to do">
          <ul className="space-y-2.5 text-xs leading-relaxed text-emerald-100/65">
            {[
              "Identify trends associated with deforestation by preprocessing and analysing historical environmental and climatic variables.",
              "Investigate the performance impact of feature engineering on prediction models.",
              "Use time-based data splitting for reliable regression and classification while avoiding data leakage.",
              "Assess models with feature rankings and comprehensive metrics to identify the main causes of deforestation.",
            ].map((o, i) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
                {o}
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <SectionTitle
        title="Methodology Pipeline"
        subtitle="From raw data to trained models in four stages"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            ch: "Stage 1",
            t: "Data Preparation",
            pts: [
              "4,030 × 27 panel · zero missing · zero duplicates",
              "log1p on 5 skewed features (skew ≈ 10.6)",
              "One-hot encoding of Entity / Region",
              "Min-Max scaling fit on the training split",
              "Hybrid feature ranking (correlation + information gain + permutation)",
            ],
          },
          {
            ch: "Stage 2",
            t: "Exploration & Mining",
            pts: [
              "Distributions, box plots, outliers per feature",
              "Global trend 1990-2020 and regional spreads",
              "Apriori rules on Low/Medium/High binned features",
              "support ≥ 10% · confidence ≥ 60% · ranked by lift",
              "K-Means with K = 2…10 selected by silhouette",
            ],
          },
          {
            ch: "Stage 3",
            t: "Predictive Modelling",
            pts: [
              "Strict temporal split: train ≤ 2015, test > 2015",
              "Leakage filter on 5 target-derived columns",
              "Random Forest regression, baseline & optimised",
              "Neural-network regressors and classifiers",
              "Binary risk target via train-median threshold",
            ],
          },
          {
            ch: "Stage 4",
            t: "Evaluation",
            pts: [
              "MAE / RMSE / R² reported in hectares",
              "Accuracy, Balanced Accuracy, Macro-P/R/F1",
              "ROC curves + AUC per classifier",
              "Confusion matrices on the 2016-2020 window",
              "5-fold cross-validation on the training period",
            ],
          },
        ].map((c) => (
          <div key={c.ch} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70">{c.ch}</div>
            <div className="mb-2 mt-0.5 text-sm font-semibold text-white">{c.t}</div>
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-emerald-100/55">
              {c.pts.map((pt) => (
                <li key={pt} className="flex gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400/60" />
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Advantages"
          subtitle="Strengths of this approach"
        >
          <ul className="space-y-2 text-xs leading-relaxed text-emerald-100/65">
            {[
              ["Proactive environmental management", "risk zones and causal drivers surface before thresholds are crossed."],
              ["Target-leakage prevention", "temporal split plus exclusion of CO₂ / carbon-sink / PM-emission features."],
              ["High predictive accuracy", "RF Top-13 regression reaches R² ≈ 0.97; the Top-10 classifier exceeds 98% accuracy with AUC ≈ 0.999."],
              ["Comprehensive mining", "descriptive (Apriori + K-Means) and predictive (RF + MLP) views of the same panel."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
                <span><span className="font-medium text-emerald-100">{t}</span> — {d}</span>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          title="Limitations"
          subtitle="Where the models fall short"
        >
          <ul className="space-y-2 text-xs leading-relaxed text-emerald-100/65">
            {[
              ["Geographical imbalance", "Other/Global aggregates dominate the panel, limiting localised predictions."],
              ["Association-rule granularity", "quantile bins struggle to filter a continuous target as granular as hectares."],
              ["Historical basis", "models learn patterns up to 2015; unforeseen ecological or policy shifts fall outside their scope."],
              ["NN variance", "multi-layer perceptrons are sensitive to scaling and seed choices, explaining their wider metric spread."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-2">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/70" />
                <span><span className="font-medium text-emerald-100">{t}</span> — {d}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Technology Stack" subtitle="Everything runs locally in this sandbox">
          <div className="space-y-3 text-xs">
            {[
              ["Frontend", "Next.js 16 · React 19 · TypeScript · Tailwind CSS · shadcn/ui · Recharts · Framer Motion"],
              ["Backend", "Python 3.12 · FastAPI · scikit-learn (RF, MLP, K-Means, metrics) · pandas · NumPy · Joblib"],
              ["Storage", "SQLite (raw mirror + run history) · canonical CSV export of the Excel source"],
              ["Mining", "Hand-rolled Apriori frequent itemsets with support / confidence / lift / leverage / conviction"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                <span className="w-20 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300/70">{k}</span>
                <span className="leading-relaxed text-emerald-100/60">{v}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Data Sources" subtitle="Where the dataset comes from">
          <ol className="list-inside list-decimal space-y-1.5 text-[11px] leading-relaxed text-emerald-100/55">
            <li>FAO — Global Forest Resources Assessment (2020)</li>
            <li>The World Bank — World Development Indicators</li>
            <li>IUCN Red List of Threatened Species</li>
            <li>WRI / Global Forest Watch — forest loss monitoring</li>
            <li>Han, Kamber & Pei — Data Mining: Concepts and Techniques (3rd ed.)</li>
            <li>Coursera — Random Forest overview</li>
          </ol>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3 text-[11px] text-emerald-200/70">
            <BookOpen className="h-4 w-4 shrink-0" />
            Advisor: Professor Dr. Daw Hus Myat Mo · University of Computer
            Studies, Yangon (UCSY)
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-100/40">
            <Server className="h-3.5 w-3.5" />
            API base: FastAPI on :3010 — every figure on this site is computed
            live from the uploaded dataset.
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
