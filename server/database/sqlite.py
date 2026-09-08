"""SQLite persistence layer for ForestGuard AI.

Stores the raw dataset, preprocessed variants, and run history
using pandas + the stdlib sqlite3 driver (zero external deps).
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import pandas as pd

from server.utils import config


def _ensure_dir() -> None:
    config.DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    """Yield a short-lived sqlite3 connection with row access by name."""
    _ensure_dir()
    conn = sqlite3.connect(config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Create run-history tables if they do not exist yet."""
    with get_connection() as conn:
        conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {config.TABLE_RUNS} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                options TEXT NOT NULL,
                rows_in INTEGER,
                rows_out INTEGER,
                steps TEXT,
                quality_before REAL,
                quality_after REAL
            )
            """
        )
        conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {config.TABLE_MODEL_RUNS} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                source TEXT NOT NULL,
                metrics_json TEXT NOT NULL,
                best_model TEXT
            )
            """
        )


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    return row is not None


def is_seeded(table: str) -> bool:
    with get_connection() as conn:
        if not table_exists(conn, table):
            return False
        row = conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()
        return bool(row and row["c"] > 0)


def save_dataframe(df: pd.DataFrame, table: str, if_exists: str = "replace") -> int:
    """Persist a DataFrame to SQLite; returns the number of rows written."""
    _ensure_dir()
    with sqlite3.connect(config.DATABASE_PATH) as conn:
        df.to_sql(table, conn, if_exists=if_exists, index=False)
    return len(df)


def load_dataframe(table: str) -> pd.DataFrame:
    with sqlite3.connect(config.DATABASE_PATH) as conn:
        return pd.read_sql_query(f"SELECT * FROM {table}", conn)


def count_rows(table: str) -> int:
    with get_connection() as conn:
        if not table_exists(conn, table):
            return 0
        return int(conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()["c"])


def insert_run_log(table: str, payload: dict) -> int:
    cols = ", ".join(payload.keys())
    placeholders = ", ".join(["?"] * len(payload))
    with get_connection() as conn:
        cur = conn.execute(
            f"INSERT INTO {table} ({cols}) VALUES ({placeholders})",
            list(payload.values()),
        )
        return int(cur.lastrowid or 0)


def fetch_run_logs(table: str, limit: int = 5) -> list[dict]:
    with get_connection() as conn:
        if not table_exists(conn, table):
            return []
        rows = conn.execute(
            f"SELECT * FROM {table} ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
