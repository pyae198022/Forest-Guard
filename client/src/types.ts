/** Shared domain types for ForestGuard AI. */

export type PageKey =
  | "dashboard"
  | "explorer"
  | "preprocessing"
  | "visualization"
  | "mining"
  | "prediction"
  | "evaluation"
  | "about";

export type Risk = "Low" | "Medium" | "High";

export interface ColumnMeta {
  name: string;
  dtype: "categorical" | "integer" | "float";
  group: string;
  missing: number;
  unique: number;
  sample: string | number | null;
}

export interface DatasetSummary {
  n_rows: number;
  n_cols: number;
  n_features: number;
  target: string;
  classes: Risk[];
  class_distribution: Record<Risk, number>;
  total_missing: number;
  missing_pct: number;
  duplicates: number;
  memory_mb: number;
  columns: ColumnMeta[];
}

export interface ForestRecord {
  record_id: number;
  region: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  slope_deg: number;
  soil_moisture_pct: number | null;
  soil_ph: number;
  ndvi: number | null;
  canopy_cover_pct: number;
  tree_density_per_ha: number;
  biomass_tons_ha: number | null;
  forest_age_years: number;
  annual_rainfall_mm: number;
  avg_temperature_c: number;
  humidity_pct: number | null;
  drought_index: number;
  wind_speed_kmh: number;
  solar_radiation_kwh_m2: number;
  fire_risk_index: number;
  species_richness: number | null;
  endemic_species_count: number;
  invasive_species_pct: number;
  population_density_per_km2: number;
  logging_intensity_index: number;
  road_proximity_km: number | null;
  agriculture_pressure_index: number;
  protected_area_flag: number;
  deforestation_risk: Risk;
}

export interface RecordsResponse {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  regions: string[];
  records: ForestRecord[];
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  missing: number;
  unique: number;
  mean?: number;
  std?: number;
  min?: number;
  q1?: number;
  median?: number;
  q3?: number;
  max?: number;
  histogram?: { bin: string; count: number }[];
  distribution?: { bin: string; count: number }[];
}

export interface QualityOverview {
  rows: number;
  columns: number;
  missing_total: number;
  missing_by_column: { column: string; missing: number; pct: number }[];
  duplicates: number;
  constant_columns: string[];
  dtype_counts: Record<string, number>;
  outlier_summary: {
    column: string;
    count: number;
    pct: number;
    lower: number;
    upper: number;
  }[];
  quality_score: number;
}

export interface PipelineStep {
  step: string;
  detail: string;
  rows_after: number;
}

export interface PipelineResult {
  rows_in: number;
  rows_out: number;
  steps: PipelineStep[];
  quality_before: number;
  quality_after: number;
  missing_before: number;
  missing_after: number;
  duplicates_before: number;
  duplicates_after: number;
  preview: Record<string, unknown>[];
  preview_columns: string[];
  options: Record<string, unknown>;
}

export interface VizOverview {
  risk_donut: { risk: Risk; value: number }[];
  region_risk: Record<string, number | string>[];
  region_environment: {
    region: string;
    avg_ndvi: number;
    avg_canopy: number;
    avg_rainfall: number;
    avg_biomass: number;
    avg_species: number;
    avg_fire_risk: number;
  }[];
  ndvi_curve: {
    ndvi_band: string;
    avg_canopy: number;
    avg_biomass: number;
    avg_moisture: number;
    count: number;
  }[];
  elevation_risk: Record<string, number | string>[];
  totals: { rows: number; regions: number };
}

export interface DescriptiveStats {
  stats: {
    feature: string;
    count: number;
    missing: number;
    mean: number;
    std: number;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    skew: number;
    kurtosis: number;
    cv: number | null;
    outliers: number;
  }[];
  top_correlations: { a: string; b: string; value: number }[];
  most_skewed: { feature: string; skew: number }[];
  region_stats: {
    region: string;
    records: number;
    avg_ndvi: number;
    high_risk_pct: number;
  }[];
}

export interface ModelSummary {
  key: string;
  name: string;
  kind: string;
  accuracy: number;
  precision_macro: number;
  recall_macro: number;
  f1_macro: number;
  roc_auc_ovr: number | null;
  cv_accuracy_mean: number;
  cv_accuracy_std: number;
  train_seconds: number;
  per_class: Record<string, { precision: number; recall: number; support: number }>;
  confusion_matrix: number[][];
}

export interface EvaluationSummary {
  models: ModelSummary[];
  best_model: string;
  trained_at: string;
  train_rows: number;
  test_rows: number;
  data_source: string;
  classes: Risk[];
}

export interface FeatureMeta {
  name: string;
  label: string;
  group: string;
  unit: string;
  description: string;
  type: "select" | "toggle" | "slider";
  options?: string[];
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  step?: number;
}

export interface PredictResult {
  prediction: Risk;
  confidence: number;
  probabilities: Record<Risk, number>;
  contributions: { feature: string; impact: number }[];
}

export interface ClusterResponse {
  k: number;
  features: string[];
  silhouette: number;
  cluster_sizes: { cluster: number; size: number; dominant_risk: Risk }[];
  centroids: Record<string, number | number[]>[];
  projection: {
    points: { x: number; y: number; cluster: number; risk: Risk }[];
    explained_variance: number[];
  };
}
