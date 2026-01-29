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
  isPushToTalkActive?: boolean; // When true in PTT mode, accumulate transcripts
  pushToTalkEnabled?: boolean; // When false, use auto-detect mode instead
}

export function AvatarView({
  heygenToken,
  avatarId,
  onReady,
  onSpeakStart,
  onSpeakEnd,
  onUserTranscript,
  isPushToTalkActive = false,
  pushToTalkEnabled = true,
}: AvatarViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const initializingRef = useRef(false);
  const isReadyRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const pendingSpeakRef = useRef<string[]>([]);
  const currentTranscriptRef = useRef<string>('');
  const lastSentTranscriptRef = useRef<string>('');
  const sendTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptTimeRef = useRef<number>(0);
  const prevPushToTalkRef = useRef<boolean>(false);
  const pttReleasedRef = useRef<boolean>(false); // Track if PTT was released, waiting for final transcript
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs for callbacks and settings to avoid stale closure issues
  const onUserTranscriptRef = useRef(onUserTranscript);
  const onReadyRef = useRef(onReady);
  const onSpeakStartRef = useRef(onSpeakStart);
  const onSpeakEndRef = useRef(onSpeakEnd);
  const pushToTalkEnabledRef = useRef(pushToTalkEnabled);
  const sendTranscriptRef = useRef<() => void>(() => {});

  // Keep refs updated with latest callbacks and settings
  useEffect(() => {
    onUserTranscriptRef.current = onUserTranscript;
    onReadyRef.current = onReady;
    onSpeakStartRef.current = onSpeakStart;
    onSpeakEndRef.current = onSpeakEnd;
    pushToTalkEnabledRef.current = pushToTalkEnabled;
  }, [onUserTranscript, onReady, onSpeakStart, onSpeakEnd, pushToTalkEnabled]);

  // Function to send transcript - must be defined before useEffect that uses it
  const sendTranscript = useCallback(() => {
    const transcript = currentTranscriptRef.current.trim();

    if (!transcript || transcript.length < 3) {
      currentTranscriptRef.current = '';
      return;
    }

    // Don't send if avatar is speaking - wait for it to finish
    if (isSpeakingRef.current) {
      console.log('Avatar is speaking, delaying transcript send');
      sendTimeoutRef.current = setTimeout(sendTranscript, 1000);
      return;
    }

    // Don't send if it's exactly the same as what we already sent
    if (transcript === lastSentTranscriptRef.current) {
      console.log('Duplicate transcript, skipping');
      currentTranscriptRef.current = '';
      return;
    }

    // Send the complete transcript
    lastSentTranscriptRef.current = transcript;
    currentTranscriptRef.current = '';

    console.log('Sending final transcript:', transcript);
    if (onUserTranscriptRef.current) {
      onUserTranscriptRef.current(transcript);
    }
  }, []);

  // Keep sendTranscriptRef updated
  useEffect(() => {
    sendTranscriptRef.current = sendTranscript;
  }, [sendTranscript]);

  // Handle push-to-talk release - send accumulated transcript (only in PTT mode)
  useEffect(() => {
    if (!pushToTalkEnabled) {
      prevPushToTalkRef.current = isPushToTalkActive;
      return;
    }

    // Detect transition from active (true) to inactive (false)
    if (prevPushToTalkRef.current && !isPushToTalkActive) {
      console.log('Push-to-talk released, waiting for final transcripts...');
      pttReleasedRef.current = true;

      // Clear any existing timeout
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
      // Start initial timer - will be reset by incoming transcripts
      // Send after 2s of no new transcripts
      sendTimeoutRef.current = setTimeout(() => {
        console.log('No more transcripts, sending now');
        pttReleasedRef.current = false;
        sendTranscript();
      }, 2000);
    }

    // When push-to-talk becomes active, reset state for new utterance
    if (!prevPushToTalkRef.current && isPushToTalkActive) {
      console.log('Push-to-talk activated, resetting transcript state');
      currentTranscriptRef.current = '';
      lastSentTranscriptRef.current = '';
      pttReleasedRef.current = false;
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
        sendTimeoutRef.current = null;
      }
    }

    prevPushToTalkRef.current = isPushToTalkActive;
  }, [isPushToTalkActive, pushToTalkEnabled, sendTranscript]);

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

        onReadyRef.current?.();
      });

      // Handle user speech transcription
      // In PTT mode: accumulate and send when button released
      // In auto mode: debounce and send after silence period
      session.on(AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
        const text = (event as { text: string }).text;
        const now = Date.now();

        // Ignore transcriptions while avatar is speaking (prevents feedback loop)
        if (isSpeakingRef.current) {
          console.log('Ignoring transcript while avatar is speaking:', text);
          return;
        }

        if (!text || text.trim().length < 2) {
          return;
        }

        console.log('Transcript received:', text);

        // In PTT mode, accumulate transcripts (SDK may reset periodically)
        if (pushToTalkEnabledRef.current) {
          const current = currentTranscriptRef.current;
          // Check if this is a continuation or a new segment
          // If the new text doesn't start with what we have, it's likely a new segment
          if (current && !text.toLowerCase().startsWith(current.toLowerCase().substring(0, 20))) {
            // New segment - append with space
            currentTranscriptRef.current = current + ' ' + text;
            console.log('Accumulated transcript:', currentTranscriptRef.current);
          } else {
            // Continuation - use the longer one
            if (text.length > current.length) {
              currentTranscriptRef.current = text;
            }
          }

          // If PTT was released and we're waiting, reset the timer on each new transcript
          if (pttReleasedRef.current) {
            console.log('New transcript after PTT release, resetting send timer');
            if (sendTimeoutRef.current) {
              clearTimeout(sendTimeoutRef.current);
            }
            // Wait another 2s for more transcripts
            sendTimeoutRef.current = setTimeout(() => {
              console.log('Transcripts settled, sending now');
              pttReleasedRef.current = false;
              sendTranscriptRef.current();
            }, 2000);
          }
        } else {
          // In auto mode, just store the latest (SDK sends cumulative)
          currentTranscriptRef.current = text;

          // Check if this is a new utterance (gap > 5 seconds since last transcript)
          if (now - lastTranscriptTimeRef.current > 5000) {
            console.log('New utterance detected (gap > 5s), resetting state');
            lastSentTranscriptRef.current = '';
          }
          lastTranscriptTimeRef.current = now;

          // Clear any existing timeout
          if (sendTimeoutRef.current) {
            clearTimeout(sendTimeoutRef.current);
          }

          // Set a new timeout to send after 3 seconds of silence
          sendTimeoutRef.current = setTimeout(() => {
            sendTranscriptRef.current();
          }, 3000);
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

      // Handle avatar speaking events - track state to prevent feedback loop
      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        isSpeakingRef.current = true;
        console.log('Avatar started speaking');
        onSpeakStartRef.current?.();
      });

      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        // Add a small delay before allowing user transcripts again
        // This prevents the tail-end of avatar speech from being captured
        setTimeout(() => {
          isSpeakingRef.current = false;
          console.log('Avatar finished speaking');
        }, 500);
        onSpeakEndRef.current?.();
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
  }, [heygenToken, avatarId, sendTranscript]);

  useEffect(() => {
    initializeAvatar();

    return () => {
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }
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
          object-fit: contain;
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
