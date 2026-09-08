"""
ForestGuard AI — FastAPI application
====================================
Data-mining backend for the ForestGuard dashboard.

Startup chain (lifespan):
    1. Ensure the dataset CSV exists (regenerate synthetically if missing)
    2. Mirror the CSV into SQLite (raw + run-history tables)
    3. Train / reload all classification pipelines (joblib persistence)

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Bootstrapping ForestGuard backend ...")
    seed.bootstrap()
    if not STATE["trained"]:
        ensure_trained()
    logger.info("ForestGuard backend ready - serving on port %s", config.SERVER_PORT)
    yield
    logger.info("ForestGuard backend shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="ForestGuard AI API",
        description="Data Mining backend: dataset, preprocessing, "
                    "visualization, descriptive mining, prediction, evaluation",
        version="1.0.0",
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
            "version": "1.0.0",
            "models_trained": STATE["trained"],
            "best_model": STATE["best_model"],
        }

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Internal error: {exc}"},
        )

    return app


app = create_app()
