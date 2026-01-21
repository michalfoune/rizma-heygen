"""
Personality Service for the Transferable Personality system.

Manages loading, storing, and swapping interviewer personas.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Optional

from ..models import PersonalityConfig

logger = logging.getLogger(__name__)


# Default personality configuration
DEFAULT_PERSONALITY = PersonalityConfig(
    id="default",
    name="Sarah",
    description="A friendly and professional technical interviewer",
    avatar_id="default_interviewer",
    voice_id="en-US-JennyNeural",
    persona_background=(
        "You are Sarah, a Senior Engineering Manager with 12 years of experience "
        "in tech. You've conducted hundreds of interviews and are known for putting "
        "candidates at ease while still maintaining high standards."
    ),
    interviewing_style=(
        "You ask clear, direct questions and give candidates time to think. "
        "You're encouraging but honest, and you probe deeper when answers are vague."
    ),
    company_values=["innovation", "collaboration", "excellence", "integrity"],
)

# Alternative personalities for persona swapping
STRICT_PERSONALITY = PersonalityConfig(
    id="strict",
    name="Michael",
    description="A demanding and thorough technical interviewer",
    avatar_id="strict_interviewer",
    voice_id="en-US-GuyNeural",
    persona_background=(
        "You are Michael, a Principal Engineer with 15 years of experience. "
        "You're known for your rigorous technical assessments and high expectations."
    ),
    interviewing_style=(
        "You ask challenging technical questions and expect precise answers. "
        "You don't accept vague responses and will push for specifics."
    ),
    company_values=["technical excellence", "precision", "accountability"],
)

FRIENDLY_PERSONALITY = PersonalityConfig(
    id="friendly",
    name="Emma",
    description="A warm and encouraging interviewer focused on culture fit",
    avatar_id="friendly_interviewer",
    voice_id="en-US-AriaNeural",
    persona_background=(
        "You are Emma, a People Operations Lead with a background in psychology. "
        "You specialize in assessing culture fit and soft skills."
    ),
    interviewing_style=(
        "You create a comfortable atmosphere and focus on understanding "
        "the whole person. You use behavioral questions and listen actively."
    ),
    company_values=["empathy", "growth mindset", "teamwork", "authenticity"],
)


class PersonalityService:
    """
    Service for managing interviewer personalities.

    Supports:
    - Loading personalities from config files
    - Runtime persona swapping
    - Custom personality creation
    - Personality validation
    """

    def __init__(self, config_dir: Optional[Path] = None):
        """
        Initialize personality service.

        Args:
            config_dir: Optional directory containing personality JSON files
        """
        self._personalities: Dict[str, PersonalityConfig] = {}
        self._config_dir = config_dir

        # Load built-in personalities
        self._load_builtin_personalities()

        # Load custom personalities from config directory
        if config_dir:
            self._load_custom_personalities()

    def _load_builtin_personalities(self) -> None:
        """Load the built-in personality configurations."""
        for personality in [DEFAULT_PERSONALITY, STRICT_PERSONALITY, FRIENDLY_PERSONALITY]:
            self._personalities[personality.id] = personality
        logger.info(f"Loaded {len(self._personalities)} built-in personalities")

    def _load_custom_personalities(self) -> None:
        """Load custom personalities from JSON files in config directory."""
        if not self._config_dir or not self._config_dir.exists():
            return

        for json_file in self._config_dir.glob("*.json"):
            try:
                with open(json_file) as f:
                    data = json.load(f)
                personality = PersonalityConfig(**data)
                self._personalities[personality.id] = personality
                logger.info(f"Loaded custom personality: {personality.id}")
            except Exception as e:
                logger.error(f"Failed to load personality from {json_file}: {e}")

    def get_personality(self, personality_id: str) -> PersonalityConfig:
        """
        Get a personality configuration by ID.

        Falls back to default if not found.
        """
        personality = self._personalities.get(personality_id)
        if not personality:
            logger.warning(f"Personality '{personality_id}' not found, using default")
            return self._personalities["default"]
        return personality

    def list_personalities(self) -> Dict[str, str]:
        """List all available personalities with their descriptions."""
        return {
            pid: p.description
            for pid, p in self._personalities.items()
        }

    def register_personality(self, personality: PersonalityConfig) -> None:
        """Register a new personality at runtime."""
        if personality.id in self._personalities:
            logger.warning(f"Overwriting existing personality: {personality.id}")
        self._personalities[personality.id] = personality
        logger.info(f"Registered personality: {personality.id}")

    def create_custom_personality(
        self,
        personality_id: str,
        name: str,
        persona_background: str,
        interviewing_style: str,
        **kwargs,
    ) -> PersonalityConfig:
        """
        Create and register a custom personality.

        Args:
            personality_id: Unique identifier
            name: Display name for the interviewer
            persona_background: Background story/context
            interviewing_style: How they conduct interviews
            **kwargs: Additional PersonalityConfig fields

        Returns:
            The created PersonalityConfig
        """
        personality = PersonalityConfig(
            id=personality_id,
            name=name,
            persona_background=persona_background,
            interviewing_style=interviewing_style,
            **kwargs,
        )
        self.register_personality(personality)
        return personality

    def get_system_prompt(self, personality_id: str) -> str:
        """Get the complete system prompt for a personality."""
        personality = self.get_personality(personality_id)
        return personality.get_system_prompt()

    def save_personality(self, personality_id: str, filepath: Path) -> None:
        """Save a personality configuration to a JSON file."""
        personality = self.get_personality(personality_id)
        with open(filepath, "w") as f:
            json.dump(personality.model_dump(), f, indent=2)
        logger.info(f"Saved personality '{personality_id}' to {filepath}")
