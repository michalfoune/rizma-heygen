'use client';

import { AvatarView } from '@/components/Avatar';
import { Timer } from './Timer';
import { ControlBar } from './ControlBar';

interface VideoAreaProps {
  heygenToken: string;
  avatarId: string;
  timeRemaining: number;
  isMicActive: boolean;
  onMicStart: () => void;
  onMicStop: () => void;
  onEndCall: () => void;
  isTranscriptVisible: boolean;
  onToggleTranscript: () => void;
  controlsDisabled?: boolean;
  onUserTranscript?: (text: string) => void;
}

export function VideoArea({
  heygenToken,
  avatarId,
  timeRemaining,
  isMicActive,
  onMicStart,
  onMicStop,
  onEndCall,
  isTranscriptVisible,
  onToggleTranscript,
  controlsDisabled = false,
  onUserTranscript,
}: VideoAreaProps) {
  return (
    <div className="video-area">
      <Timer timeRemaining={timeRemaining} />

      <div className="avatar-container">
        <AvatarView
          heygenToken={heygenToken}
          avatarId={avatarId}
          onUserTranscript={onUserTranscript}
        />
      </div>

      <ControlBar
        isMicActive={isMicActive}
        onMicStart={onMicStart}
        onMicStop={onMicStop}
        onEndCall={onEndCall}
        isTranscriptVisible={isTranscriptVisible}
        onToggleTranscript={onToggleTranscript}
        disabled={controlsDisabled}
      />

      <style jsx>{`
        .video-area {
          position: relative;
          height: 100%;
          background: var(--bg-primary);
          border-radius: 12px;
          overflow: hidden;
        }
        .avatar-container {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
}
