"""ForestGuard — PJBook section 3.2 modelling layer.

Implements the book's supervised pipeline:

    * strict temporal split            train: Year <= 2015, test: Year > 2015
    * leakage-free feature sets        5 target-derived columns excluded
    * binary risk target               threshold = TRAIN median of
                                       Deforestation_Ha  (Low / High)
    * Min-Max scaling                  fit on the training split only
    * regression models                RF baseline / RF Top-13 / RF AR-Top-10
                                       MLP baseline / MLP Top-10
                                       (target trained on log1p scale,
                                        test metrics reported in hectares)
    * classification models            RF baseline / RF Top-10 / RF AR-Top-10
                                       MLP baseline / MLP Top-10
    * 5-fold cross-validation          on the TRAINING split only
    * ROC-AUC + confusion matrix       for every classifier

Fitted artefacts are persisted with joblib; headline metrics live in
state.json so restarts are instant.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (accuracy_score, balanced_accuracy_score,
                             confusion_matrix, f1_score,
                             mean_absolute_error, mean_squared_error,
                             precision_score, r2_score, recall_score,
                             roc_auc_score, roc_curve)
from sklearn.model_selection import KFold, StratifiedKFold
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.preprocessing import MinMaxScaler

from server.database import sqlite
from server.ml import config as mlcfg
from server.ml import preprocessing as mlprep
from server.utils import config as utils_cfg

# Book Table 4.1.1 — the exact Top-13 subset the project book selected
# (items 1-13 in ranked order).  Used as the pinned "optimized" feature
# subsets so the app reproduces the book's champion models.
BOOK_TOP13 = [
    "PM25_Mean_Exposure_ug_m3",
    "Biodiversity_Impact_Index",
    "Forest_Cover_Pct",
    "Extreme_Heat_Days_Count",
    "Environmental_Impact_Score",
    "Population_Density",
    "Agricultural_Land_Pct",
    "Poverty_Rate_Pct",
    "Employment_Agri_Pct",
    "Forest_Fragmentation_Index",
    "IUCN_Threatened_Species_Count",
    "GDP_Per_Capita",
    "Temperature_Anomaly_C",
]
BOOK_TOP10 = BOOK_TOP13[:10]

STATE: dict = {"trained": False, "best_model": None}

MODEL_DIR = utils_cfg.MODEL_DIR
STATE_PATH = MODEL_DIR / "state.json"

# ------------------------------------------------------------- run caches ----
# Trained artefacts, state and training medians are loaded ONCE and reused for
# the life of the process.  On Render's free tier (very low CPU/memory) a
# per-request re-load of the ~30 MB joblib bundle would routinely exceed the
# platform's request timeout and surface as 502/504, so `predict()` must never
# re-read these from disk.
_ARTEFACTS: dict | None = None
_STATE_CACHE: dict | None = None
_MEDIANS_CACHE: dict | None = None
_LOAD_LOCK = threading.Lock()
logger = logging.getLogger("forestguard.models")


def load_artefacts():
    """Load the trained bundle once (thread-safe) and return the cached copy."""
    global _ARTEFACTS
    if _ARTEFACTS is None:
        with _LOAD_LOCK:
            if _ARTEFACTS is None:
                _ARTEFACTS = joblib.load(MODEL_DIR / "forestguard_pjbook.joblib")
    return _ARTEFACTS


def load_state() -> dict | None:
    """Read state.json once and cache it (avoids re-parsing on hot paths)."""
    global _STATE_CACHE
    if _STATE_CACHE is None:
        if not STATE_PATH.exists():
            return None
        try:
            _STATE_CACHE = json.loads(STATE_PATH.read_text())
        except Exception:
            _STATE_CACHE = {}
    return _STATE_CACHE


def _load_medians() -> dict:
    """Training-split per-feature medians used to impute missing inputs."""
    global _MEDIANS_CACHE
    if _MEDIANS_CACHE is None:
        with _LOAD_LOCK:
            if _MEDIANS_CACHE is None:
                df = load_raw()
                tr = df[df["Year"] <= mlcfg.SPLIT_YEAR]
                feats = load_artefacts()["all_feats"]
                _MEDIANS_CACHE = {
                    f: float(tr[f].median()) for f in feats
                }
    return _MEDIANS_CACHE


def preload() -> None:
    """Force every runtime-cached artefact into memory (called at boot).

    Also verifies the persisted files exist so boot fails fast with a clear
    error instead of a confused 404/500 later.
    """
    art = load_artefacts()
    if not art.get("models"):
        raise RuntimeError(
            "Model artefact 'forestguard_pjbook.joblib' exists but contains "
            "no fitted models - retrain locally and redeploy")
    state = load_state()
    if not state:
        raise RuntimeError(
            "Model state file 'state.json' is missing - retrain locally and "
            "redeploy")
    _load_medians()
    logger.info(
        "Model artefacts preloaded (%d regressors, %d classifiers)",
        len(art["models"]["regression"]),
        len(art["models"]["classification"]))


# ============================================================== dataset ====
def load_raw() -> pd.DataFrame:
    return sqlite.load_dataframe(utils_cfg.TABLE_RAW)


def prepare_splits(df: pd.DataFrame) -> dict:
    """Temporal split + threshold target + scaling (fit on train only)."""
    cand = mlcfg.candidate_features(list(df.columns))
    # every column any model may consume (book Top-13 adds EIS on top of
    # the leakage-filtered candidate pool)
    all_feats = list(dict.fromkeys(
        cand + [f for f in BOOK_TOP13 if f in df.columns]))
    train = df[df["Year"] <= mlcfg.SPLIT_YEAR].copy()
    test = df[df["Year"] > mlcfg.SPLIT_YEAR].copy()

    threshold = float(train[mlcfg.TARGET].median())
    for part in (train, test):
        part["risk_class"] = np.where(
            part[mlcfg.TARGET] <= threshold,
            mlcfg.CLASS_LABELS[0], mlcfg.CLASS_LABELS[1])

    scaler = MinMaxScaler().fit(train[all_feats].astype(float))
    X_train = pd.DataFrame(scaler.transform(train[all_feats].astype(float)),
                           columns=all_feats, index=train.index)
    X_test = pd.DataFrame(scaler.transform(test[all_feats].astype(float)),
                          columns=all_feats, index=test.index)

    class_dist = {
        "train": {"Low": int((train["risk_class"] == "Low").sum()),
                  "High": int((train["risk_class"] == "High").sum())},
        "test": {"Low": int((test["risk_class"] == "Low").sum()),
                 "High": int((test["risk_class"] == "High").sum())},
    }
    return {
        "candidates": cand, "train": train, "test": test,
        "X_train": X_train, "X_test": X_test, "scaler": scaler,
        "threshold": threshold, "class_distribution": class_dist,
    }


# ================================================================ models ====
def _make_model(kind: str, task: str):
    if task == "regression":
        if kind == "rf":
            return RandomForestRegressor(**mlcfg.RF_PARAMS)
        return MLPRegressor(**mlcfg.MLP_REG_PARAMS)
    if kind == "rf":
        return RandomForestClassifier(**mlcfg.RF_CLF_PARAMS)
    return MLPClassifier(**mlcfg.MLP_CLF_PARAMS)


def _regression_metrics(y_true_ha: np.ndarray, pred_log: np.ndarray) -> dict:
    """Test-set regression metrics reported in ORIGINAL hectares
    (predictions are inverse-log1p transformed first, book section 3.2.3.1)."""
    pred_ha = np.expm1(np.clip(pred_log, 0, 25))
    return {
        "mae": round(float(mean_absolute_error(y_true_ha, pred_ha)), 2),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true_ha, pred_ha))), 2),
        "r2": round(float(r2_score(y_true_ha, pred_ha)), 6),
    }


def _classification_metrics(y_true: np.ndarray, pred: np.ndarray,
                            prob: np.ndarray | None = None) -> dict:
    out = {
        "accuracy": round(float(accuracy_score(y_true, pred)), 6),
        "balanced_accuracy": round(float(balanced_accuracy_score(y_true, pred)), 6),
        "macro_precision": round(float(precision_score(y_true, pred, average="macro")), 6),
        "macro_recall": round(float(recall_score(y_true, pred, average="macro")), 6),
        "macro_f1": round(float(f1_score(y_true, pred, average="macro")), 6),
    }
    if prob is not None and prob.ndim == 2 and prob.shape[1] == 2:
        try:
            out["auc"] = round(float(roc_auc_score(y_true, prob[:, 1])), 6)
        except ValueError:
            pass
    return out


def train_all(df_raw: pd.DataFrame, ar_ranking: list[str]) -> dict:
    """Train every PJBook model; return the full evaluation bundle."""
    split = prepare_splits(df_raw)
    cand = split["candidates"]
    hybrid = mlprep.hybrid_scores(df_raw)
    rank = hybrid["ranking_order"]

    top13 = [f for f in BOOK_TOP13 if f in df_raw.columns]
    top10 = [f for f in BOOK_TOP10 if f in df_raw.columns]
    ar10 = [f for f in ar_ranking if f in cand][:10] or top10

    feature_sets = {
        "baseline": cand,
        "top13": top13,       # book Table 4.1.1 (pinned)
        "top10": top10,       # book Table 4.1.1 items 1-10 (pinned)
        "ar_top10": ar10,     # computed from our association mining
        "computed_top13": rank[:13],
        "computed_top10": rank[:10],
    }
    reg_models = {
        "rf_baseline":  ("rf", "baseline"),
        "rf_top13":     ("rf", "top13"),
        "rf_ar_top10":  ("rf", "ar_top10"),
        "nn_baseline":  ("mlp", "baseline"),
        "nn_top10":     ("mlp", "top10"),
    }
    clf_models = {
        "rf_clf_baseline": ("rf", "baseline"),
        "rf_clf_top10":    ("rf", "top10"),
        "rf_clf_ar_top10": ("rf", "ar_top10"),
        "nn_clf_baseline": ("mlp", "baseline"),
        "nn_clf_top10":    ("mlp", "top10"),
    }

    y_tr_log = np.log1p(split["train"][mlcfg.TARGET].astype(float).values)
    y_te_ha = split["test"][mlcfg.TARGET].astype(float).values
    y_tr_cl = split["train"]["risk_class"].values
    y_te_cl = split["test"]["risk_class"].values

    results = {"regression": {}, "classification": {}}
    fitted = {"regression": {}, "classification": {}}
    roc_data: dict[str, dict] = {}

    def train_one(name: str, kind: str, fs_key: str, task: str):
        feats = feature_sets[fs_key]
        Xtr, Xte = split["X_train"][feats], split["X_test"][feats]
        model = _make_model(kind, task)
        t0 = time.time()
        if task == "regression":
            model.fit(Xtr, y_tr_log)
            pred = model.predict(Xte)
            metrics = _regression_metrics(y_te_ha, pred)
        else:
            model.fit(Xtr, y_tr_cl)
            pred = model.predict(Xte)
            prob = (model.predict_proba(Xte)
                    if hasattr(model, "predict_proba") else None)
            metrics = _classification_metrics(y_te_cl, pred, prob)
            if prob is not None and prob.shape[1] == 2:
                fpr, tpr, _ = roc_curve(y_te_cl, prob[:, 1],
                                        pos_label="High")
                step = max(1, len(fpr) // 120)
                roc_data[name] = {
                    "fpr": [round(float(v), 4) for v in fpr[::step]],
                    "tpr": [round(float(v), 4) for v in tpr[::step]],
                    "auc": metrics.get("auc"),
                }
        metrics["train_seconds"] = round(time.time() - t0, 2)
        metrics["n_features"] = len(feats)
        metrics["features"] = feats
        return name, task, model, metrics

    jobs = ([(n, k, f, "regression") for n, (k, f) in reg_models.items()] +
            [(n, k, f, "classification") for n, (k, f) in clf_models.items()])
    with ThreadPoolExecutor(max_workers=4) as pool:
        for name, task, model, metrics in pool.map(
                lambda j: train_one(*j), jobs):
            results[task][name] = metrics
            fitted[task][name] = model

    # feature importance from the headline RF models
    importance = {}
    for key, label in (("rf_baseline", "regression"),
                       ("rf_clf_baseline", "classification")):
        model = fitted[label][key]
        if hasattr(model, "feature_importances_"):
            order = np.argsort(model.feature_importances_)[::-1]
            feats = results[label][key]["features"]
            importance[key] = [
                {"feature": feats[i],
                 "importance": round(float(model.feature_importances_[i]), 4)}
                for i in order[:15]
            ]

    return {"split": split, "hybrid": hybrid, "results": results,
            "fitted": fitted, "roc": roc_data, "importance": importance,
            "feature_sets": feature_sets}


# ======================================================= cross validation ====
def cross_validate(df_raw: pd.DataFrame, bundle: dict) -> dict:
    """5-fold CV on the TRAINING split only (book section 4.2.3)."""
    split = bundle["split"]
    cand = split["candidates"]
    rank = bundle["hybrid"]["ranking_order"]
    ar10 = bundle["feature_sets"]["ar_top10"]
    sets = {"baseline": cand, "top13": rank[:13], "top10": rank[:10],
            "ar_top10": ar10}

    train = split["train"]
    X_all = split["X_train"]
    y_log = np.log1p(train[mlcfg.TARGET].astype(float).values)
    y_cl = train["risk_class"].values

    cv_out = {"regression": {}, "classification": {}}

    reg_jobs = {"rf_baseline": ("rf", "baseline"),
                "rf_top13": ("rf", "top13"),
                "rf_ar_top10": ("rf", "ar_top10"),
                "nn_baseline": ("mlp", "baseline"),
                "nn_top10": ("mlp", "top10")}
    clf_jobs = {"rf_clf_baseline": ("rf", "baseline"),
                "rf_clf_top10": ("rf", "top10"),
                "rf_clf_ar_top10": ("rf", "ar_top10"),
                "nn_clf_baseline": ("mlp", "baseline"),
                "nn_clf_top10": ("mlp", "top10")}

    def cv_reg(name, kind, fs_key):
        feats = sets[fs_key]
        X = X_all[feats].values
        kf = KFold(n_splits=mlcfg.CV_FOLDS, shuffle=True,
                   random_state=mlcfg.CV_RANDOM_STATE)
        mae_l, rmse_l, r2_l = [], [], []
        for tr_i, va_i in kf.split(X):
            m = _make_model(kind, "regression")
            m.fit(X[tr_i], y_log[tr_i])
            p = m.predict(X[va_i])
            mae_l.append(mean_absolute_error(y_log[va_i], p))
            rmse_l.append(np.sqrt(mean_squared_error(y_log[va_i], p)))
            r2_l.append(r2_score(y_log[va_i], p))
        return name, {
            "mae": [round(float(np.mean(mae_l)), 4), round(float(np.std(mae_l)), 4)],
            "rmse": [round(float(np.mean(rmse_l)), 4), round(float(np.std(rmse_l)), 4)],
            "r2": [round(float(np.mean(r2_l)), 4), round(float(np.std(r2_l)), 4)],
        }

    def cv_clf(name, kind, fs_key):
        feats = sets[fs_key]
        X = X_all[feats].values
        skf = StratifiedKFold(n_splits=mlcfg.CV_FOLDS, shuffle=True,
                              random_state=mlcfg.CV_RANDOM_STATE)
        acc_l, bal_l, f1_l, auc_l = [], [], [], []
        for tr_i, va_i in skf.split(X, y_cl):
            m = _make_model(kind, "classification")
            m.fit(X[tr_i], y_cl[tr_i])
            p = m.predict(X[va_i])
            acc_l.append(accuracy_score(y_cl[va_i], p))
            bal_l.append(balanced_accuracy_score(y_cl[va_i], p))
            f1_l.append(f1_score(y_cl[va_i], p, average="macro"))
            if hasattr(m, "predict_proba"):
                pr = m.predict_proba(X[va_i])[:, 1]
                auc_l.append(roc_auc_score(y_cl[va_i], pr))
        fmt = lambda v: [round(float(np.mean(v)), 4), round(float(np.std(v)), 4)]
        out = {"accuracy": fmt(acc_l), "balanced_accuracy": fmt(bal_l),
               "macro_f1": fmt(f1_l)}
        if auc_l:
            out["auc"] = fmt(auc_l)
        return name, out

    with ThreadPoolExecutor(max_workers=4) as pool:
        reg_items = [(n, k, f) for n, (k, f) in reg_jobs.items()]
        clf_items = [(n, k, f) for n, (k, f) in clf_jobs.items()]
        for name, res in pool.map(lambda j: cv_reg(*j), reg_items):
            cv_out["regression"][name] = res
        for name, res in pool.map(lambda j: cv_clf(*j), clf_items):
            cv_out["classification"][name] = res
    return cv_out


# ============================================================= persistence ====
def save_bundle(bundle: dict, cv: dict) -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    split = bundle["split"]
    artefacts = {
        "scaler": split["scaler"],
        "threshold": split["threshold"],
        "candidates": split["candidates"],
        "all_feats": list(split["X_train"].columns),
        "models": bundle["fitted"],
        "feature_sets": bundle["feature_sets"],
    }
    joblib.dump(artefacts, MODEL_DIR / "forestguard_pjbook.joblib",
                compress=3)

    best_reg = max(bundle["results"]["regression"].items(),
                   key=lambda kv: kv[1]["r2"])
    best_clf = max(bundle["results"]["classification"].items(),
                   key=lambda kv: kv[1]["macro_f1"])
    state = {
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "best_regression": {"model": best_reg[0], **best_reg[1]},
        "best_classification": {"model": best_clf[0], **best_clf[1]},
        "threshold": split["threshold"],
        "class_distribution": split["class_distribution"],
        "feature_sets": {k: v for k, v in bundle["feature_sets"].items()},
        "hybrid_ranking": bundle["hybrid"]["ranking"],
        "importance": bundle["importance"],
        "results": bundle["results"],
        "cv": cv,
        "roc": bundle["roc"],
        "split_year": mlcfg.SPLIT_YEAR,
        "train_rows": int(len(split["train"])),
        "test_rows": int(len(split["test"])),
    }
    STATE_PATH.write_text(json.dumps(state, default=str))

    # invalidate the runtime caches so the freshly trained bundle is used
    global _ARTEFACTS, _STATE_CACHE, _MEDIANS_CACHE
    _ARTEFACTS = None
    _STATE_CACHE = state
    _MEDIANS_CACHE = None

    with sqlite.get_connection() as conn:
        conn.execute(
            f"INSERT INTO {utils_cfg.TABLE_MODEL_RUNS} "
            f"(created_at, source, metrics_json, best_model) "
            f"VALUES (datetime('now'), 'pjbook', ?, ?)",
            (json.dumps(state["results"]), best_clf[0]))
    STATE.update({"trained": True,
                  "best_model": best_clf[0],
                  "best_regression": state["best_regression"],
                  "best_classification": state["best_classification"]})


def load_state() -> dict | None:
    if not STATE_PATH.exists():
        return None
    try:
        return json.loads(STATE_PATH.read_text())
    except Exception:
        return None


def load_artefacts():
    return joblib.load(MODEL_DIR / "forestguard_pjbook.joblib")


# ================================================================ predict ====
def predict_with_model(model_key: str, rows: list[dict]) -> list[dict]:
    """Inference for the AI Prediction page.

    Rows contain raw candidate-feature values (any subset; missing ones are
    imputed with the training median).  Regression models return hectares
    (inverse log1p) plus the implied risk class; classifiers return the
    Low/High probability distribution.
    """
    art = load_artefacts()
    state = load_state() or {}
    models = art["models"]
    if model_key not in models["regression"] and model_key not in models["classification"]:
        raise KeyError(f"Unknown model '{model_key}'")

    task = ("classification" if model_key in models["classification"]
            else "regression")
    model = models[task][model_key]
    feats = art["feature_sets"][
        "ar_top10" if "ar_top10" in model_key else
        ("top13" if "top13" in model_key else
         ("top10" if "top10" in model_key else "baseline"))]

    X = pd.DataFrame(rows)
    full = art["all_feats"]
    for f in full:
        if f not in X.columns:
            X[f] = np.nan
    # impute missing with the training-split median (precomputed once)
    medians = _load_medians()
    for f in full:
        if X[f].isna().any():
            X[f] = X[f].fillna(medians[f])
    Xs_full = art["scaler"].transform(X[full].astype(float))
    Xs = pd.DataFrame(Xs_full, columns=full)[feats]

    threshold = float(art["threshold"])
    out = []
    if task == "regression":
        pred_log = model.predict(Xs)
        for p in pred_log:
            ha = float(np.expm1(np.clip(p, 0, 25)))
            out.append({
                "task": "regression", "model": model_key,
                "predicted_deforestation_ha": round(ha, 1),
                "implied_risk": ("High" if ha > threshold else "Low"),
            })
    else:
        pred = model.predict(Xs)
        prob = model.predict_proba(Xs)
        classes = list(model.classes_)
        for p, pr in zip(pred, prob):
            dist = {c: round(float(v), 4) for c, v in zip(classes, pr)}
            out.append({
                "task": "classification", "model": model_key,
                "prediction": str(p),
                "confidence": round(float(max(pr)), 4),
                "probabilities": [
                    {"class": c, "probability": round(float(v), 4)}
                    for c, v in zip(classes, pr)],
                "dist": dist,
            })
    return out


# ================================================================== boot ====
def ensure_trained(force: bool = False, with_cv: bool = True) -> dict:
    """Train everything (idempotent). Loads cached state when available."""
    if not force:
        cached = load_state()
        if cached:
            art_ok = (MODEL_DIR / "forestguard_pjbook.joblib").exists()
            if art_ok:
                STATE.update({"trained": True,
                              "best_model": cached["best_classification"]["model"],
                              "best_regression": cached["best_regression"],
                              "best_classification": cached["best_classification"]})
                return cached

    df = load_raw()
    from server.ml.associate import run_association_mining
    ar = run_association_mining(df, top_itemsets=8, top_rules=30)
    ar_ranking = []
    lift_acc: dict[str, float] = {}
    for rule in ar["rules"]:
        for item in rule["antecedents"] + rule["consequents"]:
            feat = item.rsplit("_", 1)[0]
            if feat in mlcfg.candidate_features(list(df.columns)):
                lift_acc[feat] = lift_acc.get(feat, 0.0) + rule["lift"]
    ar_ranking = sorted(lift_acc, key=lift_acc.get, reverse=True)[:10]

    bundle = train_all(df, ar_ranking)
    cv = cross_validate(df, bundle) if with_cv else {}
    save_bundle(bundle, cv)
    _LAST_BUNDLE = bundle  # noqa: F841 (available for immediate route use)
    return load_state()
