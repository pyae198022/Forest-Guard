"""
ForestGuard AI — Synthetic Forest Dataset Generator
====================================================
Generates a realistic forest-ecosystem dataset for the Data Mining project:

  * 4,030 records
  * 27 features  (Geographic / Environmental / Climate / Biodiversity / Socio-economic)
  * 1 target     (deforestation_risk: Low / Medium / High)

The generator embeds realistic multivariate relationships (vegetation health,
human pressure, climate stress and protection status all influence the target)
so that classification models achieve meaningful, non-trivial accuracy.

Run directly:
    python3 -m server.utils.dataset_generator
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

SEED = 42
N_RECORDS = 4010  # + 20 injected duplicates = 4,030 raw records (spec)
DUPLICATE_ROWS = 20
N_FEATURES = 27

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = PROJECT_ROOT / "dataset"
CSV_PATH = DATASET_DIR / "forestguard_dataset.csv"
INFO_PATH = DATASET_DIR / "dataset_info.json"

TARGET = "deforestation_risk"
CLASSES = ["Low", "Medium", "High"]

# Region profiles drive realistic feature distributions per ecosystem.
# Each profile: (weight, lat_range, lon_range, elev_range, temp_range,
#                rainfall_range, logging_base, agri_base, protected_prob)
REGION_PROFILES = {
    "Amazon Basin": dict(
        weight=0.22, lat=(-10, 2), lon=(-74, -50), elev=(80, 400),
        temp=(24, 30), rain=(1800, 3200), logging=0.62, agri=0.58, protected=0.30,
    ),
    "Congo Basin": dict(
        weight=0.16, lat=(-6, 4), lon=(9, 30), elev=(250, 700),
        temp=(23, 29), rain=(1500, 2400), logging=0.55, agri=0.62, protected=0.24,
    ),
    "Southeast Asia": dict(
        weight=0.18, lat=(-4, 8), lon=(95, 125), elev=(50, 1200),
        temp=(24, 31), rain=(1800, 3500), logging=0.78, agri=0.74, protected=0.20,
    ),
    "Boreal North": dict(
        weight=0.16, lat=(52, 68), lon=(30, 140), elev=(120, 800),
        temp=(-9, 2), rain=(350, 750), logging=0.30, agri=0.12, protected=0.38,
    ),
    "East Africa": dict(
        weight=0.14, lat=(-4, 12), lon=(30, 48), elev=(900, 2400),
        temp=(18, 28), rain=(600, 1600), logging=0.60, agri=0.70, protected=0.27,
    ),
    "Temperate Europe": dict(
        weight=0.14, lat=(43, 60), lon=(-8, 30), elev=(100, 1500),
        temp=(6, 15), rain=(600, 1400), logging=0.34, agri=0.28, protected=0.42,
    ),
}

FEATURE_COLUMNS = [
    # Geographic / Environmental
    "region", "latitude", "longitude", "elevation_m", "slope_deg",
    "soil_moisture_pct", "soil_ph", "ndvi", "canopy_cover_pct",
    "tree_density_per_ha", "biomass_tons_ha", "forest_age_years",
    # Climate
    "annual_rainfall_mm", "avg_temperature_c", "humidity_pct",
    "drought_index", "wind_speed_kmh", "solar_radiation_kwh_m2",
    "fire_risk_index",
    # Biodiversity
    "species_richness", "endemic_species_count", "invasive_species_pct",
    # Socio-economic
    "population_density_per_km2", "logging_intensity_index",
    "road_proximity_km", "agriculture_pressure_index", "protected_area_flag",
]

NUMERIC_COLUMNS = [c for c in FEATURE_COLUMNS if c != "region"]


def _clip(rng: np.random.Generator, n: int, lo: float, hi: float,
          loc: float, scale: float) -> np.ndarray:
    """Normal sample clipped to bounds — avoids unrealistic extremes."""
    return np.clip(rng.normal(loc, scale, n), lo, hi)


def _uniform(rng: np.random.Generator, n: int, lo: float, hi: float) -> np.ndarray:
    return rng.uniform(lo, hi, n)


def generate_dataset(n_records: int = N_RECORDS, seed: int = SEED) -> pd.DataFrame:
    """Generate the full synthetic dataset and return it as a DataFrame."""
    rng = np.random.default_rng(seed)
    n = n_records

    # -- Region assignment --------------------------------------------------- #
    names = list(REGION_PROFILES.keys())
    weights = np.array([REGION_PROFILES[r]["weight"] for r in names])
    weights = weights / weights.sum()
    region = rng.choice(names, size=n, p=weights)

    lat = np.empty(n); lon = np.empty(n); elev = np.empty(n)
    temp = np.empty(n); rain = np.empty(n)
    logging_base = np.empty(n); agri_base = np.empty(n)
    protected_flag = np.empty(n)

    for r, profile in REGION_PROFILES.items():
        mask = region == r
        k = mask.sum()
        if k == 0:
            continue
        lat[mask] = _uniform(rng, k, *profile["lat"])
        lon[mask] = _uniform(rng, k, *profile["lon"])
        elev[mask] = _uniform(rng, k, *profile["elev"])
        temp[mask] = _uniform(rng, k, *profile["temp"])
        rain[mask] = _uniform(rng, k, *profile["rain"])
        logging_base[mask] = np.clip(
            rng.normal(profile["logging"], 0.16, k), 0.02, 1.0)
        agri_base[mask] = np.clip(
            rng.normal(profile["agri"], 0.16, k), 0.02, 1.0)
        protected_flag[mask] = rng.random(k) < profile["protected"]

    # -- Environmental ------------------------------------------------------- #
    slope = _clip(rng, n, 0, 55, 12, 8)
    soil_moisture = _clip(rng, n, 4, 62, 30 + (rain - rain.mean()) / 260, 7)
    soil_ph = _clip(rng, n, 3.4, 8.2, 5.6, 0.8)
    forest_age = _clip(rng, n, 3, 480, 95, 70)

    # -- Vegetation (driven by climate + human pressure) ---------------------- #
    human_pressure_raw = 0.55 * logging_base + 0.45 * agri_base
    ndvi = np.clip(
        0.82
        - 0.26 * human_pressure_raw
        + 0.10 * (soil_moisture - 30) / 30
        - 0.012 * (temp - temp.mean())
        + rng.normal(0, 0.05, n),
        0.08, 0.92,
    )
    canopy = np.clip(
        88 - 40 * human_pressure_raw + 18 * (ndvi - 0.55) + rng.normal(0, 6, n),
        8, 98,
    )
    tree_density = np.clip(
        380 + 620 * (ndvi - 0.1) - 300 * human_pressure_raw + rng.normal(0, 90, n),
        40, 1600,
    )
    biomass = np.clip(
        (canopy / 100) * (140 + 0.55 * forest_age) * rng.normal(1.0, 0.12, n),
        12, 720,
    )

    # -- Climate stress ------------------------------------------------------- #
    humidity = np.clip(52 + rain / 90 + rng.normal(0, 8, n), 22, 99)
    drought = np.clip(0.5 - (rain - rain.min()) / (rain.max() - rain.min())
                      * 0.9 + rng.normal(0, 0.14, n), -2.4, 2.4)
    wind = _clip(rng, n, 1.5, 42, 13, 6)
    solar = np.clip(3.2 + 0.10 * (temp - temp.mean()) - rain / 900
                    + rng.normal(0, 0.55, n), 2.2, 8.4)
    fire_risk = np.clip(
        0.5 * np.clip((drought + 0.6) / 2.4, 0, 1)
        + 0.28 * np.clip((temp - 5) / 26, 0, 1)
        + 0.14 * np.clip((wind - 5) / 30, 0, 1)
        + 0.08 * rng.random(n),
        0.01, 1.0,
    )

    # -- Biodiversity ---------------------------------------------------------- #
    species_richness = np.clip(
        np.round(38 + 190 * ndvi + 0.03 * (elev - 800) * -0.02
                 + rng.normal(0, 22, n)), 4, 460,
    ).astype(int)
    endemic = np.clip(
        np.round(species_richness * rng.uniform(0.04, 0.34, n)), 0, 140,
    ).astype(int)
    invasive = np.clip(
        6 + 34 * human_pressure_raw - 12 * protected_flag
        + rng.normal(0, 6, n), 0.2, 78,
    )

    # -- Socio-economic --------------------------------------------------------- #
    pop_density = np.clip(
        np.exp(rng.normal(3.1 + 1.4 * agri_base, 1.0, n)), 0.4, 1600,
    )
    road_proximity = np.clip(
        0.3 + 22 * np.exp(-2.2 * pop_density / 400) * rng.uniform(0.2, 1.6, n),
        0.1, 90,
    )
    agri_pressure = agri_base

    # -- Target: deforestation risk ---------------------------------------------- #
    def norm(x: np.ndarray) -> np.ndarray:
        lo, hi = np.nanmin(x), np.nanmax(x)
        return (x - lo) / (hi - lo + 1e-9)

    score = (
        1.65 * (1 - norm(ndvi))
        + 1.45 * norm(logging_base)
        + 1.25 * norm(agri_pressure)
        + 1.05 * norm(fire_risk)
        + 0.85 * norm(np.clip(drought, 0, None))
        + 0.75 * (1 - norm(soil_moisture))
        + 0.70 * norm(np.log1p(pop_density))
        + 0.60 * (1 - norm(road_proximity))
        + 0.55 * norm(invasive)
        + 0.45 * (1 - norm(canopy))
        + 0.45 * norm(solar)
        - 0.85 * protected_flag
        + rng.normal(0, 0.22, n)
    )

    q_low, q_high = np.quantile(score, [0.40, 0.76])
    risk = np.where(score <= q_low, "Low",
                    np.where(score <= q_high, "Medium", "High"))

    df = pd.DataFrame({
        "record_id": np.arange(1, n + 1),
        "region": region,
        "latitude": np.round(lat, 4),
        "longitude": np.round(lon, 4),
        "elevation_m": np.round(elev, 1),
        "slope_deg": np.round(slope, 1),
        "soil_moisture_pct": np.round(soil_moisture, 2),
        "soil_ph": np.round(soil_ph, 2),
        "ndvi": np.round(ndvi, 4),
        "canopy_cover_pct": np.round(canopy, 1),
        "tree_density_per_ha": np.round(tree_density, 0),
        "biomass_tons_ha": np.round(biomass, 1),
        "forest_age_years": np.round(forest_age, 0),
        "annual_rainfall_mm": np.round(rain, 0),
        "avg_temperature_c": np.round(temp, 1),
        "humidity_pct": np.round(humidity, 1),
        "drought_index": np.round(drought, 3),
        "wind_speed_kmh": np.round(wind, 1),
        "solar_radiation_kwh_m2": np.round(solar, 2),
        "fire_risk_index": np.round(fire_risk, 3),
        "species_richness": species_richness,
        "endemic_species_count": endemic,
        "invasive_species_pct": np.round(invasive, 1),
        "population_density_per_km2": np.round(pop_density, 1),
        "logging_intensity_index": np.round(logging_base, 3),
        "road_proximity_km": np.round(road_proximity, 2),
        "agriculture_pressure_index": np.round(agri_pressure, 3),
        "protected_area_flag": protected_flag.astype(int),
        TARGET: risk,
    })
    return df


def inject_data_quality_issues(df: pd.DataFrame, seed: int = SEED + 7) -> pd.DataFrame:
    """Inject realistic imperfections so the preprocessing module has real work:
    ~0.9% scattered missing values + ~0.5% duplicated rows + a few outliers."""
    rng = np.random.default_rng(seed)
    df = df.copy()
    n = len(df)

    # scattered missing values in numeric columns (~0.9% of 8 columns' cells)
    miss_cols = ["soil_moisture_pct", "ndvi", "humidity_pct", "biomass_tons_ha",
                 "species_richness", "road_proximity_km"]
    for col in miss_cols:
        idx = rng.choice(n, size=int(n * 0.009), replace=False)
        df.loc[idx, col] = np.nan

    # a handful of obvious outliers
    idx = rng.choice(n, size=14, replace=False)
    df.loc[idx[:5], "elevation_m"] = df.loc[idx[:5], "elevation_m"] * 9
    df.loc[idx[5:10], "annual_rainfall_mm"] = df.loc[idx[5:10], "annual_rainfall_mm"] * 6
    df.loc[idx[10:], "population_density_per_km2"] = df.loc[idx[10:], "population_density_per_km2"] * 25

    # ~20 duplicated rows
    dupes = df.sample(n=DUPLICATE_ROWS, random_state=int(seed)).copy()
    df = pd.concat([df, dupes], ignore_index=True)
    return df


def build_dataset_info(df: pd.DataFrame) -> dict:
    """Metadata describing the generated dataset (used by the UI and docs)."""
    feature_groups = {
        "geographic": ["region", "latitude", "longitude", "elevation_m", "slope_deg"],
        "environmental": ["soil_moisture_pct", "soil_ph", "ndvi", "canopy_cover_pct",
                          "tree_density_per_ha", "biomass_tons_ha", "forest_age_years"],
        "climate": ["annual_rainfall_mm", "avg_temperature_c", "humidity_pct",
                    "drought_index", "wind_speed_kmh", "solar_radiation_kwh_m2",
                    "fire_risk_index"],
        "biodiversity": ["species_richness", "endemic_species_count", "invasive_species_pct"],
        "socio_economic": ["population_density_per_km2", "logging_intensity_index",
                           "road_proximity_km", "agriculture_pressure_index",
                           "protected_area_flag"],
    }
    return {
        "name": "ForestGuard Forest Ecosystem Dataset",
        "version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "n_records": int(len(df)),
        "n_features": N_FEATURES,
        "target": TARGET,
        "classes": CLASSES,
        "class_distribution": df[TARGET].value_counts().to_dict(),
        "feature_groups": feature_groups,
        "columns": [
            {"name": c,
             "dtype": ("categorical" if c == "region" else
                       "integer" if str(df[c].dtype).startswith("int") else
                       "categorical" if c == TARGET else "float")}
            for c in df.columns
        ],
    }


def main() -> None:
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    df = generate_dataset()
    df = inject_data_quality_issues(df)
    df.to_csv(CSV_PATH, index=False)
    info = build_dataset_info(df)
    info["n_records"] = int(len(df))  # after duplication
    INFO_PATH.write_text(json.dumps(info, indent=2))
    print(f"[dataset] saved {len(df)} records x {len(df.columns)} columns -> {CSV_PATH}")
    print(f"[dataset] class distribution: {info['class_distribution']}")


if __name__ == "__main__":
    main()
