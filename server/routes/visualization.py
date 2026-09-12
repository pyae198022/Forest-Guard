"""Visualization routes — PJBook section 2.3 figure set."""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter, Query

from server.database import sqlite
from server.ml import config as mlcfg
from server.utils import config, responses

router = APIRouter(prefix="/api/visualization", tags=["visualization"])


def _df() -> pd.DataFrame:
    return sqlite.load_dataframe(config.TABLE_RAW)


@router.get("/histogram")
def histogram(feature: str = Query(...), bins: int = Query(24, ge=5, le=80)):
    """Figure 2.2.2.1 — feature distribution + skewness (log-aware)."""
    df = _df()
    if feature not in df.columns:
        return responses.err(f"Unknown feature '{feature}'", 404)
    s = df[feature].dropna()
    if not pd.api.types.is_numeric_dtype(s) or len(s.unique()) <= 12:
        vc = df[feature].value_counts()
        return responses.ok({
            "feature": feature, "skew": None,
            "data": [{"bin": str(k), "count": int(v)}
                     for k, v in vc.items()]})
    s = s.astype(float)
    skew_before = float(s.skew())
    use_log = feature in mlcfg.LOG1P_FEATURES or skew_before > 3
    values = np.log1p(s) if use_log else s
    counts, edges = np.histogram(values, bins=bins)
    labels = [f"{edges[i]:.4g}–{edges[i+1]:.4g}" for i in range(len(counts))]
    if use_log:
        labels = [f"{np.expm1(edges[i]):.4g}–{np.expm1(edges[i+1]):.4g}"
                  for i in range(len(counts))]
    return responses.ok({
        "feature": feature,
        "skew": round(skew_before, 3),
        "log_transformed": use_log,
        "data": [{"bin": labels[i], "count": int(c)}
                 for i, c in enumerate(counts)],
    })


@router.get("/boxplot")
def boxplot(feature: str = Query(...)):
    """Figure 2.3.1 — box plot with explicit outlier detection (IQR rule)."""
    df = _df()
    if feature not in df.columns:
        return responses.err(f"Unknown feature '{feature}'", 404)
    s = df[feature].dropna().astype(float)
    q1, q3 = s.quantile([0.25, 0.75])
    iqr = q3 - q1
    lo_fence, hi_fence = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    outliers = s[(s < lo_fence) | (s > hi_fence)]
    return responses.ok({
        "feature": feature,
        "min": round(float(s.min()), 3),
        "q1": round(float(q1), 3),
        "median": round(float(s.median()), 3),
        "q3": round(float(q3), 3),
        "max": round(float(s.max()), 3),
        "lower_fence": round(float(lo_fence), 3),
        "upper_fence": round(float(hi_fence), 3),
        "outliers_count": int(len(outliers)),
        "outliers_pct": round(100 * len(outliers) / len(s), 2),
        "sample_points": [round(float(v), 3) for v in
                          np.random.default_rng(7).choice(
                              s.values, size=min(220, len(s)),
                              replace=False)],
    })


@router.get("/region-boxplot")
def region_boxplot():
    """Figure 2.3.2 — deforestation spread by region."""
    df = _df()
    groups = []
    for region, sub in df.groupby("Region"):
        s = sub[mlcfg.TARGET].astype(float)
        q1, q3 = s.quantile([0.25, 0.75])
        groups.append({
            "region": region, "count": int(len(s)),
            "min": round(float(s.min()), 1),
            "q1": round(float(q1), 1),
            "median": round(float(s.median()), 1),
            "q3": round(float(q3), 1),
            "max": round(float(s.max()), 1),
            "mean": round(float(s.mean()), 1),
            "std": round(float(s.std()), 1),
        })
    order = ["Other/Global", "Africa", "Asia", "Europe", "North America",
             "South America", "Oceania"]
    groups.sort(key=lambda g: order.index(g["region"])
                if g["region"] in order else 99)
    return responses.ok({"target": mlcfg.TARGET, "groups": groups})


@router.get("/trend")
def trend():
    """Figure 2.3.3 — global annual average deforestation 1990-2020."""
    df = _df()
    yearly = df.groupby("Year")[mlcfg.TARGET].mean().round(1)
    return responses.ok({
        "data": [{"year": int(y), "value": float(v)}
                 for y, v in yearly.items()],
        "interpretation": "Sustained long-term decline in average global "
                          "deforestation across 1990-2020.",
    })


@router.get("/records-by-region")
def records_by_region():
    """Figure 2.3.4 — record-count imbalance across regions."""
    df = _df()
    vc = df["Region"].value_counts()
    return responses.ok({
        "data": [{"region": k, "count": int(v),
                  "pct": round(100 * v / len(df), 2)}
                 for k, v in vc.items()],
        "interpretation": "Geographical imbalance: aggregated Other/Global "
                          "records dominate the panel.",
    })


@router.get("/correlation")
def correlation(threshold: float = Query(0.25, ge=0.0, le=1.0)):
    """Figure 2.3.5 — correlation heat-map matrix."""
    df = _df()
    num = df.select_dtypes(include=[np.number]).drop(columns=["record_id"],
          errors="ignore")
    corr = num.corr(method="spearman").round(3)
    cols = list(corr.columns)
    strong = []
    target_corr = corr[mlcfg.TARGET].drop(mlcfg.TARGET)
    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            v = float(corr.loc[a, b])
            if abs(v) >= threshold:
                strong.append({"a": a, "b": b, "corr": v})
    strong.sort(key=lambda x: -abs(x["corr"]))
    return responses.ok({
        "columns": cols,
        "matrix": corr.values.tolist(),
        "strong_pairs": strong[:24],
        "target_correlation": [
            {"feature": f, "corr": round(float(v), 3)}
            for f, v in target_corr.sort_values(key=abs,
                                                ascending=False).items()],
    })


@router.get("/target-correlation")
def target_correlation(top: int = Query(12, ge=3, le=25)):
    """Figure 2.3.6 — features most correlated with Deforestation_Ha."""
    df = _df()
    num = df.select_dtypes(include=[np.number]).drop(columns=["Year"],
          errors="ignore")
    corr = num.corr(method="spearman")[mlcfg.TARGET].drop(mlcfg.TARGET)
    rows = [{"feature": f, "corr": round(float(v), 3),
             "abs": round(float(abs(v)), 3),
             "leakage": f in mlcfg.LEAKAGE_FEATURES}
            for f, v in corr.sort_values(key=abs, ascending=False).items()]
    return responses.ok({"target": mlcfg.TARGET, "data": rows[:top]})
