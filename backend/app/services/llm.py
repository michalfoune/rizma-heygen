"""
LLM Service for interview response generation.

Uses Anthropic's Claude API to generate contextual interviewer responses.
"""

import logging
from typing import List, Dict, Optional

import anthropic

from ..config import get_settings
from ..models import InterviewSession, PersonalityConfig, InterviewPhase

logger = logging.getLogger(__name__)


class LLMService:
    """Service for LLM-powered interview response generation."""

    def __init__(self, api_key: Optional[str] = None):
        settings = get_settings()
        self.api_key = api_key or settings.anthropic_api_key
        self.client = anthropic.Anthropic(api_key=self.api_key) if self.api_key else None

    def generate_response(
        self,
        session: InterviewSession,
        personality: PersonalityConfig,
        candidate_message: str,
    ) -> str:
        """
        Generate an interviewer response using Claude.

        Args:
            session: Current interview session with transcript
            personality: Interviewer personality configuration
            candidate_message: The candidate's latest message

        Returns:
            Interviewer response string
        """
        if not self.client:
            logger.warning("Anthropic API key not configured, using fallback")
            return self._fallback_response(session)

        try:
            system_prompt = self._build_system_prompt(session, personality)
            messages = self._build_messages(session, candidate_message)

            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=300,
                system=system_prompt,
                messages=messages,
            )

            return response.content[0].text

        except Exception as e:
            logger.error(f"LLM generation error: {e}")
            return self._fallback_response(session)

    def _build_system_prompt(
        self, session: InterviewSession, personality: PersonalityConfig
    ) -> str:
        """Build the system prompt for the interviewer."""
        phase_instructions = {
            InterviewPhase.GREETING: """You are in the GREETING phase.
- Warmly acknowledge the candidate's introduction
- Show genuine interest in their background
- After 1-2 exchanges, naturally transition to technical questions
- Keep responses concise (2-3 sentences max)""",
            InterviewPhase.TECHNICAL: """You are in the TECHNICAL phase.
- Ask relevant technical questions for the role
- Listen carefully and acknowledge the candidate's answers
- Ask follow-up questions based on their responses
- Probe deeper if answers are vague
- Keep responses conversational and concise (2-3 sentences max)
- Don't repeat the same question""",
            InterviewPhase.EVALUATION: """You are wrapping up the interview.
- Thank the candidate for their time
- Keep it brief and professional""",
        }

        return f"""You are {personality.name}, a professional job interviewer.

PERSONALITY:
{personality.persona_background}

INTERVIEWING STYLE:
{personality.interviewing_style}

CURRENT PHASE: {session.phase.value}
{phase_instructions.get(session.phase, '')}

ROLE BEING INTERVIEWED FOR: {session.target_role}
CANDIDATE NAME: {session.candidate_name}

IMPORTANT RULES:
- Keep responses SHORT (2-3 sentences max) since they will be spoken aloud
- Acknowledge what the candidate said before asking the next question
- Never repeat the exact same question
- Be conversational and natural
- Don't use bullet points or lists - speak naturally
- Don't be overly formal or robotic"""

    def _build_messages(
        self, session: InterviewSession, current_message: str
    ) -> List[Dict[str, str]]:
        """Build the message history for the API call."""
        messages = []

        # Add transcript history (last 10 messages for context)
        recent_transcript = session.transcript[-10:] if len(session.transcript) > 10 else session.transcript

        for entry in recent_transcript:
            role = "assistant" if entry.role == "interviewer" else "user"
            messages.append({"role": role, "content": entry.content})

        # Add current message if not already in transcript
        if not messages or messages[-1]["content"] != current_message:
            messages.append({"role": "user", "content": current_message})

        return messages

    def _fallback_response(self, session: InterviewSession) -> str:
        """Fallback response when LLM is unavailable."""
        if session.phase == InterviewPhase.GREETING:
            return "Thank you for that introduction. Let's move on to some technical questions."
        elif session.phase == InterviewPhase.TECHNICAL:
            return "That's an interesting perspective. Can you tell me more about your approach?"
        else:
            return "Thank you for your time today."
