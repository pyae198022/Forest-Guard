"""API router aggregation for ForestGuard AI."""

from fastapi import APIRouter

from server.routes import dataset, evaluation, mining, prediction, preprocessing, visualization

api_router = APIRouter()
api_router.include_router(dataset.router)
api_router.include_router(preprocessing.router)
api_router.include_router(visualization.router)
api_router.include_router(mining.router)
api_router.include_router(prediction.router)
api_router.include_router(evaluation.router)
