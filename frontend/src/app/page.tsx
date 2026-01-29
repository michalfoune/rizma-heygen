'use client';

import { useState } from 'react';
import { useInterview } from '@/hooks';
import { InterviewLayout } from '@/components/Interview';
import { StartSessionResponse } from '@/types';

export default function InterviewPage() {
  const { state, startSession, endSession, sendCandidateMessage, pushToTalkStart, pushToTalkStop } = useInterview();
  const [sessionData, setSessionData] = useState<StartSessionResponse | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(true);

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
          <img src="/rizma-logo.png" alt="Rizma" className="logo" />
          <h1>rizma.ai Interview Simulation</h1>
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
            <div className="field toggle-field">
              <label htmlFor="ptt">Push-to-Talk Mode</label>
              <div className="toggle-row">
                <button
                  type="button"
                  className={`toggle ${pushToTalkEnabled ? 'active' : ''}`}
                  onClick={() => setPushToTalkEnabled(!pushToTalkEnabled)}
                  disabled={isStarting}
                  aria-pressed={pushToTalkEnabled}
                >
                  <span className="toggle-slider" />
                </button>
                <span className="toggle-hint">
                  {pushToTalkEnabled
                    ? 'Hold mic button while speaking'
                    : 'Speak freely, auto-detect when done'}
                </span>
              </div>
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
            text-align: center;
          }
          .logo {
            width: 64px;
            height: 64px;
            border-radius: 12px;
            margin-bottom: 1rem;
          }
          .form {
            text-align: left;
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
          .toggle-field {
            margin-top: 0.5rem;
          }
          .toggle-row {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .toggle {
            position: relative;
            width: 48px;
            height: 26px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 13px;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s;
            padding: 0;
          }
          .toggle:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .toggle.active {
            background: var(--accent);
            border-color: var(--accent);
          }
          .toggle-slider {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            transition: transform 0.2s;
          }
          .toggle.active .toggle-slider {
            transform: translateX(22px);
          }
          .toggle-hint {
            font-size: 0.8rem;
            color: var(--text-muted);
          }
        `}</style>
      </main>
    );
  }

  // Active session: Show interview UI
  return (
    <InterviewLayout
      sessionData={sessionData}
      state={state}
      onEndSession={handleEnd}
      onSendMessage={sendCandidateMessage}
      onPushToTalkStart={pushToTalkStart}
      onPushToTalkStop={pushToTalkStop}
      pushToTalkEnabled={pushToTalkEnabled}
    />
  );
}
