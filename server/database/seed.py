"""Bootstrap helpers: ensure the CSV exists and mirror it into SQLite."""

from __future__ import annotations

import json
import logging

import pandas as pd

from server.database import sqlite
from server.utils import config
from server.utils.dataset_generator import generate_dataset, inject_data_quality_issues

logger = logging.getLogger("forestguard.seed")

TARGET = "deforestation_risk"


def ensure_csv() -> pd.DataFrame:
    """Load the dataset CSV; regenerate it from the generator if missing."""
    if config.CSV_PATH.exists():
        df = pd.read_csv(config.CSV_PATH)
        logger.info("Loaded dataset CSV: %s rows", len(df))
        return df

    logger.info("Dataset CSV missing - generating a fresh one")
    df = inject_data_quality_issues(generate_dataset())
    config.DATASET_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(config.CSV_PATH, index=False)
    return df


def seed_raw_table(df: pd.DataFrame, force: bool = False) -> None:
    """Write the raw dataset into SQLite once (idempotent)."""
    if not force and sqlite.is_seeded(config.TABLE_RAW):
        logger.info("Raw table already seeded (%s rows)", sqlite.count_rows(config.TABLE_RAW))
        return
    rows = sqlite.save_dataframe(df, config.TABLE_RAW, if_exists="replace")
    logger.info("Seeded %s raw records into SQLite", rows)


def bootstrap(force_reseed: bool = False) -> pd.DataFrame:
    """Full startup chain: CSV -> SQLite. Returns the raw dataframe."""
    sqlite.init_db()
    df = ensure_csv()
    seed_raw_table(df, force=force_reseed)
    try:
        info = json.loads(config.INFO_PATH.read_text()) if config.INFO_PATH.exists() else {}
    except json.JSONDecodeError:
        info = {}
    if info:
        logger.info("Dataset info: %s", info.get("name", "unknown"))
    return df
