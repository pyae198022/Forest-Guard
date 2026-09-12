"""Dataset routes — PJBook section 2.1 (dataset & statistics)."""

from __future__ import annotations

import io

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import StreamingResponse

from server.database import sqlite
from server.ml import config as mlcfg
from server.utils import config, responses

router = APIRouter(prefix="/api/dataset", tags=["dataset"])


def _df() -> pd.DataFrame:
    return sqlite.load_dataframe(config.TABLE_RAW)


@router.get("/info")
def info():
    import json
    if config.INFO_PATH.exists():
        return responses.ok(json.loads(config.INFO_PATH.read_text()))
    return responses.ok({})


@router.get("/summary")
def summary():
    df = _df()
    tr = df[df["Year"] <= mlcfg.SPLIT_YEAR]
    te = df[df["Year"] > mlcfg.SPLIT_YEAR]
    threshold = float(tr[mlcfg.TARGET].median())
    return responses.ok({
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "numeric_columns": int(df.select_dtypes("number").shape[1]),
        "categorical_columns": int(sum(
            1 for c in df.columns if not pd.api.types.is_numeric_dtype(df[c]))),
        "entities": int(df["Entity"].nunique()),
        "regions": int(df["Region"].nunique()),
        "year_min": int(df["Year"].min()),
        "year_max": int(df["Year"].max()),
        "target": mlcfg.TARGET,
        "target_stats": {
            "mean": round(float(df[mlcfg.TARGET].mean()), 2),
            "median": round(float(df[mlcfg.TARGET].median()), 2),
            "std": round(float(df[mlcfg.TARGET].std()), 2),
            "min": round(float(df[mlcfg.TARGET].min()), 2),
            "max": round(float(df[mlcfg.TARGET].max()), 2),
            "skew": round(float(df[mlcfg.TARGET].skew()), 3),
        },
        "split": {
            "train_rows": int(len(tr)), "test_rows": int(len(te)),
            "threshold": threshold,
            "train": {"Low": int((tr[mlcfg.TARGET] <= threshold).sum()),
                      "High": int((tr[mlcfg.TARGET] > threshold).sum())},
            "test": {"Low": int((te[mlcfg.TARGET] <= threshold).sum()),
                     "High": int((te[mlcfg.TARGET] > threshold).sum())},
        },
    })


@router.get("/attributes")
def attributes():
    """Book Table 2.1.1 — attribute dictionary."""
    return responses.ok([
        {"name": name, **meta} for name, meta in mlcfg.ATTRIBUTE_DICT.items()
    ])


@router.get("/stats")
def stats():
    """Book Table 2.1.2 — descriptive statistics for every numeric column."""
    df = _df()
    rows = []
    for col in mlcfg.ATTRIBUTE_DICT:
        if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
            continue
        s = df[col].astype(float)
        rows.append({
            "feature": col,
            "count": int(s.count()),
            "mean": round(float(s.mean()), 2),
            "std": round(float(s.std()), 2),
            "min": round(float(s.min()), 2),
            "median": round(float(s.median()), 2),
            "max": round(float(s.max()), 2),
        })
    return responses.ok(rows)


@router.get("/quality")
def quality():
    from server.ml.preprocessing import quality_report
    return responses.ok(quality_report(_df()))


@router.get("/records")
def records(
    entity: str | None = Query(None),
    region: str | None = Query(None),
    year_min: int | None = Query(None, ge=1990, le=2020),
    year_max: int | None = Query(None, ge=1990, le=2020),
    q: str | None = Query(None, max_length=60),
    sort_by: str = Query("Entity"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    df = _df()
    if entity and entity != "all":
        df = df[df["Entity"] == entity]
    if region and region != "all":
        df = df[df["Region"] == region]
    if year_min is not None:
        df = df[df["Year"] >= year_min]
    if year_max is not None:
        df = df[df["Year"] <= year_max]
    if q:
        mask = df["Entity"].str.contains(q, case=False, na=False)
        df = df[mask]
    sort_col = sort_by if sort_by in df.columns else "Entity"
    df = df.sort_values(sort_col, ascending=(order == "asc"))
    total = int(len(df))
    page = df.iloc[offset:offset + limit]
    return responses.ok({
        "total": total, "offset": offset, "limit": limit,
        "records": page.replace({np.nan: None}).to_dict(orient="records"),
    })


@router.get("/facets")
def facets():
    df = _df()
    return responses.ok({
        "entities": sorted(df["Entity"].dropna().unique().tolist()),
        "regions": sorted(df["Region"].dropna().unique().tolist()),
    })


@router.get("/column-profile/{name}")
def column_profile(name: str):
    df = _df()
    if name not in df.columns:
        return responses.err(f"Unknown column '{name}'", 404)
    s = df[name]
    if not pd.api.types.is_numeric_dtype(s):
        vc = s.value_counts()
        return responses.ok({
            "name": name, "type": "categorical",
            "unique": int(s.nunique()),
            "top": [{"value": str(k), "count": int(v)}
                    for k, v in vc.head(12).items()],
        })
    q1, q3 = s.quantile([0.25, 0.75])
    return responses.ok({
        "name": name, "type": "numeric",
        "mean": round(float(s.mean()), 3),
        "std": round(float(s.std()), 3),
        "min": round(float(s.min()), 3),
        "q1": round(float(q1), 3), "median": round(float(s.median()), 3),
        "q3": round(float(q3), 3), "max": round(float(s.max()), 3),
        "missing": int(s.isna().sum()),
        "histogram": _hist(s),
    })


def _hist(s, bins: int = 24):
    import numpy as np
    clean = s.dropna().astype(float)
    # log1p only makes sense for non-negative columns (SPEI can be < 0)
    if clean.min() >= 0 and clean.skew() > 3:
        values = np.log1p(clean)
    else:
        values = clean
    counts, edges = np.histogram(values, bins=bins)
    if values is clean:
        labels = [f"{edges[i]:.4g}–{edges[i+1]:.4g}" for i in range(len(counts))]
    else:
        labels = [f"{np.expm1(edges[i]):.4g}–{np.expm1(edges[i+1]):.4g}"
                  for i in range(len(counts))]
    return [{"bin": labels[i], "count": int(c)}
            for i, c in enumerate(counts)]


@router.get("/export")
def export():
    df = _df()
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition":
                 "attachment; filename=deforestation_dataset.csv"})


@router.post("/import")
async def import_csv(file: UploadFile = File(...)):
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content)) if file.filename.endswith(
            ".csv") else pd.read_excel(io.BytesIO(content))
    except Exception as exc:
        return responses.err(f"Could not parse file: {exc}", 422)
    expected = set(mlcfg.ATTRIBUTE_DICT)
    if not expected.issubset(set(df.columns)):
        missing = expected - set(df.columns)
        return responses.err(
            f"Missing required columns: {sorted(missing)[:6]} ...", 422)
    df["Year"] = df["Year"].astype(int)
    with sqlite.get_connection() as conn:
        conn.execute(f"DROP TABLE IF EXISTS {config.TABLE_RAW}")
    sqlite.save_dataframe(df, config.TABLE_RAW)
    df.to_csv(config.CSV_PATH, index=False)
    # stale heavy computations must not survive an import
    from server.routes import preprocessing as pp
    pp._PIPELINE_CACHE = None
    from server.routes import mining as mn
    mn._CACHE["ar"] = None
    return responses.ok(dataset_info(df))


def dataset_info(df):
    from server.database.seed import dataset_info as _info
    return _info(df)
