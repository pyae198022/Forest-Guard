"""Training manager: builds, trains, stores and serves all classification
pipelines. Holds a module-level APP_STATE so routes can access fitted models."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

from server.database import sqlite
from server.ml import config as mlcfg
from server.ml import evaluation
from server.ml.preprocessing import build_preprocessor
from server.utils import config

logger = logging.getLogger("forestguard.models")

ESTIMATORS = {
    "random_forest": RandomForestClassifier,
    "gradient_boosting": GradientBoostingClassifier,
    "decision_tree": DecisionTreeClassifier,
    "logistic_regression": LogisticRegression,
    "knn": KNeighborsClassifier,
}

STATE: dict[str, Any] = {
    "trained": False,
    "source": "raw",
    "metrics": {},
    "roc": {},
    "importances": {},
    "best_model": None,
    "trained_at": None,
}


def load_data(source: str = "raw") -> tuple[pd.DataFrame, pd.Series]:
    """Fetch training data from SQLite (raw or preprocessed variant)."""
    table = config.TABLE_PREPROCESSED if source == "preprocessed" else config.TABLE_RAW
    if source == "preprocessed" and not sqlite.is_seeded(table):
        logger.warning("No preprocessed table found - falling back to raw data")
        table = config.TABLE_RAW
    df = sqlite.load_dataframe(table)
    df = df.dropna(subset=[mlcfg.TARGET])
    X = df[mlcfg.FEATURES]
    y = df[mlcfg.TARGET].astype(str)
    return X, y


def train_all_models(source: str = "raw", persist: bool = True) -> dict:
    """Train every model in the registry and populate APP_STATE."""
    X, y = load_data(source)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=mlcfg.TEST_SIZE, random_state=mlcfg.RANDOM_STATE,
        stratify=y,
    )
    classes = sorted(y.unique().tolist())
    logger.info("Training %d models on %s data (%d rows)...",
                len(ESTIMATORS), source, len(X))

    metrics: dict[str, dict] = {}
    roc: dict[str, dict] = {}
    importances: dict[str, dict] = {}

    for key, spec in mlcfg.MODEL_REGISTRY.items():
        pre = build_preprocessor(scaling="standard", missing_strategy="mean")
        clf = ESTIMATORS[key](random_state=mlcfg.RANDOM_STATE, **spec["params"]) \
            if key not in ("knn",) else ESTIMATORS[key](**spec["params"])
        pipe = Pipeline([("preprocessor", pre), ("classifier", clf)])

        fit_start = datetime.now(timezone.utc)
        pipe.fit(X_train, y_train)
        fit_seconds = (datetime.now(timezone.utc) - fit_start).total_seconds()

        m = evaluation.compute_metrics(pipe, X_train, y_train, X_test, y_test, classes)
        m["train_seconds"] = round(m["train_seconds"] + fit_seconds, 3)
        metrics[key] = m
        roc[key] = evaluation.roc_curves(pipe, X_test, y_test, classes)
        imp = evaluation.feature_importances(pipe)
        if imp:
            importances[key] = imp

        if persist:
            joblib.dump(pipe, config.MODEL_DIR / f"{key}.joblib")
        logger.info("  %-20s accuracy=%.4f", spec["name"], m["accuracy"])

    best = max(metrics.items(), key=lambda kv: kv[1]["accuracy"])[0]

    STATE.update({
        "trained": True,
        "source": source,
        "metrics": metrics,
        "roc": roc,
        "importances": importances,
        "best_model": best,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "classes": classes,
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
    })

    if persist:
        config.MODEL_DIR.mkdir(parents=True, exist_ok=True)
        (config.MODEL_DIR / "state.json").write_text(json.dumps({
            "source": source,
            "best_model": best,
            "trained_at": STATE["trained_at"],
            "classes": classes,
            "train_rows": STATE["train_rows"],
            "test_rows": STATE["test_rows"],
            "metrics": metrics,
            "roc": roc,
            "importances": importances,
        }))
        sqlite.insert_run_log(config.TABLE_MODEL_RUNS, {
            "created_at": STATE["trained_at"],
            "source": source,
            "metrics_json": json.dumps({k: {"accuracy": v["accuracy"],
                                            "f1_macro": v["f1_macro"]} for k, v in metrics.items()}),
            "best_model": best,
        })
    return STATE


def ensure_trained() -> None:
    """Train on first boot; afterwards restore metrics from state.json (instant).
    Pipelines themselves are lazily loaded from joblib at prediction time."""
    config.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    state_path = config.MODEL_DIR / "state.json"
    artifacts_ready = all(
        (config.MODEL_DIR / f"{key}.joblib").exists() for key in ESTIMATORS
    )
    if artifacts_ready and state_path.exists():
        try:
            info = json.loads(state_path.read_text())
            STATE.update({
                "trained": True,
                "source": info.get("source", "raw"),
                "metrics": info.get("metrics", {}),
                "roc": info.get("roc", {}),
                "importances": info.get("importances", {}),
                "best_model": info.get("best_model"),
                "trained_at": info.get("trained_at"),
                "classes": info.get("classes", mlcfg.CLASSES),
                "train_rows": info.get("train_rows"),
                "test_rows": info.get("test_rows"),
            })
            logger.info("Restored model state from disk (best=%s) - instant boot",
                        info.get("best_model"))
            return
        except json.JSONDecodeError:
            logger.warning("state.json corrupted - retraining")
    train_all_models(source="raw")


def predict_with_model(model_key: str, records: list[dict]) -> list[dict]:
    """Predict one or many records with a named pipeline."""
    if not STATE["trained"]:
        raise RuntimeError("Models are not trained yet")
    if model_key not in ESTIMATORS:
        raise KeyError(f"Unknown model '{model_key}'")

    pipe: Pipeline = joblib.load(config.MODEL_DIR / f"{model_key}.joblib")
    X = pd.DataFrame(records)
    for col in mlcfg.FEATURES:
        if col not in X.columns:
            X[col] = np.nan
    X = X[mlcfg.FEATURES]

    proba = pipe.predict_proba(X)
    classes = list(pipe.classes_)
    preds = pipe.predict(X)
    out = []
    for i, row in X.iterrows():
        probabilities = {cls: round(float(p) * 100, 2)
                         for cls, p in zip(classes, proba[i])}
        pred = str(preds[i])
        contributions = _sensitivity_contributions(pipe, row, classes.index(pred))
        out.append({
            "prediction": pred,
            "confidence": probabilities[pred],
            "probabilities": probabilities,
            "contributions": contributions,
        })
    return out


def _sensitivity_contributions(pipe: Pipeline, row: pd.Series,
                               pred_idx: int, top_k: int = 5) -> list[dict]:
    """Model-agnostic local attribution: finite-difference sensitivity of the
    predicted-class probability to a small change in each numeric feature."""
    base_proba = float(pipe.predict_proba(row.to_frame().T)[0][pred_idx])
    numeric = [f for f in mlcfg.NUMERIC_FEATURES if pd.notna(row.get(f))]
    scores: list[dict] = []
    for feat in numeric:
        perturbed = row.copy()
        delta = max(abs(float(row[feat])) * 0.1, 1e-3)
        perturbed[feat] = float(row[feat]) + delta
        try:
            new_proba = float(pipe.predict_proba(perturbed.to_frame().T)[0][pred_idx])
        except Exception:
            continue
        scores.append({"feature": feat, "impact": round(new_proba - base_proba, 4)})
    scores.sort(key=lambda s: -abs(s["impact"]))
    return scores[:top_k]
