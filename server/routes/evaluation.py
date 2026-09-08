"""Model evaluation routes: comparison, per-model artifacts, retraining."""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from server.ml import config as mlcfg
from server.ml.models import STATE, ensure_trained, train_all_models
from server.utils import responses

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])


@router.get("/summary")
def evaluation_summary():
    if not STATE["trained"]:
        return responses.err("Models are not trained yet", 503)
    models = []
    for key, spec in mlcfg.MODEL_REGISTRY.items():
        m = STATE["metrics"].get(key, {})
        models.append({
            "key": key,
            "name": spec["name"],
            "kind": spec["kind"],
            "accuracy": m.get("accuracy"),
            "precision_macro": m.get("precision_macro"),
            "recall_macro": m.get("recall_macro"),
            "f1_macro": m.get("f1_macro"),
            "roc_auc_ovr": m.get("roc_auc_ovr"),
            "cv_accuracy_mean": m.get("cv_accuracy_mean"),
            "cv_accuracy_std": m.get("cv_accuracy_std"),
            "train_seconds": m.get("train_seconds"),
            "per_class": m.get("per_class"),
            "confusion_matrix": m.get("confusion_matrix"),
        })
    return responses.ok({
        "models": models,
        "best_model": STATE["best_model"],
        "trained_at": STATE["trained_at"],
        "train_rows": STATE.get("train_rows"),
        "test_rows": STATE.get("test_rows"),
        "data_source": STATE.get("source"),
        "classes": mlcfg.CLASSES,
    })


@router.get("/confusion-matrix")
def confusion_matrix(model: str = Query("random_forest")):
    m = STATE["metrics"].get(model)
    if not m:
        return responses.err(f"No metrics for model '{model}'", 404)
    return responses.ok({
        "model": model,
        "classes": mlcfg.CLASSES,
        "matrix": m["confusion_matrix"],
    })


@router.get("/roc")
def roc(model: str = Query("random_forest")):
    curves = STATE["roc"].get(model)
    if curves is None:
        return responses.err(f"No ROC data for model '{model}'", 404)
    return responses.ok({"model": model, "curves": curves})


@router.get("/feature-importance")
def feature_importance(model: str = Query("random_forest"), top: int = Query(12, ge=3, le=27)):
    imp = STATE["importances"].get(model)
    if not imp:
        return responses.err(f"No importance data for model '{model}'", 404)
    items = list(imp.items())[:top]
    return responses.ok({
        "model": model,
        "importances": [{"feature": k, "importance": v} for k, v in items],
    })


class RetrainRequest(BaseModel):
    source: str = "raw"  # "raw" | "preprocessed"


@router.post("/retrain")
def retrain(req: RetrainRequest):
    try:
        state = train_all_models(source=req.source)
    except Exception as exc:
        return responses.err(f"Retraining failed: {exc}", 500)
    return responses.ok({
        "best_model": state["best_model"],
        "trained_at": state["trained_at"],
        "source": state["source"],
        "accuracy": {k: v["accuracy"] for k, v in state["metrics"].items()},
    }, message="All models retrained successfully")
