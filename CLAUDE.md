# CLAUDE.md - Rizma.ai Development Guidelines

This file contains the architectural rules and coding standards for the Rizma.ai platform. Follow these guidelines when contributing to the codebase.

## Project Overview

Rizma.ai is a modular AI role-play platform for job interview simulation. The system uses an interactive HeyGen avatar as the interviewer, powered by a Python backend orchestrator.

## Architecture

### Hybrid Repository Structure

```
rizma-heygen/
├── frontend/           # TypeScript (Next.js) - UI & HeyGen SDK
│   ├── src/
│   │   ├── app/        # Next.js App Router pages
│   │   ├── components/ # React components (Avatar, Transcript, Controls)
│   │   ├── hooks/      # Custom hooks (useWebSocket, useInterview)
│   │   └── types/      # TypeScript interfaces
│   └── package.json
├── backend/            # Python (FastAPI) - Logic, RAG, Memory
│   ├── app/
│   │   ├── api/        # REST & WebSocket endpoints
│   │   ├── agents/     # LangGraph interview flows
│   │   ├── mcp/        # MCP tool integrations
│   │   ├── models/     # Pydantic schemas
│   │   └── services/   # Core business logic
│   └── tests/
└── CLAUDE.md
```

## Core Architectural Patterns

### 1. State-Driven Orchestrator

The interview flow is managed by a state machine in `backend/app/services/orchestrator.py`.

**Interview Phases:**
- `IDLE` - Session created, not started
- `GREETING` - Introduction phase (max 3 exchanges)
- `TECHNICAL` - Technical questions (max 10 exchanges)
- `EVALUATION` - Scoring phase
- `COMPLETED` - Interview finished

**Valid Transitions:**
```
IDLE -> GREETING -> TECHNICAL -> EVALUATION -> COMPLETED
```

**Rules:**
- Only one phase can be active at a time
- Phase transitions are explicit and logged
- Auto-transition occurs after exchange limits
- The orchestrator coordinates all services (evaluator, memory, guardrails)

### 2. Transferable Personality System

Interviewer personas are defined in `backend/app/services/personality.py` and `backend/app/models/personality.py`.

**Key Concepts:**
- Personalities are configs, not code changes
- Each personality defines: tone, behavior rules, phase prompts, system prompt
- Personas can be swapped at session creation
- Built-in personas: `default` (Sarah), `strict` (Michael), `friendly` (Emma)

**Adding a New Personality:**
```python
from app.models import PersonalityConfig

new_persona = PersonalityConfig(
    id="technical_expert",
    name="Alex",
    persona_background="Principal Engineer with 20 years experience...",
    interviewing_style="Deep technical probing...",
    company_values=["engineering excellence", "innovation"],
)
personality_service.register_personality(new_persona)
```

### 3. Standalone Evaluator

The `EvaluatorService` in `backend/app/services/evaluator.py` scores interviews independently.

**Scoring Criteria:**
- **Persuasion (30%)**: Confidence, concrete examples, lack of hedging
- **Technical Fit (40%)**: Accuracy, depth, role relevance
- **Communication (30%)**: Structure, clarity, articulation

**Passing Threshold:** 80/100 (configurable via `DEFAULT_PASSING_SCORE`)

**Rules:**
- Evaluator has no side effects on session state
- Scoring logic is deterministic for the same input
- In production, replace keyword analysis with LLM-based evaluation

### 4. MCP-Ready Tooling

Tool integrations follow the Model Context Protocol pattern in `backend/app/mcp/`.

**Structure:**
```python
from app.mcp import MCPTool, MCPToolSchema

class MyTool(MCPTool):
    @property
    def schema(self) -> MCPToolSchema:
        return MCPToolSchema(
            name="my_tool",
            description="What this tool does",
            parameters={...}  # JSON Schema
        )

    async def execute(self, **kwargs) -> Any:
        # Implementation
```

**Registry Usage:**
```python
registry = ToolRegistry()
registry.register(MyTool())
schemas = registry.get_schemas_for_llm()  # For Claude tool_use
```

### 5. Memory & Guardrails

**MemoryService** (`backend/app/services/memory.py`):
- Stores exchange history per candidate
- Supports in-memory or Redis backends
- Provides context for LLM prompts
- 30-day TTL for Redis entries

**GuardrailsService** (`backend/app/services/guardrails.py`):
- Filters toxic content
- Redacts PII (email, phone, SSN, credit card)
- Detects off-topic messages
- Ensures professional tone in outputs

## Frontend Guidelines

### HeyGen SDK Integration

Use `@heygen/streaming-avatar` via the `AvatarView` component.

```typescript
// Avatar initialization
const avatar = new StreamingAvatar({ token: heygenToken });
await avatar.createStartAvatar({
  avatarName: avatarId,
  quality: AvatarQuality.High,
  voice: { voiceId: 'en-US-JennyNeural' },
});

// Speaking
await avatar.speak({ text: message, taskType: TaskType.REPEAT });
```

### Push-to-Talk Pattern

```typescript
// Start recording
pushToTalkStart();
send({ type: 'state_update', payload: { action: 'ptt_start' } });

// Stop and send
pushToTalkStop();
send({ type: 'state_update', payload: { action: 'ptt_stop' } });
```

### WebSocket Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `state_update` | Bidirectional | Phase changes, PTT signals |
| `transcript_entry` | Bidirectional | Conversation messages |
| `evaluation_result` | Server->Client | Final scores |
| `avatar_speak` | Server->Client | Text for avatar to speak |
| `error` | Server->Client | Error notifications |

## Backend Guidelines

### API Conventions

- All REST endpoints under `/api/v1/`
- WebSocket at `/ws/{session_id}`
- Use Pydantic models for request/response validation
- Return appropriate HTTP status codes

### Dependency Injection

Services are injected via FastAPI's `Depends()`:

```python
from app.dependencies import get_orchestrator

@router.post("/sessions/start")
async def start(orchestrator: InterviewOrchestrator = Depends(get_orchestrator)):
    ...
```

### Error Handling

- Use `HTTPException` for REST errors
- WebSocket errors send `type: "error"` messages
- Log all errors with session context

## Development Commands

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Testing
```bash
cd backend
pytest tests/
```

## Environment Variables

### Backend (.env)
```
ANTHROPIC_API_KEY=sk-ant-...
HEYGEN_API_KEY=...
REDIS_URL=redis://localhost:6379/0
DEFAULT_PASSING_SCORE=80
CORS_ORIGINS=http://localhost:3000
```

### Frontend (.env.local)
```
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_HEYGEN_API_KEY=...
```

## Code Style

### Python
- Use type hints everywhere
- Follow PEP 8 (enforced by Ruff)
- Pydantic for all data models
- Async functions for I/O operations

### TypeScript
- Strict mode enabled
- Use interfaces over types when possible
- Prefer function components with hooks
- No `any` types unless absolutely necessary

## Security Considerations

- Never log or expose API keys
- Sanitize all user input via GuardrailsService
- Use CORS whitelist in production
- Session tokens have limited lifetime
- PII is automatically redacted from transcripts

## Future Integration Points

1. **RAG Pipeline**: Add company/role context retrieval in `app/agents/`
2. **Voice Transcription**: Integrate Whisper/Deepgram for audio input
3. **Analytics Dashboard**: Aggregate evaluation data for insights
4. **Multi-language Support**: Extend personality configs for i18n
