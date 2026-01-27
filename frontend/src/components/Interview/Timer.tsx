'use client';

interface TimerProps {
  timeRemaining: number; // seconds
  isWarning?: boolean;
}

export function Timer({ timeRemaining, isWarning = false }: TimerProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const showWarning = isWarning || timeRemaining < 60;

  return (
    <div className={`timer ${showWarning ? 'warning' : ''}`}>
      Time remaining {formattedTime}
      <style jsx>{`
        .timer {
          position: absolute;
          top: 16px;
          left: 16px;
          background: var(--overlay-bg, rgba(0, 0, 0, 0.6));
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          color: white;
          backdrop-filter: blur(4px);
          z-index: 10;
        }
        .timer.warning {
          background: rgba(248, 113, 113, 0.8);
        }
      `}</style>
    </div>
  );
}
