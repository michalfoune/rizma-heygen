'use client';

import { useState, KeyboardEvent } from 'react';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Send a message...',
}: MessageInputProps) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="input-container">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="message-input"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="send-button"
        aria-label="Send message"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>

      <style jsx>{`
        .input-container {
          display: flex;
          gap: 8px;
          padding: 16px;
          border-top: 1px solid var(--border);
          background: var(--bg-secondary);
        }
        .message-input {
          flex: 1;
          padding: 12px 16px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 24px;
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
        }
        .message-input:focus {
          border-color: var(--accent);
        }
        .message-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .message-input::placeholder {
          color: var(--text-muted);
        }
        .send-button {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--chat-bubble-user, #3b82f6);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s, transform 0.2s;
        }
        .send-button:hover:not(:disabled) {
          transform: scale(1.05);
        }
        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
