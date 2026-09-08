"""Preprocessing routes: quality overview, pipeline execution, run history."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel, Field

from server.database import sqlite
from server.ml import config as mlcfg
from server.ml.preprocessing import iqr_outlier_counts, winsorize_outliers
from server.utils import config, responses

router = APIRouter(prefix="/api/preprocessing", tags=["preprocessing"])

QUALITY_WEIGHTS = {"missing": 0.4, "duplicates": 0.3, "outliers": 0.3}


def quality_score(df: pd.DataFrame) -> float:
    """Composite 0-100 score: missing values, duplicates and IQR outliers."""
    total_cells = max(1, df.shape[0] * df.shape[1])
    missing = float(df.isna().sum().sum()) / total_cells
    dupes = float(df.duplicated(subset=df.columns.drop("record_id")).sum()) / max(1, len(df))
    outliers = iqr_outlier_counts(df)
    outlier_cells = sum(v["count"] for v in outliers.values())
    outlier_rate = outlier_cells / max(1, df.select_dtypes(include=[np.number]).size)
    score = 100 * (
        1 - QUALITY_WEIGHTS["missing"] * missing * 10
        - QUALITY_WEIGHTS["duplicates"] * dupes
        - QUALITY_WEIGHTS["outliers"] * min(1.0, outlier_rate * 10)
    )
    return round(max(0.0, min(100.0, score)), 1)


class PipelineOptions(BaseModel):
    missing_strategy: str = Field("median", pattern="^(mean|median|most_frequent)$")
    scaling: str = Field("standard", pattern="^(standard|minmax|robust|none)$")
    outlier_handling: str = Field("winsorize", pattern="^(none|winsorize)$")
    drop_duplicates: bool = True
    drop_high_missing: bool = True
    missing_threshold: float = Field(30.0, ge=0, le=100)
    save_result: bool = True


@router.get("/overview")
def preprocessing_overview():
    df = sqlite.load_dataframe(config.TABLE_RAW)
    missing_by_col = [
        {"column": c, "missing": int(v), "pct": round(float(v) / len(df) * 100, 2)}
        for c, v in df.isna().sum().items() if v > 0
    ]
    missing_by_col.sort(key=lambda x: -x["missing"])
    outliers = iqr_outlier_counts(df)
    top_outliers = sorted(outliers.items(), key=lambda kv: -kv[1]["count"])[:8]

    dtypes = df.dtypes.astype(str).value_counts().to_dict()
    return responses.ok({
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "missing_total": int(df.isna().sum().sum()),
        "missing_by_column": missing_by_col,
        "duplicates": int(df.duplicated(subset=df.columns.drop("record_id")).sum()),
        "constant_columns": [c for c in df.columns if df[c].nunique(dropna=True) <= 1],
        "dtype_counts": dtypes,
        "outlier_summary": [
            {"column": c, "count": v["count"], "pct": v["pct"],
             "lower": round(v["lower"], 2), "upper": round(v["upper"], 2)}
            for c, v in top_outliers
        ],
        "quality_score": quality_score(df),
    })


@router.post("/run")
def run_pipeline(options: PipelineOptions):
    raw = sqlite.load_dataframe(config.TABLE_RAW)
    df = raw.copy()
    rows_in = len(df)
    steps: list[dict] = []

    # 1. duplicate removal
    if options.drop_duplicates:
        before = len(df)
        df = df.drop_duplicates(subset=df.columns.drop("record_id"), keep="first")
        removed = before - len(df)
        steps.append({"step": "Remove duplicate rows", "detail": f"{removed} rows removed",
                      "rows_after": int(len(df))})

    # 2. drop columns with too many missing values
    if options.drop_high_missing:
        thresh = options.missing_threshold / 100
        high_missing = [c for c in df.columns if df[c].isna().mean() > thresh]
        if high_missing:
            df = df.drop(columns=high_missing)
            steps.append({"step": "Drop high-missing columns",
                          "detail": f"Dropped: {', '.join(high_missing)} (> {options.missing_threshold}%)",
                          "rows_after": int(len(df))})

    # 3. missing value imputation
    imputed_cells = 0
    for col in df.columns:
        n_missing = int(df[col].isna().sum())
        if n_missing == 0:
            continue
        imputed_cells += n_missing
        if pd.api.types.is_numeric_dtype(df[col]):
            if options.missing_strategy == "median":
                fill = df[col].median()
            elif options.missing_strategy == "most_frequent":
                fill = df[col].mode().iloc[0]
            else:
                fill = df[col].mean()
        else:
            fill = df[col].mode().iloc[0]
        df[col] = df[col].fillna(fill)
    steps.append({"step": f"Impute missing values ({options.missing_strategy})",
                  "detail": f"{imputed_cells} cells filled", "rows_after": int(len(df))})

    # 4. outlier treatment
    if options.outlier_handling == "winsorize":
        numeric_cols = [c for c in df.select_dtypes(include=[np.number]).columns
                        if c not in ("record_id", "protected_area_flag")]
        df, capped = winsorize_outliers(df, numeric_cols)
        total_capped = sum(capped.values())
        steps.append({"step": "Winsorize outliers (1st/99th percentile)",
                      "detail": f"{total_capped} extreme cells capped",
                      "rows_after": int(len(df))})

    # 5. type optimization
    for col in df.select_dtypes(include=["float64"]).columns:
        if (df[col].dropna() % 1 == 0).all() and df[col].max() < 2 ** 31:
            df[col] = df[col].astype("int64")
    steps.append({"step": "Optimize data types",
                  "detail": f"Memory: {raw.memory_usage(deep=True).sum() // 1024} KB -> "
                            f"{df.memory_usage(deep=True).sum() // 1024} KB",
                  "rows_after": int(len(df))})

    # 6. encoding preview (what training pipeline applies)
    steps.append({
        "step": "Encode categoricals + scale numerics",
        "detail": f"One-hot 'region' ({df['region'].nunique()} levels), "
                  f"{options.scaling} scaling applied at training time",
        "rows_after": int(len(df)),
    })

    score_before = quality_score(raw)
    score_after = quality_score(df)

    preview_cols = [c for c in df.columns][:12]
    if options.save_result:
        sqlite.save_dataframe(df, config.TABLE_PREPROCESSED, if_exists="replace")
        sqlite.insert_run_log(config.TABLE_RUNS, {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "options": json.dumps(options.model_dump()),
            "rows_in": rows_in,
            "rows_out": int(len(df)),
            "steps": json.dumps(steps),
            "quality_before": score_before,
            "quality_after": score_after,
        })

    return responses.ok({
        "rows_in": rows_in,
        "rows_out": int(len(df)),
        "steps": steps,
        "quality_before": score_before,
        "quality_after": score_after,
        "missing_before": int(raw.isna().sum().sum()),
        "missing_after": int(df.isna().sum().sum()),
        "duplicates_before": int(raw.duplicated(subset=raw.columns.drop("record_id")).sum()),
        "duplicates_after": int(df.duplicated(subset=df.columns.drop("record_id")).sum()) if "record_id" in df.columns else 0,
        "preview": df[preview_cols].head(10).to_dict(orient="records"),
        "preview_columns": preview_cols,
        "options": options.model_dump(),
    })


@router.get("/history")
def run_history(limit: int = 5):
    runs = sqlite.fetch_run_logs(config.TABLE_RUNS, limit=limit)
    for r in runs:
        for field in ("options", "steps"):
            try:
                r[field] = json.loads(r[field])
            except (json.JSONDecodeError, TypeError):
                pass
    return responses.ok(runs)
