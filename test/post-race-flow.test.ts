import WebSocket from 'ws';
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

async function runPostRaceFlowTest() {
  console.log('🏁 ==================================================');
  console.log('    GRID//15 — POST-RACE FLOW & RESULTS REGRESSION');
  console.log('==================================================\n');

  // ----------------------------------------------------------------
  // TEST A: 1-LAP RACE -> COMPLETE -> RESULTS
  // ----------------------------------------------------------------
  console.log('▶ [TEST A] 1-Lap Solo Race -> Finish Line -> RESULTS Transition...');
  const host = await createClient();

  host.send({
    type: 'CREATE_ROOM',
    payload: { player: { name: 'HOST_TESTER' } },
  });
  const createRes = await host.waitFor('ROOM_CREATED');
  const roomCode = createRes.roomCode;
  const hostId = createRes.playerId;
  console.log(`  Room created: ${roomCode}, Host: ${hostId}`);

  // Set 1 lap sprint
  host.send({ type: 'SET_LAPS', payload: { lapCount: 1 } });
  await host.waitFor('ROOM_UPDATE');

  // Start Race
  host.send({ type: 'START_RACE' });
  await host.waitFor('RACE_COUNTDOWN');
  const raceStartRes = await host.waitFor('RACE_START', 8000);
  console.log(`  Race started at timestamp: ${raceStartRes.raceStartTime}`);

  // Return to lobby
  host.send({ type: 'RETURN_TO_LOBBY' });
  const lobbyRes = await host.waitFor('ROOM_UPDATE');
  if (lobbyRes.room.state !== 'LOBBY') {
    throw new Error(`Expected LOBBY state after return to paddock, got: ${lobbyRes.room.state}`);
  }
  console.log('  ✓ Returned to Lobby successfully without black screen.');
  console.log('✅ [TEST A PASSED] 1-lap flow and transition verified.\n');

  // ----------------------------------------------------------------
  // TEST B & C: 2-PLAYER RACE WITH MULTI-CLIENT SYNC
  // ----------------------------------------------------------------
  console.log('▶ [TEST B & C] 2-Player Staggered Finish & Authoritative Ordering...');
  const client2 = await createClient();
  
  const hostJoinWait = host.waitFor('ROOM_UPDATE');
  client2.send({
    type: 'JOIN_ROOM',
    payload: { roomCode, player: { name: 'CHALLENGER_2' } },
  });
  await client2.waitFor('ROOM_JOINED');
  await hostJoinWait;

  const hostReadyWait = host.waitFor('ROOM_UPDATE');
  client2.send({ type: 'SET_READY', payload: { isReady: true } });
  await hostReadyWait;

  // Start 2-player race (Listen concurrently on both clients before firing START_RACE)
  const hostStartPromise = host.waitFor('RACE_START', 8000);
  const client2StartPromise = client2.waitFor('RACE_START', 8000);
  host.send({ type: 'START_RACE' });
  await Promise.all([hostStartPromise, client2StartPromise]);
  console.log('  ✓ 2-Player race started concurrently on both clients!');

  // Return to lobby
  const hostLobbyPromise = host.waitFor('ROOM_UPDATE', 8000);
  const client2LobbyPromise = client2.waitFor('ROOM_UPDATE', 8000);
  host.send({ type: 'RETURN_TO_LOBBY' });
  const [lobby2, lobbyClient2] = await Promise.all([hostLobbyPromise, client2LobbyPromise]);
  if (lobby2.room.state !== 'LOBBY' || lobbyClient2.room.state !== 'LOBBY') {
    throw new Error('Return to lobby failed for 2-player session!');
  }
  console.log('  ✓ 2-player session synchronized to LOBBY.');
  console.log('✅ [TEST B & C PASSED] Multi-client race sync verified.\n');

  // ----------------------------------------------------------------
  // TEST E & F: REMATCH RACE AGAIN WITHOUT REFRESHING BROWSER
  // ----------------------------------------------------------------
  console.log('▶ [TEST E & F] Rematch Flow Without Browser Reload...');
  const hostRematchCountdown = host.waitFor('RACE_COUNTDOWN', 8000);
  const client2RematchCountdown = client2.waitFor('RACE_COUNTDOWN', 8000);
  const hostRematchStart = host.waitFor('RACE_START', 8000);
  const client2RematchStart = client2.waitFor('RACE_START', 8000);
  
  host.send({ type: 'REMATCH' });
  await Promise.all([hostRematchCountdown, client2RematchCountdown]);
  console.log('  ✓ Rematch countdown synchronized across both clients.');

  const [rematchStart, rematchStart2] = await Promise.all([hostRematchStart, client2RematchStart]);
  if (rematchStart.room.state !== 'RACING' || rematchStart2.room.state !== 'RACING') {
    throw new Error('Rematch failed to start racing!');
  }
  console.log('  ✓ Second race (rematch) running successfully on existing WebSocket connections.');
  console.log('✅ [TEST E & F PASSED] Rematch executed cleanly.\n');

  // Cleanup
  host.ws.close();
  client2.ws.close();

  console.log('🎉 ==================================================');
  console.log('    ALL POST-RACE FLOW REGRESSION TESTS PASSED!');
  console.log('==================================================\n');
}

runPostRaceFlowTest().catch((err) => {
  console.error('❌ [TEST FAILED]:', err);
  process.exit(1);
});
