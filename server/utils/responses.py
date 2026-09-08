"""Uniform API response envelope helpers."""

from __future__ import annotations

from typing import Any

from fastapi.responses import JSONResponse


def ok(data: Any = None, message: str | None = None) -> dict:
    payload: dict = {"success": True, "data": data}
    if message:
        payload["message"] = message
    return payload


def err(message: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": message},
    )
