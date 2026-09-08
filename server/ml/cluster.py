"""ForestGuard AI — PJBook section 3.1.2 clustering analysis.

K-Means on the ten book-chosen features (scaled), K evaluated from 2 to 10
with Inertia (WCSS) + Silhouette; random_state=42, n_init=10.  Includes
cluster profiles, distribution, per-cluster silhouette and a PCA-2D view.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import MinMaxScaler

from server.ml import config as mlcfg


def _prep(df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    feats = [c for c in mlcfg.CLUSTER_FEATURES if c in df.columns]
    X = df[feats].astype(float).copy()
    # log1p the heavily skewed members so density outliers don't dominate
    for col in ("Deforestation_Ha", "CO2_Emissions_Mt", "Population_Density",
                "GDP_Per_Capita"):
        if col in X.columns:
            X[col] = np.log1p(X[col].clip(lower=0))
    Xs = MinMaxScaler().fit_transform(X)
    return Xs, feats


def k_selection(Xs: np.ndarray) -> tuple[list[dict], int]:
    """Evaluate K=2..10 -> return table + optimal K (max silhouette)."""
    rows = []
    for k in mlcfg.KM_K_RANGE:
        km = KMeans(n_clusters=k, random_state=mlcfg.KM_RANDOM_STATE,
                    n_init=mlcfg.KM_N_INIT)
        labels = km.fit_predict(Xs)
        sil = silhouette_score(Xs, labels)
        rows.append({
            "k": int(k),
            "inertia_wcss": round(float(km.inertia_), 4),
            "silhouette": round(float(sil), 4),
        })
    best = max(rows, key=lambda r: r["silhouette"])
    return rows, int(best["k"])


def run_clustering(df: pd.DataFrame, k: int | None = None) -> dict:
    Xs, feats = _prep(df)
    table, best_k = k_selection(Xs)
    chosen = int(k) if k and 2 <= int(k) <= 10 else best_k

    km = KMeans(n_clusters=chosen, random_state=mlcfg.KM_RANDOM_STATE,
                n_init=mlcfg.KM_N_INIT)
    labels = km.fit_predict(Xs)

    overall = silhouette_score(Xs, labels)
    # per-cluster silhouette = mean of the sample-level silhouette values
    # (computed against the FULL clustering, as in the book's Table 3.1.2.5)
    from sklearn.metrics import silhouette_samples
    sample_sil = silhouette_samples(Xs, labels)
    per_cluster = []
    for c in range(chosen):
        mask = labels == c
        per_cluster.append({
            "cluster": int(c),
            "count": int(mask.sum()),
            "percentage": round(100 * mask.sum() / len(labels), 2),
            "silhouette": (round(float(sample_sil[mask].mean()), 4)
                           if mask.sum() > 0 else None),
        })

    # profiles on the ORIGINAL (raw) feature scale
    prof = df.groupby(labels)[feats].mean().round(2)
    profiles = []
    for c in range(chosen):
        profiles.append({
            "cluster": int(c),
            **{f: float(prof.loc[c, f]) for f in feats},
        })

    pca = PCA(n_components=2, random_state=mlcfg.KM_RANDOM_STATE)
    pts = pca.fit_transform(Xs)
    sample_idx = np.random.default_rng(mlcfg.KM_RANDOM_STATE).choice(
        len(pts), size=min(900, len(pts)), replace=False)
    scatter = [{"x": round(float(pts[i, 0]), 4),
                "y": round(float(pts[i, 1]), 4),
                "cluster": int(labels[i])} for i in sample_idx]

    # IF-THEN style rule hints: top distinguishing features per cluster
    grand = df[feats].mean()
    rules = []
    for c in range(chosen):
        diffs = (prof.loc[c] - grand) / (grand.abs() + 1e-9)
        top = diffs.abs().sort_values(ascending=False).head(4)
        conds = [f"{f} = {'HIGH' if diffs[f] > 0 else 'LOW'}" for f in top.index]
        rules.append({"cluster": int(c),
                      "rule": " AND ".join(conds) + f"  THEN Cluster = {c}"})

    return {
        "features_used": feats,
        "k_selection": table,
        "optimal_k": best_k,
        "k": chosen,
        "overall_silhouette": round(float(overall), 4),
        "cluster_distribution": per_cluster,
        "profiles": profiles,
        "pca_explained": [round(float(v), 4) for v in
                          pca.explained_variance_ratio_],
        "scatter": scatter,
        "rules": rules,
        "benchmark": mlcfg.BOOK_BENCHMARKS["clustering"],
    }
