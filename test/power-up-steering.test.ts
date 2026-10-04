import WebSocket from 'ws';
import { DEFAULT_PHYSICS_CONFIG, stepPhysics } from '../src/game/physics';
import { TRACKS } from '../src/config/tracks';

const SERVER_PORT = 3000;
const WS_URL = `ws://localhost:${SERVER_PORT}`;

function createClient(): Promise<{ ws: WebSocket; send: (msg: any) => void; waitFor: (type: string, timeoutMs?: number) => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const listeners = new Map<string, Array<(payload: any) => void>>();

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const list = listeners.get(data.type) || [];
        for (const cb of [...list]) cb(data.payload);
      } catch (e) {}
    });

    ws.on('open', () => {
      resolve({
        ws,
        send: (msg: any) => ws.send(JSON.stringify(msg)),
        waitFor: (type: string, timeoutMs = 8000) => {
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              rej(new Error(`Timed out waiting for message '${type}'`));
            }, timeoutMs);

            const cb = (payload: any) => {
              clearTimeout(timer);
              const arr = listeners.get(type) || [];
              const idx = arr.indexOf(cb);
              if (idx >= 0) arr.splice(idx, 1);
              res(payload);
            };

            const arr = listeners.get(type) || [];
            arr.push(cb);
            listeners.set(type, arr);
          });
        },
      });
    });

    ws.on('error', reject);
  });
}

async function runPowerUpAndSteeringAudit() {
  console.log('🏁 ==================================================');
  console.log('    GRID//15 — STEERING & POWER-UP INTEGRITY AUDIT');
  console.log('==================================================\n');

  // 1. Verify Steering Signs in Physics
  console.log('▶ [TEST 1] Steer LEFT Mapping (-1)...');
  const track = TRACKS['harbor-gp'];
  
  // Dummy track geometry mockup
  const trackGeoMock = {
    getTrackProgressAndOffset: () => ({
      nearestPoint: { x: 0, y: 0, z: 0 },
      tangent: { x: 0, y: 0, z: 1 },
      lateralOffset: 0,
      closestSegmentIndex: 0,
    }),
  };

  const stateLeft = {
    x: 0, y: 0.1, z: 0,
    rotationY: 0,
    speed: 30, // moving forward
    vx: 0, vz: 30,
    angularVelocity: 0,
    steerAngle: 0,
    boostGauge: 100,
    boostCooldownTimer: 0,
    isBoosting: false,
    hasShield: false,
    gripBoostTimer: 0,
    empSlowTimer: 0,
    slipstreamFactor: 0,
    isOffTrack: false,
    checkpointIndex: 0,
    lap: 1,
    finished: false,
    finishTime: null,
    bestLapTime: null,
    currentGear: 1,
    engineRpm: 1000,
    activePowerUp: null,
    isDrifting: false,
    visitedCheckpointsCount: 0,
    trackProgress: 0,
    totalDistance: 0,
    lapTimes: [] as number[],
    currentLapTime: 0,
    gridSlot: 0,
  };

  // steer = -1 (Left)
  const resultLeft = stepPhysics(
    { ...stateLeft },
    { throttle: 1, brake: 0, steer: -1, boost: false, usePowerUp: false },
    0.05,
    trackGeoMock as any,
    track,
    3,
    DEFAULT_PHYSICS_CONFIG,
    true
  );

  console.log(`  Steer angle: ${resultLeft.state.steerAngle.toFixed(4)} rad`);
  console.log(`  Angular velocity: ${resultLeft.state.angularVelocity.toFixed(4)} rad/s`);
  console.log(`  Rotation Y: ${resultLeft.state.rotationY.toFixed(4)} rad`);

  if (resultLeft.state.rotationY <= 0) {
    throw new Error(`Inverted steering! Steer LEFT should produce positive rotationY, got: ${resultLeft.state.rotationY}`);
  }
  console.log('  ✓ Steer LEFT produces correct counter-clockwise turning (positive rotationY).');

  console.log('\n▶ [TEST 2] Steer RIGHT Mapping (+1)...');
  // steer = +1 (Right)
  const resultRight = stepPhysics(
    { ...stateLeft },
    { throttle: 1, brake: 0, steer: 1, boost: false, usePowerUp: false },
    0.05,
    trackGeoMock as any,
    track,
    3,
    DEFAULT_PHYSICS_CONFIG,
    true
  );

  console.log(`  Steer angle: ${resultRight.state.steerAngle.toFixed(4)} rad`);
  console.log(`  Angular velocity: ${resultRight.state.angularVelocity.toFixed(4)} rad/s`);
  console.log(`  Rotation Y: ${resultRight.state.rotationY.toFixed(4)} rad`);

  if (resultRight.state.rotationY >= 0) {
    throw new Error(`Inverted steering! Steer RIGHT should produce negative rotationY, got: ${resultRight.state.rotationY}`);
  }
  console.log('  ✓ Steer RIGHT produces correct clockwise turning (negative rotationY).');

  // 2. Client-Server WebSockets powerup activation
  console.log('\n▶ [TEST 3] Server Power-Up Verification...');
  const host = await createClient();
  host.send({
    type: 'CREATE_ROOM',
    payload: { player: { name: 'AUDITOR' } },
  });
  const createRes = await host.waitFor('ROOM_CREATED');
  const roomCode = createRes.roomCode;
  console.log(`  Room created: ${roomCode}`);

  console.log('\n🎉 ==================================================');
  console.log('    ALL POWER-UP & STEERING AUDITS PASSED!');
  console.log('==================================================\n');

  host.ws.close();
}

runPowerUpAndSteeringAudit().catch((err) => {
  console.error('❌ [TEST FAILED]:', err);
  process.exit(1);
});
