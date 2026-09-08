"""Model evaluation: metrics, confusion matrices, ROC curves, importances."""

from __future__ import annotations

import time

import numpy as np
from sklearn.metrics import (
    accuracy_score, confusion_matrix, f1_score, precision_score,
    recall_score, roc_auc_score, roc_curve,
)
from sklearn.model_selection import cross_val_score


def compute_metrics(pipeline, X_train, y_train, X_test, y_test,
                    classes: list[str], cv_folds: int = 5) -> dict:
    """Full evaluation for one fitted pipeline (returns JSON-safe dict)."""
    start = time.perf_counter()
    y_pred = pipeline.predict(X_test)
    elapsed = time.perf_counter() - start

    proba = None
    if hasattr(pipeline, "predict_proba"):
        try:
            proba = pipeline.predict_proba(X_test)
        except Exception:  # some estimators cannot emit probabilities
            proba = None

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision_macro": round(float(precision_score(y_test, y_pred, average="macro", zero_division=0)), 4),
        "recall_macro": round(float(recall_score(y_test, y_pred, average="macro", zero_division=0)), 4),
        "f1_macro": round(float(f1_score(y_test, y_pred, average="macro", zero_division=0)), 4),
        "train_seconds": round(elapsed, 3),
        "test_size": int(len(y_test)),
    }

    if proba is not None and len(classes) > 2:
        try:
            metrics["roc_auc_ovr"] = round(
                float(roc_auc_score(y_test, proba, multi_class="ovr", average="macro")), 4)
        except ValueError:
            metrics["roc_auc_ovr"] = None

    cv = cross_val_score(pipeline, X_train, y_train, cv=cv_folds, scoring="accuracy", n_jobs=-1)
    metrics["cv_accuracy_mean"] = round(float(cv.mean()), 4)
    metrics["cv_accuracy_std"] = round(float(cv.std()), 4)

    cm = confusion_matrix(y_test, y_pred, labels=classes)
    metrics["confusion_matrix"] = cm.tolist()

    per_class = {}
    for i, cls in enumerate(classes):
        tp = int(cm[i, i])
        fp = int(cm[:, i].sum() - cm[i, i])
        fn = int(cm[i, :].sum() - cm[i, i])
        per_class[cls] = {
            "precision": round(tp / (tp + fp), 4) if tp + fp else 0.0,
            "recall": round(tp / (tp + fn), 4) if tp + fn else 0.0,
            "support": int(cm[i, :].sum()),
        }
    metrics["per_class"] = per_class
    return metrics


def roc_curves(pipeline, X_test, y_test, classes: list[str]) -> dict:
    """One-vs-rest ROC curve points per class."""
    if not hasattr(pipeline, "predict_proba"):
        return {}
    try:
        proba = pipeline.predict_proba(X_test)
    except Exception:
        return {}
    curves = {}
    for i, cls in enumerate(classes):
        y_bin = (y_test == cls).astype(int)
        if y_bin.sum() == 0 or y_bin.sum() == len(y_bin):
            continue
        fpr, tpr, _ = roc_curve(y_bin, proba[:, i])
        idx = np.linspace(0, len(fpr) - 1, min(60, len(fpr))).astype(int)
        curves[cls] = {
            "fpr": [round(float(v), 4) for v in fpr[idx]],
            "tpr": [round(float(v), 4) for v in tpr[idx]],
        }
    return curves


def feature_importances(pipeline, classes_count: int = 3) -> dict[str, float] | None:
    """Extract importances from the final estimator, mapped to original
    feature names via the fitted ColumnTransformer."""
    clf = pipeline.named_steps.get("classifier")
    pre = pipeline.named_steps.get("preprocessor")
    if clf is None or pre is None:
        return None

    raw = None
    if hasattr(clf, "feature_importances_"):
        raw = np.asarray(clf.feature_importances_)
    elif hasattr(clf, "coef_"):
        coef = np.asarray(clf.coef_)
        raw = np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef).ravel()
    if raw is None:
        return None

    try:
        names = pre.get_feature_names_out()
    except Exception:
        return None

    agg: dict[str, float] = {}
    for name, value in zip(names, raw):
        # transformer prefixes look like "num__ndvi" / "cat__region_Amazon Basin"
        base = name.split("__", 1)[-1]
        if base.startswith("region_"):
            base = "region"
        agg[base] = agg.get(base, 0.0) + float(value)
    total = sum(agg.values()) or 1.0
    return {k: round(v / total, 4) for k, v in
            sorted(agg.items(), key=lambda kv: -kv[1])}
