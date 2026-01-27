/**
 * Interview session types for the Rizma.ai platform
 */

export enum InterviewPhase {
  IDLE = 'IDLE',
  GREETING = 'GREETING',
  TECHNICAL = 'TECHNICAL',
  EVALUATION = 'EVALUATION',
  COMPLETED = 'COMPLETED',
}

export interface TranscriptEntry {
  id: string;
  role: 'interviewer' | 'candidate';
  content: string;
  timestamp: Date;
  phase: InterviewPhase;
}

export interface InterviewState {
  sessionId: string | null;
  phase: InterviewPhase;
  transcript: TranscriptEntry[];
  isConnected: boolean;
  isPushToTalkActive: boolean;
  evaluationScore: number | null;
  passed: boolean | null;
}

export interface WebSocketMessage {
  type: 'state_update' | 'transcript_entry' | 'evaluation_result' | 'error' | 'avatar_speak';
  payload: unknown;
}

export interface EvaluationResult {
  score: number;
  passed: boolean;
  feedback: {
    persuasion: number;
    technicalFit: number;
    communication: number;
  };
  summary: string;
}

export interface StartSessionRequest {
  candidateName: string;
  targetRole: string;
  companyContext?: string;
  personalityId?: string;
}

export interface StartSessionResponse {
  sessionId: string;
  heygenToken: string;
  avatarId: string;
}
