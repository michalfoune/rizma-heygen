import { useCallback, useEffect, useRef, useState } from 'react';
import { WebSocketMessage } from '@/types';

interface UseWebSocketOptions {
  url: string;
  sessionId: string | null;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  send: (message: WebSocketMessage) => void;
  connect: (overrideSessionId?: string) => void;
  disconnect: () => void;
}

export function useWebSocket({
  url,
  sessionId,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback((overrideSessionId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const sid = overrideSessionId || sessionId;
    if (!sid) {
      console.warn('Cannot connect WebSocket: no session ID');
      return;
    }

    // Store the active session ID for reconnection
    activeSessionIdRef.current = sid;

    const wsUrl = `${url}/${sid}`;
    console.log('Connecting WebSocket to:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('WebSocket received:', message.type, message.payload);
        onMessage?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      onDisconnect?.();
      // Auto-reconnect after 3 seconds using stored session ID
      reconnectTimeoutRef.current = setTimeout(() => {
        if (activeSessionIdRef.current) connect(activeSessionIdRef.current);
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };

    wsRef.current = ws;
  }, [url, sessionId, onMessage, onConnect, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    activeSessionIdRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent');
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { isConnected, send, connect, disconnect };
}
