"""
LiveAvatar API Proxy.

Proxies requests from the frontend SDK to the LiveAvatar API
to avoid CORS issues during development.
"""

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Request, Response, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter()

# Note: SDK adds /v1/ prefix, so we use the base URL without /v1
LIVEAVATAR_API_BASE = "https://api.liveavatar.com"


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_liveavatar(request: Request, path: str):
    """
    Proxy requests to the LiveAvatar API.

    This endpoint forwards all requests to api.liveavatar.com,
    adding the necessary headers and handling CORS.
    """
    # Build target URL
    target_url = f"{LIVEAVATAR_API_BASE}/{path}"

    # Get the authorization header from the request
    auth_header = request.headers.get("authorization")

    # Build headers for the proxied request
    headers = {
        "Content-Type": "application/json",
    }

    if auth_header:
        headers["Authorization"] = auth_header

    # Get request body if present
    body = None
    if request.method in ["POST", "PUT", "PATCH"]:
        body = await request.body()

    # Get query params
    params = dict(request.query_params)

    logger.info(f"Proxying {request.method} request to: {target_url}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
                params=params if params else None,
            )

            logger.info(f"LiveAvatar API response: {response.status_code}")

            # Return the response with appropriate headers
            return Response(
                content=response.content,
                status_code=response.status_code,
                media_type=response.headers.get("content-type", "application/json"),
            )
    except httpx.HTTPError as e:
        logger.error(f"Error proxying to LiveAvatar API: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to proxy request: {str(e)}")
