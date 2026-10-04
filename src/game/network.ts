import { ClientMessage, ServerMessage, RoomInfo, PlayerPhysicsState, PowerUpBox, RaceResultEntry, PowerUpType } from '../types/game';

type MessageHandler<T> = (data: T) => void;

export class NetworkManager {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: Map<string, Set<MessageHandler<any>>> = new Map();
  private pingInterval: number | null = null;
  private reconnectInterval: number | null = null;
  public latency: number = 0;
  public isConnected: boolean = false;
  public autoReconnectEnabled: boolean = false;
  public sessionMeta: { roomCode: string; playerId: string; carConfig: any } | null = null;

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}`;

    this.on('PONG', (payload: { clientTimestamp: number; serverTimestamp: number }) => {
      this.latency = Math.max(1, Math.round((Date.now() - payload.clientTimestamp) / 2));
    });
  }

  public setSessionMeta(meta: { roomCode: string; playerId: string; carConfig: any } | null) {
    this.sessionMeta = meta;
    this.autoReconnectEnabled = meta !== null;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.startPingLoop();
        this.stopReconnectLoop();
        this.dispatch('CONNECTION_CHANGE', { isConnected: true });

        // Auto re-send RECONNECT packet if session metadata exists
        if (this.sessionMeta) {
          this.send({
            type: 'RECONNECT',
            payload: {
              roomCode: this.sessionMeta.roomCode,
              playerId: this.sessionMeta.playerId,
              carConfig: this.sessionMeta.carConfig,
            },
          });
        }
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          this.dispatch(msg.type, (msg as any).payload);
        } catch (e) {
          console.error('Failed to parse server message', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        reject(err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.dispatch('CONNECTION_CHANGE', { isConnected: false });

        if (this.autoReconnectEnabled && this.sessionMeta) {
          this.startReconnectLoop();
        }
      };
    });
  }

  private startReconnectLoop() {
    if (this.reconnectInterval) return;
    this.reconnectInterval = window.setInterval(() => {
      if (!this.isConnected) {
        this.connect().catch(() => {
          // Retry silently in background
        });
      }
    }, 1500);
  }

  private stopReconnectLoop() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  private startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING', payload: { timestamp: Date.now() } });
      }
    }, 2000);
  }

  public send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public on(type: string, handler: MessageHandler<any>) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  private dispatch(type: string, payload: any) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.forEach((h) => h(payload));
    }
  }

  public disconnect() {
    this.autoReconnectEnabled = false;
    this.sessionMeta = null;
    this.stopReconnectLoop();
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.dispatch('CONNECTION_CHANGE', { isConnected: false });
  }
}

export const net = new NetworkManager();
