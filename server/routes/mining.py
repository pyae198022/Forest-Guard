"""Descriptive-mining routes — PJBook section 3.1 (AR + K-Means)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from server.database import sqlite
from server.ml import associate
from server.ml.cluster import run_clustering
from server.utils import config, responses

router = APIRouter(prefix="/api/mining", tags=["mining"])

_CACHE: dict = {"ar": None}


def _df():
    return sqlite.load_dataframe(config.TABLE_RAW)


@router.get("/association/overview")
def association_overview():
    """Book 3.1.1.1/3.1.1.3 — parameters, basket size, headline numbers."""
    if _CACHE["ar"] is None:
        _CACHE["ar"] = associate.run_association_mining(_df())
    ar = _CACHE["ar"]
    return responses.ok({
        "params": ar["params"],
        "n_itemsets": ar["n_itemsets"],
        "n_rules": ar["n_rules"],
        "top_single_items": ar["top_single_items"],
        "headline": _headline(ar),
    })


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


@router.get("/association/itemsets")
def association_itemsets(top: int = Query(15, ge=5, le=40)):
    """Figure 3.1.1.1 — frequent itemsets ranked by support."""
    if _CACHE["ar"] is None:
        _CACHE["ar"] = associate.run_association_mining(_df())
    return responses.ok({"itemsets": _CACHE["ar"]["frequent_itemsets"][:top]})


@router.get("/association/scatter")
def association_scatter():
    """Figure 3.1.1.2 — support vs confidence, coloured by lift."""
    if _CACHE["ar"] is None:
        _CACHE["ar"] = associate.run_association_mining(_df())
    pts = [{"support": r["support"], "confidence": r["confidence"],
            "lift": r["lift"]}
           for r in _CACHE["ar"]["scatter_points"]]
    return responses.ok({"points": pts})


@router.get("/association/rules")
def association_rules(top: int = Query(10, ge=3, le=30)):
    """Figure 3.1.1.3 — top rules by lift with all five metrics."""
    if _CACHE["ar"] is None:
        _CACHE["ar"] = associate.run_association_mining(_df())
    return responses.ok({
        "rules": _CACHE["ar"]["rules"][:top],
        "n_rules": _CACHE["ar"]["n_rules"],
    })


@router.post("/clustering")
def clustering(k: int | None = Query(None, ge=2, le=10)):
    """Book 3.1.2 — K-Means with K-selection, profiles, PCA view."""
    return responses.ok(run_clustering(_df(), k))
