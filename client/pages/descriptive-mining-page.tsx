"use client";

import { useState } from "react";
import { Boxes } from "lucide-react";
import { PageHeader, SectionTitle } from "@client/components/page-header";
import { LoadingPanel, ErrorPanel, TableSkeleton } from "@client/components/loading";
import { ChartCard } from "@client/charts/chart-card";
import { ClusterScatter } from "@client/charts/cluster-scatter";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import { cn } from "@/lib/utils";
import type { ClusterResponse, DescriptiveStats } from "@client/src/types";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export function DescriptiveMiningPage() {
  const stats = useApi<DescriptiveStats>(() => forestApi.descriptive(), []);
  const [k, setK] = useState(4);
  const [cluster, setCluster] = useState<ClusterResponse | null>(null);
  const [clustering, setClustering] = useState(false);

  const runClustering = async () => {
    setClustering(true);
    try {
      setCluster(await forestApi.clustering(k));
    } finally {
      setClustering(false);
    }
  };

  if (stats.error && !stats.data)
    return <ErrorPanel message={stats.error} onRetry={stats.refresh} />;

  const d = stats.data;

  return (
    <div>
      <PageHeader
        title="Descriptive Mining"
        description="Full statistical fingerprint of the dataset — central tendency, dispersion, skewness, outliers, cross-feature correlations and unsupervised K-Means segmentation of forest plots."
      />

      {/* descriptive stats table */}
      <GlassTableCard stats={d} loading={stats.loading && !stats.data} />

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* skewness */}
        {d && (
          <ChartCard title="Distribution Shapes" subtitle="Most skewed features — |skew| > 1 indicates strong asymmetry">
            <div className="space-y-2.5">
              {d.most_skewed.map((s) => {
                const pos = s.skew >= 0;
                return (
                  <div key={s.feature} className="flex items-center gap-3 text-xs">
                    <span className="w-44 truncate text-emerald-100/70">{s.feature.replace(/_/g, " ")}</span>
                    <div className="relative h-2 flex-1 rounded-full bg-white/[0.06]">
                      <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
                      <div
                        className={cn("absolute top-0 h-full rounded-full", pos ? "bg-emerald-400/80" : "bg-rose-400/80")}
                        style={{
                          left: pos ? "50%" : `${50 - Math.min(50, Math.abs(s.skew) * 25)}%`,
                          width: `${Math.min(50, Math.abs(s.skew) * 25)}%`,
                        }}
                      />
                    </div>
                    <span className={cn("w-12 text-right font-mono", pos ? "text-emerald-300/80" : "text-rose-300/80")}>
                      {s.skew.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-emerald-100/40">
              Right-skewed features (rainfall, population) may benefit from log transforms before linear models.
            </p>
          </ChartCard>
        )}

        {/* region aggregates */}
        {d && (
          <ChartCard title="Ecoregion Aggregates" subtitle="Records, vegetation health and High-risk share">
            <div className="space-y-3">
              {d.region_stats.map((r) => (
                <div key={r.region} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium text-emerald-50/90">{r.region}</span>
                    <span className="font-mono text-xs text-emerald-100/50">{r.records} plots</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px]">
                    <span className="text-emerald-100/45">avg NDVI <b className="text-emerald-200">{r.avg_ndvi}</b></span>
                    <div className="flex flex-1 items-center gap-2">
                      <span className="shrink-0 text-emerald-100/45">High risk</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                        <div className="h-full rounded-full bg-gradient-to-r from-rose-400/60 to-rose-400"
                          style={{ width: `${r.high_risk_pct}%` }} />
                      </div>
                      <span className="w-10 text-right font-mono text-rose-300/80">{r.high_risk_pct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>

      {/* clustering */}
      <ChartCard
        title="K-Means Clustering"
        subtitle="Unsupervised segmentation on 7 environmental features (standardized, PCA-projected)"
        className="mt-4"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-100/55">k = {k}</span>
              <Slider value={[k]} min={2} max={8} step={1} onValueChange={([v]) => setK(v)} className="w-28" />
            </div>
            <Button size="sm" onClick={runClustering} disabled={clustering}
              className="h-8 gap-1.5 rounded-lg bg-emerald-500/90 text-xs text-white hover:bg-emerald-400">
              <Boxes className="h-3.5 w-3.5" /> {clustering ? "Clustering…" : "Run K-Means"}
            </Button>
          </div>
        }
      >
        {clustering ? (
          <div className="flex h-[320px] items-center justify-center text-xs text-emerald-100/40">fitting clusters…</div>
        ) : cluster ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ClusterScatter points={cluster.projection.points} variance={cluster.projection.explained_variance} />
            </div>
            <div className="space-y-2.5">
              <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3 text-xs">
                <p className="text-emerald-100/50">Silhouette score</p>
                <p className="mt-0.5 text-xl font-semibold text-emerald-200">{cluster.silhouette.toFixed(3)}</p>
                <p className="mt-1 text-[11px] text-emerald-100/40">
                  {cluster.silhouette > 0.35 ? "Reasonable separation between clusters." : "Clusters overlap substantially — try a different k."}
                </p>
              </div>
              {cluster.cluster_sizes.map((c) => (
                <div key={c.cluster} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="text-emerald-100/70">Cluster {c.cluster}</span>
                  <span className="font-mono text-emerald-100/50">{c.size.toLocaleString()} plots</span>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-emerald-200/80">{c.dominant_risk}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
            <Boxes className="h-8 w-8 text-emerald-400/40" />
            <p className="max-w-sm text-xs text-emerald-100/45">
              Choose k and run K-Means to discover natural groupings of forest plots — each cluster is
              profiled by its dominant deforestation-risk class.
            </p>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

/** Full describe()-style table with search. */
function GlassTableCard({ stats, loading }: { stats: DescriptiveStats | null; loading: boolean }) {
  const [query, setQuery] = useState("");
  const rows = (stats?.stats ?? []).filter((r) => r.feature.includes(query.toLowerCase()));
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
        <div>
          <h3 className="text-[15px] font-semibold text-white">Descriptive Statistics</h3>
          <p className="mt-0.5 text-xs text-emerald-100/45">count · mean · std · quartiles · skew · kurtosis · outliers</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter features..."
            className="h-8 w-44 rounded-lg border border-white/10 bg-white/[0.05] px-3 text-xs text-emerald-50 placeholder:text-emerald-100/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
          />
        </div>
      </div>
      {loading ? (
        <TableSkeleton rows={8} cols={9} />
      ) : (
        <div className="max-h-[460px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-[#071b12]/95 backdrop-blur">
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                {["feature", "count", "mean", "std", "min", "q1", "median", "q3", "max", "skew", "outliers"].map((h) => (
                  <TableHead key={h} className="whitespace-nowrap text-[11px] uppercase tracking-wide text-emerald-200/60">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.feature} className="border-white/[0.04] text-[12px] text-emerald-50/80 hover:bg-white/[0.03]">
                  <TableCell className="whitespace-nowrap font-medium text-emerald-50/90">{r.feature.replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-mono">{r.count}</TableCell>
                  <TableCell className="font-mono">{fmt(r.mean)}</TableCell>
                  <TableCell className="font-mono">{fmt(r.std)}</TableCell>
                  <TableCell className="font-mono">{fmt(r.min)}</TableCell>
                  <TableCell className="font-mono">{fmt(r.q1)}</TableCell>
                  <TableCell className="font-mono">{fmt(r.median)}</TableCell>
                  <TableCell className="font-mono">{fmt(r.q3)}</TableCell>
                  <TableCell className="font-mono">{fmt(r.max)}</TableCell>
                  <TableCell className={cn("font-mono", Math.abs(r.skew) > 1 ? "text-amber-300/90" : "")}>{fmt(r.skew)}</TableCell>
                  <TableCell className={cn("font-mono", r.outliers > 50 ? "text-rose-300/90" : "")}>{r.outliers}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function fmt(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
