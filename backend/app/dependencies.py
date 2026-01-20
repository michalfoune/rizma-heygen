"""FastAPI dependency injection configuration."""

from functools import lru_cache
from typing import Generator

from .config import get_settings
from .services import (
    InterviewOrchestrator,
    EvaluatorService,
    MemoryService,
    GuardrailsService,
    PersonalityService,
    HeyGenService,
)


@lru_cache
def get_evaluator_service() -> EvaluatorService:
    """Get cached evaluator service instance."""
    settings = get_settings()
    return EvaluatorService(passing_score=settings.default_passing_score)


@lru_cache
def get_memory_service() -> MemoryService:
    """Get cached memory service instance."""
    settings = get_settings()
    return MemoryService(redis_url=settings.redis_url if settings.redis_url else None)


@lru_cache
def get_guardrails_service() -> GuardrailsService:
    """Get cached guardrails service instance."""
    return GuardrailsService(strict_mode=False)


@lru_cache
def get_personality_service() -> PersonalityService:
    """Get cached personality service instance."""
    return PersonalityService()


@lru_cache
def get_heygen_service() -> HeyGenService:
    """Get cached HeyGen service instance."""
    return HeyGenService()


@lru_cache
def get_orchestrator() -> InterviewOrchestrator:
    """Get cached orchestrator instance with all dependencies."""
    return InterviewOrchestrator(
        evaluator=get_evaluator_service(),
        memory=get_memory_service(),
        guardrails=get_guardrails_service(),
        personality_service=get_personality_service(),
    )
