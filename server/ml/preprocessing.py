"""ForestGuard — PJBook section 2.2 preprocessing pipeline.

Steps (mirroring the project book):
    2.2.1  Missing-value inspection (dataset ships with zero NaN)
    2.2.2  log1p transform of highly skewed features + one-hot encoding
    2.2.4  Min-Max normalization (fit on the TRAINING split only)
    2.2.3  Hybrid feature selection:
             Spearman correlation + Mutual Information + RF permutation
             importance  ->  combined score  ->  subset sizes
             {5, 8, 10, 12, 15, all} validated on a time-based validation
             window carved out of the training period (2012-2015).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.feature_selection import mutual_info_regression
from sklearn.inspection import permutation_importance
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.ensemble import RandomForestRegressor

from server.ml import config as mlcfg


# ------------------------------------------------------------------ 2.2.1 --
def quality_report(df: pd.DataFrame) -> dict:
    """Book Table 2.1.3 — the data-quality audit."""
    per_col = {
        c: int(df[c].isna().sum()) for c in df.columns if df[c].isna().sum() > 0
    }
    return {
        "total_records": int(len(df)),
        "total_attributes": int(df.shape[1]),
        "missing_values": int(df.isna().sum().sum()),
        "missing_by_column": per_col,
        "duplicate_records": int(df.duplicated().sum()),
        "entity_year_duplicates": int(df.duplicated(subset=["Entity", "Year"]).sum()),
        "imputation_required": bool(df.isna().sum().sum() > 0),
    }


def skewness_report(df: pd.DataFrame) -> list[dict]:
    """Skewness before/after log1p for the book-listed skewed features."""
    rows = []
    for col in mlcfg.LOG1P_FEATURES:
        if col not in df.columns:
            continue
        s = df[col].astype(float)
        rows.append({
            "feature": col,
            "skew_before": round(float(s.skew()), 3),
            "skew_after": round(float(np.log1p(s).skew()), 3),
            "zeros": int((s == 0).sum()),
            "transformed": col != mlcfg.TARGET or True,
        })
    return rows


# ------------------------------------------------------------------ 2.2.2 --
def log1p_transform(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for col in mlcfg.LOG1P_FEATURES:
        if col in out.columns:
            out[col] = np.log1p(out[col].astype(float).clip(lower=0))
    return out


def onehot_summary(df: pd.DataFrame) -> dict:
    """Report the one-hot expansion of Entity/Region (book section 2.2.2)."""
    base = df.shape[1]
    expanded = pd.get_dummies(df[mlcfg.ONEHOT_FEATURES].astype(str),
                              prefix=mlcfg.ONEHOT_FEATURES)
    return {
        "features_encoded": mlcfg.ONEHOT_FEATURES,
        "columns_before": int(base),
        "columns_after": int(base + expanded.shape[1]),
        "dummy_columns": int(expanded.shape[1]),
    }


# ------------------------------------------------------------------ 2.2.4 --
def minmax_preview(df: pd.DataFrame, sample: int = 6) -> dict:
    cols = ["Population_Density", "GDP_Per_Capita", "Forest_Cover_Pct",
            "Precipitation_mm"]
    cols = [c for c in cols if c in df.columns]
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(df[cols])
    before = df[cols].head(sample).round(3)
    after = pd.DataFrame(scaled[:sample], columns=cols).round(3)
    return {
        "columns": cols,
        "before": before.to_dict(orient="records"),
        "after": after.to_dict(orient="records"),
        "min_": [round(float(v), 4) for v in scaler.data_min_],
        "max_": [round(float(v), 4) for v in scaler.data_max_],
    }


def fit_scalers(train_df: pd.DataFrame):
    """Fit Min-Max on numeric candidates strictly on the training split."""
    scaler = MinMaxScaler()
    scaler.fit(train_df[mlcfg.CANDIDATES])
    return scaler


# ------------------------------------------------------------------ 2.2.3 --
def hybrid_scores(df: pd.DataFrame) -> dict:
    """Spearman + Mutual Information + RF permutation importance.

    Returns per-candidate scores plus the normalised hybrid ranking used
    to build the Top-13 (regression) and Top-10 (classification) subsets.
    """
    cand = mlcfg.candidate_features(list(df.columns))
    X = df[cand].astype(float)
    y = df[mlcfg.TARGET].astype(float)

    # 1) Spearman correlation with the target
    spear = X.corrwith(y, method="spearman").abs()

    # 2) Mutual information (regression) on a sample for speed
    rs = 42
    idx = X.sample(n=min(1500, len(X)), random_state=rs).index
    mi = mutual_info_regression(X.loc[idx], y.loc[idx], random_state=rs)
    mi = pd.Series(mi, index=cand)

    # 3) RF permutation importance (small forest — this is a ranking aid)
    rf = RandomForestRegressor(n_estimators=80, max_depth=10,
                               min_samples_leaf=3, random_state=rs, n_jobs=-1)
    rf.fit(X, y)
    pi = permutation_importance(rf, X, y, n_repeats=3, random_state=rs,
                                n_jobs=-1, scoring="r2")
    perm = pd.Series(pi.importances_mean, index=cand)

    def norm(s: pd.Series) -> pd.Series:
        rng = s.max() - s.min()
        return (s - s.min()) / rng if rng > 0 else s * 0

    hybrid = 0.34 * norm(spear) + 0.33 * norm(mi) + 0.33 * norm(perm)
    ranking = (hybrid.sort_values(ascending=False)
               .rename("hybrid_score").reset_index()
               .rename(columns={"index": "feature"}))
    ranking["spearman"] = [round(float(spear[f]), 4) for f in ranking["feature"]]
    ranking["mutual_info"] = [round(float(mi[f]), 4) for f in ranking["feature"]]
    ranking["permutation"] = [round(float(perm[f]), 4) for f in ranking["feature"]]
    ranking["hybrid_score"] = ranking["hybrid_score"].round(4)
    return {
        "candidates": cand,
        "ranking": ranking.to_dict(orient="records"),
        "ranking_order": ranking["feature"].tolist(),
    }


def temporal_validation(df_raw: pd.DataFrame, ranking_order: list[str]) -> dict:
    """Evaluate subset sizes on a time-based validation window (2012-2015).

    Selection-train: 1990-2011 · validation: 2012-2015 (both inside the
    historical period, keeping the official test years untouched).
    Regression MAE/RMSE/R2 are computed on log1p scale, exactly like the
    book's model training regime.
    """
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

    tr = df_raw[df_raw["Year"] <= 2011]
    va = df_raw[(df_raw["Year"] > 2011) & (df_raw["Year"] <= mlcfg.SPLIT_YEAR)]

    tr_log = np.log1p(tr[mlcfg.TARGET].astype(float))
    va_log = np.log1p(va[mlcfg.TARGET].astype(float))

    scaler = MinMaxScaler().fit(tr[ranking_order].astype(float))
    Xtr = pd.DataFrame(scaler.transform(tr[ranking_order].astype(float)),
                       columns=ranking_order, index=tr.index)
    Xva = pd.DataFrame(scaler.transform(va[ranking_order].astype(float)),
                       columns=ranking_order, index=va.index)

    results = []
    sizes = sorted(set(mlcfg.SUBSET_SIZES + [len(ranking_order)]))
    for n in sizes:
        feats = ranking_order[:n]
        # lightweight RF sweep — the full protocol runs in the modelling layer
        rf = RandomForestRegressor(n_estimators=80, max_depth=10,
                                   min_samples_leaf=3, random_state=42,
                                   n_jobs=-1)
        rf.fit(Xtr[feats], tr_log)
        pred = rf.predict(Xva[feats])
        results.append({
            "n_features": int(n),
            "features": feats,
            "mae": round(float(mean_absolute_error(va_log, pred)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(va_log, pred))), 4),
            "r2": round(float(r2_score(va_log, pred)), 4),
        })
    best = min(results, key=lambda r: r["rmse"])
    return {"validation_split": {"selection_train": "1990-2011",
                                 "validation": "2012-2015"},
            "results": results, "best": best}


def association_based_ranking(df: pd.DataFrame, ar_result: dict | None = None):
    """Early selection attempt driven purely by association-rule evidence
    (book section 4.1.3): rank features by aggregated lift of the rules
    they participate in.  Returns a top-10 feature list."""
    if not ar_result or not ar_result.get("rules"):
        return []
    lift_acc: dict[str, float] = {}
    for rule in ar_result["rules"]:
        lift = float(rule.get("lift", 0.0))
        for item in rule.get("antecedents", []) + rule.get("consequents", []):
            feat = item.rsplit("_", 1)[0]
            if feat in mlcfg.candidate_features(list(df.columns)):
                lift_acc[feat] = lift_acc.get(feat, 0.0) + lift
    ranked = sorted(lift_acc, key=lift_acc.get, reverse=True)
    return ranked[:10]
