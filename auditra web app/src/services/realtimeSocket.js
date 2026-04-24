/**
 * Singleton WebSocket service for real-time notifications.
 * Connects to /ws/notifications/?token=<jwt>
 * Supports subscribe/unsubscribe callbacks.
 */

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT = 10;

let ws = null;
let reconnectAttempts = 0;
let accessToken = null;
let reconnectTimer = null;
const handlers = new Set();

function getWsUrl() {
  const base = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000').replace(/\/$/, '');
  return `${base}/ws/notifications/?token=${accessToken}`;
}

function connect() {
  if (!accessToken) return;
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    reconnectAttempts = 0;
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handlers.forEach((h) => h(data));
    } catch {}
  };

  ws.onclose = () => {
    ws = null;
    if (reconnectAttempts < MAX_RECONNECT && accessToken) {
      reconnectAttempts++;
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS * Math.min(reconnectAttempts, 5));
    }
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function disconnect() {
  clearTimeout(reconnectTimer);
  accessToken = null;
  if (ws) {
    ws.close();
    ws = null;
  }
}

const realtimeSocket = {
  init(token) {
    if (token && token !== accessToken) {
      disconnect();
      accessToken = token;
      reconnectAttempts = 0;
      connect();
    }
  },

  disconnect() {
    disconnect();
  },

  subscribe(handler) {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },

  send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  },
};

export default realtimeSocket;
