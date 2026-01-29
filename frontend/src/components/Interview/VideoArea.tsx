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
  pushToTalkEnabled?: boolean;
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
  pushToTalkEnabled = true,
  onUserTranscript,
}: VideoAreaProps) {
  return (
    <div className="video-area">
      <Timer timeRemaining={timeRemaining} />
      <img src="/rizma-logo.png" alt="Rizma" className="video-logo" />

      <div className="avatar-container">
        <AvatarView
          heygenToken={heygenToken}
          avatarId={avatarId}
          onUserTranscript={onUserTranscript}
          isPushToTalkActive={pushToTalkEnabled ? isMicActive : false}
          pushToTalkEnabled={pushToTalkEnabled}
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
        pushToTalkEnabled={pushToTalkEnabled}
      />

      <style jsx>{`
        .video-area {
          position: relative;
          height: 100%;
          background: var(--bg-primary);
          border-radius: 12px;
          overflow: hidden;
        }
        .video-logo {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          z-index: 10;
          opacity: 0.9;
        }
        .avatar-container {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
}
