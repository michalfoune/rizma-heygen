'use client';

import { useState } from 'react';
import { useInterview } from '@/hooks';
import { AvatarView } from '@/components/Avatar';
import { TranscriptPane } from '@/components/Transcript';
import { PushToTalkButton } from '@/components/Controls';
import { InterviewPhase, StartSessionResponse } from '@/types';

export default function InterviewPage() {
  const { state, startSession, endSession, pushToTalkStart, pushToTalkStop } = useInterview();
  const [sessionData, setSessionData] = useState<StartSessionResponse | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!candidateName.trim() || !targetRole.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const response = await startSession({
        candidateName: candidateName.trim(),
        targetRole: targetRole.trim(),
      });
      setSessionData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  const handleEnd = () => {
    endSession();
    setSessionData(null);
    setCandidateName('');
    setTargetRole('');
  };

  // Pre-session: Show setup form
  if (!sessionData) {
    return (
      <main className="setup-container">
        <div className="setup-card">
          <h1>Rizma.ai Interview Simulation</h1>
          <p className="subtitle">Practice your interview skills with an AI-powered interviewer</p>

          <div className="form">
            <div className="field">
              <label htmlFor="name">Your Name</label>
              <input
                id="name"
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Enter your name"
                disabled={isStarting}
              />
            </div>
            <div className="field">
              <label htmlFor="role">Target Role</label>
              <input
                id="role"
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g., Senior Software Engineer"
                disabled={isStarting}
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button
              className="start-button"
              onClick={handleStart}
              disabled={isStarting}
            >
              {isStarting ? 'Starting...' : 'Start Interview'}
            </button>
          </div>
        </div>

        <style jsx>{`
          .setup-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }
          .setup-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 3rem;
            max-width: 480px;
            width: 100%;
          }
          h1 {
            font-size: 1.75rem;
            margin-bottom: 0.5rem;
          }
          .subtitle {
            color: var(--text-secondary);
            margin-bottom: 2rem;
          }
          .form {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }
          .field {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          label {
            font-size: 0.875rem;
            color: var(--text-secondary);
          }
          input {
            padding: 0.75rem 1rem;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 1rem;
          }
          input:focus {
            outline: none;
            border-color: var(--accent);
          }
          .error {
            color: var(--error);
            font-size: 0.875rem;
          }
          .start-button {
            padding: 1rem;
            background: linear-gradient(135deg, var(--accent) 0%, #4a4a80 100%);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .start-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 4px 20px rgba(100, 100, 160, 0.3);
          }
          .start-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
        `}</style>
      </main>
    );
  }

  // Active session: Show interview UI
  return (
    <main className="interview-container">
      <header className="header">
        <div className="header-left">
          <h1>Interview in Progress</h1>
          <span className="connection-status">
            {state.isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
        <button className="end-button" onClick={handleEnd}>
          End Interview
        </button>
      </header>

      <div className="content">
        <div className="avatar-section">
          <AvatarView
            heygenToken={sessionData.heygenToken}
            avatarId={sessionData.avatarId}
          />
        </div>

        <div className="transcript-section">
          <TranscriptPane
            entries={state.transcript}
            currentPhase={state.phase}
          />
        </div>
      </div>

      <footer className="controls">
        <PushToTalkButton
          isActive={state.isPushToTalkActive}
          onStart={pushToTalkStart}
          onStop={pushToTalkStop}
          disabled={state.phase === InterviewPhase.EVALUATION || state.phase === InterviewPhase.COMPLETED}
        />
      </footer>

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
            <button onClick={handleEnd}>Start New Interview</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .interview-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .header h1 {
          font-size: 1.25rem;
          font-weight: 500;
        }
        .connection-status {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          background: var(--bg-tertiary);
          border-radius: 4px;
          color: var(--text-muted);
        }
        .end-button {
          padding: 0.5rem 1rem;
          background: transparent;
          border: 1px solid var(--error);
          border-radius: 6px;
          color: var(--error);
          cursor: pointer;
          transition: background 0.2s;
        }
        .end-button:hover {
          background: rgba(248, 113, 113, 0.1);
        }
        .content {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          padding: 1rem;
          overflow: hidden;
        }
        .avatar-section,
        .transcript-section {
          height: calc(100vh - 200px);
        }
        .controls {
          display: flex;
          justify-content: center;
          padding: 1.5rem;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
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
        }
      `}</style>
    </main>
  );
}
