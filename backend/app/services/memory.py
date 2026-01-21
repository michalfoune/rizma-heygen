"""
Memory Service for cross-session history.

Provides storage and retrieval of interview history for
context-aware conversations and analytics.
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from ..models import InterviewSession, TranscriptEntry

logger = logging.getLogger(__name__)


class MemoryEntry:
    """Single memory entry for storage."""

    def __init__(
        self,
        session_id: UUID,
        candidate_name: str,
        target_role: str,
        candidate_message: str,
        interviewer_response: str,
        timestamp: datetime,
    ):
        self.session_id = session_id
        self.candidate_name = candidate_name
        self.target_role = target_role
        self.candidate_message = candidate_message
        self.interviewer_response = interviewer_response
        self.timestamp = timestamp

    def to_dict(self) -> Dict:
        return {
            "session_id": str(self.session_id),
            "candidate_name": self.candidate_name,
            "target_role": self.target_role,
            "candidate_message": self.candidate_message,
            "interviewer_response": self.interviewer_response,
            "timestamp": self.timestamp.isoformat(),
        }


class MemoryService:
    """
    Memory service for storing and retrieving interview history.

    Supports:
    - In-memory storage (default)
    - Redis backend (when configured)
    - Cross-session context retrieval
    - Analytics data aggregation
    """

    def __init__(self, redis_url: Optional[str] = None):
        self._redis_url = redis_url
        self._redis_client = None
        self._memory: Dict[str, List[MemoryEntry]] = {}

        if redis_url:
            self._init_redis()

    def _init_redis(self) -> None:
        """Initialize Redis connection if URL provided."""
        try:
            import redis
            self._redis_client = redis.from_url(self._redis_url)
            self._redis_client.ping()
            logger.info("Connected to Redis for memory storage")
        except Exception as e:
            logger.warning(f"Redis connection failed, using in-memory storage: {e}")
            self._redis_client = None

    def store_exchange(
        self,
        session: InterviewSession,
        candidate_message: str,
        interviewer_response: str,
    ) -> None:
        """Store a candidate-interviewer exchange."""
        entry = MemoryEntry(
            session_id=session.session_id,
            candidate_name=session.candidate_name,
            target_role=session.target_role,
            candidate_message=candidate_message,
            interviewer_response=interviewer_response,
            timestamp=datetime.utcnow(),
        )

        key = f"memory:{session.candidate_name.lower().replace(' ', '_')}"

        if self._redis_client:
            self._store_redis(key, entry)
        else:
            self._store_memory(key, entry)

        logger.debug(f"Stored exchange for {session.candidate_name}")

    def _store_memory(self, key: str, entry: MemoryEntry) -> None:
        """Store entry in local memory."""
        if key not in self._memory:
            self._memory[key] = []
        self._memory[key].append(entry)

    def _store_redis(self, key: str, entry: MemoryEntry) -> None:
        """Store entry in Redis."""
        try:
            self._redis_client.rpush(key, json.dumps(entry.to_dict()))
            # Set expiry to 30 days
            self._redis_client.expire(key, 60 * 60 * 24 * 30)
        except Exception as e:
            logger.error(f"Redis store failed: {e}")
            # Fallback to memory
            self._store_memory(key, entry)

    def get_candidate_history(
        self, candidate_name: str, limit: int = 10
    ) -> List[Dict]:
        """Retrieve previous interview history for a candidate."""
        key = f"memory:{candidate_name.lower().replace(' ', '_')}"

        if self._redis_client:
            return self._get_redis_history(key, limit)
        return self._get_memory_history(key, limit)

    def _get_memory_history(self, key: str, limit: int) -> List[Dict]:
        """Get history from local memory."""
        entries = self._memory.get(key, [])
        return [e.to_dict() for e in entries[-limit:]]

    def _get_redis_history(self, key: str, limit: int) -> List[Dict]:
        """Get history from Redis."""
        try:
            entries = self._redis_client.lrange(key, -limit, -1)
            return [json.loads(e) for e in entries]
        except Exception as e:
            logger.error(f"Redis retrieve failed: {e}")
            return self._get_memory_history(key, limit)

    def get_session_transcript(self, session: InterviewSession) -> List[Dict]:
        """Get formatted transcript for a session."""
        return [
            {
                "role": entry.role,
                "content": entry.content,
                "timestamp": entry.timestamp.isoformat(),
                "phase": entry.phase.value,
            }
            for entry in session.transcript
        ]

    def get_context_for_llm(
        self, session: InterviewSession, max_entries: int = 5
    ) -> str:
        """
        Generate context string for LLM prompts.

        Includes recent conversation history and any relevant
        past interview context for the candidate.
        """
        context_parts = []

        # Current session context
        recent_transcript = session.transcript[-max_entries * 2:]
        if recent_transcript:
            context_parts.append("Recent conversation:")
            for entry in recent_transcript:
                role = "Interviewer" if entry.role == "interviewer" else "Candidate"
                context_parts.append(f"  {role}: {entry.content[:200]}")

        # Historical context (if available)
        history = self.get_candidate_history(session.candidate_name, limit=3)
        if history:
            context_parts.append("\nPrevious interview highlights:")
            for h in history:
                context_parts.append(f"  - {h['candidate_message'][:100]}...")

        return "\n".join(context_parts)

    def clear_session(self, session_id: UUID) -> None:
        """Clear memory for a specific session (for privacy/cleanup)."""
        # Note: This clears from local memory only
        # Redis entries expire automatically
        keys_to_remove = []
        for key, entries in self._memory.items():
            self._memory[key] = [
                e for e in entries if e.session_id != session_id
            ]
            if not self._memory[key]:
                keys_to_remove.append(key)

        for key in keys_to_remove:
            del self._memory[key]

        logger.info(f"Cleared memory for session {session_id}")
