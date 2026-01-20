'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
} from '@heygen/streaming-avatar';

interface AvatarViewProps {
  heygenToken: string | null;
  avatarId: string;
  onReady?: () => void;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
}

export function AvatarView({
  heygenToken,
  avatarId,
  onReady,
  onSpeakStart,
  onSpeakEnd,
}: AvatarViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initializeAvatar = useCallback(async () => {
    if (!heygenToken || !videoRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      const avatar = new StreamingAvatar({ token: heygenToken });
      avatarRef.current = avatar;

      avatar.on(StreamingEvents.STREAM_READY, (event) => {
        if (videoRef.current && event.detail) {
          videoRef.current.srcObject = event.detail;
          videoRef.current.play();
        }
        setIsLoading(false);
        onReady?.();
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        onSpeakStart?.();
      });

      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        onSpeakEnd?.();
      });

      await avatar.createStartAvatar({
        avatarName: avatarId,
        quality: AvatarQuality.High,
        voice: { voiceId: 'en-US-JennyNeural' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize avatar');
      setIsLoading(false);
    }
  }, [heygenToken, avatarId, onReady, onSpeakStart, onSpeakEnd]);

  useEffect(() => {
    initializeAvatar();

    return () => {
      avatarRef.current?.stopAvatar();
    };
  }, [initializeAvatar]);

  const speak = useCallback(async (text: string) => {
    if (!avatarRef.current) return;
    await avatarRef.current.speak({
      text,
      taskType: TaskType.REPEAT,
    });
  }, []);

  const interrupt = useCallback(async () => {
    if (!avatarRef.current) return;
    await avatarRef.current.interrupt();
  }, []);

  // Expose methods via ref-like pattern for parent components
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__rizmaAvatar = { speak, interrupt };
    return () => {
      delete (window as unknown as Record<string, unknown>).__rizmaAvatar;
    };
  }, [speak, interrupt]);

  return (
    <div className="avatar-container">
      {isLoading && (
        <div className="avatar-loading">
          <div className="spinner" />
          <p>Initializing interviewer...</p>
        </div>
      )}
      {error && (
        <div className="avatar-error">
          <p>Error: {error}</p>
          <button onClick={initializeAvatar}>Retry</button>
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ display: isLoading || error ? 'none' : 'block' }}
      />
      <style jsx>{`
        .avatar-container {
          position: relative;
          width: 100%;
          height: 100%;
          background: #1a1a2e;
          border-radius: 12px;
          overflow: hidden;
        }
        video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .avatar-loading,
        .avatar-error {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .avatar-error button {
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background: #4a4a6a;
          border: none;
          border-radius: 6px;
          color: white;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
