"""Descriptive-mining routes — PJBook section 3.1 (AR + K-Means).

Production note: association mining and K-Means are CPU-heavy (~10 s and
~4 s for the full panel).  They are computed ONCE at boot (`warm()`) and
served from memory there-after; the heavy results are also snapshotted to
disk so a restarted instance re-uses them instead of recomputing inline.
A request-time recompute on Render's free tier would blow through the host
proxy's timeout and surface as a 502 to the browser.
"""

from __future__ import annotations

import logging

from joblib import dump, load as jload
from fastapi import APIRouter, Query

from server.database import sqlite
from server.ml import associate
from server.ml.cluster import run_clustering
from server.utils import config, responses

router = APIRouter(prefix="/api/mining", tags=["mining"])

logger = logging.getLogger("forestguard.mining")

_CACHE: dict = {"ar": None, "cluster": {}}
_AR_CACHE_PATH = config.MODEL_DIR / "ar_cache.joblib"
_CLUSTER_CACHE_PATH = config.MODEL_DIR / "cluster_cache.joblib"


def _df():
    return sqlite.load_dataframe(config.TABLE_RAW)


def _snapshot_path(path, calc):
    """Return cached value when a snapshot exists, else compute + persist it."""
    try:
        if path.exists():
            return jload(path)
    except Exception:  # noqa: BLE001 — corrupt cache → recompute
        logger.exception("Mining cache unreadable, recomputing: %s", path)
    result = calc()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        dump(result, path)
    except Exception:  # noqa: BLE001 — persistence is best-effort
        pass
    return result


def warm() -> None:
    """Boot-time precompute of association mining + default clustering."""
    _CACHE["ar"] = _snapshot_path(
        _AR_CACHE_PATH, lambda: associate.run_association_mining(_df()))
    auto = _snapshot_path(
        _CLUSTER_CACHE_PATH, lambda: run_clustering(_df()) or {})
    _CACHE["cluster"]["auto"] = auto


def _ensure_ar() -> dict:
    if _CACHE["ar"] is None:
        _CACHE["ar"] = _snapshot_path(
            _AR_CACHE_PATH, lambda: associate.run_association_mining(_df()))
    return _CACHE["ar"]


def _headline(ar: dict) -> list[dict]:
    """Auto-generated reading of the strongest patterns (book narrative)."""
    notes = []
    if ar["rules"]:
        top = ar["rules"][0]
        notes.append({
            "title": "Strongest rule by lift",
            "text": f"{' + '.join(top['antecedents'])} -> "
                    f"{' + '.join(top['consequents'])} "
                    f"(support {top['support']}, confidence {top['confidence']}, "
                    f"lift {top['lift']}).",
        })
    pairs = [i for i in ar["frequent_itemsets"] if i["k"] == 2]
    if pairs:
        p = pairs[0]
        notes.append({
            "title": "Most frequent paired condition",
            "text": f"{' + '.join(p['items'])} occurs in "
                    f"{round(p['support'] * 100, 1)}% of records.",
        })
    return notes


@router.get("/association/overview")
def association_overview():
    """Book 3.1.1.1/3.1.1.3 — parameters, basket size, headline numbers."""
    ar = _ensure_ar()
    return responses.ok({
        "params": ar["params"],
        "n_itemsets": ar["n_itemsets"],
        "n_rules": ar["n_rules"],
        "top_single_items": ar["top_single_items"],
        "headline": _headline(ar),
    })


@router.get("/association/itemsets")
def association_itemsets(top: int = Query(15, ge=5, le=40)):
    """Figure 3.1.1.1 — frequent itemsets ranked by support."""
    ar = _ensure_ar()
    return responses.ok({"itemsets": ar["frequent_itemsets"][:top]})


@router.get("/association/scatter")
def association_scatter():
    """Figure 3.1.1.2 — support vs confidence, coloured by lift."""
    ar = _ensure_ar()
    pts = [{"support": r["support"], "confidence": r["confidence"],
            "lift": r["lift"]}
           for r in ar["scatter_points"]]
    return responses.ok({"points": pts})


@router.get("/association/rules")
def association_rules(top: int = Query(10, ge=3, le=30)):
    """Figure 3.1.1.3 — top rules by lift with all five metrics."""
    ar = _ensure_ar()
    return responses.ok({
        "rules": ar["rules"][:top],
        "n_rules": ar["n_rules"],
    })


@router.post("/clustering")
def clustering(k: int | None = Query(None, ge=2, le=10)):
    """Book 3.1.2 — K-Means with K-selection, profiles, PCA view."""
    key = str(k) if k else "auto"
    # precompute the auto (optimal-k) run at boot so the common path is instant
    if key == "auto" and _CACHE["cluster"].get("auto") is None:
        _CACHE["cluster"]["auto"] = _snapshot_path(
            _CLUSTER_CACHE_PATH, lambda: run_clustering(_df()))
    if key not in _CACHE["cluster"]:
        _CACHE["cluster"][key] = run_clustering(_df(), k)
    return responses.ok(_CACHE["cluster"][key])