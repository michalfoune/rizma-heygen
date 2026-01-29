"""WebSocket endpoint for real-time interview communication."""

import json
import logging
from typing import Dict
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect

from ..models import WebSocketMessage, InterviewPhase
from ..services import InterviewOrchestrator

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        self.active_connections: Dict[UUID, WebSocket] = {}

    async def connect(self, session_id: UUID, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[session_id] = websocket
        logger.info(f"WebSocket connected for session {session_id}")

    def disconnect(self, session_id: UUID) -> None:
        """Remove a WebSocket connection."""
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            logger.info(f"WebSocket disconnected for session {session_id}")

    async def send_message(self, session_id: UUID, message: WebSocketMessage) -> None:
        """Send a message to a specific session."""
        websocket = self.active_connections.get(session_id)
        if websocket:
            await websocket.send_json(message.model_dump())

    async def broadcast(self, message: WebSocketMessage) -> None:
        """Broadcast a message to all connected sessions."""
        for websocket in self.active_connections.values():
            await websocket.send_json(message.model_dump())


# Global connection manager instance
manager = ConnectionManager()


async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    orchestrator: InterviewOrchestrator,
) -> None:
    """
    WebSocket endpoint for interview session communication.

    Handles:
    - Session start/stop signals
    - Candidate message processing
    - Real-time transcript updates
    - Evaluation results
    """
    try:
        session_uuid = UUID(session_id)
    except ValueError:
        await websocket.close(code=4000, reason="Invalid session ID")
        return

    # Verify session exists
    session = orchestrator.get_session(session_uuid)
    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    await manager.connect(session_uuid, websocket)

    try:
        # Start the interview and send greeting
        phase, greeting = orchestrator.start_interview(session_uuid)

        # Send initial state
        await manager.send_message(
            session_uuid,
            WebSocketMessage(type="state_update", payload=phase.value),
        )

        # Send greeting as transcript entry
        await manager.send_message(
            session_uuid,
            WebSocketMessage(
                type="transcript_entry",
                payload={
                    "id": str(session.transcript[-1].id),
                    "role": "interviewer",
                    "content": greeting,
                    "timestamp": session.transcript[-1].timestamp.isoformat(),
                    "phase": phase.value,
                },
            ),
        )

        # Send avatar speak command
        await manager.send_message(
            session_uuid,
            WebSocketMessage(type="avatar_speak", payload={"text": greeting}),
        )

        # Main message loop
        while True:
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                await handle_client_message(session_uuid, message, orchestrator)
            except json.JSONDecodeError:
                await manager.send_message(
                    session_uuid,
                    WebSocketMessage(type="error", payload="Invalid JSON"),
                )

    except WebSocketDisconnect:
        manager.disconnect(session_uuid)
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}")
        manager.disconnect(session_uuid)
        raise


async def handle_client_message(
    session_id: UUID,
    message: dict,
    orchestrator: InterviewOrchestrator,
) -> None:
    """Handle incoming WebSocket messages from the client."""
    msg_type = message.get("type")
    payload = message.get("payload", {})

    if msg_type == "transcript_entry":
        # Process candidate message immediately - frontend handles debouncing
        content = payload.get("content", "")
        if not content:
            return

        logger.info(f"Processing message for {session_id}: {content[:100]}...")

        phase, response, evaluation = orchestrator.process_candidate_message(
            session_id, content
        )

        # Send user message as transcript entry (frontend doesn't add locally anymore)
        session = orchestrator.get_session(session_id)
        candidate_entries = [e for e in session.transcript if e.role == "candidate"]
        if candidate_entries:
            last_candidate = candidate_entries[-1]
            await manager.send_message(
                session_id,
                WebSocketMessage(
                    type="transcript_entry",
                    payload={
                        "id": str(last_candidate.id),
                        "role": "candidate",
                        "content": content,
                        "timestamp": last_candidate.timestamp.isoformat(),
                        "phase": phase.value,
                    },
                ),
            )

        # Send state update if phase changed
        await manager.send_message(
            session_id,
            WebSocketMessage(type="state_update", payload=phase.value),
        )

        # Send interviewer response
        if response:
            await manager.send_message(
                session_id,
                WebSocketMessage(
                    type="transcript_entry",
                    payload={
                        "id": str(session.transcript[-1].id),
                        "role": "interviewer",
                        "content": response,
                        "timestamp": session.transcript[-1].timestamp.isoformat(),
                        "phase": phase.value,
                    },
                ),
            )

            # Send avatar speak command
            await manager.send_message(
                session_id,
                WebSocketMessage(type="avatar_speak", payload={"text": response}),
            )

        # Send evaluation if completed
        if evaluation:
            await manager.send_message(
                session_id,
                WebSocketMessage(
                    type="evaluation_result",
                    payload={
                        "score": evaluation.score,
                        "passed": evaluation.passed,
                        "feedback": {
                            "persuasion": evaluation.feedback.persuasion,
                            "technicalFit": evaluation.feedback.technical_fit,
                            "communication": evaluation.feedback.communication,
                        },
                        "summary": evaluation.summary,
                    },
                ),
            )

    elif msg_type == "state_update":
        action = payload.get("action")

        if action == "end_session":
            evaluation = orchestrator.end_interview(session_id)
            if evaluation:
                await manager.send_message(
                    session_id,
                    WebSocketMessage(
                        type="evaluation_result",
                        payload={
                            "score": evaluation.score,
                            "passed": evaluation.passed,
                            "feedback": {
                                "persuasion": evaluation.feedback.persuasion,
                                "technicalFit": evaluation.feedback.technical_fit,
                                "communication": evaluation.feedback.communication,
                            },
                            "summary": evaluation.summary,
                        },
                    ),
                )

        elif action == "ptt_start":
            # Push-to-talk started - could trigger audio recording
            logger.debug(f"PTT started for session {session_id}")

        elif action == "ptt_stop":
            # Push-to-talk stopped - could process recorded audio
            logger.debug(f"PTT stopped for session {session_id}")
