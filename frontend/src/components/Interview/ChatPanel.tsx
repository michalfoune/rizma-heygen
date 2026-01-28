'use client';

import { useEffect, useRef } from 'react';
import { TranscriptEntry, InterviewPhase } from '@/types';
import { MessageBubble, MessageInput } from '@/components/Chat';

interface ChatPanelProps {
  interviewerName: string;
  messages: TranscriptEntry[];
  onSendMessage: (content: string) => void;
  currentPhase: InterviewPhase;
}

export function ChatPanel({
  interviewerName,
  messages,
  onSendMessage,
  currentPhase,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInputDisabled =
    currentPhase === InterviewPhase.EVALUATION ||
    currentPhase === InterviewPhase.COMPLETED;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-panel">
      <header className="chat-header">
        <h2>Chatting with {interviewerName}</h2>
        <span className="phase-badge">{formatPhase(currentPhase)}</span>
      </header>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>The interview will begin shortly...</p>
          </div>
        ) : (
          messages.map((entry) => (
            <MessageBubble key={entry.id} entry={entry} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput
        onSend={onSendMessage}
        disabled={isInputDisabled}
        placeholder={isInputDisabled ? 'Interview completed' : 'Send a message...'}
      />

      <style jsx>{`
        .chat-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-secondary);
          border-left: 1px solid var(--border);
        }
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .chat-header h2 {
          font-size: 16px;
          font-weight: 500;
          margin: 0;
        }
        .phase-badge {
          font-size: 12px;
          padding: 4px 8px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          color: var(--text-muted);
        }
        .messages-container {
          flex: 1;
          overflow-y: scroll;
          padding: 20px;
          min-height: 0;
        }
        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}

function formatPhase(phase: InterviewPhase): string {
  switch (phase) {
    case InterviewPhase.IDLE:
      return 'Starting...';
    case InterviewPhase.GREETING:
      return 'Introduction';
    case InterviewPhase.TECHNICAL:
      return 'Technical';
    case InterviewPhase.EVALUATION:
      return 'Evaluating';
    case InterviewPhase.COMPLETED:
      return 'Completed';
    default:
      return phase;
  }
}
