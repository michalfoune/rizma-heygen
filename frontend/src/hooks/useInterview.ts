import { useCallback, useReducer } from 'react';
import {
  InterviewState,
  InterviewPhase,
  TranscriptEntry,
  EvaluationResult,
  WebSocketMessage,
  StartSessionRequest,
  StartSessionResponse,
} from '@/types';
import { useWebSocket } from './useWebSocket';

type InterviewAction =
  | { type: 'SET_SESSION'; payload: { sessionId: string } }
  | { type: 'SET_PHASE'; payload: InterviewPhase }
  | { type: 'ADD_TRANSCRIPT'; payload: TranscriptEntry }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_PUSH_TO_TALK'; payload: boolean }
  | { type: 'SET_EVALUATION'; payload: EvaluationResult }
  | { type: 'RESET' };

const initialState: InterviewState = {
  sessionId: null,
  phase: InterviewPhase.IDLE,
  transcript: [],
  isConnected: false,
  isPushToTalkActive: false,
  evaluationScore: null,
  passed: null,
};

function interviewReducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, sessionId: action.payload.sessionId };
    case 'SET_PHASE':
      return { ...state, phase: action.payload };
    case 'ADD_TRANSCRIPT':
      return { ...state, transcript: [...state.transcript, action.payload] };
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'SET_PUSH_TO_TALK':
      return { ...state, isPushToTalkActive: action.payload };
    case 'SET_EVALUATION':
      return {
        ...state,
        evaluationScore: action.payload.score,
        passed: action.payload.passed,
        phase: InterviewPhase.COMPLETED,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface UseInterviewReturn {
  state: InterviewState;
  startSession: (request: StartSessionRequest) => Promise<StartSessionResponse>;
  endSession: () => void;
  sendCandidateMessage: (content: string) => void;
  pushToTalkStart: () => void;
  pushToTalkStop: () => void;
}

export function useInterview(): UseInterviewReturn {
  const [state, dispatch] = useReducer(interviewReducer, initialState);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'state_update':
        dispatch({ type: 'SET_PHASE', payload: message.payload as InterviewPhase });
        break;
      case 'transcript_entry':
        dispatch({ type: 'ADD_TRANSCRIPT', payload: message.payload as TranscriptEntry });
        break;
      case 'evaluation_result':
        dispatch({ type: 'SET_EVALUATION', payload: message.payload as EvaluationResult });
        break;
      case 'avatar_speak':
        // Make the avatar speak the text
        const avatarApi = (window as unknown as Record<string, unknown>).__rizmaAvatar as { speak: (text: string) => void } | undefined;
        if (avatarApi?.speak) {
          const text = (message.payload as { text: string }).text;
          console.log('Avatar speaking:', text);
          avatarApi.speak(text);
        } else {
          console.warn('Avatar API not available for speaking');
        }
        break;
      case 'error':
        console.error('Interview error:', message.payload);
        break;
    }
  }, []);

  const { isConnected, send, connect, disconnect } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws',
    sessionId: state.sessionId,
    onMessage: handleMessage,
    onConnect: () => dispatch({ type: 'SET_CONNECTED', payload: true }),
    onDisconnect: () => dispatch({ type: 'SET_CONNECTED', payload: false }),
  });

  const startSession = useCallback(async (request: StartSessionRequest): Promise<StartSessionResponse> => {
    // Convert camelCase to snake_case for backend API
    const backendRequest = {
      candidate_name: request.candidateName,
      target_role: request.targetRole,
      company_context: request.companyContext,
      personality_id: request.personalityId,
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendRequest),
    });

    if (!response.ok) {
      throw new Error('Failed to start session');
    }

    // Convert snake_case response to camelCase
    const rawData = await response.json();
    const data: StartSessionResponse = {
      sessionId: rawData.session_id,
      heygenToken: rawData.heygen_token,
      avatarId: rawData.avatar_id,
    };
    dispatch({ type: 'SET_SESSION', payload: { sessionId: data.sessionId } });

    // Connect WebSocket after session is created - pass sessionId directly to avoid race condition
    setTimeout(() => connect(data.sessionId), 100);

    return data;
  }, [connect]);

  const endSession = useCallback(() => {
    if (state.sessionId) {
      send({ type: 'state_update', payload: { action: 'end_session' } });
    }
    disconnect();
    dispatch({ type: 'RESET' });
  }, [state.sessionId, send, disconnect]);

  const sendCandidateMessage = useCallback((content: string) => {
    // Don't add to local state - backend will accumulate messages and send
    // the combined transcript back. This prevents partial messages from
    // appearing in the chat during continuous speech.
    const entry: TranscriptEntry = {
      id: crypto.randomUUID(),
      role: 'candidate',
      content,
      timestamp: new Date(),
      phase: state.phase,
    };
    send({ type: 'transcript_entry', payload: entry });
  }, [state.phase, send]);

  const pushToTalkStart = useCallback(() => {
    dispatch({ type: 'SET_PUSH_TO_TALK', payload: true });
    send({ type: 'state_update', payload: { action: 'ptt_start' } });
  }, [send]);

  const pushToTalkStop = useCallback(() => {
    dispatch({ type: 'SET_PUSH_TO_TALK', payload: false });
    send({ type: 'state_update', payload: { action: 'ptt_stop' } });
  }, [send]);

  return {
    state: { ...state, isConnected },
    startSession,
    endSession,
    sendCandidateMessage,
    pushToTalkStart,
    pushToTalkStop,
  };
}
