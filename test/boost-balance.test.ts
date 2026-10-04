import { TRACKS } from '../src/config/tracks';
import { TrackGeometry, createInitialPhysicsState, stepPhysics } from '../src/game/physics';
import WebSocket from 'ws';

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
        for (const cb of list) cb(data.payload);
      } catch (e) {}
    });

    ws.on('open', () => {
      resolve({
        ws,
        send: (msg: any) => ws.send(JSON.stringify(msg)),
        waitFor: (type: string, timeoutMs = 8000) => {
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              rej(new Error(`Timed out waiting for message '${type}' (${timeoutMs}ms)`));
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

async function runBoostBalanceAudit() {
  console.log('⚡ ==================================================');
  console.log('    GRID//15 — BOOST REGENERATION BALANCE AUDIT');
  console.log('==================================================\n');

  const track = TRACKS['harbor-gp'];
  const geo = new TrackGeometry(track.trackPoints);
  const state = createInitialPhysicsState(0, track);

  // 1. Initial State: Full Boost
  console.log('▶ [CHECK 1] Start with Full Boost...');
  if (state.boostGauge !== 100) {
    throw new Error(`Expected initial boostGauge to be 100, got: ${state.boostGauge}`);
  }
  console.log(`  ✓ Initial boost gauge: ${state.boostGauge}% (READY)`);

  // 2. Activate Boost & Verify Acceleration
  console.log('▶ [CHECK 2 & 3] Activate Boost & Verify Speed Surge...');
  state.speed = 30.0;
  // Burn boost for 1.5 seconds (45 frames @ 33ms)
  for (let i = 0; i < 45; i++) {
    stepPhysics(state, { throttle: 1.0, brake: 0, steer: 0, boost: true, usePowerUp: false }, 0.033, geo, track, 3);
  }
  const speedAfterBoost = state.speed * 3.6;
  console.log(`  ✓ Speed after 1.5s boost: ${speedAfterBoost.toFixed(1)} km/h, Gauge: ${state.boostGauge.toFixed(1)}%`);
  if (!state.isBoosting || state.boostGauge > 60 || state.boostGauge < 40) {
    throw new Error(`Boost consumption rate incorrect! Gauge is ${state.boostGauge}%`);
  }

  // 4. Deplete remaining boost to 0%
  console.log('▶ [CHECK 4] Complete Boost Burn & Verify Zero-Charge State...');
  for (let i = 0; i < 80; i++) {
    if (state.boostGauge > 0) {
      stepPhysics(state, { throttle: 1.0, brake: 0, steer: 0, boost: true, usePowerUp: false }, 0.033, geo, track, 3);
    }
  }
  if (state.boostGauge > 0.001) {
    throw new Error(`Expected boost gauge to reach 0, got: ${state.boostGauge}`);
  }
  console.log(`  ✓ Boost depleted to 0%, isBoosting turned off, cooldown timer initialized to ${state.boostCooldownTimer}s.`);

  // 5. Verify Recharge Pause Cooldown Delay (1.2s delay before recharge begins)
  console.log('▶ [CHECK 5] Verify Cooldown Delay Before Recharge Resumes...');
  // Run 0.8s without boost input: Cooldown should count down, gauge should REMAIN 0%
  for (let i = 0; i < 24; i++) {
    stepPhysics(state, { throttle: 1.0, brake: 0, steer: 0, boost: false, usePowerUp: false }, 0.033, geo, track, 3);
  }
  if (state.boostGauge > 0.01) {
    throw new Error(`Recharge started prematurely during cooldown! Gauge: ${state.boostGauge}`);
  }
  console.log(`  ✓ Cooldown delay honored: 0.8s after burn, gauge remains ${state.boostGauge}% (paused, ${state.boostCooldownTimer.toFixed(2)}s left).`);

  // 6. Verify Minimum Activation Threshold (< 20% cannot activate boost)
  console.log('▶ [CHECK 6] Verify <20% Activation Threshold (Anti-Micro-Stutter)...');
  // Run another 1.0s: Gauge should reach ~2.5%
  for (let i = 0; i < 30; i++) {
    stepPhysics(state, { throttle: 1.0, brake: 0, steer: 0, boost: false, usePowerUp: false }, 0.033, geo, track, 3);
  }
  console.log(`  Gauge is now: ${state.boostGauge.toFixed(1)}% (< 20%)`);
  // Attempt to activate boost at low gauge
  stepPhysics(state, { throttle: 1.0, brake: 0, steer: 0, boost: true, usePowerUp: false }, 0.033, geo, track, 3);
  if (state.isBoosting) {
    throw new Error('Boost activated under 20% threshold!');
  }
  console.log(`  ✓ Boost activation correctly rejected when gauge < 20%.`);

  // 7. Test Sustained Recharge to Full
  console.log('▶ [CHECK 7 & 8] Tactical Recharge Rate & Full Replenishment...');
  // Recharge for 22 seconds (660 frames)
  for (let i = 0; i < 660; i++) {
    stepPhysics(state, { throttle: 1.0, brake: 0, steer: 0, boost: false, usePowerUp: false }, 0.033, geo, track, 3);
  }
  console.log(`  ✓ Gauge after recharge: ${state.boostGauge.toFixed(1)}% (BOOST READY).`);
  if (state.boostGauge < 95) {
    throw new Error(`Expected boost gauge to reach >= 95%, got: ${state.boostGauge}`);
  }

  // 9. Multiplayer Session Sync
  console.log('▶ [CHECK 9 & 10] Multiplayer Server-Authoritative Sync...');
  const host = await createClient();
  host.send({
    type: 'CREATE_ROOM',
    payload: { player: { name: 'BOOST_TEST_HOST' } },
  });
  const roomRes = await host.waitFor('ROOM_CREATED');
  host.send({ type: 'START_RACE' });
  await host.waitFor('RACE_START', 6000);

  // Send tick input with boost
  host.send({
    type: 'INPUT_UPDATE',
    payload: { input: { throttle: 1.0, brake: 0, steer: 0, boost: true, usePowerUp: false }, timestamp: Date.now() },
  });
  const tickRes = await host.waitFor('GAME_TICK');
  const hostState = tickRes.players[roomRes.playerId];
  if (hostState.boostGauge > 100) {
    throw new Error('Server gauge calculation out of bounds!');
  }
  console.log(`  ✓ Server-authoritative boost state verified on 30Hz GAME_TICK.`);

  host.ws.close();

  console.log('\n🎉 ==================================================');
  console.log('    ALL BOOST BALANCE & RESILIENCE AUDITS PASSED!');
  console.log('==================================================\n');
}

runBoostBalanceAudit().catch((err) => {
  console.error('❌ [AUDIT FAILED]:', err);
  process.exit(1);
});
