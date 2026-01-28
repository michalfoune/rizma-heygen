'use client';

import { TranscriptEntry } from '@/types';

interface MessageBubbleProps {
  entry: TranscriptEntry;
}

export function MessageBubble({ entry }: MessageBubbleProps) {
  const isCandidate = entry.role === 'candidate';
  const timestamp = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`bubble-wrapper ${isCandidate ? 'user' : 'interviewer'}`}>
      {!isCandidate && <div className="avatar">A</div>}
      <div className="bubble">
        <p>{entry.content}</p>
        <span className="time">{timestamp}</span>
      </div>
      {isCandidate && <div className="avatar user-avatar">U</div>}

      <style jsx>{`
        .bubble-wrapper {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 16px;
        }
        .bubble-wrapper.user {
          flex-direction: row-reverse;
        }
        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
          flex-shrink: 0;
        }
        .user-avatar {
          background: var(--chat-bubble-user, #3b82f6);
          color: white;
        }
        .bubble {
          max-width: 70%;
          padding: 12px 16px;
          border-radius: 16px;
          background: var(--chat-bubble-interviewer, var(--bg-tertiary));
        }
        .user .bubble {
          background: var(--chat-bubble-user, #3b82f6);
          color: white;
        }
        .bubble p {
          margin: 0;
          line-height: 1.5;
          word-wrap: break-word;
        }
        .time {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
          display: block;
        }
        .user .time {
          color: rgba(255, 255, 255, 0.7);
        }
      `}</style>
    </div>
  );
}
