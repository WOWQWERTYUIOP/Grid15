import { PlayerInput, PlayerPhysicsState, TrackData, TrackPoint, RaceConfig } from '../types/game';
import { POWER_UP_BALANCING } from '../config/powerups';

export interface PhysicsConfig {
  maxSpeedForward: number;       // m/s (~285 km/h is ~79 m/s)
  maxSpeedReverse: number;       // m/s (~45 km/h is ~12.5 m/s)
  boostMaxSpeed: number;         // m/s (~345 km/h is ~96 m/s)
  acceleration: number;          // m/s^2 base
  brakeForce: number;            // m/s^2
  coastDrag: number;             // drag coefficient
  aerodynamicDrag: number;       // air resistance at high speed
  downforceGrip: number;         // extra lateral grip multiplier from speed
  baseLateralGrip: number;       // tire grip before sliding
  driftFriction: number;         // friction when sliding
  steerSpeed: number;            // how fast wheels turn
  maxSteerAngle: number;         // rad at low speed
  highSpeedSteerFactor: number;  // steer angle reduction at high speed
  angularDamping: number;
  weightInertia: number;
  offTrackFriction: number;
  trackWidth: number;
  barrierRestitution: number;
  // Four-wheel vehicle dynamics configuration (RVP-inspired)
  mass?: number;                 // vehicle mass in kg (~790 kg)
  wheelbase?: number;            // distance between front and rear axles (~3.2 m)
  trackWidthFront?: number;      // front track width (~1.60 m)
  trackWidthRear?: number;       // rear track width (~1.55 m)
  cgHeight?: number;             // center of gravity height (~0.30 m)
  weightDistFront?: number;      // static front weight distribution (~0.45)
  brakeBiasFront?: number;       // front brake bias (~0.56)
  downforceCoeff?: number;       // aero downforce coeff (~3.4 N/(m/s)^2)
  tirePeakSlipAngle?: number;    // optimal tire slip angle (~0.13 rad)
  tireFrictionPeak?: number;     // peak tire friction coefficient (~1.65)
  tireFrictionSlide?: number;    // sliding friction coefficient (~1.30)
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  maxSpeedForward: 79.5,         // ~286 km/h
  maxSpeedReverse: 13.0,         // ~47 km/h
  boostMaxSpeed: 96.5,           // ~347 km/h
  acceleration: 34.0,            // progressive torque curve: predictable launch & sustained mid-range
  brakeForce: 68.0,              // confidence-inspiring, forgiving progressive braking
  coastDrag: 1.8,
  aerodynamicDrag: 0.0031,
  downforceGrip: 0.028,          // aerodynamic downforce for high-speed stability
  baseLateralGrip: 30.0,         // firm front-end grip: car cleanly holds line through turns
  driftFriction: 18.0,           // predictable, controllable tire friction during slides
  steerSpeed: 10.5,              // snappy, responsive steering wheel turn rate
  maxSteerAngle: 0.64,           // ~36.7 degrees (sharp hairpin authority and nimble cornering)
  highSpeedSteerFactor: 0.52,    // accessible high-speed steering authority
  angularDamping: 2.4,           // calibrated yaw stability: smooth return to center without choking turns
  weightInertia: 12.0,           // agile, immediate weight transfer and yaw response
  offTrackFriction: 0.45,
  trackWidth: 16.0,
  barrierRestitution: 0.18,      // soft, cushioned deflection away from walls
  mass: 790,
  wheelbase: 3.2,
  trackWidthFront: 1.60,
  trackWidthRear: 1.55,
  cgHeight: 0.30,
  weightDistFront: 0.45,
  brakeBiasFront: 0.56,
  downforceCoeff: 3.4,
  tirePeakSlipAngle: 0.13,
  tireFrictionPeak: 1.65,
  tireFrictionSlide: 1.30,
};

// Track segment spline calculations
export class TrackGeometry {
  points: TrackPoint[];
  totalLength: number;
  segmentLengths: number[];
  cumulativeDistances: number[];

  constructor(trackPoints: TrackPoint[]) {
    this.points = trackPoints;
    this.segmentLengths = [];
    this.cumulativeDistances = [0];
    let total = 0;

    for (let i = 0; i < trackPoints.length; i++) {
      const nextIdx = (i + 1) % trackPoints.length;
      const p1 = trackPoints[i];
      const p2 = trackPoints[nextIdx];
      const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      this.segmentLengths.push(dist);
      total += dist;
      this.cumulativeDistances.push(total);
    }
    this.totalLength = total;
  }

  // Find nearest point on track centerline and compute progress (0 to 1) & lateral offset
  getTrackProgressAndOffset(x: number, z: number, currentCheckpoint = 0): {
    progress: number;
    distanceAlongTrack: number;
    nearestPoint: { x: number; y: number; z: number };
    lateralOffset: number;
    tangent: { x: number; z: number };
    normal: { x: number; z: number };
    closestSegmentIndex: number;
  } {
    let minDistanceSq = Infinity;
    let closestSegment = 0;
    let closestT = 0;
    let closestPoint = { x: 0, y: 0, z: 0 };
    let tangent = { x: 0, z: 1 };
    let normal = { x: 1, z: 0 };

    const n = this.points.length;
    // Window search near expected checkpoint (+/- 4)
    for (let offset = -4; offset <= 4; offset++) {
      const i = (currentCheckpoint + offset + n) % n;
      const nextIdx = (i + 1) % n;
      const p1 = this.points[i];
      const p2 = this.points[nextIdx];

      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const segLenSq = dx * dx + dz * dz;
      if (segLenSq === 0) continue;

      let t = ((x - p1.x) * dx + (z - p1.z) * dz) / segLenSq;
      t = Math.max(0, Math.min(1, t));

      const projX = p1.x + t * dx;
      const projY = p1.y + t * (p2.y - p1.y);
      const projZ = p1.z + t * dz;

      const distSq = (x - projX) ** 2 + (z - projZ) ** 2;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestSegment = i;
        closestT = t;
        closestPoint = { x: projX, y: projY, z: projZ };
        const len = Math.hypot(dx, dz) || 1;
        tangent = { x: dx / len, z: dz / len };
        // Normal pointing to the right of tangent
        normal = { x: tangent.z, z: -tangent.x };
      }
    }

    // Full scan fallback if vehicle was respawned or far off
    if (minDistanceSq > 2500) {
      for (let i = 0; i < n; i++) {
        const nextIdx = (i + 1) % n;
        const p1 = this.points[i];
        const p2 = this.points[nextIdx];
        const dx = p2.x - p1.x;
        const dz = p2.z - p1.z;
        const segLenSq = dx * dx + dz * dz;
        if (segLenSq === 0) continue;
        let t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (z - p1.z) * dz) / segLenSq));
        const projX = p1.x + t * dx;
        const projY = p1.y + t * (p2.y - p1.y);
        const projZ = p1.z + t * dz;
        const distSq = (x - projX) ** 2 + (z - projZ) ** 2;
        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          closestSegment = i;
          closestT = t;
          closestPoint = { x: projX, y: projY, z: projZ };
          const len = Math.hypot(dx, dz) || 1;
          tangent = { x: dx / len, z: dz / len };
          normal = { x: tangent.z, z: -tangent.x };
        }
      }
    }

    const segStartDist = this.cumulativeDistances[closestSegment];
    const segLength = this.segmentLengths[closestSegment];
    const distanceAlongTrack = segStartDist + closestT * segLength;
    const progress = (distanceAlongTrack / this.totalLength) % 1.0;
    const lateralOffset = Math.sqrt(minDistanceSq);

    return {
      progress,
      distanceAlongTrack,
      nearestPoint: closestPoint,
      lateralOffset,
      tangent,
      normal,
      closestSegmentIndex: closestSegment,
    };
  }
}

// Initial physics state builder
export function createInitialPhysicsState(
  gridSlot: number,
  track: TrackData
): PlayerPhysicsState {
  const slot = track.startGridSlots[gridSlot] || {
    x: 0,
    y: 0.1,
    z: -gridSlot * 8,
    rotationY: 0,
  };

  return {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    rotationY: slot.rotationY,
    speed: 0,
    angularVelocity: 0,
    vx: 0,
    vz: 0,
    steerAngle: 0,
    isDrifting: false,
    isOffTrack: false,
    boostGauge: 100,
    isBoosting: false,
    boostCooldownTimer: 0,
    activePowerUp: null,
    hasShield: false,
    shieldTimer: 0,
    turboTimer: 0,
    gripBoostTimer: 0,
    empSlowTimer: 0,
    draftStreamTimer: 0,
    slipstreamFactor: 0,
    lap: 1,
    checkpointIndex: 0,
    visitedCheckpointsCount: 1, // Started at grid
    trackProgress: 0,
    totalDistance: 0,
    finished: false,
    finishTime: null,
    currentLapTime: 0,
    bestLapTime: null,
    lapTimes: [],
    gridSlot,
    currentGear: 1,
    engineRpm: 1200,
    pitch: 0,
    roll: 0,
    suspensionCompression: [0.5, 0.5, 0.5, 0.5],
    wheelSlip: [0, 0, 0, 0],
  };
}

// Gear & RPM calculator for open-wheel telemetry
function calculateGearAndRpm(speedMs: number, throttle: number): { gear: number; rpm: number } {
  const speedKmh = Math.abs(speedMs) * 3.6;

  if (speedMs < -0.5) {
    const rpm = 2000 + Math.min(8000, (Math.abs(speedMs) / 12) * 8000);
    return { gear: 0, rpm }; // Reverse
  }

  // 7-speed stepped transmission
  let gear = 1;
  let minSpeed = 0;
  let maxSpeed = 55;

  if (speedKmh < 55) {
    gear = 1; minSpeed = 0; maxSpeed = 55;
  } else if (speedKmh < 100) {
    gear = 2; minSpeed = 55; maxSpeed = 100;
  } else if (speedKmh < 145) {
    gear = 3; minSpeed = 100; maxSpeed = 145;
  } else if (speedKmh < 190) {
    gear = 4; minSpeed = 145; maxSpeed = 190;
  } else if (speedKmh < 235) {
    gear = 5; minSpeed = 190; maxSpeed = 235;
  } else if (speedKmh < 280) {
    gear = 6; minSpeed = 235; maxSpeed = 280;
  } else {
    gear = 7; minSpeed = 280; maxSpeed = 350;
  }

  const fraction = Math.max(0, Math.min(1, (speedKmh - minSpeed) / (maxSpeed - minSpeed)));
  const baseRpm = 4500 + fraction * 9500; // 4,500 to 14,000 RPM
  const throttleBonus = throttle > 0 ? 500 : 0;
  const rpm = Math.round(Math.max(1200, baseRpm + throttleBonus));

  return { gear, rpm };
}

// Fixed timestep simulation step for authoritative & client prediction
export function stepPhysics(
  state: PlayerPhysicsState,
  input: PlayerInput,
  dt: number,
  trackGeo: TrackGeometry,
  trackData: TrackData,
  totalLaps: number,
  config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG,
  raceStarted = true,
  raceConfig?: RaceConfig
): { state: PlayerPhysicsState; barrierHitIntensity: number } {
  let barrierHitIntensity = 0;

  // Resolve config-defined assists & toggles
  const hasSteeringAssist = raceConfig ? raceConfig.steeringAssist : true;
  const hasTractionAssist = raceConfig ? raceConfig.tractionAssist : true;
  const hasStabilityAssist = raceConfig ? raceConfig.stabilityAssist : true;
  const hasBrakeAssist = raceConfig ? raceConfig.brakeAssist : true;
  const offTrackPenaltyActive = raceConfig ? raceConfig.offTrackPenalty : true;
  const isBoostEnabled = raceConfig ? raceConfig.boostEnabled : true;

  if (!raceStarted) {
    // Locked on starting grid
    state.speed = 0;
    state.vx = 0;
    state.vz = 0;
    state.angularVelocity = 0;
    state.steerAngle = 0;
    state.engineRpm = input.throttle > 0 ? 9500 : 3500;
    return { state, barrierHitIntensity: 0 };
  }

  if (state.finished) {
    // Coast to smooth halt when finished
    state.speed = Math.max(0, state.speed - 22 * dt);
    state.vx = Math.sin(state.rotationY) * state.speed;
    state.vz = Math.cos(state.rotationY) * state.speed;
    state.x += state.vx * dt;
    state.z += state.vz * dt;
    const { gear, rpm } = calculateGearAndRpm(state.speed, 0);
    state.currentGear = gear;
    state.engineRpm = rpm;
    return { state, barrierHitIntensity: 0 };
  }

  // Decrement status timers
  if (state.turboTimer && state.turboTimer > 0) {
    state.turboTimer = Math.max(0, state.turboTimer - dt * 1000);
  }
  if (state.shieldTimer && state.shieldTimer > 0) {
    state.shieldTimer = Math.max(0, state.shieldTimer - dt * 1000);
    if (state.shieldTimer === 0) state.hasShield = false;
  }
  if (state.gripBoostTimer > 0) {
    state.gripBoostTimer = Math.max(0, state.gripBoostTimer - dt * 1000);
  }
  if (state.empSlowTimer > 0) {
    state.empSlowTimer = Math.max(0, state.empSlowTimer - dt * 1000);
  }
  if (state.draftStreamTimer && state.draftStreamTimer > 0) {
    state.draftStreamTimer = Math.max(0, state.draftStreamTimer - dt * 1000);
  }

  // Check off-track status & track position
  const trackInfo = trackGeo.getTrackProgressAndOffset(state.x, state.z, state.checkpointIndex);
  const halfTrackWidth = config.trackWidth / 2;
  const barrierDistanceLimit = halfTrackWidth + 1.2; // Armco barrier wall location (~9.2m)
  const isOffTrack = trackInfo.lateralOffset > halfTrackWidth + 0.3;
  state.isOffTrack = isOffTrack;

  // Handle respawn if requested or if car is wildly lost (>40m off course)
  if (input.respawn || trackInfo.lateralOffset > halfTrackWidth + 40) {
    state.x = trackInfo.nearestPoint.x;
    state.y = trackInfo.nearestPoint.y + 0.1;
    state.z = trackInfo.nearestPoint.z;
    state.rotationY = Math.atan2(trackInfo.tangent.x, trackInfo.tangent.z);
    state.speed = 0;
    state.vx = 0;
    state.vz = 0;
    state.angularVelocity = 0;
    state.steerAngle = 0;
    return { state, barrierHitIntensity: 0 };
  }

  // 1. BARRIER COLLISION RESPONSE
  // If vehicle penetrates barrier limit, cushion impact, deflect softly, and prevent sticking
  if (trackInfo.lateralOffset > barrierDistanceLimit) {
    const penetration = trackInfo.lateralOffset - barrierDistanceLimit;
    const dxFromCenter = state.x - trackInfo.nearestPoint.x;
    const dzFromCenter = state.z - trackInfo.nearestPoint.z;
    const distFromCenter = Math.hypot(dxFromCenter, dzFromCenter) || 1;

    // Resolve collision settings
    let currentBarrierRestitution = config.barrierRestitution;
    let barrierSpeedFrictionFactor = 0.25;

    if (raceConfig) {
      if (raceConfig.collisionStrength === 'LIGHT') {
        currentBarrierRestitution = 0.10;
        barrierSpeedFrictionFactor = 0.10;
      } else if (raceConfig.collisionStrength === 'HEAVY') {
        currentBarrierRestitution = 0.45;
        barrierSpeedFrictionFactor = 0.45;
      }
    }

    // Normal pointing OUTWARD from track
    const outNormalX = dxFromCenter / distFromCenter;
    const outNormalZ = dzFromCenter / distFromCenter;

    // Softly push car back inside track boundary (never gets stuck inside barrier)
    state.x -= outNormalX * (penetration + 0.12);
    state.z -= outNormalZ * (penetration + 0.12);

    // Compute velocity component heading INTO the barrier (outward)
    const vOut = state.vx * outNormalX + state.vz * outNormalZ;
    if (vOut > 0) {
      // Rebound inward with cushioned restitution
      barrierHitIntensity = Math.min(0.5, vOut / 20);
      const reboundForce = (1.0 + currentBarrierRestitution) * vOut;
      state.vx -= outNormalX * reboundForce;
      state.vz -= outNormalZ * reboundForce;

      // Energy absorption: controlled speed reduction (forgiving but penalizes crash)
      state.speed *= Math.max(0.70, 1.0 - barrierSpeedFrictionFactor * Math.min(1.0, vOut / 25));
    } else {
      // Wall scrape friction along tangent while touching barrier
      state.speed *= Math.max(0.85, 1.0 - 0.15 * dt);
    }

    // Kill spin into barrier
    state.angularVelocity = 0;

    // Smoothly align car orientation parallel to track forward tangent (with proper angle wrapping)
    const trackRot = Math.atan2(trackInfo.tangent.x, trackInfo.tangent.z);
    let angleDelta = trackRot - state.rotationY;
    while (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
    while (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;
    state.rotationY += angleDelta * Math.min(1.0, 4.0 * dt);
  }

  // 2. Power-up Boost / Nitro management
  // Resolving custom boost settings from config
  let boostGaugeDepletion = 35.0; // standard % per sec
  let boostRegenSpeed = 4.5; // standard % per sec
  let boostAccelerationBonus = 0.85;
  let boostMaxSpeedCap = config.boostMaxSpeed;

  if (raceConfig) {
    if (raceConfig.boostStrength === 'LOW') {
      boostAccelerationBonus = 0.45;
      boostMaxSpeedCap = config.maxSpeedForward + 6.0;
    } else if (raceConfig.boostStrength === 'HIGH') {
      boostAccelerationBonus = 1.25;
      boostMaxSpeedCap = config.maxSpeedForward + 18.0;
    }

    if (raceConfig.boostDuration === 'SHORT') {
      boostGaugeDepletion = 45.0;
    } else if (raceConfig.boostDuration === 'LONG') {
      boostGaugeDepletion = 25.0;
    }

    if (raceConfig.boostRegeneration === 'SLOW') {
      boostRegenSpeed = 2.5;
    } else if (raceConfig.boostRegeneration === 'FAST') {
      boostRegenSpeed = 8.0;
    }
  }

  const wasBoosting = state.isBoosting;
  const isTurboActive = Boolean(state.turboTimer && state.turboTimer > 0);
  const hasMinimumCharge = wasBoosting ? state.boostGauge > 0 : state.boostGauge >= 20.0;
  // If boost is disabled globally, driver cannot use it
  const isBoostAllowedByConfig = raceConfig ? raceConfig.boostEnabled : true;
  const canBoost = (input.boost && hasMinimumCharge && state.empSlowTimer === 0 && isBoostAllowedByConfig) || isTurboActive;
  state.isBoosting = canBoost;

  if (canBoost && !isTurboActive) {
    // Deplete normal KERS boost while active (only when boosting via Shift)
    state.boostGauge = Math.max(0, state.boostGauge - boostGaugeDepletion * dt);
    // Keep recharge paused
    state.boostCooldownTimer = 1.2;
  } else if (!isTurboActive) {
    if (wasBoosting && !canBoost) {
      // Just stopped boosting (either released key or exhausted tank): lock 1.2s recharge delay
      state.boostCooldownTimer = 1.2;
    }
    // Count down recharge cooldown delay
    if (state.boostCooldownTimer > 0) {
      state.boostCooldownTimer = Math.max(0, state.boostCooldownTimer - dt);
    } else {
      // Slower, meaningful tactical regeneration
      state.boostGauge = Math.min(100, state.boostGauge + boostRegenSpeed * dt);
    }
  }

  // Multipliers based on active buffs/debuffs
  let accelMultiplier = 1.0;
  let topSpeedCap = config.maxSpeedForward;
  let gripMultiplier = 1.0;

  // 1. Kinetic Turbo Power-up vs Normal Nitro Boost
  if (isTurboActive) {
    accelMultiplier += 1.35; // +135% rocket acceleration
    topSpeedCap = Math.max(topSpeedCap, config.boostMaxSpeed + 12.0); // Exceeds standard top speed
  } else if (state.isBoosting) {
    accelMultiplier += boostAccelerationBonus;
    topSpeedCap = boostMaxSpeedCap;
  }

  // 2. Aero Grip Power-up
  if (state.gripBoostTimer > 0) {
    gripMultiplier += 0.60;
  }

  // 3. Neural EMP Debuff
  if (state.empSlowTimer > 0) {
    accelMultiplier *= 0.40;
    topSpeedCap *= 0.52;
  }

  // 4. Draft Stream Power-up & Slipstream
  const isDraftStreamActive = Boolean(state.draftStreamTimer && state.draftStreamTimer > 0);
  if (isDraftStreamActive) {
    accelMultiplier += 0.55;
    topSpeedCap += 10.0;
    state.slipstreamFactor = Math.max(state.slipstreamFactor, 1.0);
  } else if (state.slipstreamFactor > 0) {
    accelMultiplier += state.slipstreamFactor * 0.42;
    topSpeedCap += state.slipstreamFactor * 8.5;
  }

  if (isOffTrack && offTrackPenaltyActive) {
    accelMultiplier *= config.offTrackFriction;
    topSpeedCap *= 0.48;
  }

  // 3. FRONT-WHEEL STEERING SENSITIVITY & ACKERMANN GEOMETRY
  // Low & mid speed: crisp, strong steering authority for 90-degree corners and hairpins.
  // High speed: progressive stabilization for high-speed bends without losing cornering ability.
  const speedRatio = Math.min(1.0, Math.abs(state.speed) / config.maxSpeedForward);
  const speedSteerScaling = 1.0 - (speedRatio ** 1.5) * (1.0 - config.highSpeedSteerFactor);

  // Forgiving trail braking: slightly moderate steering authority under heavy threshold braking
  const brakeSteerDamping = input.brake > 0.5 ? Math.max(0.85, 1.0 - 0.15 * input.brake) : 1.0;
  const steeringSensitivity = hasSteeringAssist ? 1.0 : 0.80;

  const targetSteerAngle =
    -input.steer *
    config.maxSteerAngle *
    speedSteerScaling *
    brakeSteerDamping *
    steeringSensitivity;

  state.steerAngle += (targetSteerAngle - state.steerAngle) * Math.min(1.0, config.steerSpeed * dt);

  // Four-Wheel Geometry Definition (F1/Formula open-wheel architecture)
  const mass = config.mass ?? 790; // kg
  const wheelbase = config.wheelbase ?? 3.2; // m
  const trackWidthF = config.trackWidthFront ?? 1.60; // m
  const trackWidthR = config.trackWidthRear ?? 1.55; // m
  const distCGFront = wheelbase * (1.0 - (config.weightDistFront ?? 0.45)); // ~1.76m to front axle
  const distCGRear = wheelbase * (config.weightDistFront ?? 0.45); // ~1.44m to rear axle
  const cgHeight = config.cgHeight ?? 0.30; // m

  // Front-Wheel Ackermann Steering Angles (FL, FR steer; RL, RR fixed)
  let steerAngleFL = state.steerAngle;
  let steerAngleFR = state.steerAngle;
  if (state.steerAngle > 0) {
    // Left turn (counter-clockwise): inside wheel (FL) turns sharper, outside (FR) shallower
    steerAngleFL = state.steerAngle * 1.12;
    steerAngleFR = state.steerAngle * 0.90;
  } else if (state.steerAngle < 0) {
    // Right turn (clockwise): inside wheel (FR) turns sharper, outside (FL) shallower
    steerAngleFR = state.steerAngle * 1.12;
    steerAngleFL = state.steerAngle * 0.90;
  }
  const steerAngleRL = 0;
  const steerAngleRR = 0;

  // 4. DRIVETRAIN & BRAKING DEMAND (RWD + Front/Rear Brake Bias)
  let engineDriveForce = 0;
  if (input.throttle > 0 && state.empSlowTimer === 0) {
    // Progressive torque curve: smooth predictable launch, strong mid-range, tapered at top speed
    const torqueCurve = Math.max(0.22, 1.0 - (state.speed / topSpeedCap) ** 1.6);
    engineDriveForce = input.throttle * config.acceleration * mass * accelMultiplier * torqueCurve;
  }

  let totalBrakeForce = 0;
  if (input.brake > 0) {
    if (state.speed > 0.4) {
      // Progressive carbon-ceramic braking
      totalBrakeForce = input.brake * config.brakeForce * mass;
    } else if (Math.abs(state.speed) < config.maxSpeedReverse) {
      // Reverse gear application
      engineDriveForce -= input.brake * (config.acceleration * 0.55) * mass;
    }
  }

  // Aerodynamic & Rolling Drag
  const dragForce =
    config.coastDrag * mass * Math.sign(state.speed) +
    config.aerodynamicDrag * mass * state.speed * Math.abs(state.speed);

  // 5. AERODYNAMIC DOWNFORCE & DYNAMIC WEIGHT TRANSFER (RVP-inspired)
  // Downforce increases with speed squared, pressing car into track
  const aeroDownforce = (config.downforceCoeff ?? 3.4) * (state.speed * state.speed) * gripMultiplier;
  const downforceFrontPerWheel = (aeroDownforce * 0.42) * 0.5;
  const downforceRearPerWheel = (aeroDownforce * 0.58) * 0.5;

  // Static Normal Load per Wheel (gravity)
  const g = 9.81;
  const staticFzFront = (mass * g * (distCGRear / wheelbase)) * 0.5;
  const staticFzRear = (mass * g * (distCGFront / wheelbase)) * 0.5;

  // Longitudinal Weight Transfer (acceleration & braking)
  const netEstAccel = (engineDriveForce - totalBrakeForce - dragForce) / mass;
  const deltaFzLong = (mass * netEstAccel * cgHeight) / wheelbase;

  // Lateral Weight Transfer (cornering centripetal acceleration)
  const estLatAccel = state.speed * state.angularVelocity;
  const deltaFzLatFront = (mass * estLatAccel * cgHeight) / trackWidthF * 0.5;
  const deltaFzLatRear = (mass * estLatAccel * cgHeight) / trackWidthR * 0.5;

  // Total Dynamic Normal Load Fz per Wheel (clamped to prevent wheel lift-off instability)
  const Fz_FL = Math.max(300, staticFzFront + downforceFrontPerWheel - deltaFzLong - deltaFzLatFront);
  const Fz_FR = Math.max(300, staticFzFront + downforceFrontPerWheel - deltaFzLong + deltaFzLatFront);
  const Fz_RL = Math.max(300, staticFzRear + downforceRearPerWheel + deltaFzLong - deltaFzLatRear);
  const Fz_RR = Math.max(300, staticFzRear + downforceRearPerWheel + deltaFzLong + deltaFzLatRear);

  // 6. WHEEL VELOCITIES, SLIP ANGLES, AND TIRE FORCES (Friction Circle)
  const forwardDirX = Math.sin(state.rotationY);
  const forwardDirZ = Math.cos(state.rotationY);
  const rightDirX = Math.cos(state.rotationY);
  const rightDirZ = -Math.sin(state.rotationY);

  const localVz = state.vx * forwardDirX + state.vz * forwardDirZ; // chassis forward velocity
  const localVx = state.vx * rightDirX + state.vz * rightDirZ;     // chassis lateral velocity

  const brakeBiasFront = config.brakeBiasFront ?? 0.56;
  const brakeBiasRear = 1.0 - brakeBiasFront;
  const peakMu = (config.tireFrictionPeak ?? 1.65) * gripMultiplier;

  // Four-wheel parameter array: [xOffset, zOffset, steerAngle, Fz, driveFraction, brakeFraction]
  const wheels = [
    { x: -trackWidthF * 0.5, z: distCGFront, steer: steerAngleFL, Fz: Fz_FL, drive: 0, brake: brakeBiasFront * 0.5 },
    { x: trackWidthF * 0.5, z: distCGFront, steer: steerAngleFR, Fz: Fz_FR, drive: 0, brake: brakeBiasFront * 0.5 },
    { x: -trackWidthR * 0.5, z: -distCGRear, steer: steerAngleRL, Fz: Fz_RL, drive: 0.5, brake: brakeBiasRear * 0.5 },
    { x: trackWidthR * 0.5, z: -distCGRear, steer: steerAngleRR, Fz: Fz_RR, drive: 0.5, brake: brakeBiasRear * 0.5 },
  ];

  let sumChassisFx = 0;
  let sumChassisFz = 0;
  let sumYawTorque = 0;
  let maxRearSlip = 0;
  const slips: [number, number, number, number] = [0, 0, 0, 0];

  for (let i = 0; i < 4; i++) {
    const w = wheels[i];
    // Wheel velocity in chassis frame due to translation + yaw rotation
    const wVx = localVx + state.angularVelocity * w.z;
    const wVz = localVz - state.angularVelocity * w.x;

    // Transform into wheel rolling frame
    const cosS = Math.cos(w.steer);
    const sinS = Math.sin(w.steer);
    const vRoll = wVz * cosS + wVx * sinS;
    const vLat = -wVz * sinS + wVx * cosS;

    // Slip angle
    const slipAngle = Math.atan2(vLat, Math.max(1.5, Math.abs(vRoll)));
    const slipMag = Math.abs(slipAngle);
    slips[i] = Math.min(1.0, slipMag / 0.25);
    if (i >= 2) maxRearSlip = Math.max(maxRearSlip, slipMag);

    // Longitudinal force demand (RWD drive on rear wheels, biased braking on all 4)
    const driveDemand = w.drive * engineDriveForce;
    const brakeDemand = w.brake * totalBrakeForce * (vRoll >= 0 ? 1 : -1);
    const fxDemand = driveDemand - brakeDemand;

    // Combined slip friction circle constraint
    // Under heavy braking, carbon-ceramic mechanical disc bite supplements aerodynamic downforce
    const maxTireForce = peakMu * w.Fz;
    const maxBrakeGrip = Math.max(maxTireForce, mass * (config.brakeForce * 0.32));
    const maxLongitudinalCapacity = fxDemand < 0 ? maxBrakeGrip : maxTireForce;
    const fxTire = Math.max(-maxLongitudinalCapacity, Math.min(maxTireForce * 0.95, fxDemand));
    const fxRatio = Math.min(0.92, Math.abs(fxTire) / Math.max(1, maxLongitudinalCapacity));
    const fyCapacity = Math.sqrt(Math.max(0.18, 1.0 - fxRatio * fxRatio)) * maxTireForce;

    // Lateral force from slip angle (Pacejka-like smooth saturation curve)
    const normSlip = slipAngle / (config.tirePeakSlipAngle ?? 0.13);
    const slipFactor = (2 * normSlip) / (1 + normSlip * normSlip);
    const fyTire = -fyCapacity * slipFactor;

    // Transform tire force back to chassis coordinates
    const chassisFx = fxTire * sinS + fyTire * cosS;
    const chassisFz = fxTire * cosS - fyTire * sinS;

    sumChassisFx += chassisFx;
    sumChassisFz += chassisFz;
    sumYawTorque += w.z * chassisFx - w.x * chassisFz;
  }

  // 7. YAW MOMENT & CHASSIS ACCELERATION INTEGRATION
  const I_z = (mass / 12) * (wheelbase * wheelbase + ((trackWidthF + trackWidthR) * 0.5) ** 2);
  const yawAccel = sumYawTorque / I_z;

  // Aerodynamic cornering envelope: limit maximum kinematic yaw rate at high speeds to prevent 20g slides
  const maxLateralG = 7.2;
  const maxAvailableYawRate = Math.abs(state.speed) > 4.0 ? (maxLateralG * 9.81) / Math.abs(state.speed) : 4.4;
  const targetYawRate = Math.max(-maxAvailableYawRate, Math.min(maxAvailableYawRate, (state.speed / wheelbase) * Math.tan(state.steerAngle)));

  // Counter-steer stabilizing assistance: only damp excess yaw if vehicle is drifting
  // and the driver is actively opposite-locking to catch the slide
  const isOppositeLock = targetSteerAngle * state.angularVelocity < 0 && Math.abs(state.angularVelocity) > 0.4;
  const isCounterSteering = isOppositeLock && state.isDrifting && hasStabilityAssist;
  const stabilityYawDamping = isCounterSteering ? 2.0 : 1.0;

  // Integrate physical tire yaw acceleration and arcade-sim trajectory tracking
  state.angularVelocity += (yawAccel * 0.18 + (targetYawRate - state.angularVelocity) * config.weightInertia) * dt;
  state.angularVelocity *= Math.max(0, 1.0 - config.angularDamping * stabilityYawDamping * dt);
  state.angularVelocity = Math.max(-4.4, Math.min(4.4, state.angularVelocity));

  if (Math.abs(state.speed) < 2.0) {
    state.angularVelocity *= 0.8;
  }

  state.rotationY += state.angularVelocity * dt;

  // Longitudinal & lateral vehicle acceleration
  const netForwardAccel = (sumChassisFz - dragForce) / mass;
  state.speed += netForwardAccel * dt;

  if (state.speed > topSpeedCap) {
    state.speed -= 22 * dt;
  } else if (state.speed < -config.maxSpeedReverse) {
    state.speed = -config.maxSpeedReverse;
  }

  // 8. TIRE TRACTION, DRIFT DYNAMICS & VELOCITY INTEGRATION
  const lateralSlip = Math.abs(localVx);
  state.isDrifting = (lateralSlip > 4.8 || maxRearSlip > 0.18) && Math.abs(state.speed) > 18;

  let lateralRestoration = (state.isDrifting ? config.driftFriction : config.baseLateralGrip) * gripMultiplier;
  if (!hasTractionAssist) {
    lateralRestoration *= 0.65;
  }

  const lateralCorrection = Math.min(1.0, lateralRestoration * dt);
  const targetVx = forwardDirX * state.speed;
  const targetVz = forwardDirZ * state.speed;

  state.vx += (targetVx - state.vx) * lateralCorrection;
  state.vz += (targetVz - state.vz) * lateralCorrection;

  // 9. SUSPENSION TELEMETRY & CHASSIS PITCH/ROLL
  const targetPitch = Math.max(-0.06, Math.min(0.06, -(netForwardAccel / 9.81) * 0.045));
  const targetRoll = Math.max(-0.08, Math.min(0.08, -(estLatAccel / 9.81) * 0.055));
  state.pitch = (state.pitch ?? 0) + (targetPitch - (state.pitch ?? 0)) * Math.min(1.0, 14 * dt);
  state.roll = (state.roll ?? 0) + (targetRoll - (state.roll ?? 0)) * Math.min(1.0, 16 * dt);

  state.suspensionCompression = [
    Math.max(0.1, Math.min(0.9, 0.5 - (state.pitch ?? 0) * 2.5 - (state.roll ?? 0) * 2.5)),
    Math.max(0.1, Math.min(0.9, 0.5 - (state.pitch ?? 0) * 2.5 + (state.roll ?? 0) * 2.5)),
    Math.max(0.1, Math.min(0.9, 0.5 + (state.pitch ?? 0) * 2.5 - (state.roll ?? 0) * 2.5)),
    Math.max(0.1, Math.min(0.9, 0.5 + (state.pitch ?? 0) * 2.5 + (state.roll ?? 0) * 2.5)),
  ];
  state.wheelSlip = slips;

  // Position update
  state.x += state.vx * dt;
  state.z += state.vz * dt;
  state.y = trackInfo.nearestPoint.y + 0.1;

  // 7. ROBUST CHECKPOINT & LAP PROGRESSION WITH ANTI-SKIP VALIDATION
  const nCheckpoints = trackData.trackPoints.length;
  const currentSeg = trackInfo.closestSegmentIndex;

  // A checkpoint is valid if it's the expected next checkpoint, or next+1 (in case of fast frame jump)
  const expectedNext = (state.checkpointIndex + 1) % nCheckpoints;
  const expectedNextPlusOne = (state.checkpointIndex + 2) % nCheckpoints;

  const nextPt = trackData.trackPoints[expectedNext];
  const distToNextSq = (state.x - nextPt.x) ** 2 + (state.z - nextPt.z) ** 2;
  const reachedNext = currentSeg === expectedNext || distToNextSq <= (config.trackWidth + 6) ** 2;

  const nextPlusOnePt = trackData.trackPoints[expectedNextPlusOne];
  const distToNextPlusOneSq = (state.x - nextPlusOnePt.x) ** 2 + (state.z - nextPlusOnePt.z) ** 2;
  const reachedNextPlusOne = !reachedNext && (currentSeg === expectedNextPlusOne || distToNextPlusOneSq <= (config.trackWidth + 6) ** 2);

  if (reachedNext || reachedNextPlusOne) {
    const targetCheckpoint = reachedNext ? expectedNext : expectedNextPlusOne;
    const addedCount = reachedNext ? 1 : 2;
    state.checkpointIndex = targetCheckpoint;
    state.visitedCheckpointsCount += addedCount;

    // Crossing Start/Finish line (checkpoint 0)
    // Anti-cheat rule: must have visited at least 75% of track checkpoints to count as valid lap!
    const minCheckpointsRequired = Math.floor(nCheckpoints * 0.75);
    if (targetCheckpoint === 0 && state.visitedCheckpointsCount >= minCheckpointsRequired) {
      // Completed valid lap!
      const completedLapTime = state.currentLapTime;
      state.lapTimes.push(completedLapTime);

      if (state.bestLapTime === null || completedLapTime < state.bestLapTime) {
        state.bestLapTime = completedLapTime;
      }

      state.currentLapTime = 0;
      state.lap += 1;
      state.visitedCheckpointsCount = 1; // Reset for next lap

      if (state.lap > totalLaps) {
        state.finished = true;
      }
    }
  }

  // Update track progress & total continuous distance
  state.trackProgress = trackInfo.progress;
  state.totalDistance = (state.lap - 1) * trackGeo.totalLength + trackInfo.distanceAlongTrack;

  // Increment race timer
  state.currentLapTime += dt * 1000;

  // Calculate Gear & RPM
  const { gear, rpm } = calculateGearAndRpm(state.speed, input.throttle);
  state.currentGear = gear;
  state.engineRpm = rpm;

  return { state, barrierHitIntensity };
}

// Compute race rankings for all players (1st to 15th)
export function computeLeaderboard(
  players: { id: string; state: PlayerPhysicsState }[]
): { id: string; rank: number }[] {
  const sorted = [...players].sort((a, b) => {
    // 0. Quit players sort at the back
    if (a.state.isQuit && !b.state.isQuit) return 1;
    if (!a.state.isQuit && b.state.isQuit) return -1;

    // 1. Finished players rank by finish time
    if (a.state.finished && b.state.finished) {
      return (a.state.finishTime ?? Infinity) - (b.state.finishTime ?? Infinity);
    }
    if (a.state.finished) return -1;
    if (b.state.finished) return 1;

    // 2. Active players rank by total continuous distance
    return b.state.totalDistance - a.state.totalDistance;
  });

  return sorted.map((p, idx) => ({ id: p.id, rank: idx + 1 }));
}
