/** Typed endpoint wrappers for the ForestGuard backend. */

import { apiGet, apiPost, apiUpload } from "./api";
import type {
  ArOverview,
  AttributeRow,
  ClassificationRow,
  ClusterResponse,
  ColumnProfile,
  ConfusionMatrix,
  CorrelationData,
  CvTable,
  DatasetInfo,
  DatasetSummary,
  EvalSummary,
  Facets,
  FeatureMeta,
  ForestRecord,
  HistogramData,
  ImportanceData,
  ItemsetRow,
  ModelOption,
  PipelineResult,
  PredictResult,
  PreprocessingOverview,
  Presets,
  QualityReport,
  RecordsByRegion,
  RecordsResponse,
  RegressionRow,
  RocCurves,
  RuleRow,
  StatsRow,
  TargetCorrelation,
  TrendData,
  BoxplotData,
  RegionBoxplot,
} from "@client/src/types";

export const forestApi = {
  // dataset ------------------------------------------------------------
  datasetSummary: () => apiGet<DatasetSummary>("/api/dataset/summary"),
  datasetInfo: () => apiGet<DatasetInfo>("/api/dataset/info"),
  attributes: () => apiGet<AttributeRow[]>("/api/dataset/attributes"),
  stats: () => apiGet<StatsRow[]>("/api/dataset/stats"),
  quality: () => apiGet<QualityReport>("/api/dataset/quality"),
  facets: () => apiGet<Facets>("/api/dataset/facets"),
  records: (params: {
    entity?: string;
    region?: string;
    year_min?: number;
    year_max?: number;
    q?: string;
    sort_by?: string;
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }) => apiGet<RecordsResponse>("/api/dataset/records", params),
  columnProfile: (name: string) =>
    apiGet<ColumnProfile>(
      `/api/dataset/column-profile/${encodeURIComponent(name)}`,
    ),
  importCsv: (file: File) =>
    apiUpload<DatasetInfo>("/api/dataset/import", file),

  // preprocessing --------------------------------------------------------
  preprocessingOverview: () =>
    apiGet<PreprocessingOverview>("/api/preprocessing/overview"),
  runPipeline: () => apiPost<PipelineResult>("/api/preprocessing/run", {}),

  // visualization ----------------------------------------------------------
  histogram: (feature: string, bins = 28) =>
    apiGet<HistogramData>("/api/visualization/histogram", { feature, bins }),
  boxplot: (feature: string) =>
    apiGet<BoxplotData>("/api/visualization/boxplot", { feature }),
  regionBoxplot: () =>
    apiGet<RegionBoxplot>("/api/visualization/region-boxplot"),
  trend: () => apiGet<TrendData>("/api/visualization/trend"),
  recordsByRegion: () =>
    apiGet<RecordsByRegion>("/api/visualization/records-by-region"),
  correlation: (threshold = 0.3) =>
    apiGet<CorrelationData>("/api/visualization/correlation", { threshold }),
  targetCorrelation: (top = 12) =>
    apiGet<TargetCorrelation>("/api/visualization/target-correlation", { top }),

  // descriptive mining ---------------------------------------------------
  arOverview: () => apiGet<ArOverview>("/api/mining/association/overview"),
  arItemsets: (top = 15) =>
    apiGet<{ itemsets: ItemsetRow[] }>(
      "/api/mining/association/itemsets",
      { top },
    ),
  arScatter: () =>
    apiGet<{
      points: { support: number; confidence: number; lift: number }[];
    }>("/api/mining/association/scatter"),
  arRules: (top = 10) =>
    apiGet<{ rules: RuleRow[]; n_rules: number }>(
      "/api/mining/association/rules",
      { top },
    ),
  clustering: (k?: number) =>
    apiPost<ClusterResponse>("/api/mining/clustering", {}, k ? { k } : undefined),

  // evaluation -----------------------------------------------------------
  evalSummary: () => apiGet<EvalSummary>("/api/evaluation/summary"),
  regressionComparison: () =>
    apiGet<{ rows: RegressionRow[] }>("/api/evaluation/regression-comparison"),
  classificationComparison: () =>
    apiGet<{ rows: ClassificationRow[] }>(
      "/api/evaluation/classification-comparison",
    ),
  roc: () => apiGet<RocCurves>("/api/evaluation/roc"),
  confusionMatrix: (model = "rf_clf_top10") =>
    apiGet<ConfusionMatrix>("/api/evaluation/confusion-matrix", { model }),
  crossValidation: () => apiGet<CvTable>("/api/evaluation/cross-validation"),
  featureImportance: () =>
    apiGet<ImportanceData>("/api/evaluation/feature-importance"),
  featureSets: () =>
    apiGet<{
      baseline_all: string[];
      top13_regression: string[];
      top10_classification: string[];
      ar_top10: string[];
    }>("/api/evaluation/feature-sets"),
  retrain: () =>
    apiPost<{ best_model: string; trained_at: string }>(
      "/api/evaluation/retrain",
      {},
    ),

  // prediction -----------------------------------------------------------
  models: () => apiGet<ModelOption[]>("/api/prediction/models"),
  featureMeta: () =>
    apiGet<{ features: FeatureMeta[]; target: string; classes: string[] }>(
      "/api/prediction/features",
    ),
  presets: () => apiGet<Presets>("/api/prediction/presets"),
  predict: (model: string, features: Record<string, number>) =>
    apiPost<PredictResult>("/api/prediction/predict", { model, features }),
};

/** Faceted record fetch used by the explorer table. */
export async function fetchRecords(
  params: Parameters<typeof forestApi.records>[0],
): Promise<RecordsResponse> {
  return apiGet<RecordsResponse>("/api/dataset/records", {
    ...params,
  } as Record<string, string | number | boolean | undefined>);
}

export type { ForestRecord };
