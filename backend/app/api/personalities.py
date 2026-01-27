"""Personality management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..models import PersonalityConfig
from ..services import PersonalityService
from ..dependencies import get_personality_service

router = APIRouter()


class CreatePersonalityRequest(BaseModel):
    """Request to create a custom personality."""

    id: str
    name: str
    description: str = ""
    persona_background: str
    interviewing_style: str
    avatar_id: str = "default_interviewer"
    voice_id: str = "en-US-JennyNeural"


@router.get("/")
async def list_personalities(
    personality_service: PersonalityService = Depends(get_personality_service),
):
    """List all available interviewer personalities."""
    personalities = personality_service.list_personalities()
    return {
        "personalities": [
            {"id": pid, "description": desc}
            for pid, desc in personalities.items()
        ]
    }


@router.get("/{personality_id}")
async def get_personality(
    personality_id: str,
    personality_service: PersonalityService = Depends(get_personality_service),
):
    """Get details of a specific personality."""
    personality = personality_service.get_personality(personality_id)

    # Return limited info (not the full system prompt)
    return {
        "id": personality.id,
        "name": personality.name,
        "description": personality.description,
        "avatar_id": personality.avatar_id,
        "tone": personality.tone.model_dump(),
        "company_values": personality.company_values,
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_personality(
    request: CreatePersonalityRequest,
    personality_service: PersonalityService = Depends(get_personality_service),
):
    """Create a new custom personality."""
    # Check if ID already exists
    existing = personality_service.list_personalities()
    if request.id in existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Personality '{request.id}' already exists",
        )

    personality = personality_service.create_custom_personality(
        personality_id=request.id,
        name=request.name,
        description=request.description,
        persona_background=request.persona_background,
        interviewing_style=request.interviewing_style,
        avatar_id=request.avatar_id,
        voice_id=request.voice_id,
    )

    return {
        "id": personality.id,
        "name": personality.name,
        "message": "Personality created successfully",
    }
