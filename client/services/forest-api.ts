/** Typed endpoint wrappers for the ForestGuard backend. */

import { apiGet, apiPost, apiUpload } from "./api";
import type {
  ClusterResponse,
  ColumnProfile,
  DatasetSummary,
  DescriptiveStats,
  EvaluationSummary,
  FeatureMeta,
  PipelineResult,
  QualityOverview,
  PredictResult,
  RecordsResponse,
  VizOverview,
} from "@client/src/types";

export interface PipelineOptions {
  missing_strategy: "mean" | "median" | "most_frequent";
  scaling: "standard" | "minmax" | "robust" | "none";
  outlier_handling: "none" | "winsorize";
  drop_duplicates: boolean;
  drop_high_missing: boolean;
  missing_threshold: number;
  save_result: boolean;
}

export const forestApi = {
  // dataset ----------------------------------------------------------------
  datasetSummary: () => apiGet<DatasetSummary>("/api/dataset/summary"),
  datasetInfo: () => apiGet<Record<string, unknown>>("/api/dataset/info"),
  records: (params: {
    page?: number;
    page_size?: number;
    region?: string;
    risk?: string;
    search?: string;
    sort_by?: string;
    sort_dir?: string;
  }) => apiGet<RecordsResponse>("/api/dataset/records", params),
  columnProfile: (name: string) =>
    apiGet<ColumnProfile>(`/api/dataset/column-profile/${encodeURIComponent(name)}`),
  importCsv: (file: File) => apiUpload<{ rows_imported: number }>("/api/dataset/import", file),

  // preprocessing ------------------------------------------------------------
  qualityOverview: () => apiGet<QualityOverview>("/api/preprocessing/overview"),
  runPipeline: (options: Partial<PipelineOptions>) =>
    apiPost<PipelineResult>("/api/preprocessing/run", {
      missing_strategy: "median",
      scaling: "standard",
      outlier_handling: "winsorize",
      drop_duplicates: true,
      drop_high_missing: true,
      missing_threshold: 30,
      save_result: true,
      ...options,
    }),
  pipelineHistory: () => apiGet<unknown[]>("/api/preprocessing/history"),

  // visualization --------------------------------------------------------------
  vizOverview: () => apiGet<VizOverview>("/api/visualization/overview"),
  histogram: (feature: string, bins = 26, groupByRisk = false) =>
    apiGet<{ feature: string; data: { bin: string; risk?: string; count: number }[] }>(
      "/api/visualization/histogram",
      { feature, bins, group_by_risk: groupByRisk },
    ),
  scatter: (x: string, y: string, sample = 700) =>
    apiGet<{
      x: string;
      y: string;
      points: { [k: string]: number | string }[];
    }>("/api/visualization/scatter", { x, y, sample }),
  correlation: (threshold = 0.2) =>
    apiGet<{
      columns: string[];
      matrix: number[][];
      top_pairs: { a: string; b: string; value: number }[];
    }>("/api/visualization/correlation", { threshold }),

  // descriptive mining ------------------------------------------------------
  descriptive: () => apiGet<DescriptiveStats>("/api/mining/descriptive"),
  groupby: (by = "region") =>
    apiGet<{ by: string; groups: Record<string, number | string>[] }>(
      "/api/mining/groupby",
      { by },
    ),
  clustering: (k = 4) => apiPost<ClusterResponse>("/api/mining/clustering", { k }),

  // prediction ------------------------------------------------------------
  predictFeatures: () => apiGet<FeatureMeta[]>("/api/prediction/features"),
  presets: () =>
    apiGet<{
      healthy: Record<string, number>;
      degraded: Record<string, number>;
      healthy_region: string;
      degraded_region: string;
    }>("/api/prediction/presets"),
  predict: (model: string, features: Record<string, number | string>) =>
    apiPost<PredictResult>("/api/prediction/predict", { model, features }),
  modelList: () =>
    apiGet<{ key: string; name: string; kind: string }[]>("/api/prediction/models"),

  // evaluation ----------------------------------------------------------------
  evaluation: () => apiGet<EvaluationSummary>("/api/evaluation/summary"),
  retrain: (source: "raw" | "preprocessed") =>
    apiPost<{ best_model: string; accuracy: Record<string, number> }>(
      "/api/evaluation/retrain",
      { source },
    ),
};
