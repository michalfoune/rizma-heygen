'use client';

import { useState, useEffect, useRef } from 'react';
import { InterviewState, InterviewPhase, StartSessionResponse } from '@/types';
import { VideoArea } from './VideoArea';
import { ChatPanel } from './ChatPanel';

interface InterviewLayoutProps {
  sessionData: StartSessionResponse;
  state: InterviewState;
  onEndSession: () => void;
  onSendMessage: (content: string) => void;
  onPushToTalkStart: () => void;
  onPushToTalkStop: () => void;
  pushToTalkEnabled?: boolean;
}

const DEFAULT_INTERVIEW_DURATION = 20 * 60; // 20 minutes in seconds

export function InterviewLayout({
  sessionData,
  state,
  onEndSession,
  onSendMessage,
  onPushToTalkStart,
  onPushToTalkStop,
  pushToTalkEnabled = true,
}: InterviewLayoutProps) {
  const [isTranscriptVisible, setIsTranscriptVisible] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_INTERVIEW_DURATION);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Interviewer name from session or default
  const interviewerName = 'Sarah';

  // Timer countdown
  useEffect(() => {
    if (state.phase !== InterviewPhase.IDLE && state.phase !== InterviewPhase.COMPLETED) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase]);

  // Stop timer when interview completes
  useEffect(() => {
    if (state.phase === InterviewPhase.COMPLETED && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [state.phase]);

  const controlsDisabled =
    state.phase === InterviewPhase.EVALUATION ||
    state.phase === InterviewPhase.COMPLETED;

  return (
    <div className="interview-layout">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <button className="back-btn" onClick={onEndSession}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1>Chat with {interviewerName}</h1>
        </div>
        <div className="header-right">
          <span className={`connection-status ${state.isConnected ? 'connected' : ''}`}>
            {state.isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className={`main ${!isTranscriptVisible ? 'full-video' : ''}`}>
        <div className="video-section">
          <VideoArea
            heygenToken={sessionData.heygenToken}
            avatarId={sessionData.avatarId}
            timeRemaining={timeRemaining}
            isMicActive={state.isPushToTalkActive}
            onMicStart={onPushToTalkStart}
            onMicStop={onPushToTalkStop}
            onEndCall={onEndSession}
            isTranscriptVisible={isTranscriptVisible}
            onToggleTranscript={() => setIsTranscriptVisible(!isTranscriptVisible)}
            controlsDisabled={controlsDisabled}
            pushToTalkEnabled={pushToTalkEnabled}
            onUserTranscript={(text) => {
              // Send user's spoken words as a message to the backend
              console.log('User transcript received:', text);
              onSendMessage(text);
            }}
          />
        </div>

        {isTranscriptVisible && (
          <div className="chat-section">
            <ChatPanel
              interviewerName={interviewerName}
              messages={state.transcript}
              onSendMessage={onSendMessage}
              currentPhase={state.phase}
            />
          </div>
        )}
      </main>

      {/* Results Overlay */}
      {state.phase === InterviewPhase.COMPLETED && state.evaluationScore !== null && (
        <div className="results-overlay">
          <div className="results-card">
            <h2>Interview Complete</h2>
            <div className={`score ${state.passed ? 'passed' : 'failed'}`}>
              {state.evaluationScore}
            </div>
            <p className="result-text">
              {state.passed
                ? 'Congratulations! You passed the interview.'
                : 'Unfortunately, you did not meet the passing threshold of 80.'}
            </p>
            <button onClick={onEndSession}>Start New Interview</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .interview-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--bg-primary);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .back-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .back-btn:hover {
          background: var(--bg-tertiary);
        }
        .header h1 {
          font-size: 16px;
          font-weight: 500;
          margin: 0;
        }
        .connection-status {
          font-size: 12px;
          padding: 4px 12px;
          background: var(--bg-tertiary);
          border-radius: 12px;
          color: var(--text-muted);
        }
        .connection-status.connected {
          background: rgba(74, 222, 128, 0.1);
          color: var(--success);
        }
        .main {
          flex: 1;
          display: grid;
          grid-template-columns: 60% 40%;
          overflow: hidden;
        }
        .main.full-video {
          grid-template-columns: 1fr;
        }
        .video-section {
          padding: 16px;
          padding-right: 8px;
        }
        .main.full-video .video-section {
          padding-right: 16px;
        }
        .chat-section {
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }
        .results-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .results-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 3rem;
          text-align: center;
          max-width: 400px;
        }
        .results-card h2 {
          margin-bottom: 1.5rem;
        }
        .score {
          font-size: 4rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }
        .score.passed {
          color: var(--success);
        }
        .score.failed {
          color: var(--error);
        }
        .result-text {
          color: var(--text-secondary);
          margin-bottom: 2rem;
        }
        .results-card button {
          padding: 0.75rem 1.5rem;
          background: var(--accent);
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          font-size: 1rem;
        }
        .results-card button:hover {
          opacity: 0.9;
        }

        @media (max-width: 768px) {
          .main {
            grid-template-columns: 1fr;
            grid-template-rows: 55% 45%;
          }
          .main.full-video {
            grid-template-rows: 1fr;
          }
          .video-section {
            padding: 12px;
            padding-bottom: 6px;
          }
          .chat-section {
            border-left: none;
            border-top: 1px solid var(--border);
          }
        }
      `}</style>
    </div>
  );
}
