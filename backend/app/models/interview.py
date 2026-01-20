"""Interview-related Pydantic models."""

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class InterviewPhase(str, Enum):
    """Interview state machine phases."""

    IDLE = "IDLE"
    GREETING = "GREETING"
    TECHNICAL = "TECHNICAL"
    EVALUATION = "EVALUATION"
    COMPLETED = "COMPLETED"


class TranscriptEntry(BaseModel):
    """Single entry in the interview transcript."""

    id: UUID = Field(default_factory=uuid4)
    role: str = Field(..., pattern="^(interviewer|candidate)$")
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    phase: InterviewPhase


class EvaluationFeedback(BaseModel):
    """Detailed evaluation feedback scores."""

    persuasion: int = Field(..., ge=0, le=100)
    technical_fit: int = Field(..., ge=0, le=100)
    communication: int = Field(..., ge=0, le=100)


class EvaluationResult(BaseModel):
    """Final interview evaluation result."""

    score: int = Field(..., ge=0, le=100)
    passed: bool
    feedback: EvaluationFeedback
    summary: str


class InterviewSession(BaseModel):
    """Complete interview session state."""

    session_id: UUID = Field(default_factory=uuid4)
    candidate_name: str
    target_role: str
    company_context: Optional[str] = None
    personality_id: str = "default"
    phase: InterviewPhase = InterviewPhase.IDLE
    transcript: List[TranscriptEntry] = Field(default_factory=list)
    evaluation: Optional[EvaluationResult] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class StartSessionRequest(BaseModel):
    """Request to start a new interview session."""

    candidate_name: str = Field(..., min_length=1, max_length=100)
    target_role: str = Field(..., min_length=1, max_length=200)
    company_context: Optional[str] = Field(None, max_length=2000)
    personality_id: Optional[str] = "default"


class StartSessionResponse(BaseModel):
    """Response after starting a new session."""

    session_id: str
    heygen_token: str
    avatar_id: str


class WebSocketMessage(BaseModel):
    """WebSocket message format."""

    type: str = Field(
        ..., pattern="^(state_update|transcript_entry|evaluation_result|error|avatar_speak)$"
    )
    payload: Any
