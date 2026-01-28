'use client';

interface ControlBarProps {
  isMicActive: boolean;
  onMicStart: () => void;
  onMicStop: () => void;
  onEndCall: () => void;
  isTranscriptVisible: boolean;
  onToggleTranscript: () => void;
  disabled?: boolean;
  pushToTalkEnabled?: boolean;
}

export function ControlBar({
  isMicActive,
  onMicStart,
  onMicStop,
  onEndCall,
  isTranscriptVisible,
  onToggleTranscript,
  disabled = false,
  pushToTalkEnabled = true,
}: ControlBarProps) {
  return (
    <div className="control-bar">
      {/* Transcript Toggle */}
      <button
        className={`control-btn ${isTranscriptVisible ? 'active' : ''}`}
        onClick={onToggleTranscript}
        aria-label="Toggle transcript"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Microphone (Push-to-Talk or always-on) */}
      <button
        className={`control-btn mic-btn ${isMicActive ? 'active' : ''} ${pushToTalkEnabled ? 'ptt-mode' : ''}`}
        onMouseDown={pushToTalkEnabled ? onMicStart : undefined}
        onMouseUp={pushToTalkEnabled ? onMicStop : undefined}
        onMouseLeave={pushToTalkEnabled && isMicActive ? onMicStop : undefined}
        onTouchStart={pushToTalkEnabled ? onMicStart : undefined}
        onTouchEnd={pushToTalkEnabled ? onMicStop : undefined}
        disabled={disabled}
        aria-label={pushToTalkEnabled ? 'Hold to speak' : 'Microphone active'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>

      {/* End Call */}
      <button
        className="control-btn end-btn"
        onClick={onEndCall}
        aria-label="End interview"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Camera Toggle (disabled for now) */}
      <button
        className="control-btn"
        disabled
        aria-label="Camera (not available)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      </button>

      <style jsx>{`
        .control-bar {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 12px;
          padding: 12px 20px;
          background: var(--control-bar-bg, rgba(0, 0, 0, 0.7));
          border-radius: 40px;
          backdrop-filter: blur(8px);
          z-index: 10;
        }
        .control-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, transform 0.2s;
        }
        .control-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
        }
        .control-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .control-btn.active {
          background: var(--accent);
        }
        .mic-btn.active {
          background: var(--success, #4ade80);
        }
        /* Push-to-talk mode: very prominent when active */
        .mic-btn.ptt-mode.active {
          background: #22c55e;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.4), 0 0 20px rgba(34, 197, 94, 0.6);
          animation: ptt-pulse 0.8s infinite;
          transform: scale(1.1);
        }
        .mic-btn.ptt-mode:not(.active) {
          background: rgba(255, 255, 255, 0.15);
        }
        .end-btn {
          background: var(--error, #f87171);
        }
        .end-btn:hover:not(:disabled) {
          background: #ef4444;
        }
        @keyframes ptt-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.4), 0 0 20px rgba(34, 197, 94, 0.6);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.2), 0 0 30px rgba(34, 197, 94, 0.8);
          }
        }
      `}</style>
    </div>
  );
}
