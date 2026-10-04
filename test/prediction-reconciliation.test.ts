import { ClientPredictionEngine } from '../src/game/prediction';
import { TrackGeometry, createInitialPhysicsState, stepPhysics, DEFAULT_PHYSICS_CONFIG } from '../src/game/physics';
import { TRACKS, DEFAULT_TRACK } from '../src/config/tracks';
import { PlayerInput, PlayerPhysicsState } from '../src/types/game';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

console.log('🏁 ==================================================');
console.log('    GRID//15 — CLIENT PREDICTION & RECONCILIATION AUDIT');
console.log('==================================================\n');

const track = TRACKS['harbor-gp'] || DEFAULT_TRACK;
const trackGeo = new TrackGeometry(track.trackPoints);
const dt = 1 / 60; // 60 FPS client frame step

// TEST 1: Instant Local Prediction
console.log('▶ [TEST 1] Testing Instant 60 FPS Local Prediction Response...');
const engine = new ClientPredictionEngine();
const startState = createInitialPhysicsState(0, track);
engine.init(startState);

const initialX = engine.predictedState!.x;
const initialZ = engine.predictedState!.z;

const gasInput: PlayerInput = { throttle: 1, brake: 0, steer: 0.5, boost: false, usePowerUp: false };
for (let i = 0; i < 10; i++) {
  engine.predictFrame(gasInput, dt, trackGeo, track, 3);
}
console.log('Engine state speed after 10 frames:', engine.predictedState?.speed, 'steerAngle:', engine.predictedState?.steerAngle);

assert(engine.predictedState!.speed > 0, 'Local speed did not increase immediately');
assert(engine.sequenceNumber === 10, 'Sequence number did not increment to 10');
assert(engine.pendingInputs.length === 10, 'Pending inputs queue length is not 10');
console.log(`  ✓ Instant prediction verified: speed = ${(engine.predictedState!.speed * 3.6).toFixed(1)} km/h in 10 frames (0.16s).`);
console.log('✅ [TEST 1 PASSED]\n');

// TEST 2: Sequence Number & Buffer Management
console.log('▶ [TEST 2] Testing Input Sequence Number Tracking & Buffer Discarding...');
assert(engine.pendingInputs[0].sequenceNumber === 1, 'First sequence number should be 1');
assert(engine.pendingInputs[9].sequenceNumber === 10, 'Tenth sequence number should be 10');
console.log('  ✓ Monotonic sequence numbering verified.');
console.log('✅ [TEST 2 PASSED]\n');

// TEST 3: Server Snapshot Reconciliation
console.log('▶ [TEST 3] Testing Server Snapshot Reconciliation & Input Replay...');
// Simulate server snapshot acknowledging sequence #5
const serverStateAtSeq5: PlayerPhysicsState = JSON.parse(JSON.stringify(startState));
serverStateAtSeq5.lastProcessedSequenceNumber = 5;

// Reconcile server snapshot
engine.reconcile(serverStateAtSeq5, trackGeo, track, 3);

assert(engine.pendingInputs.length === 5, `Expected 5 pending inputs remaining, got ${engine.pendingInputs.length}`);
assert(engine.pendingInputs[0].sequenceNumber === 6, 'First remaining pending input should be #6');
console.log(`  ✓ Reconciliation processed: dropped acknowledged inputs 1..5, remaining queue = ${engine.pendingInputs.length}.`);
console.log('✅ [TEST 3 PASSED]\n');

// TEST 4: Controlled Error Reconciliation (Slight Discrepancy Replay)
console.log('▶ [TEST 4] Testing Replay of Unacknowledged Inputs under Network Deviation...');
const preReconcilePos = { x: engine.predictedState!.x, z: engine.predictedState!.z };

// Simulate server snapshot at seq #8 with slight lateral collision push
const serverStateAtSeq8: PlayerPhysicsState = JSON.parse(JSON.stringify(serverStateAtSeq5));
serverStateAtSeq8.lastProcessedSequenceNumber = 8;
serverStateAtSeq8.x += 0.2; // 20cm push from collision

engine.reconcile(serverStateAtSeq8, trackGeo, track, 3);

assert(engine.pendingInputs.length === 2, `Expected 2 pending inputs remaining (9 and 10), got ${engine.pendingInputs.length}`);
assert(engine.reconciliationCount > 0, 'Reconciliation count should be > 0');
console.log(`  ✓ Replay succeeded: remaining queue = ${engine.pendingInputs.length}, correction magnitude = ${engine.lastCorrectionMagnitude.toFixed(3)}m.`);
console.log('✅ [TEST 4 PASSED]\n');

// TEST 5: Respawn System Independence
console.log('▶ [TEST 5] Testing Respawn System State Transition & History Reset...');
engine.triggerRespawn();
assert(engine.isRespawning === true, 'isRespawning should be true after triggerRespawn()');
assert(engine.pendingInputs.length === 0, 'Pending inputs buffer should be cleared on respawn');

// Simulate server sending authoritative respawn state
const respawnState: PlayerPhysicsState = createInitialPhysicsState(0, track);
respawnState.x = 0;
respawnState.z = 0;
respawnState.speed = 0;
respawnState.lastRespawnTimestamp = Date.now();

engine.reconcile(respawnState, trackGeo, track, 3);

assert(engine.isRespawning === false, 'isRespawning should be false after server respawn snapshot');
assert(engine.predictedState!.x === 0 && engine.predictedState!.z === 0, 'Local predicted state set to respawn origin');
console.log('  ✓ Respawn state transition verified: pending inputs cleared and prediction safely resumed from new point.');
console.log('✅ [TEST 5 PASSED]\n');

// TEST 6: Simulated 150ms High-Latency Network Stress Test
console.log('▶ [TEST 6] Testing High-Latency (150ms Ping) Prediction Stability...');
const latencyEngine = new ClientPredictionEngine();
const start = createInitialPhysicsState(0, track);
latencyEngine.init(start);

// Simulate 1 second of aggressive driving (60 FPS = 60 frames)
const serverSimState = createInitialPhysicsState(0, track);
for (let frame = 1; frame <= 60; frame++) {
  const input: PlayerInput = {
    throttle: 1,
    brake: 0,
    steer: Math.sin(frame * 0.1),
    boost: frame > 20 && frame < 40,
    usePowerUp: false,
  };
  latencyEngine.predictFrame(input, dt, trackGeo, track, 3);
  stepPhysics(serverSimState, input, dt, trackGeo, track, 3, DEFAULT_PHYSICS_CONFIG, true);

  // Server ticks arrive every 33ms (~9 frames at 150ms ping lag)
  if (frame % 9 === 0) {
    const delayedAckSeq = Math.max(0, frame - 9);
    const mockServerState: PlayerPhysicsState = JSON.parse(JSON.stringify(serverSimState));
    mockServerState.lastProcessedSequenceNumber = delayedAckSeq;
    latencyEngine.reconcile(mockServerState, trackGeo, track, 3);
  }
}

assert(latencyEngine.predictedState!.speed > 10, 'Car should have accelerated cleanly despite 150ms ping');
assert(!isNaN(latencyEngine.predictedState!.x), 'Position must be finite numbers');
assert(!isNaN(latencyEngine.predictedState!.z), 'Position must be finite numbers');
console.log(`  ✓ High-latency test completed: car accelerated cleanly to ${(latencyEngine.predictedState!.speed * 3.6).toFixed(1)} km/h with finite coordinates.`);
console.log('✅ [TEST 6 PASSED]\n');

console.log('🎉 ==================================================');
console.log('    ALL CLIENT PREDICTION & RECONCILIATION TESTS PASSED!');
console.log('==================================================');
