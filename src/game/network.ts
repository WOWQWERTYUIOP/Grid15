import { ClientMessage, ServerMessage, RoomInfo, PlayerPhysicsState, PowerUpBox, RaceResultEntry, PowerUpType } from '../types/game';

type MessageHandler<T> = (data: T) => void;

export class NetworkManager {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: Map<string, Set<MessageHandler<any>>> = new Map();
  private pingInterval: number | null = null;
  public latency: number = 0;
  public isConnected: boolean = false;

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}`;
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
      };
    });
  }

  private startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING', payload: { timestamp: Date.now() } });
      }
    }, 2000);

    this.on('PONG', (payload: { clientTimestamp: number; serverTimestamp: number }) => {
      this.latency = Math.max(1, Math.round((Date.now() - payload.clientTimestamp) / 2));
    });
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
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export const net = new NetworkManager();
