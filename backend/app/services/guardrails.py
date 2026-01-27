"""
Guardrails Service for content filtering.

Filters toxic, off-topic, and inappropriate responses
to maintain professional interview standards.
"""

import logging
import re
from typing import List, Set, Tuple

logger = logging.getLogger(__name__)


class GuardrailsService:
    """
    Content filtering service for interview safety.

    Provides:
    - Toxic content detection and filtering
    - Off-topic response detection
    - PII (Personally Identifiable Information) redaction
    - Profanity filtering
    """

    # Toxic/inappropriate patterns (simplified - production would use ML models)
    TOXIC_PATTERNS: List[str] = [
        r'\b(hate|kill|die|attack|violent)\b',
        r'\b(stupid|idiot|dumb|loser)\b',
        r'\bfuck\b|\bshit\b|\bdamn\b|\bass\b',
    ]

    # Off-topic indicators
    OFF_TOPIC_PATTERNS: List[str] = [
        r'\b(politics|religion|dating|gossip)\b',
        r'\b(what time is it|weather today|sports score)\b',
    ]

    # PII patterns for redaction
    PII_PATTERNS = {
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phone": r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
        "ssn": r'\b\d{3}-\d{2}-\d{4}\b',
        "credit_card": r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
    }

    # Allowed interview topics
    ALLOWED_TOPICS: Set[str] = {
        "experience", "skills", "project", "team", "challenge",
        "problem", "solution", "technology", "code", "design",
        "leadership", "communication", "goal", "achievement",
        "company", "role", "career", "learning", "growth",
    }

    def __init__(self, strict_mode: bool = False):
        """
        Initialize guardrails service.

        Args:
            strict_mode: If True, applies more aggressive filtering
        """
        self.strict_mode = strict_mode
        self._compiled_toxic = [re.compile(p, re.IGNORECASE) for p in self.TOXIC_PATTERNS]
        self._compiled_off_topic = [re.compile(p, re.IGNORECASE) for p in self.OFF_TOPIC_PATTERNS]
        self._compiled_pii = {k: re.compile(v) for k, v in self.PII_PATTERNS.items()}

    def filter_input(self, content: str) -> Tuple[str, bool]:
        """
        Filter candidate input for safety.

        Returns:
            Tuple of (filtered_content, was_modified)
        """
        original = content
        filtered = content

        # Remove toxic content
        filtered = self._remove_toxic(filtered)

        # Redact PII
        filtered = self._redact_pii(filtered)

        # Check for off-topic (log but don't block)
        if self._is_off_topic(filtered):
            logger.warning(f"Off-topic content detected: {filtered[:50]}...")

        was_modified = filtered != original
        if was_modified:
            logger.info("Content was filtered by guardrails")

        return filtered.strip(), was_modified

    def filter_output(self, content: str) -> Tuple[str, bool]:
        """
        Filter interviewer output for safety.

        Ensures AI responses maintain professional standards.
        """
        original = content
        filtered = content

        # Remove any accidental toxic content
        filtered = self._remove_toxic(filtered)

        # Ensure professional tone (simplified check)
        filtered = self._ensure_professional(filtered)

        was_modified = filtered != original
        return filtered.strip(), was_modified

    def _remove_toxic(self, content: str) -> str:
        """Remove toxic patterns from content."""
        result = content
        for pattern in self._compiled_toxic:
            result = pattern.sub("[filtered]", result)
        return result

    def _redact_pii(self, content: str) -> str:
        """Redact personally identifiable information."""
        result = content
        for pii_type, pattern in self._compiled_pii.items():
            result = pattern.sub(f"[REDACTED_{pii_type.upper()}]", result)
        return result

    def _is_off_topic(self, content: str) -> bool:
        """Check if content appears to be off-topic."""
        content_lower = content.lower()

        # Check for off-topic patterns
        for pattern in self._compiled_off_topic:
            if pattern.search(content_lower):
                return True

        # In strict mode, also check for lack of relevant topics
        if self.strict_mode:
            words = set(content_lower.split())
            has_relevant = bool(words & self.ALLOWED_TOPICS)
            if not has_relevant and len(words) > 10:
                return True

        return False

    def _ensure_professional(self, content: str) -> str:
        """Ensure content maintains professional tone."""
        # Remove excessive punctuation
        content = re.sub(r'[!]{2,}', '!', content)
        content = re.sub(r'[?]{2,}', '?', content)

        # Remove emojis (simplified)
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"
            "\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF"
            "\U0001F1E0-\U0001F1FF"
            "]+",
            flags=re.UNICODE
        )
        content = emoji_pattern.sub("", content)

        return content

    def validate_response_length(
        self, content: str, min_words: int = 3, max_words: int = 500
    ) -> Tuple[bool, str]:
        """
        Validate response meets length requirements.

        Returns:
            Tuple of (is_valid, message)
        """
        word_count = len(content.split())

        if word_count < min_words:
            return False, f"Response too short. Please provide more detail (minimum {min_words} words)."

        if word_count > max_words:
            return False, f"Response too long. Please be more concise (maximum {max_words} words)."

        return True, ""

    def get_content_warnings(self, content: str) -> List[str]:
        """Get list of content warnings without filtering."""
        warnings = []

        for pattern in self._compiled_toxic:
            if pattern.search(content):
                warnings.append("Contains potentially inappropriate language")
                break

        if self._is_off_topic(content):
            warnings.append("May be off-topic for an interview context")

        for pii_type, pattern in self._compiled_pii.items():
            if pattern.search(content):
                warnings.append(f"Contains {pii_type.replace('_', ' ')}")

        return warnings
