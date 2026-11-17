import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    checkins,
    demo,
    feedback,
    health,
    insights,
    mindbalance,
    plans,
    profile,
    radar,
    resources,
    tasks,
)
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.db.database import SessionLocal, init_db
from app.services.resource_service import seed_resources

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with SessionLocal() as db:
        seed_resources(db)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="UniWell AI API",
        version="1.0.0",
        description="Non-clinical student wellbeing & academic planning companion.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-User-Id"],
    )

    @app.middleware("http")
    async def limit_body_size(request: Request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > settings.max_request_bytes:
            return JSONResponse(
                status_code=413,
                content={"error": {"code": "payload_too_large", "message": "Request body is too large."}},
            )
        return await call_next(request)

    register_error_handlers(app)

    for module in (
        health,
        profile,
        checkins,
        tasks,
        radar,
        plans,
        feedback,
        insights,
        mindbalance,
        resources,
        demo,
    ):
        app.include_router(module.router, prefix="/api")
    return app


app = create_app()
