"""Visualization routes: pre-aggregated chart-ready datasets."""

from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter, Query

from server.database import sqlite
from server.ml import config as mlcfg
from server.utils import config, responses

router = APIRouter(prefix="/api/visualization", tags=["visualization"])


def _df() -> pd.DataFrame:
    return sqlite.load_dataframe(config.TABLE_RAW)


@router.get("/overview")
def visualization_overview():
    """Everything the Visualization page needs in one round trip."""
    df = _df()

    risk_counts = df[mlcfg.TARGET].value_counts().reindex(mlcfg.CLASSES).fillna(0)

    region_risk = (
        df.groupby(["region", mlcfg.TARGET]).size().unstack(fill_value=0)
        .reindex(columns=mlcfg.CLASSES, fill_value=0)
        .reset_index()
    )
    region_risk_records = region_risk.to_dict(orient="records")

    region_env = df.groupby("region").agg(
        avg_ndvi=("ndvi", "mean"),
        avg_canopy=("canopy_cover_pct", "mean"),
        avg_rainfall=("annual_rainfall_mm", "mean"),
        avg_biomass=("biomass_tons_ha", "mean"),
        avg_species=("species_richness", "mean"),
        avg_fire_risk=("fire_risk_index", "mean"),
    ).round(2).reset_index()

    # NDVI decile bands -> canopy area curve
    banded = df.copy()
    banded["ndvi_band"] = pd.cut(banded["ndvi"], bins=8)
    ndvi_curve = banded.groupby("ndvi_band", observed=True).agg(
        avg_canopy=("canopy_cover_pct", "mean"),
        avg_biomass=("biomass_tons_ha", "mean"),
        avg_moisture=("soil_moisture_pct", "mean"),
        count=("ndvi", "size"),
    ).round(2).reset_index()
    ndvi_curve["ndvi_band"] = ndvi_curve["ndvi_band"].astype(str).str.slice(1, -1)

    # elevation bands
    elev_bands = pd.cut(df["elevation_m"], bins=[0, 250, 500, 1000, 1500, 2500],
                        labels=["<250", "250-500", "500-1k", "1k-1.5k", ">1.5k"])
    elev_risk = df.assign(elev_band=elev_bands).groupby(
        ["elev_band", mlcfg.TARGET], observed=True).size().unstack(fill_value=0)
    elev_risk = elev_risk.reindex(columns=mlcfg.CLASSES, fill_value=0).reset_index()
    elev_risk["elev_band"] = elev_risk["elev_band"].astype(str)

    return responses.ok({
        "risk_donut": [{"risk": k, "value": int(v)} for k, v in risk_counts.items()],
        "region_risk": region_risk_records,
        "region_environment": region_env.to_dict(orient="records"),
        "ndvi_curve": ndvi_curve.to_dict(orient="records"),
        "elevation_risk": elev_risk.to_dict(orient="records"),
        "totals": {"rows": int(len(df)), "regions": int(df["region"].nunique())},
    })


@router.get("/histogram")
def histogram(feature: str = Query(...), bins: int = Query(24, ge=5, le=60),
              group_by_risk: bool = False):
    df = _df()
    if feature not in df.columns:
        return responses.err(f"Unknown feature '{feature}'", 404)
    if not pd.api.types.is_numeric_dtype(df[feature]):
        vc = df[feature].value_counts()
        return responses.ok({
            "feature": feature,
            "data": [{"bin": str(k), "count": int(v)} for k, v in vc.items()],
        })

    clean = df[[feature, mlcfg.TARGET]].dropna()
    _, edges = pd.cut(clean[feature], bins=bins, retbins=True, duplicates="drop")
    edges = np.round(edges, 2)
    data = []
    if group_by_risk:
        for risk in mlcfg.CLASSES:
            subset = clean[clean[mlcfg.TARGET] == risk][feature]
            counts = pd.cut(subset, bins=edges, include_lowest=True).value_counts().sort_index()
            entry = {"bin": f"{edges[0]}"}
            for i, c in enumerate(counts):
                label = f"[{edges[i]:.4g}, {edges[i+1]:.4g})"
                data.append({"bin": label, "risk": risk, "count": int(c)})
    else:
        counts = pd.cut(clean[feature], bins=edges, include_lowest=True).value_counts().sort_index()
        for i, c in enumerate(counts):
            label = f"{edges[i]:.4g}–{edges[i+1]:.4g}"
            data.append({"bin": label, "count": int(c)})
    return responses.ok({"feature": feature, "data": data})


@router.get("/scatter")
def scatter(x: str = Query(...), y: str = Query(...),
            sample: int = Query(600, ge=50, le=2000)):
    df = _df()
    for col in (x, y):
        if col not in df.columns:
            return responses.err(f"Unknown column '{col}'", 404)
        if not pd.api.types.is_numeric_dtype(df[col]):
            return responses.err(f"Column '{col}' is not numeric", 422)
    sub = df[[x, y, mlcfg.TARGET, "region"]].dropna().sample(
        n=min(sample, len(df)), random_state=7)
    return responses.ok({
        "x": x, "y": y,
        "points": [
            {**{x: round(float(r[x]), 3), y: round(float(r[y]), 3)},
             "risk": r[mlcfg.TARGET], "region": r["region"]}
            for _, r in sub.iterrows()
        ],
    })


@router.get("/correlation")
def correlation(threshold: float = Query(0.25, ge=0.0, le=1.0)):
    df = _df()
    numeric = df.select_dtypes(include=[np.number]).drop(columns=["record_id"],
                                                         errors="ignore")
    corr = numeric.corr().round(3)
    pairs = []
    cols = corr.columns.tolist()
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            v = corr.iloc[i, j]
            if abs(v) >= threshold:
                pairs.append({"a": cols[i], "b": cols[j], "value": round(float(v), 3)})
    pairs.sort(key=lambda p: -abs(p["value"]))
    return responses.ok({
        "columns": cols,
        "matrix": corr.values.tolist(),
        "top_pairs": pairs[:14],
    })
