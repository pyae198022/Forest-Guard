"""Prediction routes: feature metadata for the form + single/batch inference."""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel

from server.database import sqlite
from server.ml import config as mlcfg
from server.ml.models import predict_with_model
from server.utils import config, responses

router = APIRouter(prefix="/api/prediction", tags=["prediction"])


class PredictRequest(BaseModel):
    model: str = "random_forest"
    features: dict[str, float | int | str]


class BatchRequest(BaseModel):
    model: str = "random_forest"
    rows: list[dict[str, float | int | str]]


@router.get("/models")
def available_models():
    return responses.ok([
        {"key": key, "name": spec["name"], "kind": spec["kind"]}
        for key, spec in mlcfg.MODEL_REGISTRY.items()
    ])


@router.get("/features")
def feature_metadata():
    """Feature metadata + sensible ranges so the UI can build sliders."""
    df = sqlite.load_dataframe(config.TABLE_RAW)
    meta = []
    for f in mlcfg.FEATURES:
        info = mlcfg.FEATURE_META[f]
        entry = {
            "name": f, "label": info["label"], "group": info["group"],
            "unit": info["unit"], "description": info["description"],
        }
        if f == "region":
            entry["type"] = "select"
            entry["options"] = sorted(df["region"].dropna().unique().tolist())
        elif f == "protected_area_flag":
            entry["type"] = "toggle"
            entry["default"] = 0
        else:
            s = df[f].dropna()
            q1, q3 = s.quantile([0.02, 0.98])
            iqr_span = q3 - q1
            entry.update({
                "type": "slider",
                "min": round(float(max(s.min(), q1 - 1.5 * iqr_span)), 2),
                "max": round(float(min(s.max(), q3 + 1.5 * iqr_span)), 2),
                "mean": round(float(s.mean()), 2),
                "median": round(float(s.median()), 2),
                "step": round(max((q3 - q1) / 100, 0.01), 3),
            })
        meta.append(entry)
    return responses.ok(meta)


@router.post("/predict")
def predict(req: PredictRequest):
    try:
        results = predict_with_model(req.model, [req.features])
    except KeyError as exc:
        return responses.err(str(exc), 404)
    except RuntimeError as exc:
        return responses.err(str(exc), 503)
    except Exception as exc:
        return responses.err(f"Prediction failed: {exc}", 500)
    return responses.ok(results[0])


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
    return responses.ok({
        "count": len(results),
        "distribution": pd.Series([r["prediction"] for r in results]).value_counts().to_dict(),
        "results": results,
    })


@router.get("/presets")
def presets():
    """Two contrasting example profiles for one-click demos."""
    df = sqlite.load_dataframe(config.TABLE_RAW)
    healthy = df[df[mlcfg.TARGET] == "Low"].mean(numeric_only=True)
    degraded = df[df[mlcfg.TARGET] == "High"].mean(numeric_only=True)

    def build(base: pd.Series) -> dict:
        out: dict[str, float | int | str] = {}
        for f in mlcfg.FEATURES:
            if f == "region":
                continue
            if f == "protected_area_flag":
                out[f] = int(round(base[f]))
            else:
                out[f] = float(np.round(base[f], 2))
        return out

    return responses.ok({
        "healthy": build(healthy),
        "degraded": build(degraded),
        "healthy_region": str(df[df[mlcfg.TARGET] == "Low"]["region"].mode().iloc[0]),
        "degraded_region": str(df[df[mlcfg.TARGET] == "High"]["region"].mode().iloc[0]),
    })
