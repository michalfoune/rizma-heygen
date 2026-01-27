"""
Standalone Evaluator Service.

Scores interview transcripts on persuasion and technical fit.
Requires 80+ to pass.
"""

import logging
import re
from typing import Dict, List

from ..models import (
    InterviewSession,
    EvaluationResult,
    EvaluationFeedback,
    TranscriptEntry,
    InterviewPhase,
)

logger = logging.getLogger(__name__)


class EvaluatorService:
    """
    Evaluates interview performance based on transcript analysis.

    Scoring criteria:
    - Persuasion (30%): Confidence, clarity, and compelling arguments
    - Technical Fit (40%): Accuracy, depth, and relevance of technical answers
    - Communication (30%): Articulation, structure, and responsiveness

    Passing threshold: 80/100
    """

    PASSING_SCORE = 80

    # Keywords and phrases for scoring (would be replaced with LLM analysis in production)
    POSITIVE_TECHNICAL_INDICATORS = [
        "implemented", "designed", "architected", "optimized", "scaled",
        "tested", "deployed", "monitored", "debugged", "refactored",
        "algorithm", "data structure", "api", "database", "performance",
    ]

    POSITIVE_COMMUNICATION_INDICATORS = [
        "for example", "specifically", "in particular", "as a result",
        "because", "therefore", "first", "second", "finally",
        "i believe", "in my experience", "we achieved",
    ]

    WEAK_INDICATORS = [
        "i don't know", "not sure", "maybe", "i guess", "um", "uh",
        "kind of", "sort of", "i think so",
    ]

    def __init__(self, passing_score: int = 80):
        self.passing_score = passing_score

    def evaluate(self, session: InterviewSession) -> EvaluationResult:
        """
        Evaluate the complete interview transcript.

        Returns an EvaluationResult with score, pass/fail, and detailed feedback.
        """
        candidate_responses = [
            entry for entry in session.transcript
            if entry.role == "candidate"
        ]

        if not candidate_responses:
            return EvaluationResult(
                score=0,
                passed=False,
                feedback=EvaluationFeedback(
                    persuasion=0,
                    technical_fit=0,
                    communication=0,
                ),
                summary="No candidate responses to evaluate.",
            )

        # Calculate individual scores
        persuasion_score = self._score_persuasion(candidate_responses)
        technical_score = self._score_technical_fit(candidate_responses, session.target_role)
        communication_score = self._score_communication(candidate_responses)

        # Weighted average
        final_score = int(
            persuasion_score * 0.3 +
            technical_score * 0.4 +
            communication_score * 0.3
        )

        passed = final_score >= self.passing_score

        summary = self._generate_summary(
            persuasion_score, technical_score, communication_score, passed
        )

        logger.info(
            f"Evaluation for session {session.session_id}: "
            f"Score={final_score}, Passed={passed}"
        )

        return EvaluationResult(
            score=final_score,
            passed=passed,
            feedback=EvaluationFeedback(
                persuasion=persuasion_score,
                technical_fit=technical_score,
                communication=communication_score,
            ),
            summary=summary,
        )

    def _score_persuasion(self, responses: List[TranscriptEntry]) -> int:
        """
        Score persuasion based on confidence and compelling arguments.

        Analyzes:
        - Use of confident language
        - Presence of concrete examples
        - Absence of hedging language
        """
        total_text = " ".join(r.content.lower() for r in responses)
        word_count = len(total_text.split())

        if word_count == 0:
            return 0

        # Base score
        score = 50

        # Positive indicators
        confident_phrases = ["i achieved", "i led", "i delivered", "we succeeded", "resulted in"]
        for phrase in confident_phrases:
            if phrase in total_text:
                score += 5

        # Negative indicators (hedging)
        for indicator in self.WEAK_INDICATORS:
            count = total_text.count(indicator)
            score -= count * 3

        # Reward longer, more detailed responses
        avg_response_length = word_count / len(responses)
        if avg_response_length > 50:
            score += 10
        elif avg_response_length > 30:
            score += 5

        return max(0, min(100, score))

    def _score_technical_fit(
        self, responses: List[TranscriptEntry], target_role: str
    ) -> int:
        """
        Score technical competency based on keyword analysis.

        In production, this would use an LLM to assess:
        - Accuracy of technical statements
        - Depth of knowledge demonstrated
        - Relevance to the target role
        """
        total_text = " ".join(r.content.lower() for r in responses)

        # Base score
        score = 50

        # Technical keyword presence
        for keyword in self.POSITIVE_TECHNICAL_INDICATORS:
            if keyword in total_text:
                score += 4

        # Role-specific bonus (simplified)
        role_lower = target_role.lower()
        if "engineer" in role_lower and any(
            kw in total_text for kw in ["code", "programming", "development"]
        ):
            score += 10
        if "manager" in role_lower and any(
            kw in total_text for kw in ["team", "leadership", "project"]
        ):
            score += 10

        # Penalize very short technical responses
        tech_responses = [
            r for r in responses
            if r.phase == InterviewPhase.TECHNICAL
        ]
        if tech_responses:
            avg_length = sum(len(r.content.split()) for r in tech_responses) / len(tech_responses)
            if avg_length < 20:
                score -= 15

        return max(0, min(100, score))

    def _score_communication(self, responses: List[TranscriptEntry]) -> int:
        """
        Score communication clarity and structure.

        Analyzes:
        - Use of structured language (first, second, finally)
        - Sentence variety
        - Appropriate response length
        """
        total_text = " ".join(r.content.lower() for r in responses)

        # Base score
        score = 50

        # Structured communication indicators
        for indicator in self.POSITIVE_COMMUNICATION_INDICATORS:
            if indicator in total_text:
                score += 4

        # Sentence variety (rough approximation)
        sentences = re.split(r'[.!?]+', total_text)
        sentence_lengths = [len(s.split()) for s in sentences if s.strip()]
        if sentence_lengths:
            variance = sum((l - sum(sentence_lengths)/len(sentence_lengths))**2
                          for l in sentence_lengths) / len(sentence_lengths)
            if variance > 50:  # Good variety
                score += 10

        # Penalize weak language
        for indicator in self.WEAK_INDICATORS:
            if indicator in total_text:
                score -= 2

        return max(0, min(100, score))

    def _generate_summary(
        self,
        persuasion: int,
        technical: int,
        communication: int,
        passed: bool,
    ) -> str:
        """Generate a human-readable evaluation summary."""
        parts = []

        if passed:
            parts.append("Congratulations! You've passed the interview.")
        else:
            parts.append(
                f"Unfortunately, you did not meet the passing threshold of {self.passing_score}."
            )

        # Strength/weakness analysis
        scores = {
            "persuasion": persuasion,
            "technical knowledge": technical,
            "communication": communication,
        }
        strongest = max(scores, key=scores.get)
        weakest = min(scores, key=scores.get)

        parts.append(f"Your strongest area was {strongest} ({scores[strongest]}/100).")
        if scores[weakest] < 70:
            parts.append(
                f"Consider improving your {weakest} skills ({scores[weakest]}/100)."
            )

        return " ".join(parts)
