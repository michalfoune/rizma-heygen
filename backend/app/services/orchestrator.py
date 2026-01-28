"""
State-Driven Interview Orchestrator.

Implements a state machine to manage interview phases:
IDLE -> GREETING -> TECHNICAL -> EVALUATION -> COMPLETED
"""

import logging
from datetime import datetime
from typing import Callable, Dict, Optional, Tuple
from uuid import UUID

from ..models import (
    InterviewPhase,
    InterviewSession,
    TranscriptEntry,
    EvaluationResult,
    PersonalityConfig,
)
from .evaluator import EvaluatorService
from .guardrails import GuardrailsService
from .memory import MemoryService
from .personality import PersonalityService
from .llm import LLMService

logger = logging.getLogger(__name__)


class StateTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""

    pass


class InterviewOrchestrator:
    """
    Orchestrates the interview flow using a state machine pattern.

    The orchestrator manages:
    - Phase transitions (GREETING -> TECHNICAL -> EVALUATION)
    - Candidate-Interviewer message routing
    - Evaluation triggering
    - Memory and guardrails integration
    """

    # Valid state transitions
    VALID_TRANSITIONS: Dict[InterviewPhase, Tuple[InterviewPhase, ...]] = {
        InterviewPhase.IDLE: (InterviewPhase.GREETING,),
        InterviewPhase.GREETING: (InterviewPhase.TECHNICAL,),
        InterviewPhase.TECHNICAL: (InterviewPhase.EVALUATION,),
        InterviewPhase.EVALUATION: (InterviewPhase.COMPLETED,),
        InterviewPhase.COMPLETED: (),
    }

    # Number of exchanges before auto-transitioning to next phase
    PHASE_EXCHANGE_LIMITS = {
        InterviewPhase.GREETING: 3,
        InterviewPhase.TECHNICAL: 10,
        InterviewPhase.EVALUATION: 1,
    }

    def __init__(
        self,
        evaluator: EvaluatorService,
        memory: MemoryService,
        guardrails: GuardrailsService,
        personality_service: PersonalityService,
        llm_service: Optional[LLMService] = None,
    ):
        self.evaluator = evaluator
        self.memory = memory
        self.guardrails = guardrails
        self.personality_service = personality_service
        self.llm_service = llm_service or LLMService()
        self._sessions: Dict[UUID, InterviewSession] = {}
        self._phase_handlers: Dict[InterviewPhase, Callable] = {
            InterviewPhase.GREETING: self._handle_greeting,
            InterviewPhase.TECHNICAL: self._handle_technical,
            InterviewPhase.EVALUATION: self._handle_evaluation,
        }

    def create_session(
        self,
        candidate_name: str,
        target_role: str,
        company_context: Optional[str] = None,
        personality_id: str = "default",
    ) -> InterviewSession:
        """Create a new interview session."""
        session = InterviewSession(
            candidate_name=candidate_name,
            target_role=target_role,
            company_context=company_context,
            personality_id=personality_id,
        )
        self._sessions[session.session_id] = session
        logger.info(f"Created session {session.session_id} for {candidate_name}")
        return session

    def get_session(self, session_id: UUID) -> Optional[InterviewSession]:
        """Retrieve a session by ID."""
        return self._sessions.get(session_id)

    def start_interview(self, session_id: UUID) -> Tuple[InterviewPhase, str]:
        """
        Start the interview, transitioning from IDLE to GREETING.

        Returns the new phase and the interviewer's greeting message.
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        self._transition_phase(session, InterviewPhase.GREETING)
        personality = self.personality_service.get_personality(session.personality_id)
        greeting = self._generate_greeting(session, personality)

        self._add_transcript_entry(session, "interviewer", greeting)
        return session.phase, greeting

    def process_candidate_message(
        self, session_id: UUID, content: str
    ) -> Tuple[InterviewPhase, str, Optional[EvaluationResult]]:
        """
        Process a candidate's message and generate the interviewer's response.

        Returns:
            Tuple of (current_phase, interviewer_response, evaluation_result_if_complete)
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Apply guardrails to candidate input
        filtered_content, was_filtered = self.guardrails.filter_input(content)
        if was_filtered:
            logger.warning(f"Content filtered for session {session_id}")

        # Add candidate message to transcript
        self._add_transcript_entry(session, "candidate", filtered_content)

        # Check for automatic phase transitions
        self._check_auto_transition(session)

        # Get phase handler
        handler = self._phase_handlers.get(session.phase)
        if not handler:
            return session.phase, "", None

        # Generate response
        response, evaluation = handler(session)

        # Add interviewer response to transcript
        if response:
            self._add_transcript_entry(session, "interviewer", response)

        # Store in memory
        self.memory.store_exchange(session, filtered_content, response)

        return session.phase, response, evaluation

    def end_interview(self, session_id: UUID) -> Optional[EvaluationResult]:
        """Force end the interview and return evaluation if available."""
        session = self._sessions.get(session_id)
        if not session:
            return None

        if session.phase not in (InterviewPhase.EVALUATION, InterviewPhase.COMPLETED):
            self._transition_phase(session, InterviewPhase.EVALUATION)
            _, evaluation = self._handle_evaluation(session)
            return evaluation

        return session.evaluation

    def _transition_phase(self, session: InterviewSession, new_phase: InterviewPhase) -> None:
        """Transition session to a new phase with validation."""
        valid_next = self.VALID_TRANSITIONS.get(session.phase, ())
        if new_phase not in valid_next:
            raise StateTransitionError(
                f"Invalid transition from {session.phase} to {new_phase}"
            )

        logger.info(f"Session {session.session_id}: {session.phase} -> {new_phase}")
        session.phase = new_phase
        session.updated_at = datetime.utcnow()

    def _check_auto_transition(self, session: InterviewSession) -> None:
        """Check if session should auto-transition based on exchange count."""
        phase_entries = [e for e in session.transcript if e.phase == session.phase]
        # Count exchanges (pairs of interviewer + candidate messages)
        exchange_count = len([e for e in phase_entries if e.role == "candidate"])

        limit = self.PHASE_EXCHANGE_LIMITS.get(session.phase, float("inf"))
        if exchange_count >= limit:
            valid_next = self.VALID_TRANSITIONS.get(session.phase, ())
            if valid_next:
                self._transition_phase(session, valid_next[0])

    def _add_transcript_entry(
        self, session: InterviewSession, role: str, content: str
    ) -> None:
        """Add an entry to the session transcript."""
        entry = TranscriptEntry(role=role, content=content, phase=session.phase)
        session.transcript.append(entry)
        session.updated_at = datetime.utcnow()

    def _generate_greeting(
        self, session: InterviewSession, personality: PersonalityConfig
    ) -> str:
        """Generate the initial greeting message."""
        return (
            f"Hello {session.candidate_name}! I'm {personality.name}, and I'll be your "
            f"interviewer today for the {session.target_role} position. "
            f"{personality.phase_prompts.greeting} "
            "Before we begin, could you briefly introduce yourself and tell me "
            "what interests you about this role?"
        )

    def _handle_greeting(self, session: InterviewSession) -> Tuple[str, None]:
        """Handle messages during the greeting phase."""
        personality = self.personality_service.get_personality(session.personality_id)

        # Get the last candidate message
        candidate_messages = [e for e in session.transcript if e.role == "candidate"]
        last_message = candidate_messages[-1].content if candidate_messages else ""

        # Generate response using LLM
        response = self.llm_service.generate_response(session, personality, last_message)
        return response, None

    def _handle_technical(self, session: InterviewSession) -> Tuple[str, None]:
        """Handle messages during the technical phase."""
        personality = self.personality_service.get_personality(session.personality_id)

        # Get the last candidate message
        candidate_messages = [e for e in session.transcript if e.role == "candidate"]
        last_message = candidate_messages[-1].content if candidate_messages else ""

        # Generate contextual response using LLM
        response = self.llm_service.generate_response(session, personality, last_message)
        return response, None

    def _handle_evaluation(self, session: InterviewSession) -> Tuple[str, EvaluationResult]:
        """Handle the evaluation phase - score the interview."""
        # Perform evaluation
        evaluation = self.evaluator.evaluate(session)
        session.evaluation = evaluation

        # Transition to completed
        self._transition_phase(session, InterviewPhase.COMPLETED)

        # Generate closing message
        closing = (
            f"Thank you for your time today, {session.candidate_name}. "
            "We've completed the interview. You'll receive your results shortly."
        )

        return closing, evaluation
