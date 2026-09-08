"""Reusable scikit-learn preprocessing pipelines."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler, MinMaxScaler, RobustScaler

from server.ml.config import CATEGORICAL, NUMERIC_FEATURES

SCALERS = {
    "standard": StandardScaler,
    "minmax": MinMaxScaler,
    "robust": RobustScaler,
    "none": None,
}

IMPUTERS = {
    "mean": lambda: SimpleImputer(strategy="mean"),
    "median": lambda: SimpleImputer(strategy="median"),
    "most_frequent": lambda: SimpleImputer(strategy="most_frequent"),
}


def build_preprocessor(scaling: str = "standard",
                       missing_strategy: str = "mean") -> ColumnTransformer:
    """Numeric impute+scale, categorical impute+one-hot — the classic recipe."""
    num_imputer = IMPUTERS.get(missing_strategy, IMPUTERS["mean"])()
    scaler = SCALERS.get(scaling, StandardScaler)
    num_steps = [("imputer", num_imputer)]
    if scaler is not None:
        num_steps.append(("scaler", scaler()))

    numeric_pipe = Pipeline(num_steps)
    categorical_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    return ColumnTransformer([
        ("num", numeric_pipe, NUMERIC_FEATURES),
        ("cat", categorical_pipe, CATEGORICAL),
    ])


def winsorize_outliers(df: pd.DataFrame, columns: list[str],
                       z_threshold: float = 3.5) -> tuple[pd.DataFrame, dict[str, int]]:
    """Cap extreme values at the 1st/99th percentile (winsorization).
    Returns the modified frame and a per-column count of capped cells."""
    df = df.copy()
    capped: dict[str, int] = {}
    for col in columns:
        if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
            continue
        lo, hi = df[col].quantile([0.01, 0.99])
        mask = (df[col] < lo) | (df[col] > hi)
        if mask.any():
            df.loc[df[col] < lo, col] = lo
            df.loc[df[col] > hi, col] = hi
            capped[col] = int(mask.sum())
    return df, capped


def iqr_outlier_counts(df: pd.DataFrame) -> dict[str, dict]:
    """Per-column IQR-based outlier statistics."""
    out: dict[str, dict] = {}
    numeric = df.select_dtypes(include=[np.number]).columns
    for col in numeric:
        s = df[col].dropna()
        if s.empty:
            continue
        q1, q3 = s.quantile([0.25, 0.75])
        iqr = q3 - q1
        if iqr == 0:
            out[col] = {"lower": float(q1), "upper": float(q3), "count": 0,
                        "pct": 0.0}
            continue
        lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        mask = (s < lo) | (s > hi)
        out[col] = {"lower": float(lo), "upper": float(hi),
                    "count": int(mask.sum()),
                    "pct": round(float(mask.mean() * 100), 2)}
    return out
