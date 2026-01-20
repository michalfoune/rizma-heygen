"""
Rizma.ai Backend Application Entry Point.

FastAPI application with WebSocket support for real-time
interview simulation with HeyGen avatar integration.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .api import api_router
from .api.websocket import websocket_endpoint
from .dependencies import get_orchestrator, get_heygen_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    # Startup
    logger.info("Starting Rizma.ai backend...")
    settings = get_settings()
    logger.info(f"Debug mode: {settings.debug}")

    yield

    # Shutdown
    logger.info("Shutting down Rizma.ai backend...")
    heygen = get_heygen_service()
    await heygen.close()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Rizma.ai API",
        description="AI-powered interview simulation platform",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API routes
    app.include_router(api_router)

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "version": "0.1.0"}

    # WebSocket endpoint for interview sessions
    @app.websocket("/ws/{session_id}")
    async def ws_interview(websocket: WebSocket, session_id: str):
        orchestrator = get_orchestrator()
        await websocket_endpoint(websocket, session_id, orchestrator)

    return app


# Create application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
