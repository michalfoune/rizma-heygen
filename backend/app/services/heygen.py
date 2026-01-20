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
    Service for HeyGen streaming avatar integration.

    Provides:
    - Session token generation
    - Avatar configuration
    - Voice synthesis coordination
    """

    HEYGEN_API_BASE = "https://api.heygen.com/v1"

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize HeyGen service.

        Args:
            api_key: HeyGen API key (defaults to settings)
        """
        settings = get_settings()
        self.api_key = api_key or settings.heygen_api_key
        self._client = httpx.AsyncClient(
            base_url=self.HEYGEN_API_BASE,
            headers={
                "X-Api-Key": self.api_key,
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def create_streaming_token(self) -> str:
        """
        Create a streaming session token for the frontend.

        Returns:
            Session token for HeyGen SDK initialization
        """
        if not self.api_key:
            logger.warning("HeyGen API key not configured, returning placeholder")
            return "placeholder_token_configure_heygen_api_key"

        try:
            response = await self._client.post("/streaming.create_token")
            response.raise_for_status()
            data = response.json()
            return data.get("data", {}).get("token", "")
        except httpx.HTTPError as e:
            logger.error(f"Failed to create HeyGen streaming token: {e}")
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
        Map personality ID to avatar ID.

        Args:
            personality_id: The personality configuration ID

        Returns:
            Corresponding avatar ID
        """
        avatar_mapping = {
            "default": "default_interviewer",
            "strict": "strict_interviewer",
            "friendly": "friendly_interviewer",
        }
        return avatar_mapping.get(personality_id, "default_interviewer")

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
