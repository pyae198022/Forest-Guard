"""ForestGuard — PJBook section 3.1.1 association-rule mining.

A self-contained Apriori implementation (no mlxtend dependency):

    1. Discretise every continuous predictor into 3 equal-count ordinal
       bins (Low / Medium / High) with pd.qcut; the continuous target
       Deforestation_Ha is EXCLUDED from the basket (anti-leakage rule,
       book 3.1.1.3).
    2. Mine frequent itemsets with iterative candidate generation
       (k -> k+1) under min_support = 0.10.
    3. Derive rules X -> Y with min_confidence = 0.60 and score each with
       support, confidence, lift, leverage and conviction.
"""

from __future__ import annotations

from itertools import combinations

import numpy as np
import pandas as pd

from server.ml import config as mlcfg


# ------------------------------------------------------------- binning ----
def build_basket(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Quantile-bin the candidate predictors; return 0/1 basket matrix."""
    cand = [c for c in mlcfg.candidate_features(list(df.columns))]
    items: dict[str, np.ndarray] = {}
    for col in cand:
        s = pd.to_numeric(df[col], errors="coerce")
        try:
            binned = pd.qcut(s, q=mlcfg.AR_BINS, labels=mlcfg.AR_BIN_LABELS,
                             duplicates="drop")
        except ValueError:
            binned = pd.cut(s, bins=mlcfg.AR_BINS, labels=mlcfg.AR_BIN_LABELS)
        for lab in mlcfg.AR_BIN_LABELS:
            mask = (binned == lab).to_numpy()
            # keep only bins that actually exist (duplicates="drop" may merge)
            if mask.sum() > 0:
                items[f"{col}_{lab}"] = mask.astype(bool)
    basket = pd.DataFrame(items, index=df.index)
    return basket, list(basket.columns)


# ------------------------------------------------------------- apriori ----
def _support(mask_matrix: np.ndarray, cols_idx: tuple[int, ...]) -> float:
    sel = mask_matrix[:, cols_idx[0]]
    for i in cols_idx[1:]:
        sel = sel & mask_matrix[:, i]
    return float(sel.mean())


def frequent_itemsets(basket: pd.DataFrame, min_support: float,
                      max_len: int = mlcfg.AR_MAX_LEN) -> list[dict]:
    """Classic level-wise Apriori over a boolean matrix."""
    cols = list(basket.columns)
    mat = basket.to_numpy(dtype=bool)
    n_rows = mat.shape[0]
    min_count = min_support * n_rows

    # exact count via matmul on int8
    mat_i = mat.astype(np.int8)
    counts = mat_i.sum(axis=0)
    frequent: dict[int, list[tuple[int, ...]]] = {}
    L1 = [(i,) for i in range(len(cols)) if counts[i] >= min_count]
    frequent[1] = L1
    results: list[dict] = [
        {"items": [cols[i] for i in iset], "k": 1,
         "support": round(counts[iset[0]] / n_rows, 4)}
        for iset in L1
    ]

    k = 2
    while k <= max_len and frequent.get(k - 1):
        prev = frequent[k - 1]
        prev_set = set(prev)
        candidates: set[tuple[int, ...]] = set()
        for a, b in combinations(prev, 2):
            union = tuple(sorted(set(a) | set(b)))
            if len(union) != k:
                continue
            # prune: all (k-1)-subsets must be frequent
            if all(tuple(sorted(s)) in prev_set
                   for s in combinations(union, k - 1)):
                candidates.add(union)
        kept: list[tuple[int, ...]] = []
        for cand in candidates:
            idx = list(cand)
            sel = mat[:, idx[0]].copy()
            for i in idx[1:]:
                sel &= mat[:, i]
            cnt = int(sel.sum())
            if cnt >= min_count:
                kept.append(cand)
                results.append({
                    "items": [cols[i] for i in cand], "k": k,
                    "support": round(cnt / n_rows, 4),
                })
        frequent[k] = kept
        k += 1

    results.sort(key=lambda r: (-r["support"], r["items"]))
    return results


# ---------------------------------------------------------------- rules ----
def _rule_metrics(mat: np.ndarray, cols: list[str],
                  ant: tuple[int, ...], cons: tuple[int, ...]) -> dict | None:
    n = mat.shape[0]
    a_sel = mat[:, ant[0]].copy()
    for i in ant[1:]:
        a_sel &= mat[:, i]
    c_sel = mat[:, cons[0]].copy()
    for i in cons[1:]:
        c_sel &= mat[:, i]
    ac_sel = a_sel & c_sel

    sup_a = a_sel.sum() / n
    sup_c = c_sel.sum() / n
    sup_ac = ac_sel.sum() / n
    if sup_a == 0:
        return None
    confidence = sup_ac / sup_a
    if confidence < mlcfg.AR_MIN_CONFIDENCE or sup_ac < mlcfg.AR_MIN_SUPPORT:
        return None
    lift = confidence / sup_c if sup_c > 0 else 0.0
    leverage = sup_ac - sup_a * sup_c
    # conviction: (1 - sup_c) / (1 - confidence); inf when confidence == 1
    conviction = float("inf") if confidence >= 1.0 else (1 - sup_c) / (1 - confidence)
    return {
        "antecedents": [cols[i] for i in ant],
        "consequents": [cols[i] for i in cons],
        "support": round(float(sup_ac), 4),
        "confidence": round(float(confidence), 4),
        "lift": round(float(lift), 4),
        "leverage": round(float(leverage), 4),
        "conviction": (None if np.isinf(conviction) else round(float(conviction), 4)),
    }


def generate_rules(basket: pd.DataFrame,
                   itemsets: list[dict]) -> list[dict]:
    """All A->B rules from frequent itemsets with k >= 2."""
    cols = list(basket.columns)
    col_idx = {c: i for i, c in enumerate(cols)}
    mat = basket.to_numpy(dtype=bool)

    rules: list[dict] = []
    for iset in itemsets:
        if iset["k"] < 2:
            continue
        idx = tuple(col_idx[c] for c in iset["items"])
        for r in range(1, len(idx)):
            for ant in combinations(idx, r):
                cons = tuple(i for i in idx if i not in ant)
                m = _rule_metrics(mat, cols, ant, cons)
                if m:
                    rules.append(m)
    rules.sort(key=lambda r: (-r["lift"], -r["confidence"]))
    return rules


# ------------------------------------------------------------- summary ----
def run_association_mining(df: pd.DataFrame,
                           top_itemsets: int = 15,
                           top_rules: int = 12) -> dict:
    basket, cols = build_basket(df)
    itemsets = frequent_itemsets(basket, mlcfg.AR_MIN_SUPPORT)
    rules = generate_rules(basket, itemsets)

    svc = basket.sum(axis=0) / len(basket)
    single = [{"item": c, "support": round(float(svc[c]), 4)}
              for c in cols]
    single.sort(key=lambda x: -x["support"])

    return {
        "params": {
            "bins": mlcfg.AR_BINS,
            "bin_labels": mlcfg.AR_BIN_LABELS,
            "min_support": mlcfg.AR_MIN_SUPPORT,
            "min_confidence": mlcfg.AR_MIN_CONFIDENCE,
            "target_excluded": mlcfg.TARGET,
            "basket_items": len(cols),
            "records": int(len(basket)),
        },
        "top_single_items": single[:15],
        "frequent_itemsets": itemsets[:top_itemsets],
        "n_itemsets": len(itemsets),
        "rules": rules[:top_rules],
        "n_rules": len(rules),
        "top_frequent_itemsets": itemsets[:15],
        "scatter_points": [
            {"support": r["support"], "confidence": r["confidence"],
             "lift": r["lift"]} for r in rules],
    }
