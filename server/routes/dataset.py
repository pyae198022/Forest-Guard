"""Dataset routes: summary, paginated browsing, profiles, import/export."""

from __future__ import annotations

import io
import json

import pandas as pd
from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import StreamingResponse

from server.database import sqlite
from server.ml import config as mlcfg
from server.utils import config, responses

router = APIRouter(prefix="/api/dataset", tags=["dataset"])

FEATURE_GROUPS = {
    "record_id": "identifier", "deforestation_risk": "target",
    **{f: (mlcfg.FEATURE_META.get(f, {}).get("group", "Other").lower())
       for f in mlcfg.FEATURES},
}


def _dtype_label(series: pd.Series) -> str:
    if series.dtype == object:
        return "categorical"
    if pd.api.types.is_integer_dtype(series):
        return "integer"
    return "float"


@router.get("/summary")
def dataset_summary():
    df = sqlite.load_dataframe(config.TABLE_RAW)
    total_cells = int(df.shape[0] * df.shape[1])
    missing = int(df.isna().sum().sum())
    columns = []
    for col in df.columns:
        s = df[col]
        columns.append({
            "name": col,
            "dtype": _dtype_label(s),
            "group": FEATURE_GROUPS.get(col, "other"),
            "missing": int(s.isna().sum()),
            "unique": int(s.nunique(dropna=True)),
            "sample": None if s.dropna().empty else (
                str(s.dropna().iloc[0]) if s.dtype == object
                else float(s.dropna().iloc[0]) if pd.api.types.is_float_dtype(s)
                else int(s.dropna().iloc[0])),
        })
    return responses.ok({
        "n_rows": int(len(df)),
        "n_cols": int(df.shape[1]),
        "n_features": len(mlcfg.FEATURES),
        "target": mlcfg.TARGET,
        "classes": mlcfg.CLASSES,
        "class_distribution": df[mlcfg.TARGET].value_counts().to_dict(),
        "total_missing": missing,
        "missing_pct": round(missing / total_cells * 100, 3),
        "duplicates": int(df.duplicated(subset=df.columns.drop("record_id")).sum()),
        "memory_mb": round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
        "columns": columns,
    })


@router.get("/records")
def dataset_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=200),
    region: str | None = None,
    risk: str | None = None,
    search: str | None = None,
    sort_by: str = "record_id",
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
):
    df = sqlite.load_dataframe(config.TABLE_RAW)
    if region and region != "all":
        df = df[df["region"] == region]
    if risk and risk != "all":
        df = df[df[mlcfg.TARGET] == risk]
    if search:
        mask = df.apply(
            lambda row: row.astype(str).str.contains(search, case=False, na=False).any(),
            axis=1,
        )
        df = df[mask]
    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(sort_dir == "asc"))

    total = int(len(df))
    start = (page - 1) * page_size
    page_df = df.iloc[start:start + page_size]
    # convert NaN -> None so FastAPI can serialize (JSON has no NaN)
    page_df = page_df.astype(object).where(pd.notna(page_df), None)
    return responses.ok({
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
        "regions": sorted(sqlite.load_dataframe(config.TABLE_RAW)["region"].unique().tolist()),
        "records": page_df.to_dict(orient="records"),
    })


@router.get("/column-profile/{name}")
def column_profile(name: str, bins: int = Query(14, ge=4, le=40)):
    df = sqlite.load_dataframe(config.TABLE_RAW)
    if name not in df.columns:
        return responses.err(f"Unknown column '{name}'", 404)
    s = df[name]
    profile: dict = {
        "name": name,
        "dtype": _dtype_label(s),
        "missing": int(s.isna().sum()),
        "unique": int(s.nunique(dropna=True)),
    }
    if pd.api.types.is_numeric_dtype(s):
        clean = s.dropna()
        profile.update({
            "mean": round(float(clean.mean()), 4),
            "std": round(float(clean.std()), 4),
            "min": round(float(clean.min()), 4),
            "q1": round(float(clean.quantile(0.25)), 4),
            "median": round(float(clean.median()), 4),
            "q3": round(float(clean.quantile(0.75)), 4),
            "max": round(float(clean.max()), 4),
        })
        counts, edges = pd.cut(clean, bins=bins, retbins=True, duplicates="drop")
        hist = counts.value_counts().sort_index()
        labels = [f"{edges[i]:.1f}" for i in range(len(edges) - 1)]
        profile["histogram"] = [
            {"bin": labels[i], "count": int(hist.iloc[i])} for i in range(len(hist))
        ]
    else:
        vc = s.value_counts()
        profile["distribution"] = [{"bin": str(k), "count": int(v)} for k, v in vc.items()]
    return responses.ok(profile)


@router.post("/import")
async def import_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        return responses.err("Only .csv files are accepted", 422)
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
    except Exception as exc:  # malformed upload
        return responses.err(f"Could not parse CSV: {exc}", 422)

    required = {"record_id", "region", mlcfg.TARGET}
    missing_required = required - set(df.columns)
    if missing_required:
        return responses.err(
            f"CSV must contain columns: {', '.join(sorted(missing_required))}", 422)

    df.to_csv(config.CSV_PATH, index=False)
    sqlite.save_dataframe(df, config.TABLE_RAW, if_exists="replace")
    return responses.ok(
        {"rows_imported": int(len(df)), "columns": list(df.columns)},
        message=f"Imported {len(df)} rows from {file.filename}",
    )


@router.get("/export")
def export_csv():
    df = sqlite.load_dataframe(config.TABLE_RAW)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=forestguard_dataset.csv"},
    )


@router.get("/info")
def dataset_info():
    if not config.INFO_PATH.exists():
        return responses.ok({})
    try:
        return responses.ok(json.loads(config.INFO_PATH.read_text()))
    except json.JSONDecodeError:
        return responses.ok({})
