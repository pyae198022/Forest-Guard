"""ML feature configuration shared by training, prediction and UI forms."""

from __future__ import annotations

TARGET = "deforestation_risk"
CLASSES = ["Low", "Medium", "High"]
RANDOM_STATE = 42
TEST_SIZE = 0.2

CATEGORICAL = ["region"]
# Ordered as they appear in the dataset (27 features)
FEATURES = [
    "region",
    "latitude", "longitude", "elevation_m", "slope_deg",
    "soil_moisture_pct", "soil_ph", "ndvi", "canopy_cover_pct",
    "tree_density_per_ha", "biomass_tons_ha", "forest_age_years",
    "annual_rainfall_mm", "avg_temperature_c", "humidity_pct",
    "drought_index", "wind_speed_kmh", "solar_radiation_kwh_m2",
    "fire_risk_index", "species_richness", "endemic_species_count",
    "invasive_species_pct", "population_density_per_km2",
    "logging_intensity_index", "road_proximity_km",
    "agriculture_pressure_index", "protected_area_flag",
]

NUMERIC_FEATURES = [f for f in FEATURES if f not in CATEGORICAL]

# UI form metadata: (label, group, unit, human description)
FEATURE_META: dict[str, dict] = {
    "region": {"group": "Geographic", "unit": "", "label": "Region",
               "description": "Major forest ecosystem the record belongs to"},
    "latitude": {"group": "Geographic", "unit": "°", "label": "Latitude",
                 "description": "North-south position of the plot"},
    "longitude": {"group": "Geographic", "unit": "°", "label": "Longitude",
                  "description": "East-west position of the plot"},
    "elevation_m": {"group": "Geographic", "unit": "m", "label": "Elevation",
                    "description": "Height above sea level"},
    "slope_deg": {"group": "Geographic", "unit": "°", "label": "Slope",
                  "description": "Terrain steepness at the plot"},
    "soil_moisture_pct": {"group": "Environmental", "unit": "%", "label": "Soil moisture",
                          "description": "Volumetric water content of topsoil"},
    "soil_ph": {"group": "Environmental", "unit": "pH", "label": "Soil pH",
                "description": "Acidity/alkalinity of the soil"},
    "ndvi": {"group": "Environmental", "unit": "index", "label": "NDVI",
             "description": "Normalized Difference Vegetation Index (satellite greenness)"},
    "canopy_cover_pct": {"group": "Environmental", "unit": "%", "label": "Canopy cover",
                         "description": "Percentage of ground shaded by tree canopy"},
    "tree_density_per_ha": {"group": "Environmental", "unit": "trees/ha", "label": "Tree density",
                            "description": "Number of trees per hectare"},
    "biomass_tons_ha": {"group": "Environmental", "unit": "t/ha", "label": "Biomass",
                        "description": "Above-ground living biomass per hectare"},
    "forest_age_years": {"group": "Environmental", "unit": "yr", "label": "Forest age",
                         "description": "Stand age since last major disturbance"},
    "annual_rainfall_mm": {"group": "Climate", "unit": "mm", "label": "Annual rainfall",
                           "description": "Total precipitation per year"},
    "avg_temperature_c": {"group": "Climate", "unit": "°C", "label": "Avg temperature",
                          "description": "Mean annual air temperature"},
    "humidity_pct": {"group": "Climate", "unit": "%", "label": "Humidity",
                     "description": "Mean relative humidity"},
    "drought_index": {"group": "Climate", "unit": "SPI", "label": "Drought index",
                      "description": "Standardized precipitation-based drought indicator (higher = drier)"},
    "wind_speed_kmh": {"group": "Climate", "unit": "km/h", "label": "Wind speed",
                       "description": "Mean wind speed"},
    "solar_radiation_kwh_m2": {"group": "Climate", "unit": "kWh/m²", "label": "Solar radiation",
                               "description": "Daily average incoming solar energy"},
    "fire_risk_index": {"group": "Climate", "unit": "0-1", "label": "Fire risk",
                        "description": "Composite wildfire danger score"},
    "species_richness": {"group": "Biodiversity", "unit": "species", "label": "Species richness",
                         "description": "Number of distinct species observed"},
    "endemic_species_count": {"group": "Biodiversity", "unit": "species", "label": "Endemic species",
                              "description": "Species found nowhere else"},
    "invasive_species_pct": {"group": "Biodiversity", "unit": "%", "label": "Invasive species",
                             "description": "Share of invasive species coverage"},
    "population_density_per_km2": {"group": "Socio-economic", "unit": "people/km²", "label": "Population density",
                                   "description": "Humans living within 10 km of the plot"},
    "logging_intensity_index": {"group": "Socio-economic", "unit": "0-1", "label": "Logging intensity",
                                "description": "Timber extraction pressure score"},
    "road_proximity_km": {"group": "Socio-economic", "unit": "km", "label": "Road proximity",
                          "description": "Distance to the nearest access road"},
    "agriculture_pressure_index": {"group": "Socio-economic", "unit": "0-1", "label": "Agriculture pressure",
                                   "description": "Land conversion pressure for farming"},
    "protected_area_flag": {"group": "Socio-economic", "unit": "0/1", "label": "Protected area",
                            "description": "1 if the plot lies inside a protected reserve"},
}

MODEL_REGISTRY: dict[str, dict] = {
    "random_forest": {
        "name": "Random Forest",
        "kind": "tree",
        "params": {"n_estimators": 260, "max_depth": 14, "min_samples_leaf": 3,
                   "class_weight": "balanced", "n_jobs": -1},
    },
    "gradient_boosting": {
        "name": "Gradient Boosting",
        "kind": "tree",
        "params": {"n_estimators": 220, "learning_rate": 0.08, "max_depth": 5,
                   "subsample": 0.9},
    },
    "decision_tree": {
        "name": "Decision Tree",
        "kind": "tree",
        "params": {"max_depth": 9, "min_samples_leaf": 6, "class_weight": "balanced"},
    },
    "logistic_regression": {
        "name": "Logistic Regression",
        "kind": "linear",
        "params": {"max_iter": 2000, "C": 1.0, "class_weight": "balanced"},
    },
    "knn": {
        "name": "K-Nearest Neighbors",
        "kind": "instance",
        "params": {"n_neighbors": 11, "weights": "distance"},
    },
}
