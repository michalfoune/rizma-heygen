'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  LiveAvatarSession,
  SessionEvent,
  SessionState,
  AgentEventsEnum,
} from '@heygen/liveavatar-web-sdk';

interface AvatarViewProps {
  heygenToken: string | null;
  avatarId: string;
  onReady?: () => void;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
  onUserTranscript?: (text: string) => void;
}

export function AvatarView({
  heygenToken,
  avatarId,
  onReady,
  onSpeakStart,
  onSpeakEnd,
  onUserTranscript,
}: AvatarViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const initializingRef = useRef(false);
  const isReadyRef = useRef(false);
  const pendingSpeakRef = useRef<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initializeAvatar = useCallback(async () => {
    if (!heygenToken || !videoRef.current) return;

    // Prevent double initialization
    if (initializingRef.current) {
      console.log('Already initializing, skipping...');
      return;
    }
    initializingRef.current = true;

    // Clean up any existing session first
    if (sessionRef.current) {
      try {
        await sessionRef.current.stop();
      } catch {
        // Ignore cleanup errors
      }
      sessionRef.current = null;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get the API URL for the proxy (to avoid CORS issues)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const proxyApiUrl = `${apiUrl}/api/v1/liveavatar`;

      // Create LiveAvatar session with proxy URL and voice chat enabled
      const session = new LiveAvatarSession(heygenToken, {
        voiceChat: true,
        apiUrl: proxyApiUrl,
      });
      sessionRef.current = session;

      // Handle stream ready - attach video to element
      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (videoRef.current) {
          session.attach(videoRef.current);
        }
        setIsLoading(false);
        isReadyRef.current = true;

        // Process any pending speak commands
        while (pendingSpeakRef.current.length > 0) {
          const text = pendingSpeakRef.current.shift();
          if (text) {
            console.log('Speaking queued message:', text);
            session.repeat(text);
          }
        }

        onReady?.();
      });

      // Handle user speech transcription
      session.on(AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
        const text = (event as { text: string }).text;
        console.log('User said:', text);
        if (text && onUserTranscript) {
          onUserTranscript(text);
        }
      });

      // Handle state changes
      session.on(SessionEvent.SESSION_STATE_CHANGED, (state: SessionState) => {
        console.log('LiveAvatar session state:', state);
        if (state === SessionState.CONNECTED) {
          // Stream should be ready soon
          setIsLoading(false);
        }
        // Don't set error on disconnect - it may be intentional
      });

      // Handle avatar speaking events
      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        onSpeakStart?.();
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        onSpeakEnd?.();
      });

      // Handle session disconnect
      session.on(SessionEvent.SESSION_DISCONNECTED, (reason) => {
        console.log('LiveAvatar disconnected:', reason);
      });

      // Start the session
      console.log('Starting LiveAvatar session...');
      await session.start();
      console.log('LiveAvatar session started successfully');
    } catch (err) {
      console.error('LiveAvatar initialization error:', err);
      // Log additional details if available
      if (err && typeof err === 'object') {
        console.error('Error details:', JSON.stringify(err, null, 2));
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize avatar';
      setError(errorMessage);
      setIsLoading(false);
      initializingRef.current = false;
    }
  }, [heygenToken, avatarId, onReady, onSpeakStart, onSpeakEnd]);

  useEffect(() => {
    initializeAvatar();

    return () => {
      sessionRef.current?.stop();
    };
  }, [initializeAvatar]);

  // Method to make the avatar speak (text-to-speech repeat)
  const speak = useCallback((text: string) => {
    if (!sessionRef.current) {
      console.log('Session not ready, queueing speak:', text);
      pendingSpeakRef.current.push(text);
      return;
    }
    if (!isReadyRef.current) {
      console.log('Avatar not ready, queueing speak:', text);
      pendingSpeakRef.current.push(text);
      return;
    }
    console.log('Avatar speaking:', text);
    sessionRef.current.repeat(text);
  }, []);

  // Method to interrupt the avatar
  const interrupt = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.interrupt();
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
          <p className="error-hint">LiveAvatar may be rate-limited. Wait a moment and try again.</p>
          <button onClick={() => {
            // Reset the initializing flag and add small delay before retry
            initializingRef.current = false;
            setTimeout(initializeAvatar, 1000);
          }}>Retry</button>
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
        .error-hint {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.6);
          margin-top: 0.5rem;
        }
      `}</style>
    </div>
  );
}
