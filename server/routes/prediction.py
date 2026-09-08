"""Prediction routes — PJBook section 3.2 inference endpoints."""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel

from server.database import sqlite
from server.ml import config as mlcfg
from server.ml.models import load_raw, predict_with_model
from server.utils import config, responses

router = APIRouter(prefix="/api/prediction", tags=["prediction"])


class PredictRequest(BaseModel):
    model: str = "rf_top13"
    features: dict[str, float | int | str]


class BatchRequest(BaseModel):
    model: str = "rf_top13"
    rows: list[dict[str, float | int | str]]


MODEL_LABELS = {
    "rf_top13": "Random Forest — Top 13 (regression, book champion)",
    "rf_baseline": "Random Forest — Baseline (all 19 features)",
    "nn_top10": "Neural Network — Optimized Top 10 (regression)",
    "nn_baseline": "Neural Network — Baseline (regression)",
    "rf_clf_top10": "Random Forest Classifier — Top 10 (Low/High risk)",
    "rf_clf_baseline": "Random Forest Classifier — Baseline (Low/High risk)",
    "nn_clf_top10": "Neural Network Classifier — Optimized (Low/High)",
}


@router.get("/models")
def available_models():
    return responses.ok([
        {"key": key, "label": label,
         "task": "classification" if "clf" in key else "regression"}
        for key, label in MODEL_LABELS.items()
    ])


@router.get("/features")
def feature_metadata():
    """Slider metadata for all model inputs (19 candidates + the book's
    Table 4.1.1 addition Environmental_Impact_Score)."""
    df = load_raw()
    train = df[df["Year"] <= mlcfg.SPLIT_YEAR]
    cand = mlcfg.candidate_features(list(df.columns))
    extra = [f for f in ("Environmental_Impact_Score",) if f in df.columns]
    meta = []
    for f in cand + extra:
        s = train[f].dropna().astype(float)
        if f == "Year":
            meta.append({"name": f, "type": "slider", "min": 1990, "max": 2020,
                         "step": 1, "mean": round(float(s.mean()), 0),
                         "median": float(s.median())})
            continue
        q1, q3 = s.quantile([0.02, 0.98])
        iqr = q3 - q1
        meta.append({
            "name": f, "type": "slider",
            "min": round(float(max(s.min(), q1 - 1.5 * iqr)), 2),
            "max": round(float(min(s.max(), q3 + 1.5 * iqr)), 2),
            "mean": round(float(s.mean()), 2),
            "median": round(float(s.median()), 2),
            "step": round(max((q3 - q1) / 100, 0.01), 3),
        })
    return responses.ok({"features": meta,
                         "target": mlcfg.TARGET,
                         "classes": mlcfg.CLASS_LABELS})


@router.get("/presets")
def presets():
    """Contrasting Low-risk vs High-risk country-year profiles."""
    df = load_raw()
    train = df[df["Year"] <= mlcfg.SPLIT_YEAR]
    threshold = float(train[mlcfg.TARGET].median())
    low = train[train[mlcfg.TARGET] <= threshold]
    high = train[train[mlcfg.TARGET] > threshold]
    cand = mlcfg.candidate_features(list(df.columns))
    extra = [f for f in ("Environmental_Impact_Score",) if f in df.columns]

    def build(base: pd.Series) -> dict:
        out: dict[str, float | int] = {}
        for f in cand + extra:
            v = base[f]
            if f == "Year":
                out[f] = int(round(v))
            else:
                out[f] = float(np.round(v, 2))
        return out

    return responses.ok({
        "healthy": build(low.mean(numeric_only=True)),
        "degraded": build(high.mean(numeric_only=True)),
        "healthy_label": "Low-risk profile (mean of Low class)",
        "degraded_label": "High-risk profile (mean of High class)",
        "threshold": threshold,
    })


@router.post("/predict")
def predict(req: PredictRequest):
    try:
        result = predict_with_model(req.model, [req.features])
    except KeyError as exc:
        return responses.err(str(exc), 404)
    except RuntimeError as exc:
        return responses.err(str(exc), 503)
    except Exception as exc:
        return responses.err(f"Prediction failed: {exc}", 500)
    return responses.ok(result[0])


@router.post("/predict-batch")
def predict_batch(req: BatchRequest):
    if not req.rows:
        return responses.err("No rows supplied", 422)
    try:
        results = predict_with_model(req.model, req.rows)
    except KeyError as exc:
        return responses.err(str(exc), 404)
    except RuntimeError as exc:
        return responses.err(str(exc), 503)
    if results and results[0]["task"] == "classification":
        dist = pd.Series([r["prediction"] for r in results]).value_counts().to_dict()
    else:
        dist = None
    return responses.ok({"count": len(results), "distribution": dist,
                         "results": results})
