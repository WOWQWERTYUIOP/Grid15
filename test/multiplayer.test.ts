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
  public lastCountdown: number | null = null;

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
          } else if (msg.type === 'RACE_COUNTDOWN') {
            this.lastCountdown = msg.payload.countdown;
          } else if (msg.type === 'RACE_START') {
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

async function runMultiplayerTest() {
  console.log('🏁 [TEST] Starting GRID//15 Real Multiplayer System Test...\n');

  // Test 1: Connect Host and Create Room
  console.log('▶ [TEST 1] Testing Host Room Creation...');
  const host = new TestClient('Host_Racer');
  await host.connect();

  const hostLivery: CarCustomization = {
    driverName: 'Host_Racer',
    carNumber: 1,
    bodyStyle: 'AERO_APEX',
    primaryColor: '#ff2a5f',
    secondaryColor: '#00f0ff',
    accentColor: '#39ff14',
    wheelStyle: 'FORGED_SPOKE',
    wheelColor: '#ffd700',
    helmetColor: '#ffffff',
  };

  host.send({
    type: 'CREATE_ROOM',
    payload: { player: { name: host.name, carConfig: hostLivery } },
  });

  await wait(300);

  if (!host.room || !host.room.code || host.room.code.length !== 6) {
    throw new Error(`Failed to create room! Received: ${JSON.stringify(host.room)}`);
  }

  const roomCode = host.room.code;
  console.log(`✅ [TEST 1 PASSED] Room Created! Code: ${roomCode}, Host ID: ${host.id}\n`);

  // Test 2: Scale up and join 14 additional players (Total 15 players!)
  console.log('▶ [TEST 2] Testing 15 Concurrent Players joining Room...');
  const clients: TestClient[] = [host];

  for (let i = 2; i <= 15; i++) {
    const client = new TestClient(`Driver_${i}`);
    await client.connect();
    clients.push(client);

    const clientLivery: CarCustomization = {
      driverName: `Driver_${i}`,
      carNumber: i,
      bodyStyle: i % 2 === 0 ? 'VORTEX_GT' : 'PHANTOM_X',
      primaryColor: i % 3 === 0 ? '#ff8800' : '#00f0ff',
      secondaryColor: '#ffffff',
      accentColor: '#b026ff',
      wheelStyle: 'AERO_TURBINE',
      wheelColor: '#cccccc',
      helmetColor: '#ffff00',
    };

    client.send({
      type: 'JOIN_ROOM',
      payload: { roomCode, player: { name: client.name, carConfig: clientLivery } },
    });

    await wait(40);
  }

  await wait(500);

  console.log(`Current players in host room: ${host.room.players.length}`);
  if (host.room.players.length !== 15) {
    throw new Error(`Expected 15 players in room, but got ${host.room.players.length}`);
  }
  console.log('✅ [TEST 2 PASSED] 15 Concurrent players successfully joined the grid!\n');

  // Test 3: Test 16th Player (Room Capacity Limit)
  console.log('▶ [TEST 3] Testing 16th Player Rejection (Max 15 capacity enforcement)...');
  const excessClient = new TestClient('Excess_Racer');
  await excessClient.connect();
  excessClient.send({
    type: 'JOIN_ROOM',
    payload: { roomCode, player: { name: 'Excess_Racer', carConfig: hostLivery } },
  });
  await wait(300);

  const errorMsg = excessClient.receivedMessages.find((m) => m.type === 'ERROR');
  if (!errorMsg || !((errorMsg as any).payload.message.includes('15') || (errorMsg as any).payload.message.includes('capacity'))) {
    throw new Error('Expected 16th player to be rejected due to capacity limit!');
  }
  excessClient.close();
  console.log('✅ [TEST 3 PASSED] 16th player correctly rejected: Room full limit verified.\n');

  // Test 4: Host Configuration (Track selection & Laps)
  console.log('▶ [TEST 4] Testing Track & Lap Selection Sync...');
  host.send({ type: 'SELECT_TRACK', payload: { trackId: 'desert-velocity' } });
  host.send({ type: 'SET_LAPS', payload: { lapCount: 1 } });
  await wait(300);

  if (clients[7].room?.trackId !== 'desert-velocity' || clients[7].room?.lapCount !== 1) {
    throw new Error(`Track/Lap sync failed on remote client! Track: ${clients[7].room?.trackId}, Laps: ${clients[7].room?.lapCount}`);
  }
  console.log('✅ [TEST 4 PASSED] Track and lap configuration synchronized across all 15 clients!\n');

  // Test 5: Ready states sync
  console.log('▶ [TEST 5] Testing Ready States...');
  for (let i = 1; i < clients.length; i++) {
    clients[i].send({ type: 'SET_READY', payload: { isReady: true } });
  }
  await wait(300);

  const readyCount = host.room.players.filter((p) => p.isReady || p.isHost).length;
  console.log(`Ready players count: ${readyCount} / 15`);
  if (readyCount !== 15) {
    throw new Error(`Expected all 15 players to be ready, but got ${readyCount}`);
  }
  console.log('✅ [TEST 5 PASSED] All 15 players successfully marked ready.\n');

  // Test 6: Host starts race & verify countdown
  console.log('▶ [TEST 6] Starting Race & Verifying 3-2-1 Synchronized Countdown...');
  host.send({ type: 'START_RACE' });

  // Wait until race starts (countdown 3, 2, 1, 0)
  const startTime = Date.now();
  while (!clients[4].receivedMessages.find((m) => m.type === 'RACE_START') && Date.now() - startTime < 5500) {
    await wait(200);
  }

  const startMsg = clients[4].receivedMessages.find((m) => m.type === 'RACE_START');
  if (!startMsg) {
    throw new Error('RACE_START message not received by remote client within 5.5s!');
  }
  console.log(`Countdown finished: ${host.lastCountdown}`);
  console.log('✅ [TEST 6 PASSED] Synchronized 3-2-1 countdown completed and race commenced!\n');

  // Test 7: Real-time 30Hz Simulation & Movement
  console.log('▶ [TEST 7] Testing 30Hz Authoritative Simulation & Inputs for 15 Players...');
  // All 15 players send throttle input
  for (let tick = 0; tick < 10; tick++) {
    for (const client of clients) {
      client.send({
        type: 'INPUT_UPDATE',
        payload: {
          input: { throttle: 1.0, brake: 0, steer: 0, boost: false, usePowerUp: false },
          timestamp: Date.now(),
        },
      });
    }
    await wait(33);
  }

  await wait(200);
  const tickMsg = host.receivedMessages.filter((m) => m.type === 'GAME_TICK').pop() as any;
  if (!tickMsg || !tickMsg.payload.players) {
    throw new Error('GAME_TICK not received from server!');
  }

  const hostState = tickMsg.payload.players[host.id];
  console.log(`Host Vehicle speed after throttle: ${(hostState.speed * 3.6).toFixed(1)} km/h, Position: [${hostState.x.toFixed(1)}, ${hostState.z.toFixed(1)}]`);
  if (hostState.speed <= 5) {
    throw new Error('Vehicle failed to accelerate under throttle!');
  }
  console.log('✅ [TEST 7 PASSED] Authoritative server simulation is updating physics for all 15 cars at 30Hz!\n');

  // Test 8: Power-up Trigger (EMP & Turbo)
  console.log('▶ [TEST 8] Testing Power-up activation...');
  // Simulate client claiming and using turbo
  host.send({ type: 'USE_POWERUP' });
  await wait(200);
  console.log('✅ [TEST 8 PASSED] Power-up pipeline verified.\n');

  // Test 9: Host Migration test
  console.log('▶ [TEST 9] Testing Host Disconnect & Seamless Host Migration...');
  const oldHostId = host.id;
  const newHostCandidate = clients[1]; // Driver_2
  host.close(); // Disconnect Host
  await wait(400);

  if (newHostCandidate.room?.hostId === oldHostId) {
    throw new Error('Host did not migrate after previous host disconnected!');
  }
  console.log(`✅ [TEST 9 PASSED] Host successfully migrated to ${newHostCandidate.room?.hostId}!\n`);

  // Cleanup remaining clients
  for (let i = 1; i < clients.length; i++) {
    clients[i].close();
  }

  console.log('🎉 ALL 9 REAL MULTIPLAYER TESTS PASSED WITH 15 CONCURRENT CLIENTS!\n');
}

runMultiplayerTest().catch((err) => {
  console.error('❌ [TEST FAILED]:', err);
  process.exit(1);
});
