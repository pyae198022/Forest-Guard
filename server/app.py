"""
ForestGuard — FastAPI application
====================================
Data-mining backend implementing the IS-212 PJBook methodology.

Startup chain (lifespan):
    1. Import the PJBook Excel dataset -> canonical CSV + SQLite mirror
    2. Train / reload the PJBook model suite (temporal split, RF + MLP,
       regression & classification) with joblib + state.json persistence

Run:
    python3 -m uvicorn server.app:app --host 0.0.0.0 --port 3010
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from server.database import seed
from server.ml.models import STATE, ensure_trained
from server.routes import api_router
from server.utils import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("forestguard.app")


def _prewarm_pipeline_cache() -> None:
    """Compute the heavy preprocessing report once at boot so the UI's
    first 'Run Full Pipeline' click is instant."""
    try:
        from server.routes import preprocessing as pp

        pp._PIPELINE_CACHE = None
        pp.run()
        logger.info("Preprocessing pipeline cache warmed")
    except Exception:  # noqa: BLE001 — cache warming must never block boot
        logger.exception("Pipeline cache warming failed (non-fatal)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Bootstrapping ForestGuard backend (PJBook edition) ...")
    info = seed.bootstrap()
    logger.info("Dataset ready: %s rows x %s cols", info["rows"],
                info["columns"])
    state = ensure_trained()
    logger.info("Models ready - best regression: %s | best classifier: %s",
                STATE.get("best_regression", {}).get("model"),
                STATE.get("best_classification", {}).get("model"))
    _prewarm_pipeline_cache()
    logger.info("ForestGuard backend ready - serving on port %s",
                config.SERVER_PORT)
    yield
    logger.info("ForestGuard backend shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="ForestGuard API (PJBook)",
        description="IS-212 Data Mining backend: dataset, preprocessing, "
                    "visualization, association rules, clustering, "
                    "prediction, evaluation",
        version="2.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "service": "forestguard-ai",
            "version": "2.0.0",
            "edition": "pjbook",
            "models_trained": STATE["trained"],
            "best_model": (STATE.get("best_classification") or {}).get("model"),
        }

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method,
                         request.url.path)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Internal error: {exc}"},
        )

    return app


app = create_app()
