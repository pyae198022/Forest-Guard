"use client";

import { useMemo, useState } from "react";
import { Download, Search, Table2, Upload, FileWarning, CopyX } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@client/components/page-header";
import { StatCard, StatCardSkeleton } from "@client/components/stat-card";
import { LoadingPanel, ErrorPanel, TableSkeleton } from "@client/components/loading";
import { RiskBadge } from "@client/components/risk-badge";
import { GlassCard } from "@client/components/glass-card";
import { forestApi } from "@client/services/forest-api";
import { useApi } from "@client/hooks/use-api";
import { apiGet } from "@client/services/api";
import { RISK_COLORS } from "@client/src/theme";
import { cn } from "@/lib/utils";
import type { ColumnProfile, DatasetSummary, RecordsResponse } from "@client/src/types";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

const PREVIEW_COLS = [
  "record_id", "region", "elevation_m", "ndvi", "canopy_cover_pct",
  "annual_rainfall_mm", "avg_temperature_c", "fire_risk_index",
  "species_richness", "logging_intensity_index", "population_density_per_km2",
  "deforestation_risk",
];

export function DatasetExplorerPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [region, setRegion] = useState("all");
  const [risk, setRisk] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy] = useState("record_id");
  const [importing, setImporting] = useState(false);

  const summary = useApi<DatasetSummary>(() => forestApi.datasetSummary(), []);
  const records = useApi<RecordsResponse>(
    () => forestApi.records({ page, page_size: pageSize, region, risk, search, sort_by: sortBy }),
    [page, pageSize, region, risk, search],
  );

  const targetCols = useMemo(
    () => (summary.data?.columns ?? []).filter((c) => PREVIEW_COLS.includes(c.name)),
    [summary.data],
  );

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const importCsv = async (file: File) => {
    setImporting(true);
    try {
      const res = await forestApi.importCsv(file);
      toast({ title: "CSV imported", description: `${res.rows_imported} rows replaced the dataset.` });
      summary.refresh();
      records.refresh();
    } catch (e) {
      toast({ title: "Import failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  if (summary.error && !summary.data)
    return <ErrorPanel message={summary.error} onRetry={summary.refresh} />;

  const s = summary.data;
  const total = s?.n_rows ?? 0;

  return (
    <div>
      <PageHeader
        title="Dataset Explorer"
        description="Browse the raw forest-ecosystem dataset stored in SQLite. Filter by ecoregion or risk class, inspect column profiles, import your own CSV or export the current table."
        actions={
          <>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importCsv(f);
                  e.target.value = "";
                }}
              />
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/20">
                <Upload className="h-4 w-4" /> {importing ? "Importing..." : "Import CSV"}
              </span>
            </label>
            <a
              href={`/api/dataset/export?XTransformPort=3010`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-4 text-sm text-emerald-100/70 transition hover:bg-white/[0.09]"
            >
              <Download className="h-4 w-4" /> Export
            </a>
          </>
        }
      />

      {/* summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!s ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : (
          <>
            <StatCard index={0} label="Rows" value={total.toLocaleString()} icon={Search} hint="raw records incl. duplicates" />
            <StatCard index={1} label="Columns" value={s.n_cols} tone="teal" icon={Table2} hint={`${s.n_features} features + id + target`} />
            <StatCard index={2} label="Missing Cells" value={s.total_missing} tone="amber" icon={FileWarning} hint={`${s.missing_pct}% of all cells`} />
            <StatCard index={3} label="Duplicate Rows" value={s.duplicates} tone="rose" icon={CopyX} hint="removed during preprocessing" />
          </>
        )}
      </div>

      {/* filters + table */}
      <GlassCard className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 md:flex-row md:items-center">
          <div className="relative flex-1 md:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-100/35" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="Search any field..."
              className="border-white/10 bg-white/[0.05] pl-9 text-sm text-emerald-50 placeholder:text-emerald-100/30"
            />
          </div>
          <Select value={region} onValueChange={(v) => { setRegion(v); setPage(1); }}>
            <SelectTrigger className="w-full border-white/10 bg-white/[0.05] text-sm md:w-48">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0a1f16] text-emerald-50">
              <SelectItem value="all">All regions</SelectItem>
              {(records.data?.regions ?? []).map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={risk} onValueChange={(v) => { setRisk(v); setPage(1); }}>
            <SelectTrigger className="w-full border-white/10 bg-white/[0.05] text-sm md:w-40">
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0a1f16] text-emerald-50">
              <SelectItem value="all">All risk levels</SelectItem>
              {["Low", "Medium", "High"].map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-3 text-xs text-emerald-100/50">
            {records.data && (
              <span>{records.data.total.toLocaleString()} matches</span>
            )}
          </div>
        </div>

        {records.loading && !records.data ? (
          <TableSkeleton rows={8} cols={8} />
        ) : records.error ? (
          <div className="p-6"><ErrorPanel message={records.error} onRetry={records.refresh} /></div>
        ) : (
          <div className="max-h-[540px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-[#071b12]/95 backdrop-blur">
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  {targetCols.map((c) => (
                    <TableHead key={c.name} className="whitespace-nowrap text-[11px] uppercase tracking-wide text-emerald-200/60">
                      {c.name.replace(/_/g, " ")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(records.data?.records ?? []).map((rec) => (
                  <TableRow key={rec.record_id} className="border-white/[0.04] text-[13px] text-emerald-50/80 hover:bg-white/[0.03]">
                    {targetCols.map((c) => {
                      const value = (rec as unknown as Record<string, unknown>)[c.name];
                      if (c.name === "deforestation_risk")
                        return <TableCell key={c.name}><RiskBadge risk={value as never} /></TableCell>;
                      if (c.name === "record_id")
                        return <TableCell key={c.name} className="font-mono text-emerald-200/60">{String(value)}</TableCell>;
                      return (
                        <TableCell key={c.name} className="whitespace-nowrap">
                          {typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value ?? "—")}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* pagination */}
        <div className="flex items-center justify-between border-t border-white/[0.06] p-3 text-xs text-emerald-100/55">
          <span>
            Page {records.data?.page ?? page} of {records.data?.pages ?? 1}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 border-white/10 bg-white/[0.04] text-emerald-100/70 hover:bg-white/[0.08]">
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={(records.data?.pages ?? 1) <= page}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 border-white/10 bg-white/[0.04] text-emerald-100/70 hover:bg-white/[0.08]">
              Next
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* column profiles */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-200/70">
          Column Profiles
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {(summary.data?.columns ?? []).map((c) => (
            <Popover key={c.name}>
              <PopoverTrigger asChild>
                <button className="group rounded-xl border border-white/[0.07] bg-white/[0.04] p-3 text-left transition hover:border-emerald-400/30 hover:bg-white/[0.07]">
                  <p className="truncate text-xs font-medium text-emerald-50/85">{c.name}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-emerald-100/40">
                    <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-emerald-300/80">{c.dtype}</span>
                    {c.missing > 0 ? (
                      <span className="text-amber-300/80">{c.missing} null</span>
                    ) : (
                      <span>{c.unique.toLocaleString()} uniq</span>
                    )}
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 border-white/10 bg-[#0a1f16]/95 text-emerald-50" side="top">
                <ProfileBody name={c.name} />
              </PopoverContent>
            </Popover>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileBody({ name }: { name: string }) {
  const { data, loading, error } = useApi<ColumnProfile>(() => forestApi.columnProfile(name), [name]);
  if (loading) return <p className="text-xs text-emerald-100/50">Profiling…</p>;
  if (error || !data) return <p className="text-xs text-rose-300/80">{error ?? "Failed"}</p>;
  return (
    <div className="space-y-2">
      <DialogHeader>
        <DialogTitle className="text-sm text-white">{name.replace(/_/g, " ")}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {(["dtype", "missing", "unique", "mean", "std", "min", "q1", "median", "q3", "max"] as const).map((k) =>
          data[k] !== undefined ? (
            <div key={k} className="flex justify-between border-b border-white/[0.05] pb-0.5">
              <span className="text-emerald-100/45">{k}</span>
              <span className="font-mono text-emerald-100/80">
                {typeof data[k] === "number" ? (data[k] as number).toLocaleString(undefined, { maximumFractionDigits: 3 }) : String(data[k])}
              </span>
            </div>
          ) : null,
        )}
      </div>
      {data.histogram && (
        <div className="flex h-14 items-end gap-0.5 pt-1">
          {data.histogram.map((b, i) => {
            const max = Math.max(...data.histogram!.map((x) => x.count));
            return (
              <div key={i} title={`${b.bin}: ${b.count}`}
                className={cn("flex-1 rounded-t-sm", "bg-emerald-400/50")}
                style={{ height: `${Math.max(4, (b.count / max) * 100)}%` }} />
            );
          })}
        </div>
      )}
      {data.distribution && (
        <div className="space-y-1 pt-1">
          {data.distribution.map((d) => (
            <div key={d.bin} className="flex items-center gap-2 text-[11px]">
              <span className="w-14 text-emerald-100/60">{d.bin}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full"
                  style={{ width: `${(d.count / Math.max(...data.distribution!.map((x) => x.count))) * 100}%`, backgroundColor: RISK_COLORS[d.bin] ?? "#34d399" }} />
              </div>
              <span className="font-mono text-emerald-100/70">{d.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
