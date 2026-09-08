"""Descriptive mining routes: statistics, outliers, groupby, clustering."""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel, Field
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from server.database import sqlite
from server.ml import config as mlcfg
from server.ml.preprocessing import iqr_outlier_counts
from server.utils import config, responses

router = APIRouter(prefix="/api/mining", tags=["mining"])


def _df() -> pd.DataFrame:
    return sqlite.load_dataframe(config.TABLE_RAW)


@router.get("/descriptive")
def descriptive_stats():
    df = _df()
    numeric = df.select_dtypes(include=[np.number]).drop(
        columns=["record_id", "protected_area_flag"], errors="ignore")

    rows = []
    for col in numeric.columns:
        s = numeric[col].dropna()
        if s.empty:
            continue
        q1, med, q3 = s.quantile([0.25, 0.5, 0.75])
        rows.append({
            "feature": col,
            "count": int(s.count()),
            "missing": int(df[col].isna().sum()),
            "mean": round(float(s.mean()), 3),
            "std": round(float(s.std()), 3),
            "min": round(float(s.min()), 3),
            "q1": round(float(q1), 3),
            "median": round(float(med), 3),
            "q3": round(float(q3), 3),
            "max": round(float(s.max()), 3),
            "skew": round(float(s.skew()), 3),
            "kurtosis": round(float(s.kurtosis()), 3),
            "cv": round(float(s.std() / s.mean()), 3) if s.mean() else None,
        })

    outliers = iqr_outlier_counts(df)
    for row in rows:
        o = outliers.get(row["feature"], {})
        row["outliers"] = o.get("count", 0)

    # categorical profile
    region_stats = df.groupby("region").agg(
        records=("record_id", "count"),
        avg_ndvi=("ndvi", "mean"),
        high_risk_pct=(mlcfg.TARGET, lambda s: (s == "High").mean() * 100),
    ).round(2).reset_index()

    # strongest absolute correlations
    corr = numeric.corr()
    pairs = []
    cols = corr.columns.tolist()
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            pairs.append({"a": cols[i], "b": cols[j],
                          "value": round(float(corr.iloc[i, j]), 3)})
    pairs.sort(key=lambda p: -abs(p["value"]))

    skew_sorted = sorted(rows, key=lambda r: -abs(r["skew"]))
    return responses.ok({
        "stats": rows,
        "top_correlations": pairs[:12],
        "most_skewed": [
            {"feature": r["feature"], "skew": r["skew"]} for r in skew_sorted[:8]
        ],
        "region_stats": region_stats.to_dict(orient="records"),
    })


@router.get("/groupby")
def groupby_analysis(by: str = "region"):
    df = _df()
    if by not in df.columns:
        return responses.err(f"Unknown grouping column '{by}'", 404)
    key_metrics = ["ndvi", "canopy_cover_pct", "annual_rainfall_mm",
                   "avg_temperature_c", "species_richness",
                   "fire_risk_index", "logging_intensity_index"]
    key_metrics = [m for m in key_metrics if m in df.columns and m != by]
    grouped = df.groupby(by)[key_metrics].mean().round(2).reset_index()
    risk_mix = (df.groupby([by, mlcfg.TARGET]).size().unstack(fill_value=0)
                .reindex(columns=mlcfg.CLASSES, fill_value=0).reset_index())
    merged = grouped.merge(risk_mix, on=by)
    return responses.ok({"by": by, "groups": merged.to_dict(orient="records")})


class ClusterRequest(BaseModel):
    k: int = Field(4, ge=2, le=8)
    features: list[str] | None = None


@router.post("/clustering")
def clustering(req: ClusterRequest):
    df = _df()
    numeric = df.select_dtypes(include=[np.number]).drop(
        columns=["record_id"], errors="ignore")
    features = req.features or ["ndvi", "canopy_cover_pct", "soil_moisture_pct",
                                "fire_risk_index", "logging_intensity_index",
                                "species_richness", "annual_rainfall_mm"]
    features = [f for f in features if f in numeric.columns]
    if len(features) < 2:
        return responses.err("Need at least 2 valid numeric features", 422)

    X = numeric[features].dropna()
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    km = KMeans(n_clusters=req.k, n_init=10, random_state=42)
    labels = km.fit_predict(Xs)
    sil = float(silhouette_score(Xs, labels))

    # 2-D PCA projection for the scatter view
    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(Xs)
    sample_idx = np.random.default_rng(7).choice(
        len(coords), size=min(800, len(coords)), replace=False)

    df_sub = X.iloc[sample_idx]
    profiles = X.assign(cluster=labels).groupby("cluster")[features].mean().round(2)
    sizes = X.assign(cluster=labels).groupby("cluster").size()

    # dominant risk per cluster
    risk_dom = (X.assign(cluster=labels)
                .merge(df[[mlcfg.TARGET]].loc[X.index], left_index=True, right_index=True)
                .groupby("cluster")[mlcfg.TARGET]
                .agg(lambda s: s.value_counts().idxmax()))

    centroids_scaled = km.cluster_centers_
    return responses.ok({
        "k": req.k,
        "features": features,
        "silhouette": round(sil, 4),
        "cluster_sizes": [{"cluster": int(c), "size": int(sizes[c]),
                           "dominant_risk": str(risk_dom[c])}
                          for c in range(req.k)],
        "centroids": [{"cluster": int(c),
                       **{f: float(profiles.loc[c, f]) for f in features}}
                      for c in profiles.index],
        "projection": {
            "points": [
                {"x": round(float(coords[i][0]), 3),
                 "y": round(float(coords[i][1]), 3),
                 "cluster": int(labels[i]),
                 "risk": df.iloc[X.index[i]][mlcfg.TARGET]}
                for i in sample_idx
            ],
            "explained_variance": [round(float(v), 3) for v in pca.explained_variance_ratio_],
        },
    })
