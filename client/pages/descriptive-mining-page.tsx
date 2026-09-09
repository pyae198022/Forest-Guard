"use client";

import { useState } from "react";
import { Network, PieChart, Sparkles } from "lucide-react";
import { PageHeader, SectionTitle } from "@client/components/page-header";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { ChartCard } from "@client/charts/chart-card";
import { MetricBars } from "@client/charts/metric-bars";
import { PcaScatter, LiftScatter } from "@client/charts/pca-scatter";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import type {
  ArOverview,
  ClusterResponse,
  ItemsetRow,
} from "@client/src/types";
import { prettyName } from "@client/src/theme";
import { Button } from "@/components/ui/button";

export function DescriptiveMiningPage() {
  const arOverview = useApi<ArOverview>(() => forestApi.arOverview(), []);
  const itemsets = useApi<{ itemsets: ItemsetRow[] }>(
    () => forestApi.arItemsets(15), []);
  const scatter = useApi(() => forestApi.arScatter(), []);
  const rules = useApi(() => forestApi.arRules(10), []);

  const [kOverride, setKOverride] = useState<number | undefined>(undefined);
  const cluster = useApi<ClusterResponse>(
    () => forestApi.clustering(kOverride), [kOverride]);

  const loading = arOverview.loading && itemsets.loading;
  const error = arOverview.error;

  if (loading && !arOverview.data)
    return <LoadingPanel label="Mining association patterns..." />;
  if (error && !arOverview.data)
    return <ErrorPanel message={error} onRetry={arOverview.refresh} />;

  const p = arOverview.data?.params;
  const maxSupport = Math.max(1, ...(itemsets.data?.itemsets ?? []).map((i) => i.support));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Descriptive Mining"
        description="Discover hidden patterns without a target variable: Apriori association rules reveal which conditions appear together, and K-Means clustering groups countries with similar environmental profiles."
        actions={
          p ? (
            <span className="glass-chip inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-emerald-200/80">
              <Network className="h-3.5 w-3.5 text-emerald-300" />
              support ≥ {(p.min_support * 100).toFixed(0)}% · confidence ≥ {(p.min_confidence * 100).toFixed(0)}%
            </span>
          ) : null
        }
      />

      {p && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Basket Items", value: p.basket_items, hint: `${p.bin_labels.join(" / ")} bins` },
            { label: "Frequent Itemsets", value: arOverview.data?.n_itemsets ?? 0 },
            { label: "Rules Mined", value: arOverview.data?.n_rules ?? 0 },
            { label: "Records", value: p.records.toLocaleString() },
            { label: "Target Excluded", value: "✓", hint: `${p.target_excluded} kept out of the basket` },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
              <div className="text-xl font-semibold text-white">{k.value}</div>
              <div className="mt-0.5 text-[11px] text-emerald-100/50">{k.label}</div>
              {k.hint && <div className="text-[10px] text-emerald-100/35">{k.hint}</div>}
            </div>
          ))}
        </div>
      )}

      {/* frequent itemsets + support/confidence */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Top 15 Frequent Itemsets"
          subtitle="Feature conditions that most often occur together (support = share of all records)"
          contentClassName="space-y-1.5"
        >
          {itemsets.loading || !itemsets.data ? (
            <LoadingPanel compact label="Counting..." />
          ) : (
            itemsets.data.itemsets.map((it, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="w-5 text-right text-emerald-100/35">{i + 1}</span>
                <span className="w-56 truncate text-emerald-100/75" title={it.items.join(", ")}>
                  {it.items.map((x) => x.replace(/_(Low|Medium|High)$/, "") + " · " + x.match(/_(Low|Medium|High)$/)?.[1]).join(" + ")}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-300"
                    style={{ width: `${(it.support / maxSupport) * 100}%` }} />
                </div>
                <span className="w-11 text-right font-medium text-emerald-300">{(it.support * 100).toFixed(1)}%</span>
              </div>
            ))
          )}
        </ChartCard>

        <ChartCard
          title="Support vs Confidence (coloured by Lift)"
          subtitle="Each dot is a rule — larger, warmer dots are stronger patterns"
        >
          {scatter.loading || !scatter.data ? (
            <LoadingPanel compact label="Plotting..." />
          ) : (
            <LiftScatter points={scatter.data.points} height={338} />
          )}
        </ChartCard>
      </div>

      {/* top rules */}
      <ChartCard
        title="Top 10 Association Rules by Lift"
        subtitle="Lift ≥ 5 means the co-occurrence is five times stronger than pure chance"
      >
        {rules.loading || !rules.data ? (
          <LoadingPanel compact label="Ranking..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead>
                <tr className="text-emerald-100/50">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">IF (antecedent)</th>
                  <th className="px-3 py-2">THEN (consequent)</th>
                  <th className="px-3 py-2 text-right">Support</th>
                  <th className="px-3 py-2 text-right">Confidence</th>
                  <th className="px-3 py-2 text-right">Lift</th>
                  <th className="px-3 py-2 text-right">Leverage</th>
                  <th className="px-3 py-2 text-right">Conviction</th>
                </tr>
              </thead>
              <tbody>
                {rules.data.rules.map((r, i) => (
                  <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-emerald-100/35">{i + 1}</td>
                    <td className="max-w-[220px] px-3 py-2 text-amber-200/80">
                      {r.antecedents.map(shortItem).join(" + ")}
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-emerald-200/85">
                      {r.consequents.map(shortItem).join(" + ")}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-100/65">{(r.support * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right text-emerald-100/65">{(r.confidence * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">
                      <span className="rounded-md bg-emerald-400/15 px-1.5 py-0.5 font-semibold text-emerald-300">
                        {r.lift}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-100/50">{r.leverage}</td>
                    <td className="px-3 py-2 text-right text-emerald-100/50">
                      {r.conviction === null ? "∞" : r.conviction}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {/* clustering */}
      <SectionTitle
        title="K-Means Clustering"
        subtitle="Countries grouped by ten environmental & socio-economic features — the number of groups (K) is chosen by silhouette score"
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="K Selection"
          subtitle="Silhouette score for each K — higher means cleaner groups"
          actions={
            <select
              value={kOverride ?? ""}
              onChange={(e) => setKOverride(e.target.value ? Number(e.target.value) : undefined)}
              className="h-8 rounded-md border border-white/10 bg-[#0a1f16] px-2 text-xs text-emerald-100"
            >
              <option value="">Optimal K ({cluster.data?.optimal_k ?? "?"})</option>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => (
                <option key={k} value={k}>K = {k}</option>
              ))}
            </select>
          }
        >
          {cluster.loading || !cluster.data ? (
            <LoadingPanel compact label="Fitting K-Means..." />
          ) : (
            <MetricBars
              data={cluster.data.k_selection.map((r) => ({
                name: `K=${r.k}`,
                silhouette: r.silhouette,
              }))}
              metrics={[{ key: "silhouette", label: "Silhouette" }]}
              height={260}
            />
          )}
        </ChartCard>

        <ChartCard
          title="PCA Cluster Scatter"
          subtitle="Countries projected onto two axes, coloured by cluster"
          className="xl:col-span-2"
        >
          {cluster.loading || !cluster.data ? (
            <LoadingPanel compact label="Projecting..." />
          ) : (
            <PcaScatter
              points={cluster.data.scatter}
              variance={cluster.data.pca_explained}
              height={300}
            />
          )}
        </ChartCard>
      </div>

      {cluster.data && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard
            title="Cluster Distribution & Quality"
            subtitle={`K = ${cluster.data.k} · overall silhouette ${cluster.data.overall_silhouette}`}
            footer={
              <p className="text-[11px] text-emerald-100/45">
                Silhouette ranges from −1 to 1: values around 0.25 indicate
                weak-moderate structure with overlapping country profiles —
                expected for complex real-world data.
              </p>
            }
          >
            <div className="space-y-2">
              {cluster.data.cluster_distribution.map((c) => (
                <div key={c.cluster} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-emerald-100">Cluster {c.cluster}</span>
                    <span className="text-emerald-100/50">
                      {c.count.toLocaleString()} rows · {c.percentage}%
                    </span>
                  </div>
                  <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                      style={{ width: `${c.percentage}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-emerald-100/40">
                    silhouette {c.silhouette}
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title="Cluster Profiles"
            subtitle="Mean of every clustering feature, per cluster (raw scale)"
            className="xl:col-span-2"
            contentClassName="overflow-x-auto"
          >
            <table className="w-full min-w-[700px] text-right text-xs">
              <thead>
                <tr className="text-emerald-100/50">
                  <th className="px-2 py-2 text-left">Feature</th>
                  {cluster.data.profiles.map((pr) => (
                    <th key={String(pr.cluster)} className="px-2 py-2">Cluster {String(pr.cluster)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cluster.data.features_used.map((f) => (
                  <tr key={f} className="border-b border-white/[0.04]">
                    <td className="px-2 py-1.5 text-left text-emerald-100/80">{prettyName(f)}</td>
                    {cluster.data!.profiles.map((pr) => (
                      <td key={String(pr.cluster)} className="px-2 py-1.5 text-emerald-50/80">
                        {Number(pr[f]).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>
        </div>
      )}

      {cluster.data && (
        <ChartCard
          title="IF-THEN Cluster Rules"
          subtitle="Plain-language summaries of each cluster relative to the global average"
        >
          <div className="grid gap-2 md:grid-cols-2">
            {cluster.data.rules.map((r) => (
              <div key={r.cluster} className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
                  <Sparkles className="h-3 w-3" /> Cluster {r.cluster}
                </div>
                <code className="text-[11px] leading-relaxed text-emerald-100/70">
                  IF {r.rule}
                </code>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

function shortItem(item: string): string {
  const m = item.match(/^(.*)_(Low|Medium|High)$/);
  if (!m) return item;
  return `${prettyName(m[1])} = ${m[2]}`;
}
