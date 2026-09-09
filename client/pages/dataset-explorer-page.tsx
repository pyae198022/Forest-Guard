"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Download,
  Search,
  ShieldAlert,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@client/components/page-header";
import { LoadingPanel, ErrorPanel } from "@client/components/loading";
import { ChartCard } from "@client/charts/chart-card";
import { FeatureHistogram } from "@client/charts/feature-histogram";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import type {
  AttributeRow,
  ColumnProfile,
  DatasetInfo,
  Facets,
  ForestRecord,
  QualityReport,
  RecordsResponse,
  StatsRow,
} from "@client/src/types";
import { prettyName } from "@client/src/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 12;

export function DatasetExplorerPage() {
  const info = useApi<DatasetInfo>(() => forestApi.datasetInfo(), []);
  const attributes = useApi<AttributeRow[]>(() => forestApi.attributes(), []);
  const stats = useApi<StatsRow[]>(() => forestApi.stats(), []);
  const quality = useApi<QualityReport>(() => forestApi.quality(), []);
  const facets = useApi<Facets>(() => forestApi.facets(), []);

  // record browser state
  const [entity, setEntity] = useState("all");
  const [region, setRegion] = useState("all");
  const [yearMin, setYearMin] = useState<number | undefined>(undefined);
  const [yearMax, setYearMax] = useState<number | undefined>(undefined);
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState("Entity");
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const records = useApi<RecordsResponse>(
    () =>
      forestApi.records({
        entity, region, year_min: yearMin, year_max: yearMax,
        q: q || undefined, sort_by: sortBy, order, limit: PAGE_SIZE, offset,
      }),
    [entity, region, yearMin, yearMax, q, offset, sortBy, order],
  );

  // column profiling
  const numericCols = useMemo(
    () => (stats.data ?? []).map((s) => s.feature),
    [stats.data],
  );
  const [profileCol, setProfileCol] = useState<string | null>(null);
  const activeCol = profileCol ?? numericCols[1] ?? "Year";
  const profile = useApi<ColumnProfile>(
    () => forestApi.columnProfile(activeCol),
    [activeCol],
  );

  const loading = info.loading || attributes.loading;
  const error = info.error || attributes.error || stats.error;

  if (loading && !info.data) return <LoadingPanel label="Loading dataset..." />;
  if (error && !info.data)
    return <ErrorPanel message={error} onRetry={info.refresh} />;

  const d = info.data;
  const toggleSort = (col: string) => {
    if (sortBy === col) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSortBy(col);
      setOrder("asc");
    }
    setOffset(0);
  };

  const total = records.data?.total ?? 0;
  const page = records.data?.records ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dataset Explorer"
        description={`Browse the full deforestation dataset: ${d?.rows.toLocaleString() ?? "4,030"} records × ${d?.columns ?? 27} attributes, covering ${d?.year_min ?? 1990}–${d?.year_max ?? 2020} across ${d?.entities ?? 130} countries. Search, filter, sort and profile every column.`}
        actions={
          <a href="/api/dataset/export?XTransformPort=3010" download>
            <Button variant="outline" size="sm" className="gap-1.5 border-emerald-400/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </a>
        }
      />

      {/* data quality */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Records", value: (quality.data?.total_records ?? d?.rows ?? 0).toLocaleString() },
          { label: "Total Attributes", value: (quality.data?.total_attributes ?? d?.columns ?? 0) },
          { label: "Missing Values", value: quality.data?.missing_values ?? 0 },
          { label: "Duplicate Records", value: quality.data?.duplicate_records ?? 0 },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
            <div className="text-2xl font-semibold text-white">{kpi.value}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-100/50">
              {(kpi.label === "Missing Values" || kpi.label === "Duplicate Records") && kpi.value === 0 ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : null}
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* records browser */}
      <SectionTitle title="Records" subtitle="Filter by country, region and year range — click any column header to sort" />
      <ChartCard
        title="Country-year observations"
        subtitle={`${total.toLocaleString()} matching rows`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-100/40" />
              <Input
                value={q}
                onChange={(e) => { setQ(e.target.value); setOffset(0); }}
                placeholder="Country..."
                className="h-8 w-36 border-white/10 bg-white/[0.05] pl-7 text-xs text-emerald-50 placeholder:text-emerald-100/30"
              />
            </div>
            <select
              value={entity}
              onChange={(e) => { setEntity(e.target.value); setOffset(0); }}
              className="h-8 rounded-md border border-white/10 bg-[#0a1f16] px-2 text-xs text-emerald-100"
            >
              <option value="all">All countries</option>
              {(facets.data?.entities ?? []).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <select
              value={region}
              onChange={(e) => { setRegion(e.target.value); setOffset(0); }}
              className="h-8 rounded-md border border-white/10 bg-[#0a1f16] px-2 text-xs text-emerald-100"
            >
              <option value="all">All regions</option>
              {(facets.data?.regions ?? []).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 text-xs text-emerald-100/60">
              <input
                type="number" placeholder="1990" min={1990} max={2020}
                value={yearMin ?? ""}
                onChange={(e) => { setYearMin(e.target.value ? Number(e.target.value) : undefined); setOffset(0); }}
                className="h-8 w-16 rounded-md border border-white/10 bg-white/[0.05] px-2 text-xs text-emerald-50"
              />
              <span>–</span>
              <input
                type="number" placeholder="2020" min={1990} max={2020}
                value={yearMax ?? ""}
                onChange={(e) => { setYearMax(e.target.value ? Number(e.target.value) : undefined); setOffset(0); }}
                className="h-8 w-16 rounded-md border border-white/10 bg-white/[0.05] px-2 text-xs text-emerald-50"
              />
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-emerald-100/50">
                {(["Entity", "Year", "Region", "Deforestation_Ha", "Forest_Cover_Pct",
                  "GDP_Per_Capita", "Population_Density", "Temperature_Anomaly_C"] as const).map((col) => (
                  <th key={col} className="cursor-pointer px-3 py-2 font-medium hover:text-emerald-200"
                    onClick={() => toggleSort(col)}>
                    <span className="inline-flex items-center gap-1">
                      {prettyName(col)}
                      {sortBy === col && (order === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.loading && !page.length ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-emerald-100/40">Loading...</td></tr>
              ) : page.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-emerald-100/40">No records match the filters</td></tr>
              ) : (
                page.map((r: ForestRecord, i: number) => (
                  <tr key={`${r.Entity}-${r.Year}`} className="border-b border-white/[0.04] text-emerald-50/85 transition-colors hover:bg-white/[0.03]">
                    <td className="px-3 py-2 font-medium text-emerald-100">{r.Entity}</td>
                    <td className="px-3 py-2">{r.Year}</td>
                    <td className="px-3 py-2 text-emerald-100/60">{r.Region}</td>
                    <td className="px-3 py-2">{Number(r.Deforestation_Ha).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(r.Forest_Cover_Pct).toFixed(1)}%</td>
                    <td className="px-3 py-2">{Number(r.GDP_Per_Capita).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(r.Population_Density).toFixed(1)}</td>
                    <td className="px-3 py-2">+{Number(r.Temperature_Anomaly_C).toFixed(2)}°C</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-emerald-100/55">
          <span>rows {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="h-7 border-white/10 bg-white/[0.04] text-emerald-100">Prev</Button>
            <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="h-7 border-white/10 bg-white/[0.04] text-emerald-100">Next</Button>
          </div>
        </div>
      </ChartCard>

      {/* attribute dictionary + profile */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Attribute Dictionary"
          subtitle="What each of the 27 columns means and how it is categorised"
          contentClassName="max-h-[430px] overflow-y-auto"
        >
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#0a1f16]/90 backdrop-blur">
              <tr className="text-emerald-100/50">
                <th className="px-2 py-2">Attribute</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {(attributes.data ?? []).map((a) => (
                <tr key={a.name} className="border-b border-white/[0.04]">
                  <td className="px-2 py-1.5">
                    <div className="font-medium text-emerald-100">{a.name}</div>
                    <div className="text-[10px] text-emerald-100/40">{a.description}</div>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={a.category === "Categorical"
                      ? "rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-300"
                      : "rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-300"}>
                      {a.category}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-emerald-100/55">{a.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>

        <ChartCard
          title="Column Profile"
          subtitle="Interactive inspection of any attribute"
          actions={
            <select
              value={activeCol}
              onChange={(e) => setProfileCol(e.target.value)}
              className="h-8 rounded-md border border-white/10 bg-[#0a1f16] px-2 text-xs text-emerald-100"
            >
              {numericCols.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          }
        >
          {profile.loading || !profile.data ? (
            <LoadingPanel compact label="Profiling..." />
          ) : profile.data.type === "numeric" ? (
            <div>
              <div className="mb-3 grid grid-cols-4 gap-2 text-center text-[11px]">
                {[
                  { l: "Mean", v: profile.data.mean },
                  { l: "Median", v: profile.data.median },
                  { l: "Q1", v: profile.data.q1 },
                  { l: "Q3", v: profile.data.q3 },
                ].map((m) => (
                  <div key={m.l} className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1.5">
                    <div className="font-semibold text-emerald-100">{m.v.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div className="text-[10px] text-emerald-100/40">{m.l}</div>
                  </div>
                ))}
              </div>
              <FeatureHistogram data={profile.data.histogram} height={250} />
              <p className="mt-2 text-[11px] text-emerald-100/40">
                Histogram on a log scale — this keeps extremely skewed values
                readable instead of squeezing everything into one bar.
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="text-emerald-100/60">{profile.data.unique} unique values</div>
              {(() => {
                const cat = profile.data as Extract<ColumnProfile, { type: "categorical" }>;
                const maxCount = cat.top[0]?.count ?? 1;
                return cat.top.map((t) => (
                <div key={t.value} className="flex items-center gap-2">
                  <span className="w-28 truncate text-emerald-100/80">{t.value}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                      style={{ width: `${(t.count / maxCount) * 100}%` }} />
                  </div>
                  <span className="w-12 text-right text-emerald-100/50">{t.count}</span>
                </div>
                ));
              })()}
            </div>
          )}
        </ChartCard>
      </div>

      {/* descriptive statistics */}
      <ChartCard
        title="Descriptive Statistics"
        subtitle="Count, mean, standard deviation and range for every numeric attribute"
        contentClassName="max-h-[460px] overflow-y-auto"
      >
        <table className="w-full min-w-[680px] text-right text-xs">
          <thead className="sticky top-0 bg-[#0a1f16]/90 backdrop-blur">
            <tr className="text-emerald-100/50">
              <th className="px-3 py-2 text-left">Feature</th>
              {["Count", "Mean", "Std", "Min", "Median", "Max"].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(stats.data ?? []).map((s) => (
              <tr key={s.feature} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-3 py-1.5 text-left font-medium text-emerald-100">{prettyName(s.feature)}</td>
                <td className="px-3 py-1.5 text-emerald-100/60">{s.count}</td>
                {[s.mean, s.std, s.min, s.median, s.max].map((v, i) => (
                  <td key={i} className="px-3 py-1.5 text-emerald-50/80">
                    {v.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>

      <div className="flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-[11px] leading-relaxed text-amber-200/70">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        Keep in mind: many rows are aggregated "Other/Global" figures rather
        than single countries, so predictions for individual regions are less
        precise than the overall global picture.
        <BookOpen className="ml-auto h-4 w-4 shrink-0 opacity-40" />
      </div>
    </div>
  );
}
