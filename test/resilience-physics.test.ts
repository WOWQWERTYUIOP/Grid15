import WebSocket from 'ws';
import {
  ClientMessage,
  ServerMessage,
  RoomInfo,
  CarCustomization,
  PlayerPhysicsState,
} from '../src/types/game';
import { TRACKS } from '../src/config/tracks';
import { TrackGeometry, createInitialPhysicsState, stepPhysics, DEFAULT_PHYSICS_CONFIG } from '../src/game/physics';

const SERVER_URL = 'ws://localhost:3000';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class LatencyClient {
  public ws: WebSocket;
  public id: string = '';
  public name: string;
  public room: RoomInfo | null = null;
  public receivedMessages: ServerMessage[] = [];
  public artificialLatencyMs: number = 0;

  constructor(name: string, artificialLatencyMs = 0) {
    this.name = name;
    this.artificialLatencyMs = artificialLatencyMs;
    this.ws = new WebSocket(SERVER_URL);
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.on('message', async (data) => {
        if (this.artificialLatencyMs > 0) {
          await wait(this.artificialLatencyMs / 2);
        }
        try {
          const msg = JSON.parse(data.toString()) as ServerMessage;
          this.receivedMessages.push(msg);

          if (msg.type === 'ROOM_CREATED' || msg.type === 'ROOM_JOINED') {
            this.id = msg.payload.playerId;
            this.room = msg.payload.room;
          } else if (msg.type === 'ROOM_UPDATE') {
            this.room = msg.payload.room;
          } else if (msg.type === 'RACE_START') {
            this.room = msg.payload.room;
          }
        } catch (e) {
          console.error(`Client ${this.name} parse error:`, e);
        }
      });
      if (this.ws.readyState === WebSocket.OPEN) {
        return resolve();
      }
      this.ws.on('open', () => resolve());
      this.ws.on('error', (err) => reject(err));
    });
  }

  public async sendWithLatency(msg: ClientMessage) {
    if (this.artificialLatencyMs > 0) {
      await wait(this.artificialLatencyMs / 2);
    }
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public close() {
    this.ws.close();
  }
}

async function runResilienceAndPhysicsEdgeCases() {
  console.log('🔬 ==================================================');
  console.log('   NETWORK RESILIENCE & PHYSICS EDGE-CASE QA');
  console.log('==================================================\n');

  // ----------------------------------------------------
  // TEST 1: SIMULATED LATENCY (50ms, 100ms, 200ms)
  // ----------------------------------------------------
  console.log('▶ [RESILIENCE 1] Testing Simulated Latency (50ms, 100ms, 200ms RTT)...');
  const normalClient = new LatencyClient('Client_0ms', 0);
  const laggyClient50 = new LatencyClient('Client_50ms', 50);
  const laggyClient100 = new LatencyClient('Client_100ms', 100);
  const laggyClient200 = new LatencyClient('Client_200ms', 200);

  await normalClient.connect();
  await laggyClient50.connect();
  await laggyClient100.connect();
  await laggyClient200.connect();

  const dummyCar: CarCustomization = {
    driverName: 'LatTester',
    carNumber: 9,
    bodyStyle: 'AERO_APEX',
    primaryColor: '#ff2a5f',
    secondaryColor: '#00f0ff',
    accentColor: '#39ff14',
    wheelStyle: 'FORGED_SPOKE',
    wheelColor: '#ffd700',
    helmetColor: '#ffffff',
  };

  normalClient.sendWithLatency({ type: 'CREATE_ROOM', payload: { player: { name: 'Normal', carConfig: dummyCar } } });
  await wait(300);
  const latCode = normalClient.room!.code;

  await laggyClient50.sendWithLatency({ type: 'JOIN_ROOM', payload: { roomCode: latCode, player: { name: 'Lag50', carConfig: dummyCar } } });
  await wait(300);

  await laggyClient100.sendWithLatency({ type: 'JOIN_ROOM', payload: { roomCode: latCode, player: { name: 'Lag100', carConfig: dummyCar } } });
  await wait(300);

  await laggyClient200.sendWithLatency({ type: 'JOIN_ROOM', payload: { roomCode: latCode, player: { name: 'Lag200', carConfig: dummyCar } } });
  await wait(500);

  if (normalClient.room?.players.length !== 4) {
    throw new Error(`Failed to join 4 clients under artificial latency! Current count: ${normalClient.room?.players.length}`);
  }
  console.log('  ✓ 4 clients connected and synchronized across 0ms, 50ms, 100ms, and 200ms latency.');

  normalClient.close();
  laggyClient50.close();
  laggyClient100.close();
  laggyClient200.close();
  console.log('✅ [RESILIENCE 1 PASSED] Server handles simulated latency up to 200ms RTT.\n');

  // ----------------------------------------------------
  // TEST 2: PHYSICS ANTI-SKIP & REVERSE LAP CHEAT ATTEMPT
  // ----------------------------------------------------
  console.log('▶ [PHYSICS 1] Testing Anti-Cheat Checkpoint & Reverse Lap Exploit Prevention...');
  const track = TRACKS['harbor-gp'];
  const geo = new TrackGeometry(track.trackPoints);
  const nCheckpoints = track.trackPoints.length;

  const state = createInitialPhysicsState(0, track);
  console.log(`  Initial State: Lap ${state.lap}, Checkpoint ${state.checkpointIndex}, Visited ${state.visitedCheckpointsCount}`);

  // Scenario A: Driving backward across finish line
  // Reversing across sector 0 without visiting circuit checkpoints
  state.x = track.trackPoints[0].x - 5;
  state.z = track.trackPoints[0].z - 5;
  state.speed = -10; // In reverse
  stepPhysics(state, { throttle: 0, brake: 1.0, steer: 0, boost: false, usePowerUp: false }, 0.033, geo, track, 3);

  if (state.lap !== 1) {
    throw new Error(`CRITICAL EXPLOIT: Reverse finish line crossing generated invalid lap! Lap is now ${state.lap}`);
  }
  console.log('  ✓ Reverse lap exploit blocked: Lap remains 1.');

  // Scenario B: Skipping directly to sector 0 with < 75% checkpoints visited
  state.x = track.trackPoints[0].x;
  state.z = track.trackPoints[0].z;
  state.checkpointIndex = nCheckpoints - 1; // Last checkpoint index
  state.visitedCheckpointsCount = 2; // Only visited 2 checkpoints (far below 75%)
  state.speed = 40;

  stepPhysics(state, { throttle: 1.0, brake: 0, steer: 0, boost: false, usePowerUp: false }, 0.033, geo, track, 3);

  if (state.lap !== 1) {
    throw new Error(`CRITICAL EXPLOIT: Insufficient checkpoints generated invalid lap! Lap is now ${state.lap}`);
  }
  console.log('  ✓ Checkpoint skipping exploit blocked: Lap requires >= 75% circuit checkpoints.');

  // Scenario C: Legitimate full lap traversal (visit all checkpoints)
  for (let cp = 1; cp < nCheckpoints; cp++) {
    state.x = track.trackPoints[cp].x;
    state.z = track.trackPoints[cp].z;
    stepPhysics(state, { throttle: 1.0, brake: 0, steer: 0, boost: false, usePowerUp: false }, 0.033, geo, track, 3);
  }

  // Cross start/finish line after valid lap
  state.x = track.trackPoints[0].x;
  state.z = track.trackPoints[0].z;
  stepPhysics(state, { throttle: 1.0, brake: 0, steer: 0, boost: false, usePowerUp: false }, 0.033, geo, track, 3);

  if ((state.lap as number) !== 2) {
    throw new Error(`Legitimate full lap failed to complete! Expected Lap 2, got Lap ${state.lap}`);
  }
  console.log('  ✓ Legitimate full lap completed successfully: Advanced to Lap 2.');
  console.log('✅ [PHYSICS 1 PASSED] Anti-skip and checkpoint validation verified.\n');

  // ----------------------------------------------------
  // TEST 3: BARRIER COLLISION & RECOVERY
  // ----------------------------------------------------
  console.log('▶ [PHYSICS 2] Testing Barrier Collision Deflection & Energy Absorption...');
  const carState = createInitialPhysicsState(0, track);
  carState.speed = 60; // 216 km/h
  carState.vx = 40; // Heading laterally into barrier
  carState.vz = 40;
  // Position outside barrier limit
  carState.x = track.trackPoints[0].x + 12.0; // Beyond 9.2m barrier wall
  carState.z = track.trackPoints[0].z;

  const result = stepPhysics(carState, { throttle: 1.0, brake: 0, steer: 0, boost: false, usePowerUp: false }, 0.033, geo, track, 3);

  if (result.barrierHitIntensity <= 0) {
    throw new Error('Barrier collision did not trigger impact response!');
  }

  // Verify car was clamped back inward and did not fly away into infinity
  const trackOffset = geo.getTrackProgressAndOffset(carState.x, carState.z, 0).lateralOffset;
  console.log(`  Lateral offset after barrier collision: ${trackOffset.toFixed(2)}m (Barrier at ~9.2m)`);
  if (trackOffset > 10.5) {
    throw new Error('Vehicle clipped through barrier!');
  }
  console.log('  ✓ Barrier successfully deflected vehicle back onto track.');
  console.log('✅ [PHYSICS 2 PASSED] Barrier collision dynamics verified.\n');

  console.log('🎉 ==================================================');
  console.log('   ALL RESILIENCE & PHYSICS TESTS PASSED!');
  console.log('==================================================\n');
}

runResilienceAndPhysicsEdgeCases().catch((err) => {
  console.error('❌ [TEST FAILED]:', err);
  process.exit(1);
});
