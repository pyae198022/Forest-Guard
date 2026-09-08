"""Shared server configuration: paths and constants."""

from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = PROJECT_ROOT / "dataset"
CSV_PATH = DATASET_DIR / "forestguard_dataset.csv"
INFO_PATH = DATASET_DIR / "dataset_info.json"

DATABASE_PATH = Path(__file__).resolve().parents[1] / "database" / "forestguard.db"
MODEL_DIR = Path(__file__).resolve().parents[1] / "models"

SERVER_HOST = "0.0.0.0"
SERVER_PORT = 3010

TABLE_RAW = "forest_records"
TABLE_PREPROCESSED = "preprocessed_records"
TABLE_RUNS = "preprocessing_runs"
TABLE_MODEL_RUNS = "model_runs"
