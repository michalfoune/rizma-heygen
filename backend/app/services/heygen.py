"""
HeyGen Service for avatar management.

Handles HeyGen API interactions for streaming avatar sessions.
"""

import logging
from typing import Optional

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)


class HeyGenService:
    """
    Service for HeyGen/LiveAvatar streaming avatar integration.

    Provides:
    - Session token generation
    - Avatar configuration
    - Voice synthesis coordination
    """

    # Live Avatar API (separate from HeyGen API)
    LIVE_AVATAR_API_BASE = "https://api.liveavatar.com/v1"

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Live Avatar service.

        Args:
            api_key: Live Avatar API key (defaults to settings)
        """
        settings = get_settings()
        self.api_key = api_key or settings.heygen_api_key

        self._client = httpx.AsyncClient(
            base_url=self.LIVE_AVATAR_API_BASE,
            headers={
                "X-API-KEY": self.api_key,
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def create_streaming_token(self, avatar_id: Optional[str] = None) -> dict:
        """
        Create a Live Avatar session token for the frontend.

        Args:
            avatar_id: Optional avatar ID to use (defaults to first available)

        Returns:
            Dict with session_id and session_token for SDK initialization
        """
        if not self.api_key:
            logger.warning("Live Avatar API key not configured, returning placeholder")
            return {
                "session_id": "placeholder_session",
                "session_token": "placeholder_token_configure_api_key"
            }

        try:
            # Live Avatar API requires mode and avatar_id in request body
            # Use a PUBLIC avatar from Live Avatar library ("Ann Therapist")
            live_avatar_id = "513fd1b7-7ef9-466d-9af2-344e51eeb833"

            request_body = {
                "mode": "FULL",
                "avatar_id": live_avatar_id,
                "avatar_persona": {
                    "language": "en"
                }
            }

            logger.info(f"Creating Live Avatar session with avatar: {live_avatar_id}")
            response = await self._client.post("/sessions/token", json=request_body)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Live Avatar session created: {data}")

            # Live Avatar returns session_id and session_token at top level or in data
            result = data.get("data", data)
            return {
                "session_id": result.get("session_id", ""),
                "session_token": result.get("session_token", "")
            }
        except httpx.HTTPError as e:
            logger.error(f"Failed to create Live Avatar session token: {e}")
            # Log response body for debugging
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response body: {e.response.text}")
            raise RuntimeError("Failed to initialize avatar session") from e

    async def get_available_avatars(self) -> list:
        """
        Get list of available avatars.

        Returns:
            List of avatar configurations
        """
        if not self.api_key:
            return self._get_default_avatars()

        try:
            response = await self._client.get("/avatars")
            response.raise_for_status()
            data = response.json()
            return data.get("data", {}).get("avatars", [])
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch avatars: {e}")
            return self._get_default_avatars()

    def _get_default_avatars(self) -> list:
        """Return default avatar configurations for development."""
        return [
            {
                "avatar_id": "default_interviewer",
                "avatar_name": "Professional Interviewer",
                "preview_image_url": None,
            },
            {
                "avatar_id": "strict_interviewer",
                "avatar_name": "Technical Lead",
                "preview_image_url": None,
            },
            {
                "avatar_id": "friendly_interviewer",
                "avatar_name": "HR Manager",
                "preview_image_url": None,
            },
        ]

    def get_avatar_for_personality(self, personality_id: str) -> str:
        """
        Map personality ID to Live Avatar UUID.

        Args:
            personality_id: The personality configuration ID

        Returns:
            Corresponding Live Avatar UUID
        """
        # Use a PUBLIC avatar from Live Avatar library
        # "Ann Therapist" for all personalities
        live_avatar_uuid = "513fd1b7-7ef9-466d-9af2-344e51eeb833"
        return live_avatar_uuid

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
