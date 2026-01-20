'use client';

import { useEffect, useRef } from 'react';
import { TranscriptEntry, InterviewPhase } from '@/types';

interface TranscriptPaneProps {
  entries: TranscriptEntry[];
  currentPhase: InterviewPhase;
}

function getPhaseLabel(phase: InterviewPhase): string {
  switch (phase) {
    case InterviewPhase.GREETING:
      return 'Introduction';
    case InterviewPhase.TECHNICAL:
      return 'Technical Questions';
    case InterviewPhase.EVALUATION:
      return 'Evaluation';
    default:
      return '';
  }
}

export function TranscriptPane({ entries, currentPhase }: TranscriptPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const interviewerEntries = entries.filter((e) => e.role === 'interviewer');
  const candidateEntries = entries.filter((e) => e.role === 'candidate');

  return (
    <div className="transcript-container">
      <div className="phase-indicator">
        <span className="phase-label">{getPhaseLabel(currentPhase)}</span>
      </div>
      <div className="dual-pane">
        <div className="pane interviewer-pane">
          <h3>Interviewer</h3>
          <div className="entries" ref={scrollRef}>
            {interviewerEntries.map((entry) => (
              <div key={entry.id} className="entry">
                <span className="timestamp">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <p>{entry.content}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="pane candidate-pane">
          <h3>You</h3>
          <div className="entries">
            {candidateEntries.map((entry) => (
              <div key={entry.id} className="entry">
                <span className="timestamp">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <p>{entry.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style jsx>{`
        .transcript-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0f0f1a;
          border-radius: 12px;
          overflow: hidden;
        }
        .phase-indicator {
          padding: 0.75rem 1rem;
          background: #1a1a2e;
          border-bottom: 1px solid #2a2a4e;
        }
        .phase-label {
          font-size: 0.875rem;
          color: #8888aa;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .dual-pane {
          display: grid;
          grid-template-columns: 1fr 1fr;
          flex: 1;
          overflow: hidden;
        }
        .pane {
          display: flex;
          flex-direction: column;
          padding: 1rem;
          overflow: hidden;
        }
        .pane h3 {
          margin: 0 0 0.75rem;
          font-size: 0.875rem;
          color: #aaaacc;
          font-weight: 500;
        }
        .interviewer-pane {
          border-right: 1px solid #2a2a4e;
        }
        .entries {
          flex: 1;
          overflow-y: auto;
        }
        .entry {
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #1a1a2e;
        }
        .entry:last-child {
          border-bottom: none;
        }
        .timestamp {
          font-size: 0.75rem;
          color: #666688;
        }
        .entry p {
          margin: 0.25rem 0 0;
          color: #e0e0f0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
