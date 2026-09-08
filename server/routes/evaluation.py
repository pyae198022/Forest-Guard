"""Model-evaluation routes — PJBook Chapter 4."""

from __future__ import annotations

from fastapi import APIRouter, Query

from server.ml import config as mlcfg
from server.ml.models import (ensure_trained, load_artefacts, load_state)
from server.utils import responses

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


def _state() -> dict:
    state = load_state()
    if not state:
        state = ensure_trained()
    return state


@router.get("/summary")
def summary():
    """Headline results — best regression + best classification + split."""
    st = _state()
    return responses.ok({
        "split_year": st.get("split_year", mlcfg.SPLIT_YEAR),
        "train_rows": st.get("train_rows"),
        "test_rows": st.get("test_rows"),
        "class_distribution": st.get("class_distribution"),
        "threshold": st.get("threshold"),
        "best_regression": st.get("best_regression"),
        "best_classification": st.get("best_classification"),
        "trained_at": st.get("trained_at"),
    })


@router.get("/regression-comparison")
def regression_comparison():
    """Tables 4.1.1.2 / 4.1.3 / 4.1.5 — all five regression models."""
    st = _state()
    rows = []
    labels = {
        "rf_baseline": "Random Forest Deforestation Baseline",
        "rf_top13": "Random Forest — Top 13 Features",
        "rf_ar_top10": "Selected RF — Association Top 10",
        "nn_baseline": "Neural Network — Deforestation Baseline",
        "nn_top10": "Neural Network — Optimized (Top 10)",
    }
    for key, label in labels.items():
        m = st["results"]["regression"].get(key, {})
        book = mlcfg.BOOK_BENCHMARKS["regression"].get(key)
        rows.append({
            "model": key, "label": label,
            "mae": m.get("mae"), "rmse": m.get("rmse"), "r2": m.get("r2"),
            "n_features": m.get("n_features"),
            "train_seconds": m.get("train_seconds"),
            "book": book,
        })
    rows.sort(key=lambda r: -(r["r2"] or 0))
    return responses.ok({"rows": rows})


@router.get("/classification-comparison")
def classification_comparison():
    """Tables 4.1.2 / 4.1.4 / 4.1.6 — all five classification models."""
    st = _state()
    labels = {
        "rf_clf_baseline": "RF Classification — Baseline",
        "rf_clf_top10": "RF Classification — Top 10 Features",
        "rf_clf_ar_top10": "Hybrid Association + RF Classifier",
        "nn_clf_baseline": "Neural Network (MLP) — Baseline",
        "nn_clf_top10": "Neural Network (MLP) — Optimized",
    }
    rows = []
    for key, label in labels.items():
        m = st["results"]["classification"].get(key, {})
        book = mlcfg.BOOK_BENCHMARKS["classification"].get(key)
        rows.append({
            "model": key, "label": label,
            "accuracy": m.get("accuracy"),
            "balanced_accuracy": m.get("balanced_accuracy"),
            "macro_precision": m.get("macro_precision"),
            "macro_recall": m.get("macro_recall"),
            "macro_f1": m.get("macro_f1"),
            "auc": m.get("auc"),
            "n_features": m.get("n_features"),
            "book": book,
        })
    rows.sort(key=lambda r: -(r["macro_f1"] or 0))
    return responses.ok({"rows": rows})


@router.get("/roc")
def roc():
    """Figure 4.2.2 — ROC curves with AUC for every classifier."""
    st = _state()
    return responses.ok({"curves": st.get("roc", {}),
                         "benchmarks": mlcfg.BOOK_BENCHMARKS["roc_auc"]})


@router.get("/confusion-matrix")
def confusion_matrix_endpoint(model: str = Query("rf_clf_top10")):
    """Confusion matrix for a chosen classifier (recomputed on the test set)."""
    st = _state()
    reg = st["results"]["classification"]
    if model not in reg:
        return responses.err(f"Unknown classifier '{model}'", 404)
    import numpy as np
    from sklearn.metrics import confusion_matrix as cm_fn
    art = load_artefacts()
    from server.ml.models import load_raw, prepare_splits
    split = prepare_splits(load_raw())
    feats = reg[model]["features"]
    model_obj = art["models"]["classification"][model]
    pred = model_obj.predict(split["X_test"][feats])
    labels = mlcfg.CLASS_LABELS
    cm = cm_fn(split["test"]["risk_class"], pred, labels=labels)
    tn, fp, fn, tp = int(cm[0][0]), int(cm[0][1]), int(cm[1][0]), int(cm[1][1])
    return responses.ok({
        "model": model, "labels": labels,
        "matrix": [[tn, fp], [fn, tp]],
        "tn": tn, "fp": fp, "fn": fn, "tp": tp,
        "test_rows": int(len(split["test"])),
    })


@router.get("/cross-validation")
def cross_validation():
    """Tables 4.2.3.1/4.2.3.2 — 5-fold CV on the training split (mean±std)."""
    st = _state()
    return responses.ok({
        "folds": mlcfg.CV_FOLDS,
        "regression": st.get("cv", {}).get("regression", {}),
        "classification": st.get("cv", {}).get("classification", {}),
        "note": ("Regression CV is scored on the log1p target (training "
                 "regime) and is not directly comparable with the "
                 "hectares-scale test metrics."),
    })


@router.get("/feature-importance")
def feature_importance():
    """RF feature importances for the headline baseline models."""
    st = _state()
    return responses.ok({
        "regression": st.get("importance", {}).get("rf_baseline", []),
        "classification": st.get("importance", {}).get("rf_clf_baseline", []),
        "hybrid_ranking": st.get("hybrid_ranking", [])[:19],
    })


@router.get("/feature-sets")
def feature_sets():
    """The three feature subsets used by the book's model families."""
    st = _state()
    return responses.ok({
        "baseline_all": st.get("feature_sets", {}).get("baseline", []),
        "top13_regression": st.get("feature_sets", {}).get("top13", []),
        "top10_classification": st.get("feature_sets", {}).get("top10", []),
        "ar_top10": st.get("feature_sets", {}).get("ar_top10", []),
    })


@router.post("/retrain")
def retrain(with_cv: bool = True):
    """Full PJBook re-run: temporal split -> train -> CV -> persist."""
    state = ensure_trained(force=True, with_cv=with_cv)
    return responses.ok({
        "best_model": state["best_classification"]["model"],
        "trained_at": state.get("trained_at"),
        "best_regression": state.get("best_regression"),
        "best_classification": state.get("best_classification"),
    })
