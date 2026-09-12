"""ForestGuard — dataset bootstrap.

Imports the uploaded PJBook Excel dataset (Deforestation_Data_With_
Climate_And_Habitat) into the canonical CSV + SQLite mirror used by
every layer of the app.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pandas as pd

from server.database import sqlite
from server.ml import config as mlcfg
from server.utils import config

UPLOAD_CANDIDATES = [
    Path("/home/z/my-project/upload/Deforestation_Data_With_Climate_And_Habitat (1).xlsx"),
]
# canonical copy kept inside the project dataset/ directory
XLSX_COPY = config.DATASET_DIR / "Deforestation_Data_With_Climate_And_Habitat.xlsx"


def _read_source() -> pd.DataFrame:
    for path in UPLOAD_CANDIDATES:
        if path.exists():
            return pd.read_excel(path)
    if XLSX_COPY.exists():
        return pd.read_excel(XLSX_COPY)
    if config.CSV_PATH.exists():
        return pd.read_csv(config.CSV_PATH)
    raise FileNotFoundError(
        "PJBook dataset not found in upload/ or dataset/ directories")


def dataset_info(df: pd.DataFrame) -> dict:
    numeric = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    categorical = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]
    return {
        "name": "Deforestation Data with Climate and Habitat",
        "source": "Country-year panel, 130 countries, 1990-2020",
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "numeric_columns": len(numeric),
        "categorical_columns": len(categorical),
        "year_min": int(df["Year"].min()),
        "year_max": int(df["Year"].max()),
        "entities": int(df["Entity"].nunique()),
        "regions": sorted(df["Region"].dropna().unique().tolist()),
        "missing_values": int(df.isna().sum().sum()),
        "duplicate_records": int(df.duplicated().sum()),
        "target": mlcfg.TARGET,
        "split": {"train": f"Year <= {mlcfg.SPLIT_YEAR}",
                  "test": f"Year > {mlcfg.SPLIT_YEAR}"},
        "leakage_excluded": mlcfg.LEAKAGE_FEATURES,
    }


def bootstrap(force: bool = False) -> dict:
    """Ensure CSV + SQLite mirror exist; returns the dataset info."""
    config.DATASET_DIR.mkdir(parents=True, exist_ok=True)
    sqlite.init_db()

    seeded = sqlite.is_seeded(config.TABLE_RAW)
    if seeded and not force and config.CSV_PATH.exists():
        return dataset_info(sqlite.load_dataframe(config.TABLE_RAW))

    df = _read_source()

    # normalise dtypes
    if "Year" in df.columns:
        df["Year"] = df["Year"].astype(int)
    for c in ("Extreme_Heat_Days_Count", "IUCN_Threatened_Species_Count"):
        if c in df.columns:
            df[c] = df[c].astype(int)

    # canonical CSV (client download + fast reloads)
    df.to_csv(config.CSV_PATH, index=False)
    if Path("/home/z/my-project/upload").exists():
        src = next((p for p in UPLOAD_CANDIDATES if p.exists()), None)
        if src and not XLSX_COPY.exists():
            shutil.copy2(src, XLSX_COPY)

    with sqlite.get_connection() as conn:
        conn.execute(f"DROP TABLE IF EXISTS {config.TABLE_RAW}")
    sqlite.save_dataframe(df, config.TABLE_RAW)

    info = dataset_info(df)
    config.INFO_PATH.write_text(json.dumps(info, indent=2))

    # drop stale preprocessed snapshot from any previous schema
    with sqlite.get_connection() as conn:
        conn.execute(f"DROP TABLE IF EXISTS {config.TABLE_PREPROCESSED}")
    return info
