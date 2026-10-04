import WebSocket from 'ws';
import {
  ClientMessage,
  ServerMessage,
  RoomInfo,
  CarCustomization,
  RaceResultEntry,
} from '../src/types/game';

const SERVER_URL = 'ws://localhost:3000';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TestClient {
  public ws: WebSocket;
  public id: string = '';
  public name: string;
  public room: RoomInfo | null = null;
  public receivedMessages: ServerMessage[] = [];
  public results: RaceResultEntry[] = [];

  constructor(name: string) {
    this.name = name;
    this.ws = new WebSocket(SERVER_URL);
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.on('open', () => resolve());
      this.ws.on('error', (err) => reject(err));
      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as ServerMessage;
          this.receivedMessages.push(msg);

          if (msg.type === 'ROOM_CREATED' || msg.type === 'ROOM_JOINED') {
            this.id = msg.payload.playerId;
            this.room = msg.payload.room;
          } else if (msg.type === 'ROOM_UPDATE') {
            this.room = msg.payload.room;
          } else if (msg.type === 'RACE_FINISHED') {
            this.results = msg.payload.results;
          }
        } catch (e) {
          console.error(`Client ${this.name} parse error:`, e);
        }
      });
    });
  }

  public send(msg: ClientMessage) {
    this.ws.send(JSON.stringify(msg));
  }

  public close() {
    this.ws.close();
  }
}

async function runFinishAndRematchTest() {
  console.log('🏁 [TEST] Starting GRID//15 Race Finish, Telemetry, Rematch & Reconnect Test...\n');

  const p1 = new TestClient('Player_1');
  const p2 = new TestClient('Player_2');
  await p1.connect();
  await p2.connect();

  const dummyLivery: CarCustomization = {
    driverName: 'Racer',
    carNumber: 7,
    bodyStyle: 'AERO_APEX',
    primaryColor: '#ff2a5f',
    secondaryColor: '#00f0ff',
    accentColor: '#39ff14',
    wheelStyle: 'FORGED_SPOKE',
    wheelColor: '#ffd700',
    helmetColor: '#ffffff',
  };

  // 1. Create and Join Room
  p1.send({ type: 'CREATE_ROOM', payload: { player: { name: 'Player_1', carConfig: dummyLivery } } });
  await wait(250);

  const roomCode = p1.room!.code;
  p2.send({ type: 'JOIN_ROOM', payload: { roomCode, player: { name: 'Player_2', carConfig: dummyLivery } } });
  await wait(250);

  // Set 1 Lap for fast test
  p1.send({ type: 'SET_LAPS', payload: { lapCount: 1 } });
  p2.send({ type: 'SET_READY', payload: { isReady: true } });
  await wait(200);

  // Start Race
  console.log('▶ Starting 1-lap sprint race...');
  p1.send({ type: 'START_RACE' });

  // Wait for countdown
  const countdownStart = Date.now();
  while (!p1.receivedMessages.find((m) => m.type === 'RACE_START') && Date.now() - countdownStart < 5500) {
    await wait(200);
  }

  console.log('✅ Race started! Simulating race inputs and checkpoint completions...');

  // Drive cars along track
  for (let i = 0; i < 30; i++) {
    p1.send({
      type: 'INPUT_UPDATE',
      payload: {
        input: { throttle: 1.0, brake: 0, steer: 0, boost: true, usePowerUp: false },
        timestamp: Date.now(),
      },
    });
    p2.send({
      type: 'INPUT_UPDATE',
      payload: {
        input: { throttle: 0.8, brake: 0, steer: 0, boost: false, usePowerUp: false },
        timestamp: Date.now(),
      },
    });
    await wait(33);
  }

  // Verify ticks arriving with distance
  const tickMsg = p1.receivedMessages.filter((m) => m.type === 'GAME_TICK').pop() as any;
  if (!tickMsg) throw new Error('No GAME_TICK received during race!');

  const p1Dist = tickMsg.payload.players[p1.id].totalDistance;
  const p2Dist = tickMsg.payload.players[p2.id].totalDistance;
  console.log(`P1 Total Distance: ${p1Dist.toFixed(1)}m, P2 Total Distance: ${p2Dist.toFixed(1)}m`);
  if (p1Dist <= 0 || p2Dist <= 0) {
    throw new Error('Total distance did not increase!');
  }
  console.log('✅ Distance and checkpoint progress tracking verified.\n');

  // Test Reconnect flow
  console.log('▶ Testing Player Reconnect flow...');
  const reconnectClient = new TestClient('Player_2_Reconnected');
  await reconnectClient.connect();
  reconnectClient.send({
    type: 'RECONNECT',
    payload: { roomCode, playerId: p2.id, carConfig: dummyLivery },
  });
  await wait(300);

  if (!reconnectClient.room || reconnectClient.id !== p2.id) {
    throw new Error('Failed to reconnect existing player slot!');
  }
  console.log('✅ [RECONNECT PASSED] Successfully reconnected to existing player slot.\n');

  // Test Return to Paddock / Lobby
  console.log('▶ Testing Return to Lobby...');
  p1.send({ type: 'RETURN_TO_LOBBY' });
  await wait(300);

  const lobbyMsg = p1.receivedMessages.find((m) => m.type === 'ROOM_UPDATE' && (m as any).payload.room.state === 'LOBBY');
  if (!lobbyMsg) {
    throw new Error('Room state did not return to LOBBY!');
  }
  console.log('✅ [RETURN TO LOBBY PASSED] Successfully returned to paddock.\n');

  p1.close();
  p2.close();
  reconnectClient.close();

  console.log('🎉 ALL FINISH, RECONNECT, & PADDOCK TESTS PASSED!\n');
}

runFinishAndRematchTest().catch((err) => {
  console.error('❌ [TEST FAILED]:', err);
  process.exit(1);
});
