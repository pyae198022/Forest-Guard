"""ForestGuard AI — PJBook methodology constants.

Every constant here is derived from the IS-212 project book
("Deforestation Data with Climate and Habitat", 4,030 rows x 27 columns,
1990-2020 country-year panel).
"""

from __future__ import annotations

TARGET = "Deforestation_Ha"

# ---------------------------------------------------------------- split ----
# Chapter 1.3 / 3.2.2: strict temporal split — train on history up to 2015,
# test on 2016-2020 to replicate genuine future forecasting (no shuffling).
SPLIT_YEAR = 2015

# ------------------------------------------------------- leakage control ----
# Section 3.2.2: downstream effects / target-derived scores are excluded
# from every prediction pipeline to prevent target leakage + look-ahead bias.
LEAKAGE_FEATURES = [
    "CO2_Emissions_Mt",
    "Lost_Carbon_Sink_kt",
    "PM25_Emissions_Tons",
    "PM10_Emissions_Tons",
    "Environmental_Impact_Score",
]

ID_COLS = ["Entity", "Region"]
CATEGORICAL = ["Entity", "Region"]

# Candidate pool (section 2.2.3): Year + all numeric predictors that survive
# the leakage filter  ->  19 candidates.
def candidate_features(all_columns: list[str]) -> list[str]:
    numeric = [
        c for c in all_columns
        if c not in ID_COLS + [TARGET] + LEAKAGE_FEATURES
    ]
    # Year first (it is the temporal axis), then the rest in dataset order
    ordered = ["Year"] + [c for c in numeric if c != "Year"]
    return ordered

# ------------------------------------------------------ transformation ----
# Section 2.2.2: log1p on highly right-skewed features.
LOG1P_FEATURES = [
    "Deforestation_Ha",       # target (regression trains on log1p scale)
    "CO2_Emissions_Mt",
    "Lost_Carbon_Sink_kt",
    "PM25_Emissions_Tons",
    "PM10_Emissions_Tons",
]

# Section 2.2.2: one-hot encoding for the categorical features.
ONEHOT_FEATURES = ["Entity", "Region"]

# --------------------------------------------------------- classification ----
# Section 3.2.2/3.2.3: binary risk target via the TRAINING-set median of
# Deforestation_Ha  (<= median -> "Low", > median -> "High").
CLASS_LABELS = ["Low", "High"]

# ------------------------------------------------------------- modelling ----
RF_PARAMS = dict(n_estimators=300, max_depth=15, min_samples_leaf=2,
                 random_state=42, n_jobs=-1)          # section 3.2.3.1
RF_CLF_PARAMS = dict(n_estimators=300, max_depth=15, min_samples_leaf=2,
                     random_state=42, n_jobs=-1,
                     class_weight="balanced")          # section 3.2.3.1
MLP_REG_PARAMS = dict(hidden_layer_sizes=(128, 64), activation="relu",
                      solver="adam", learning_rate_init=1e-3,
                      batch_size=32, max_iter=150, early_stopping=True,
                      random_state=42)                 # section 3.2.3.2 spirit
MLP_CLF_PARAMS = dict(hidden_layer_sizes=(128, 64), activation="relu",
                      solver="adam", learning_rate_init=1e-3,
                      batch_size=32, max_iter=150, early_stopping=True,
                      random_state=42)

# Feature-subset sizes tested during selection (section 2.2.3).
SUBSET_SIZES = [5, 8, 10, 12, 15]

# Final choices reported by the book: Top-13 regression / Top-10 classification.
REG_TOP_N = 13
CLF_TOP_N = 10

# Cross validation (section 4.2.3): 5-fold K-Fold on the TRAINING split only.
CV_FOLDS = 5
CV_RANDOM_STATE = 42

# ------------------------------------------------- descriptive mining: AR ----
# Section 3.1.1.3: qcut 3 equal-count bins (Low/Medium/High), the continuous
# target itself is EXCLUDED from the basket. min support 0.10, min conf 0.60.
AR_BINS = 3
AR_BIN_LABELS = ["Low", "Medium", "High"]
AR_MIN_SUPPORT = 0.10
AR_MIN_CONFIDENCE = 0.60
AR_MAX_LEN = 4

# ------------------------------------------------ descriptive mining: KM ----
# Section 3.1.2: the ten clustering features.
CLUSTER_FEATURES = [
    "Deforestation_Ha",
    "Agricultural_Land_Pct",
    "Population_Density",
    "GDP_Per_Capita",
    "Forest_Cover_Pct",
    "CO2_Emissions_Mt",
    "Biodiversity_Impact_Index",
    "Temperature_Anomaly_C",
    "Precipitation_mm",
    "Species_Habitat_Loss_Pct",
]
KM_K_RANGE = range(2, 11)
KM_RANDOM_STATE = 42
KM_N_INIT = 10
KM_OPTIMAL_K = 2

# Book reference values (chapter 4 tables) shown as benchmarks in the UI.
BOOK_BENCHMARKS = {
    "regression": {
        "rf_baseline":      {"mae": 17268.27, "rmse": 49053.58, "r2": 0.969184},
        "rf_top13":         {"mae": 16268.74, "rmse": 44440.98, "r2": 0.974707},
        "rf_ar_top10":      {"mae": 17354.25, "rmse": 49309.29, "r2": 0.968862},
        "nn_baseline":      {"mae": 25051.80, "rmse": 119119.31, "r2": 0.818284},
        "nn_top10":         {"mae": 19232.18, "rmse": 77704.84, "r2": 0.922674},
    },
    "classification": {
        "rf_clf_baseline":  {"accuracy": 0.984615, "balanced_accuracy": 0.984767, "macro_f1": 0.984508},
        "rf_clf_top10":     {"accuracy": 0.986154, "balanced_accuracy": 0.986184, "macro_f1": 0.986054},
        "rf_clf_ar_top10":  {"accuracy": 0.984615, "balanced_accuracy": 0.984767, "macro_f1": 0.984508},
        "nn_clf_baseline":  {"accuracy": 0.9677, "macro_f1": 0.9674},
        "nn_clf_top10":     {"accuracy": 0.9754, "macro_f1": 0.9752},
    },
    "roc_auc": {
        "rf_clf_top10": 0.9988, "rf_clf_ar_top10": 0.9986,
        "rf_clf_baseline": 0.9986, "nn_clf_top10": 0.9980,
    },
    "clustering": {"k": 2, "silhouette": 0.2520},
}

# Human-readable attribute dictionary (book Table 2.1.1).
ATTRIBUTE_DICT: dict[str, dict[str, str]] = {
    "Entity": {"category": "Categorical", "type": "object",
               "description": "Country or geographic entity name"},
    "Year": {"category": "Numeric", "type": "int64",
             "description": "Year of observation from 1990 to 2020"},
    "Deforestation_Ha": {"category": "Numeric", "type": "float64",
                         "description": "Deforestation area in hectares"},
    "Agricultural_Land_Pct": {"category": "Numeric", "type": "float64",
                              "description": "Agricultural land percentage"},
    "Population_Density": {"category": "Numeric", "type": "float64",
                           "description": "Population density metrics"},
    "GDP_Per_Capita": {"category": "Numeric", "type": "float64",
                       "description": "Gross Domestic Product per capita"},
    "Rural_Population_Pct": {"category": "Numeric", "type": "float64",
                             "description": "Rural population percentage"},
    "Poverty_Rate_Pct": {"category": "Numeric", "type": "float64",
                         "description": "Poverty rate percentage"},
    "Employment_Agri_Pct": {"category": "Numeric", "type": "float64",
                            "description": "Employment in agriculture percentage"},
    "Region": {"category": "Categorical", "type": "object",
               "description": "Geographic region classification"},
    "Forest_Cover_Pct": {"category": "Numeric", "type": "float64",
                         "description": "Forest cover percentage"},
    "CO2_Emissions_Mt": {"category": "Numeric", "type": "float64",
                         "description": "Carbon dioxide emissions in megatons"},
    "Lost_Carbon_Sink_kt": {"category": "Numeric", "type": "float64",
                            "description": "Lost carbon sink in kilotons"},
    "Biodiversity_Impact_Index": {"category": "Numeric", "type": "float64",
                                  "description": "Biodiversity impact index score"},
    "Environmental_Impact_Score": {"category": "Numeric", "type": "float64",
                                   "description": "Overall environmental impact score"},
    "PM25_Emissions_Tons": {"category": "Numeric", "type": "float64",
                            "description": "PM2.5 emissions in tons"},
    "PM10_Emissions_Tons": {"category": "Numeric", "type": "float64",
                            "description": "PM10 emissions in tons"},
    "PM25_Mean_Exposure_ug_m3": {"category": "Numeric", "type": "float64",
                                 "description": "PM2.5 mean exposure level in ug/m3"},
    "Temperature_Anomaly_C": {"category": "Numeric", "type": "float64",
                              "description": "Temperature anomaly in degrees Celsius"},
    "Precipitation_mm": {"category": "Numeric", "type": "float64",
                         "description": "Total precipitation in millimeters"},
    "SPEI_Drought_Index": {"category": "Numeric", "type": "float64",
                           "description": "Standardized Precipitation-Evapotranspiration Index"},
    "Extreme_Heat_Days_Count": {"category": "Numeric", "type": "int64",
                                "description": "Count of extreme heat days"},
    "Species_Habitat_Loss_Pct": {"category": "Numeric", "type": "float64",
                                 "description": "Percentage of species habitat loss"},
    "IUCN_Threatened_Species_Count": {"category": "Numeric", "type": "int64",
                                      "description": "Count of IUCN threatened species"},
    "Biodiversity_Intactness_Index_Pct": {"category": "Numeric", "type": "float64",
                                          "description": "Biodiversity intactness index percentage"},
    "Protected_Area_Coverage_Pct": {"category": "Numeric", "type": "float64",
                                    "description": "Protected area coverage percentage"},
    "Forest_Fragmentation_Index": {"category": "Numeric", "type": "float64",
                                    "description": "Forest fragmentation index score"},
}
