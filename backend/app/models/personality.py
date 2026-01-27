"""Personality configuration models for the Transferable Personality system."""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class ToneParameters(BaseModel):
    """Voice and communication tone parameters."""

    formality: float = Field(0.7, ge=0, le=1, description="0=casual, 1=formal")
    warmth: float = Field(0.6, ge=0, le=1, description="0=cold, 1=warm")
    directness: float = Field(0.7, ge=0, le=1, description="0=indirect, 1=direct")
    pace: float = Field(0.5, ge=0, le=1, description="0=slow, 1=fast")


class BehaviorRules(BaseModel):
    """Behavioral rules for the interviewer persona."""

    max_follow_up_questions: int = Field(2, ge=0, le=5)
    allow_hints: bool = True
    challenge_weak_answers: bool = True
    praise_strong_answers: bool = True


class PhasePrompts(BaseModel):
    """Custom prompts for each interview phase."""

    greeting: str = "Warmly greet the candidate and introduce yourself."
    technical_intro: str = "Transition to technical questions with a brief explanation."
    evaluation_intro: str = "Thank the candidate and explain you'll now evaluate."


class PersonalityConfig(BaseModel):
    """
    Transferable Personality configuration.

    This defines the interviewer's persona, allowing for easy swapping
    of interview styles without changing the core logic.
    """

    id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field("", max_length=500)

    # Avatar settings
    avatar_id: str = Field("default_interviewer")
    voice_id: str = Field("en-US-JennyNeural")

    # Personality parameters
    tone: ToneParameters = Field(default_factory=ToneParameters)
    behavior: BehaviorRules = Field(default_factory=BehaviorRules)
    phase_prompts: PhasePrompts = Field(default_factory=PhasePrompts)

    # System prompt additions
    persona_background: str = Field(
        "You are an experienced technical interviewer with 10+ years in the industry."
    )
    interviewing_style: str = Field(
        "You ask thoughtful questions and listen actively to responses."
    )

    # Company-specific context injection points
    company_values: List[str] = Field(default_factory=list)
    evaluation_criteria: Dict[str, float] = Field(
        default_factory=lambda: {
            "technical_accuracy": 0.4,
            "communication": 0.3,
            "problem_solving": 0.3,
        }
    )

    def get_system_prompt(self) -> str:
        """Generate the complete system prompt for this personality."""
        values_str = ", ".join(self.company_values) if self.company_values else "excellence"

        return f"""You are an interviewer named {self.name}.

Background: {self.persona_background}

Style: {self.interviewing_style}

Tone Guidelines:
- Formality level: {self.tone.formality:.0%}
- Warmth level: {self.tone.warmth:.0%}
- Directness level: {self.tone.directness:.0%}

Company Values: {values_str}

Behavioral Rules:
- Maximum follow-up questions per topic: {self.behavior.max_follow_up_questions}
- Provide hints when candidate struggles: {self.behavior.allow_hints}
- Challenge weak or incomplete answers: {self.behavior.challenge_weak_answers}
- Acknowledge strong answers: {self.behavior.praise_strong_answers}

Remember to maintain this persona consistently throughout the interview."""
