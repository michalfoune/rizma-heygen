"""Session management API endpoints."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from ..models import StartSessionRequest, StartSessionResponse, EvaluationResult
from ..services import (
    InterviewOrchestrator,
    EvaluatorService,
    MemoryService,
    GuardrailsService,
    PersonalityService,
    HeyGenService,
)
from ..dependencies import get_orchestrator, get_heygen_service

router = APIRouter()


@router.post("/start", response_model=StartSessionResponse)
async def start_session(
    request: StartSessionRequest,
    orchestrator: InterviewOrchestrator = Depends(get_orchestrator),
    heygen: HeyGenService = Depends(get_heygen_service),
) -> StartSessionResponse:
    """
    Start a new interview session.

    Creates the session, initializes HeyGen avatar, and returns
    credentials for the frontend to establish connections.
    """
    # Create session in orchestrator
    session = orchestrator.create_session(
        candidate_name=request.candidate_name,
        target_role=request.target_role,
        company_context=request.company_context,
        personality_id=request.personality_id or "default",
    )

    # Get avatar ID for the personality
    avatar_id = heygen.get_avatar_for_personality(session.personality_id)

    # Get Live Avatar session token
    try:
        token_data = await heygen.create_streaming_token(avatar_id=avatar_id)
        heygen_token = token_data.get("session_token", "")
    except RuntimeError:
        heygen_token = "development_placeholder"

    return StartSessionResponse(
        session_id=str(session.session_id),
        heygen_token=heygen_token,
        avatar_id=avatar_id,
    )


@router.get("/{session_id}/status")
async def get_session_status(
    session_id: UUID,
    orchestrator: InterviewOrchestrator = Depends(get_orchestrator),
):
    """Get the current status of an interview session."""
    session = orchestrator.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    return {
        "session_id": str(session.session_id),
        "phase": session.phase.value,
        "candidate_name": session.candidate_name,
        "target_role": session.target_role,
        "transcript_count": len(session.transcript),
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
    }


@router.post("/{session_id}/end", response_model=Optional[EvaluationResult])
async def end_session(
    session_id: UUID,
    orchestrator: InterviewOrchestrator = Depends(get_orchestrator),
) -> Optional[EvaluationResult]:
    """
    End an interview session and get evaluation results.

    If the interview hasn't reached the evaluation phase,
    it will be force-completed and evaluated.
    """
    evaluation = orchestrator.end_interview(session_id)
    return evaluation


@router.get("/{session_id}/transcript")
async def get_transcript(
    session_id: UUID,
    orchestrator: InterviewOrchestrator = Depends(get_orchestrator),
):
    """Get the complete transcript for a session."""
    session = orchestrator.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    return {
        "session_id": str(session.session_id),
        "transcript": [
            {
                "id": str(entry.id),
                "role": entry.role,
                "content": entry.content,
                "timestamp": entry.timestamp.isoformat(),
                "phase": entry.phase.value,
            }
            for entry in session.transcript
        ],
    }
