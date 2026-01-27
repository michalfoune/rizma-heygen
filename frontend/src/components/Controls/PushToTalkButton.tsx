'use client';

import { useCallback, useEffect, useState } from 'react';

interface PushToTalkButtonProps {
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function PushToTalkButton({
  isActive,
  onStart,
  onStop,
  disabled = false,
}: PushToTalkButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = useCallback(() => {
    if (disabled) return;
    setIsPressed(true);
    onStart();
  }, [disabled, onStart]);

  const handleMouseUp = useCallback(() => {
    if (disabled) return;
    setIsPressed(false);
    onStop();
  }, [disabled, onStop]);

  // Handle keyboard shortcut (Space bar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !disabled) {
        e.preventDefault();
        setIsPressed(true);
        onStart();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !disabled) {
        e.preventDefault();
        setIsPressed(false);
        onStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [disabled, onStart, onStop]);

  return (
    <button
      className={`ptt-button ${isPressed || isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      disabled={disabled}
    >
      <div className="mic-icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </div>
      <span className="label">
        {isActive ? 'Speaking...' : 'Hold to Speak'}
      </span>
      <span className="hint">or press Space</span>
      <style jsx>{`
        .ptt-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 120px;
          height: 120px;
          border: none;
          border-radius: 50%;
          background: linear-gradient(135deg, #4a4a6a 0%, #2a2a4e 100%);
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        }
        .ptt-button:hover:not(.disabled) {
          transform: scale(1.05);
          box-shadow: 0 0 20px rgba(100, 100, 200, 0.3);
        }
        .ptt-button.active {
          background: linear-gradient(135deg, #6a6a8a 0%, #4a4a6e 100%);
          box-shadow: 0 0 30px rgba(100, 100, 200, 0.5);
          transform: scale(0.98);
        }
        .ptt-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .mic-icon {
          width: 32px;
          height: 32px;
          margin-bottom: 0.5rem;
        }
        .mic-icon svg {
          width: 100%;
          height: 100%;
        }
        .label {
          font-size: 0.875rem;
          font-weight: 500;
        }
        .hint {
          font-size: 0.625rem;
          color: #8888aa;
          margin-top: 0.25rem;
        }
      `}</style>
    </button>
  );
}
