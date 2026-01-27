"""Main API router configuration."""

from fastapi import APIRouter

from .sessions import router as sessions_router
from .personalities import router as personalities_router
from .liveavatar_proxy import router as liveavatar_proxy_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(sessions_router, prefix="/sessions", tags=["sessions"])
api_router.include_router(personalities_router, prefix="/personalities", tags=["personalities"])

# LiveAvatar API proxy for avoiding CORS issues in development
api_router.include_router(liveavatar_proxy_router, prefix="/liveavatar", tags=["liveavatar-proxy"])
