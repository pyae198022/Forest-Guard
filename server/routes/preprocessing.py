"""Preprocessing routes — PJBook section 2.2 pipeline."""

from __future__ import annotations

from fastapi import APIRouter

from server.database import sqlite
from server.ml import config as mlcfg
from server.ml import preprocessing as mlprep
from server.utils import config, responses

router = APIRouter(prefix="/api/preprocessing", tags=["preprocessing"])

_PIPELINE_CACHE: dict | None = None


def _df():
    return sqlite.load_dataframe(config.TABLE_RAW)


@router.get("/overview")
def overview():
    """Book 2.2.1/2.2.2/2.2.4 — full pipeline report (no side effects)."""
    df = _df()
    leak = [{
        "feature": f,
        "spearman_with_target": round(float(
            df[f].corr(df[mlcfg.TARGET], method="spearman")), 4)
    } for f in mlcfg.LEAKAGE_FEATURES]
    return responses.ok({
        "quality": mlprep.quality_report(df),
        "skewness": mlprep.skewness_report(df),
        "onehot": mlprep.onehot_summary(df),
        "minmax": mlprep.minmax_preview(df),
        "leakage_excluded": leak,
        "rationale": ("Section 3.2.2 — downstream effects / target-derived "
                      "scores are removed to prevent target leakage and "
                      "look-ahead bias."),
        "split": {"rule": f"train Year <= {mlcfg.SPLIT_YEAR}, "
                          f"test Year > {mlcfg.SPLIT_YEAR}",
                  "train_rows": int((df["Year"] <= mlcfg.SPLIT_YEAR).sum()),
                  "test_rows": int((df["Year"] > mlcfg.SPLIT_YEAR).sum())},
    })


@router.post("/run")
def run(refresh: bool = False):
    """Execute the full book pipeline: quality -> log1p -> one-hot ->
    min-max -> hybrid feature ranking -> temporal subset validation.
    Results are cached in-process (the panel is static) so repeat runs
    return instantly; pass ?refresh=true to force a recompute."""
    global _PIPELINE_CACHE
    if _PIPELINE_CACHE is not None and not refresh:
        return responses.ok({**_PIPELINE_CACHE, "cached": True})
    df = _df()
    quality = mlprep.quality_report(df)
    skew = mlprep.skewness_report(df)
    onehot = mlprep.onehot_summary(df)
    minmax = mlprep.minmax_preview(df)
    hybrid = mlprep.hybrid_scores(df)
    validation = mlprep.temporal_validation(df, hybrid["ranking_order"])

    steps = [
        {"step": 1, "name": "Data quality audit (2.2.1)",
         "detail": f"{quality['total_records']} records x "
                   f"{quality['total_attributes']} attributes · "
                   f"missing={quality['missing_values']} · "
                   f"duplicates={quality['duplicate_records']}"},
        {"step": 2, "name": "log1p transform (2.2.2)",
         "detail": "Applied to the 5 highly skewed features "
                   "(skew ~10.6 -> ~0)"},
        {"step": 3, "name": "One-hot encoding (2.2.2)",
         "detail": f"{onehot['features_encoded']} -> "
                   f"+{onehot['dummy_columns']} dummy columns"},
        {"step": 4, "name": "Min-Max scaling (2.2.4)",
         "detail": "Fit on the training split only (no future leakage)"},
        {"step": 5, "name": "Hybrid feature ranking (2.2.3)",
         "detail": "Spearman + Mutual Information + RF permutation "
                   "importance over 19 candidates"},
        {"step": 6, "name": "Temporal subset validation (2.2.3)",
         "detail": f"Subset sizes {mlcfg.SUBSET_SIZES}+all validated on "
                   "2012-2015 window"},
    ]
    result = {
        "quality": quality, "skewness": skew, "onehot": onehot,
        "minmax": minmax, "hybrid_ranking": hybrid["ranking"],
        "candidates": hybrid["candidates"],
        "validation": validation, "steps": steps,
    }
    _PIPELINE_CACHE = result
    return responses.ok({**result, "cached": False})
