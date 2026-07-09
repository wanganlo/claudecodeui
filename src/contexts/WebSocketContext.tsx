import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminScope } from './AdminScopeContext';
import { IS_PLATFORM } from '../constants/config';
import { AUTH_TOKEN_STORAGE_KEY } from '../components/auth/constants';

/**
 * One frame received from the chat websocket. The server guarantees every
 * frame carries a `kind` (provider message kinds plus gateway kinds such as
 * `chat_subscribed`, `session_upserted`, `loading_progress`,
 * `protocol_error`). The synthetic `websocket_reconnected` kind is injected
 * client-side when the socket re-opens after a drop.
 */
export type ServerEvent = {
  kind?: string;
  type?: string;
  sessionId?: string;
  seq?: number;
  [key: string]: unknown;
};

type ServerEventListener = (event: ServerEvent) => void;

type WebSocketContextType = {
  ws: WebSocket | null;
  sendMessage: (message: unknown) => void;
  /**
   * Subscribes to every websocket frame. Returns an unsubscribe function.
   *
   * This is the primary consumption API: events are dispatched synchronously
   * to every listener, so rapid back-to-back frames can never be coalesced or
   * dropped the way a single "latest message" state slot could.
   */
  subscribe: (listener: ServerEventListener) => () => void;
  /**
   * Legacy state-based access to the most recent frame.
   *
   * Kept only for low-frequency consumers (TaskMaster broadcasts). High-rate
   * chat streams must use `subscribe` — React may batch state updates, which
   * makes `latestMessage` lossy under load.
   */
  latestMessage: ServerEvent | null;
  isConnected: boolean;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

const buildWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (IS_PLATFORM) return `${protocol}//${window.location.host}/ws`; // Platform mode: Use same domain as the page (goes through proxy)
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) return null;
  return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`; // OSS mode: Use same host:port that served the page
};

const useWebSocketProviderState = (): WebSocketContextType => {
  const wsRef = useRef<WebSocket | null>(null);
  const unmountedRef = useRef(false); // Track if component is unmounted
  const hasConnectedRef = useRef(false); // Track if we've ever connected (to detect reconnects)
  /**
   * Listener registry for the subscribe API. A ref (not state) because the
   * set must be readable synchronously inside `onmessage` and never trigger
   * re-renders of the provider tree.
   */
  const listenersRef = useRef(new Set<ServerEventListener>());
  const [latestMessage, setLatestMessage] = useState<ServerEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Incremented every time we intentionally open a new socket. Stored on the
  // socket instance so that stale reconnect timeouts from a previously closed
  // socket cannot overwrite the current connection.
  const socketGenerationRef = useRef(0);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
  const { scopeAll } = useAdminScope();

  const dispatch = useCallback((event: ServerEvent) => {
    for (const listener of listenersRef.current) {
      try {
        listener(event);
      } catch (error) {
        console.error('WebSocket listener error:', error);
      }
    }
    setLatestMessage(event);
  }, []);

  useEffect(() => {
    // The cleanup below sets unmountedRef = true. Without this reset, every
    // re-run of the effect (e.g. on token refresh) would short-circuit connect()
    // at its unmounted guard and leave the socket permanently disconnected.
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token, scopeAll]); // everytime token or scopeAll changes, we reconnect

  // Keep the websocket token in sync with localStorage even when the value is
  // updated outside of React (e.g. authenticatedFetch X-Refreshed-Token or
  // login in another tab). This guarantees WebSocket and HTTP API use the same
  // identity.
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== AUTH_TOKEN_STORAGE_KEY) return;
      setToken(event.newValue);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return; // Prevent connection if unmounted
    try {
      // Construct WebSocket URL from the current localStorage token so it can
      // never drift from the token used by authenticatedFetch.
      const wsUrl = buildWebSocketUrl();

      if (!wsUrl) return console.warn('No authentication token found for WebSocket connection');

      // Cancel any pending reconnect before opening a new socket, and bump the
      // generation so that a late reconnect timeout from a closed socket is
      // ignored instead of overwriting the current connection.
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      const generation = ++socketGenerationRef.current;

      const websocket = new WebSocket(wsUrl);
      // Tag the socket with its generation so onclose can tell if it is stale.
      (websocket as any).__socketGeneration = generation;

      websocket.onopen = () => {
        // Only honor this socket if it is the most recent one we intentionally
        // opened. Prevents stale reconnect timeouts from hijacking wsRef.
        if (generation !== socketGenerationRef.current) {
          websocket.close();
          return;
        }
        setIsConnected(true);
        wsRef.current = websocket;
        if (hasConnectedRef.current) {
          // This is a reconnect — signal so components can catch up on missed messages
          dispatch({ kind: 'websocket_reconnected', timestamp: Date.now() });
        }
        hasConnectedRef.current = true;
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ServerEvent;
          dispatch(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onclose = () => {
        setIsConnected(false);
        // Only clear wsRef if this socket is still the current one.
        if (wsRef.current === websocket) {
          wsRef.current = null;
        }

        // Do not schedule reconnect from a stale socket.
        if ((websocket as any).__socketGeneration !== socketGenerationRef.current) {
          return;
        }

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (unmountedRef.current) return; // Prevent reconnection if unmounted
          connect();
        }, 3000);
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  }, [scopeAll, dispatch]); // reconnect when scopeAll changes; token is read from localStorage dynamically

  const sendMessage = useCallback((message: unknown) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }, []);

  const subscribe = useCallback((listener: ServerEventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value: WebSocketContextType = useMemo(() =>
  ({
    ws: wsRef.current,
    sendMessage,
    subscribe,
    latestMessage,
    isConnected
  }), [sendMessage, subscribe, latestMessage, isConnected]);

  return value;
};

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const webSocketData = useWebSocketProviderState();

  return (
    <WebSocketContext.Provider value={webSocketData}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;
