import WebSocket from 'ws';
import { TRACKS } from '../src/config/tracks';
import { RaceConfig } from '../src/types/game';

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
        waitFor: (type: string, timeoutMs = 12000) => {
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

async function runRaceControlAudit() {
  console.log('⚙️ ==================================================');
  console.log('    GRID//15 — RACE CONTROL / SETUP AUDIT');
  console.log('==================================================\n');

  const host = await createClient();

  // 1. Host creates a room
  console.log('▶ [TEST 1] Create Room & Verify Default RaceConfig...');
  host.send({
    type: 'CREATE_ROOM',
    payload: { player: { name: 'RACE_MARSHAL' } },
  });
  const createRes = await host.waitFor('ROOM_CREATED');
  const roomCode = createRes.roomCode;
  const hostId = createRes.playerId;
  const initialRoom = createRes.room;

  console.log(`  Room created: ${roomCode}, Host: ${hostId}`);
  if (!initialRoom.raceConfig) {
    throw new Error('Default RaceConfig was not initialized on room creation!');
  }
  if (initialRoom.raceConfig.trackId !== 'harbor-gp' || initialRoom.raceConfig.lapCount !== 3) {
    throw new Error(`Unexpected default config values: ${JSON.stringify(initialRoom.raceConfig)}`);
  }
  console.log('  ✓ Initial default config matches Harbor GP, 3 laps, Standard Preset.');

  // 2. Host modifies configuration via UPDATE_RACE_CONFIG
  console.log('\n▶ [TEST 2] Host Updates Config (Laps=5, Track=Neon, Boost=Off, Preset=Custom)...');
  const customConfig: RaceConfig = {
    ...initialRoom.raceConfig,
    trackId: 'neon-district',
    lapCount: 5,
    preset: 'CUSTOM',
    boostEnabled: false,
    carCollisionsEnabled: false,
  };

  host.send({
    type: 'UPDATE_RACE_CONFIG',
    payload: { raceConfig: customConfig },
  });

  const updateRes = await host.waitFor('ROOM_UPDATE');
  const updatedRoom = updateRes.room;
  if (updatedRoom.trackId !== 'neon-district' || updatedRoom.lapCount !== 5 || updatedRoom.raceConfig.boostEnabled !== false) {
    throw new Error(`Failed to apply custom config values on server: ${JSON.stringify(updatedRoom.raceConfig)}`);
  }
  console.log('  ✓ Server validated, applied, and synchronized custom rules successfully.');

  // 3. Second player joins & verifies synced config
  console.log('\n▶ [TEST 3] Second Player Joins & Verifies Synced Config...');
  const player2 = await createClient();
  const hostJoinWait = host.waitFor('ROOM_UPDATE');
  player2.send({
    type: 'JOIN_ROOM',
    payload: { roomCode, player: { name: 'CHALLENGER' } },
  });
  const joinRes = await player2.waitFor('ROOM_JOINED');
  await hostJoinWait;

  if (joinRes.room.raceConfig.trackId !== 'neon-district' || joinRes.room.raceConfig.lapCount !== 5 || joinRes.room.raceConfig.carCollisionsEnabled !== false) {
    throw new Error('Second player did not receive the synchronized custom settings on join!');
  }
  console.log('  ✓ Challenger received synchronized custom rules correctly upon joining.');

  // 4. Unauthorized non-host player attempts config change
  console.log('\n▶ [TEST 4] Unauthorized Non-Host Modification Rejection...');
  player2.send({
    type: 'UPDATE_RACE_CONFIG',
    payload: { raceConfig: { ...customConfig, lapCount: 10 } },
  });
  const errorRes = await player2.waitFor('ERROR');
  console.log(`  ✓ Received unauthorized error message: "${errorRes.message}"`);
  if (!errorRes.message.includes('Unauthorized')) {
    throw new Error(`Expected unauthorized error, got: ${errorRes.message}`);
  }

  // 5. Host starts countdown & verify settings lock
  console.log('\n▶ [TEST 5] Settings Lock During Active States...');
  player2.send({ type: 'SET_READY', payload: { isReady: true } });
  await host.waitFor('ROOM_UPDATE');

  host.send({ type: 'START_RACE' });
  await host.waitFor('ROOM_UPDATE'); // Starts starting state

  // Try to modify settings during countdown state
  host.send({
    type: 'UPDATE_RACE_CONFIG',
    payload: { raceConfig: { ...customConfig, lapCount: 2 } },
  });
  const stateLockError = await host.waitFor('ERROR');
  console.log(`  ✓ Modification rejected during start sequence: "${stateLockError.message}"`);
  if (!stateLockError.message.includes('Cannot modify')) {
    throw new Error(`Expected state lock error, got: ${stateLockError.message}`);
  }

  // Clean up
  host.ws.close();
  player2.ws.close();

  console.log('\n🎉 ==================================================');
  console.log('    ALL RACE CONTROL SETUP TESTS PASSED!');
  console.log('==================================================\n');
}

runRaceControlAudit().catch((err) => {
  console.error('❌ [TEST FAILED]:', err);
  process.exit(1);
});
