class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    // Use exponential backoff (capped) instead of a fixed retry count.
    // Set to null to retry indefinitely.
    this.maxReconnectAttempts = null;
    this.baseReconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.listeners = new Map();
    this.isConnecting = false;
    this.manualDisconnect = false;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.heartbeatIntervalMs = 25000;
  }

  connect(url) {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.manualDisconnect = false;
    const wsUrl = url || import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/realtime';

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.notifyListeners('connection', { status: 'connected' });

        // Heartbeat to keep the connection alive (some proxies close idle sockets)
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
        }
        this.heartbeatTimer = setInterval(() => {
          try {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send('ping');
            }
          } catch {
            // ignore
          }
        }, this.heartbeatIntervalMs);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyListeners(data.type || 'message', data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        const code = event?.code;
        const reason = event?.reason;
        console.log('WebSocket disconnected', { code, reason });
        this.isConnecting = false;

        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }

        this.notifyListeners('connection', { status: 'disconnected' });

        if (!this.manualDisconnect) {
          this.attemptReconnect(wsUrl);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
    }
  }

  attemptReconnect(url) {
    if (this.manualDisconnect) return;

    if (this.maxReconnectAttempts != null && this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.notifyListeners('connection', { status: 'failed' });
      return;
    }

    this.reconnectAttempts++;

    const expDelay = this.baseReconnectDelay * Math.pow(2, Math.max(0, this.reconnectAttempts - 1));
    const delay = Math.min(this.maxReconnectDelay, expDelay);
    const jitter = Math.floor(Math.random() * 500);
    const finalDelay = delay + jitter;

    console.log(`Reconnecting... Attempt ${this.reconnectAttempts} in ${finalDelay}ms`);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(() => this.connect(url), finalDelay);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => callback(data));
    }
  }

  disconnect() {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();
