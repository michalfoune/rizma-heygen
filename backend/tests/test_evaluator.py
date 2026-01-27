"""Tests for the EvaluatorService."""

import pytest
from datetime import datetime
from uuid import uuid4

from app.models import InterviewSession, TranscriptEntry, InterviewPhase
from app.services.evaluator import EvaluatorService


@pytest.fixture
def evaluator():
    return EvaluatorService(passing_score=80)


@pytest.fixture
def sample_session():
    session = InterviewSession(
        candidate_name="Test Candidate",
        target_role="Software Engineer",
    )
    return session


def create_entry(role: str, content: str, phase: InterviewPhase) -> TranscriptEntry:
    return TranscriptEntry(
        id=uuid4(),
        role=role,
        content=content,
        timestamp=datetime.utcnow(),
        phase=phase,
    )


class TestEvaluatorService:
    def test_empty_transcript_returns_zero(self, evaluator, sample_session):
        """Empty transcript should return score of 0."""
        result = evaluator.evaluate(sample_session)
        assert result.score == 0
        assert result.passed is False

    def test_strong_responses_pass(self, evaluator, sample_session):
        """Strong, detailed responses should pass."""
        sample_session.transcript = [
            create_entry(
                "candidate",
                "I implemented a distributed caching system that reduced API latency by 40%. "
                "I designed the architecture using Redis clusters and carefully tested the solution "
                "before deploying to production. As a result, we achieved significant performance improvements.",
                InterviewPhase.TECHNICAL,
            ),
            create_entry(
                "candidate",
                "First, I analyzed the problem systematically. Second, I collaborated with "
                "my team to identify the root cause. Finally, we delivered a solution that "
                "exceeded expectations. I believe this approach demonstrates my problem-solving skills.",
                InterviewPhase.TECHNICAL,
            ),
        ]

        result = evaluator.evaluate(sample_session)
        assert result.score >= 70  # Should score well
        assert result.feedback.technical_fit > 50

    def test_weak_responses_fail(self, evaluator, sample_session):
        """Weak, vague responses should not pass."""
        sample_session.transcript = [
            create_entry(
                "candidate",
                "I don't know, maybe I did some stuff.",
                InterviewPhase.TECHNICAL,
            ),
            create_entry(
                "candidate",
                "Um, I guess I sort of worked on things.",
                InterviewPhase.TECHNICAL,
            ),
        ]

        result = evaluator.evaluate(sample_session)
        assert result.passed is False
        assert result.score < 80

    def test_evaluation_generates_summary(self, evaluator, sample_session):
        """Evaluation should generate a meaningful summary."""
        sample_session.transcript = [
            create_entry(
                "candidate",
                "I have experience with Python and JavaScript.",
                InterviewPhase.TECHNICAL,
            ),
        ]

        result = evaluator.evaluate(sample_session)
        assert result.summary
        assert len(result.summary) > 0
