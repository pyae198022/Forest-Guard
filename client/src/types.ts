/** Shared types for the PJBook edition of ForestGuard AI. */

export type Risk = "Low" | "High";

export type PageKey =
  | "dashboard"
  | "explorer"
  | "preprocessing"
  | "visualization"
  | "mining"
  | "prediction"
  | "evaluation"
  | "about";

export interface DatasetSummary {
  rows: number;
  columns: number;
  numeric_columns: number;
  categorical_columns: number;
  entities: number;
  regions: number;
  year_min: number;
  year_max: number;
  target: string;
  target_stats: {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    skew: number;
  };
  split: {
    train_rows: number;
    test_rows: number;
    threshold: number;
    train: { Low: number; High: number };
    test: { Low: number; High: number };
  };
}

export interface DatasetInfo {
  name: string;
  source: string;
  rows: number;
  columns: number;
  numeric_columns: number;
  categorical_columns: number;
  year_min: number;
  year_max: number;
  entities: number;
  regions: string[];
  missing_values: number;
  duplicate_records: number;
  target: string;
  split: { train: string; test: string };
  leakage_excluded: string[];
}

export interface AttributeRow {
  name: string;
  category: string;
  type: string;
  description: string;
}

export interface StatsRow {
  feature: string;
  count: number;
  mean: number;
  std: number;
  min: number;
  median: number;
  max: number;
}

export interface QualityReport {
  total_records: number;
  total_attributes: number;
  missing_values: number;
  missing_by_column: Record<string, number>;
  duplicate_records: number;
  entity_year_duplicates: number;
  imputation_required: boolean;
}

export interface ForestRecord {
  Entity: string;
  Year: number;
  Deforestation_Ha: number;
  Region: string;
  [key: string]: string | number;
}

export interface RecordsResponse {
  total: number;
  offset: number;
  limit: number;
  records: ForestRecord[];
}

export interface Facets {
  entities: string[];
  regions: string[];
}

export interface NumericProfile {
  name: string;
  type: "numeric";
  mean: number;
  std: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  missing: number;
  histogram: { bin: string; count: number }[];
}

export interface CategoricalProfile {
  name: string;
  type: "categorical";
  unique: number;
  top: { value: string; count: number }[];
}

export type ColumnProfile = NumericProfile | CategoricalProfile;

/* ------------------------------------------------------------ preprocessing */
export interface SkewRow {
  feature: string;
  skew_before: number;
  skew_after: number;
  zeros: number;
  transformed: boolean;
}

export interface PreprocessingOverview {
  quality: QualityReport;
  skewness: SkewRow[];
  onehot: {
    features_encoded: string[];
    columns_before: number;
    columns_after: number;
    dummy_columns: number;
  };
  minmax: {
    columns: string[];
    before: Record<string, number>[];
    after: Record<string, number>[];
    min_: number[];
    max_: number[];
  };
  leakage_excluded: { feature: string; spearman_with_target: number }[];
  rationale: string;
  split: { rule: string; train_rows: number; test_rows: number };
}

export interface RankingRow {
  feature: string;
  hybrid_score: number;
  spearman: number;
  mutual_info: number;
  permutation: number;
}

export interface ValidationResult {
  n_features: number;
  features: string[];
  mae: number;
  rmse: number;
  r2: number;
}

export interface PipelineResult {
  quality: QualityReport;
  skewness: SkewRow[];
  onehot: PreprocessingOverview["onehot"];
  minmax: PreprocessingOverview["minmax"];
  hybrid_ranking: RankingRow[];
  candidates: string[];
  validation: {
    validation_split: { selection_train: string; validation: string };
    results: ValidationResult[];
    best: ValidationResult;
  };
  steps: { step: number; name: string; detail: string }[];
}

/* ------------------------------------------------------------ visualization */
export interface HistogramData {
  feature: string;
  skew: number | null;
  log_transformed?: boolean;
  data: { bin: string; count: number }[];
}

export interface BoxplotData {
  feature: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  lower_fence: number;
  upper_fence: number;
  outliers_count: number;
  outliers_pct: number;
  sample_points: number[];
}

export interface RegionBoxplot {
  target: string;
  groups: {
    region: string;
    count: number;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    mean: number;
    std: number;
  }[];
}

export interface TrendData {
  data: { year: number; value: number }[];
  interpretation: string;
}

export interface RecordsByRegion {
  data: { region: string; count: number; pct: number }[];
  interpretation: string;
}

export interface CorrelationData {
  columns: string[];
  matrix: number[][];
  strong_pairs: { a: string; b: string; corr: number }[];
  target_correlation: { feature: string; corr: number }[];
}

export interface TargetCorrelation {
  target: string;
  data: { feature: string; corr: number; abs: number; leakage: boolean }[];
}

/* ------------------------------------------------------------------- mining */
export interface ArOverview {
  params: {
    bins: number;
    bin_labels: string[];
    min_support: number;
    min_confidence: number;
    target_excluded: string;
    basket_items: number;
    records: number;
  };
  n_itemsets: number;
  n_rules: number;
  top_single_items: { item: string; support: number }[];
  headline: { title: string; text: string }[];
}

export interface ItemsetRow {
  items: string[];
  k: number;
  support: number;
}

export interface RuleRow {
  antecedents: string[];
  consequents: string[];
  support: number;
  confidence: number;
  lift: number;
  leverage: number;
  conviction: number | null;
}

export interface ClusterResponse {
  features_used: string[];
  k_selection: { k: number; inertia_wcss: number; silhouette: number }[];
  optimal_k: number;
  k: number;
  overall_silhouette: number;
  cluster_distribution: {
    cluster: number;
    count: number;
    percentage: number;
    silhouette: number | null;
  }[];
  profiles: Record<string, number | string>[];
  pca_explained: number[];
  scatter: { x: number; y: number; cluster: number }[];
  rules: { cluster: number; rule: string }[];
  benchmark: { k: number; silhouette: number };
}

/* --------------------------------------------------------------- evaluation */
export interface EvalSummary {
  split_year: number;
  train_rows: number;
  test_rows: number;
  class_distribution: {
    train: { Low: number; High: number };
    test: { Low: number; High: number };
  };
  threshold: number;
  best_regression: { model: string; mae: number; rmse: number; r2: number };
  best_classification: {
    model: string;
    accuracy: number;
    macro_f1: number;
  };
  trained_at: string;
}

export interface RegressionRow {
  model: string;
  label: string;
  mae: number | null;
  rmse: number | null;
  r2: number | null;
  n_features: number | null;
  train_seconds: number | null;
  book: { mae: number; rmse: number; r2: number } | undefined;
}

export interface ClassificationRow {
  model: string;
  label: string;
  accuracy: number | null;
  balanced_accuracy: number | null;
  macro_precision: number | null;
  macro_recall: number | null;
  macro_f1: number | null;
  auc: number | null;
  n_features: number | null;
  book: { accuracy: number; balanced_accuracy: number; macro_f1: number } | undefined;
}

export interface RocCurves {
  curves: Record<string, { fpr: number[]; tpr: number[]; auc: number | null }>;
  benchmarks: Record<string, number>;
}

export interface ConfusionMatrix {
  model: string;
  labels: string[];
  matrix: number[][];
  tn: number;
  fp: number;
  fn: number;
  tp: number;
  test_rows: number;
}

export interface CvTable {
  folds: number;
  regression: Record<string, { mae: number[]; rmse: number[]; r2: number[] }>;
  classification: Record<
    string,
    { accuracy: number[]; balanced_accuracy: number[]; macro_f1: number[]; auc?: number[] }
  >;
  note: string;
}

export interface ImportanceData {
  regression: { feature: string; importance: number }[];
  classification: { feature: string; importance: number }[];
  hybrid_ranking: RankingRow[];
}

/* --------------------------------------------------------------- prediction */
export interface ModelOption {
  key: string;
  label: string;
  task: "regression" | "classification";
}

export interface FeatureMeta {
  name: string;
  type: "slider";
  min: number;
  max: number;
  mean: number;
  median: number;
  step: number;
}

export interface PredictResult {
  task: "regression" | "classification";
  model: string;
  predicted_deforestation_ha?: number;
  implied_risk?: "Low" | "High";
  prediction?: string;
  confidence?: number;
  probabilities?: { class: string; probability: number }[];
}

export interface Presets {
  healthy: Record<string, number>;
  degraded: Record<string, number>;
  healthy_label: string;
  degraded_label: string;
  threshold: number;
}
