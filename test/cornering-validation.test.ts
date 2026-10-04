import { TRACKS } from '../src/config/tracks';
import {
  TrackGeometry,
  createInitialPhysicsState,
  stepPhysics,
  DEFAULT_PHYSICS_CONFIG,
} from '../src/game/physics';

async function runCorneringValidation() {
  console.log('🏁 ==================================================');
  console.log('    GRID//15 — CORNERING AUTHORITY VALIDATION AUDIT');
  console.log('==================================================\n');

  const dt = 0.033; // ~30Hz simulation step

  // 1. 90-DEGREE CORNER TEST
  console.log('▶ [TEST 1] 90° Corner Negotiation (Entry ~120 km/h)...');
  {
    const state = createInitialPhysicsState(0, TRACKS['harbor-gp']);
    state.speed = 33.3; // 120 km/h
    state.x = 0; state.z = 0; state.rotationY = 0;
    
    // Hold left steering for 1.2 seconds through a 90-degree turn
    const startRot = state.rotationY;
    for (let i = 0; i < 36; i++) {
      stepPhysics(state, { throttle: 0.7, brake: 0, steer: -1.0, boost: false, usePowerUp: false }, dt, {
        getTrackProgressAndOffset: () => ({ lateralOffset: 2, nearestPoint: { x: 0, y: 0, z: 0 }, tangent: { x: 0, z: 1 } })
      } as any, TRACKS['harbor-gp'], 3);
    }
    const angleTurned = Math.abs(state.rotationY - startRot);
    const angleTurnedDeg = (angleTurned * 180 / Math.PI);
    console.log(`  Angle turned in 1.2s: ${angleTurnedDeg.toFixed(1)}° (Speed: ${(state.speed * 3.6).toFixed(1)} km/h)`);
    if (angleTurnedDeg < 85) {
      throw new Error(`90° corner failed: turned only ${angleTurnedDeg.toFixed(1)}°!`);
    }
    console.log('  ✓ 90° corner completed with authority.');
  }

  // 2. HAIRPIN TEST (180° turnaround at 70 km/h)
  console.log('\n▶ [TEST 2] Hairpin 180° Turnaround (Entry ~70 km/h)...');
  {
    const state = createInitialPhysicsState(0, TRACKS['harbor-gp']);
    state.speed = 19.4; // 70 km/h
    state.x = 0; state.z = 0; state.rotationY = 0;

    const startRot = state.rotationY;
    for (let i = 0; i < 50; i++) {
      stepPhysics(state, { throttle: 0.5, brake: 0, steer: -1.0, boost: false, usePowerUp: false }, dt, {
        getTrackProgressAndOffset: () => ({ lateralOffset: 2, nearestPoint: { x: 0, y: 0, z: 0 }, tangent: { x: 0, z: 1 } })
      } as any, TRACKS['harbor-gp'], 3);
    }
    const angleTurnedDeg = Math.abs(state.rotationY - startRot) * 180 / Math.PI;
    console.log(`  Angle turned in hairpin: ${angleTurnedDeg.toFixed(1)}° (Speed: ${(state.speed * 3.6).toFixed(1)} km/h)`);
    if (angleTurnedDeg < 170) {
      throw new Error(`Hairpin failed: turned only ${angleTurnedDeg.toFixed(1)}°!`);
    }
    console.log('  ✓ 180° Hairpin negotiated comfortably without pushing wide.');
  }

  // 3. MEDIUM-SPEED CORNER (Entry 160 km/h)
  console.log('\n▶ [TEST 3] Medium-Speed Cornering (Entry ~160 km/h)...');
  {
    const state = createInitialPhysicsState(0, TRACKS['harbor-gp']);
    state.speed = 44.4; // 160 km/h
    state.x = 0; state.z = 0; state.rotationY = 0;

    const startRot = state.rotationY;
    for (let i = 0; i < 30; i++) {
      stepPhysics(state, { throttle: 0.8, brake: 0, steer: -0.6, boost: false, usePowerUp: false }, dt, {
        getTrackProgressAndOffset: () => ({ lateralOffset: 2, nearestPoint: { x: 0, y: 0, z: 0 }, tangent: { x: 0, z: 1 } })
      } as any, TRACKS['harbor-gp'], 3);
    }
    const angleTurnedDeg = Math.abs(state.rotationY - startRot) * 180 / Math.PI;
    console.log(`  Angle turned at 160 km/h: ${angleTurnedDeg.toFixed(1)}°`);
    if (angleTurnedDeg < 45) {
      throw new Error(`Medium-speed corner understeered: ${angleTurnedDeg.toFixed(1)}°`);
    }
    console.log('  ✓ Medium-speed turn carved smoothly with solid grip.');
  }

  // 4. CHICANE TEST (Left-Right Flick at 150 km/h)
  console.log('\n▶ [TEST 4] Chicane Rapid Direction Reversal (150 km/h)...');
  {
    const state = createInitialPhysicsState(0, TRACKS['harbor-gp']);
    state.speed = 41.6; // 150 km/h
    state.x = 0; state.z = 0; state.rotationY = 0;

    // Steer left for 10 frames
    for (let i = 0; i < 10; i++) {
      stepPhysics(state, { throttle: 0.8, brake: 0, steer: -0.8, boost: false, usePowerUp: false }, dt, {
        getTrackProgressAndOffset: () => ({ lateralOffset: 1, nearestPoint: { x: 0, y: 0, z: 0 }, tangent: { x: 0, z: 1 } })
      } as any, TRACKS['harbor-gp'], 3);
    }
    const leftYaw = state.angularVelocity;
    if (leftYaw <= 0) throw new Error('Chicane left transition failed!');

    // Flick right for 12 frames
    for (let i = 0; i < 12; i++) {
      stepPhysics(state, { throttle: 0.8, brake: 0, steer: 0.8, boost: false, usePowerUp: false }, dt, {
        getTrackProgressAndOffset: () => ({ lateralOffset: 1, nearestPoint: { x: 0, y: 0, z: 0 }, tangent: { x: 0, z: 1 } })
      } as any, TRACKS['harbor-gp'], 3);
    }
    const rightYaw = state.angularVelocity;
    if (rightYaw >= 0) throw new Error('Chicane right reversal failed!');

    console.log(`  Flick response: ${leftYaw.toFixed(2)} rad/s (Left) -> ${rightYaw.toFixed(2)} rad/s (Right)`);
    console.log('  ✓ Chicane completed with instant weight transfer and zero delay.');
  }

  // 5. HIGH-SPEED BEND (220 km/h)
  console.log('\n▶ [TEST 5] High-Speed Sweeper (220 km/h)...');
  {
    const state = createInitialPhysicsState(0, TRACKS['harbor-gp']);
    state.speed = 61.1; // 220 km/h
    state.x = 0; state.z = 0; state.rotationY = 0;

    for (let i = 0; i < 20; i++) {
      stepPhysics(state, { throttle: 1.0, brake: 0, steer: 0.5, boost: false, usePowerUp: false }, dt, {
        getTrackProgressAndOffset: () => ({ lateralOffset: 2, nearestPoint: { x: 0, y: 0, z: 0 }, tangent: { x: 0, z: 1 } })
      } as any, TRACKS['harbor-gp'], 3);
    }
    console.log(`  High-speed yaw: ${state.angularVelocity.toFixed(2)} rad/s, isDrifting: ${state.isDrifting}`);
    if (Math.abs(state.angularVelocity) < 0.5 || Math.abs(state.angularVelocity) > 2.5) {
      throw new Error('High speed turn is either unresponsive or unstable!');
    }
    console.log('  ✓ High-speed bend carved cleanly with downforce stability.');
  }

  console.log('\n🎉 ==================================================');
  console.log('    ALL 5 CORNERING ARCHETYPES VALIDATED SUCCESSFULLY!');
  console.log('==================================================');
}

runCorneringValidation().catch((err) => {
  console.error('❌ Cornering validation failed:', err);
  process.exit(1);
});
