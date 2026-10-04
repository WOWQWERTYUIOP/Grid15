import { PlayerPhysicsState, PlayerInput, TrackData, RaceConfig } from '../types/game';
import { TrackGeometry, stepPhysics, DEFAULT_PHYSICS_CONFIG } from './physics';

export interface PendingInput {
  sequenceNumber: number;
  input: PlayerInput;
  dt: number;
}

export class ClientPredictionEngine {
  public predictedState: PlayerPhysicsState | null = null;
  public sequenceNumber: number = 0;
  public pendingInputs: PendingInput[] = [];
  public lastAckSequenceNumber: number = 0;
  public reconciliationCount: number = 0;
  public lastCorrectionMagnitude: number = 0;
  public isRespawning: boolean = false;
  private respawnRequestedTime: number = 0;

  private errorOffsetPos = { x: 0, z: 0 };
  private errorOffsetRot = 0;

  public init(initialState: PlayerPhysicsState) {
    this.predictedState = JSON.parse(JSON.stringify(initialState));
    this.sequenceNumber = 0;
    this.pendingInputs = [];
    this.lastAckSequenceNumber = 0;
    this.reconciliationCount = 0;
    this.lastCorrectionMagnitude = 0;
    this.isRespawning = false;
    this.respawnRequestedTime = 0;
    this.errorOffsetPos = { x: 0, z: 0 };
    this.errorOffsetRot = 0;
  }

  /**
   * Returns state ready for rendering with visual smoothing applied.
   * Does NOT pollute physical prediction state.
   */
  public getRenderState(): PlayerPhysicsState | null {
    if (!this.predictedState) return null;

    const x = Number.isFinite(this.predictedState.x) ? this.predictedState.x : 0;
    const y = Number.isFinite(this.predictedState.y) ? this.predictedState.y : 0.1;
    const z = Number.isFinite(this.predictedState.z) ? this.predictedState.z : 0;
    const rot = Number.isFinite(this.predictedState.rotationY) ? this.predictedState.rotationY : 0;
    const errX = Number.isFinite(this.errorOffsetPos.x) ? this.errorOffsetPos.x : 0;
    const errZ = Number.isFinite(this.errorOffsetPos.z) ? this.errorOffsetPos.z : 0;
    const errRot = Number.isFinite(this.errorOffsetRot) ? this.errorOffsetRot : 0;

    return {
      ...this.predictedState,
      x: x + errX,
      y,
      z: z + errZ,
      rotationY: rot + errRot,
    };
  }

  /**
   * Run local prediction immediately for the current frame input.
   * Runs at 60+ FPS in the client render loop.
   */
  public predictFrame(
    rawInput: PlayerInput,
    dt: number,
    trackGeo: TrackGeometry,
    track: TrackData,
    totalLaps: number,
    raceConfig?: RaceConfig
  ): PlayerInput {
    if (!this.predictedState) {
      return rawInput;
    }

    // Increment sequence number
    this.sequenceNumber++;
    const input: PlayerInput = {
      ...rawInput,
      sequenceNumber: this.sequenceNumber,
    };

    if (this.isRespawning) {
      return input;
    }

    // Add to pending input history buffer
    this.pendingInputs.push({
      sequenceNumber: this.sequenceNumber,
      input,
      dt,
    });

    // Limit buffer length to prevent memory leaks if server drops connection
    if (this.pendingInputs.length > 60) {
      this.pendingInputs.shift();
    }

    // Run physics simulation on local predicted state (pure physics)
    stepPhysics(
      this.predictedState,
      input,
      dt,
      trackGeo,
      track,
      totalLaps,
      DEFAULT_PHYSICS_CONFIG,
      true, // raceStarted = true
      raceConfig
    );

    // Sanitize position/rotation from potential NaN or Infinity
    if (!Number.isFinite(this.predictedState.x) || !Number.isFinite(this.predictedState.z)) {
      this.predictedState.x = 0;
      this.predictedState.z = 0;
      this.predictedState.speed = 0;
      this.predictedState.vx = 0;
      this.predictedState.vz = 0;
    }

    // Exponential decay of visual smoothing offset (decays to 0 over ~100ms without touching physics)
    const decay = Math.min(1.0, 18.0 * dt);
    this.errorOffsetPos.x *= (1.0 - decay);
    this.errorOffsetPos.z *= (1.0 - decay);
    this.errorOffsetRot *= (1.0 - decay);

    if (Math.hypot(this.errorOffsetPos.x, this.errorOffsetPos.z) < 0.001) {
      this.errorOffsetPos.x = 0;
      this.errorOffsetPos.z = 0;
    }
    if (Math.abs(this.errorOffsetRot) < 0.001) {
      this.errorOffsetRot = 0;
    }

    return input;
  }

  /**
   * Reconcile local prediction with authoritative server snapshot.
   * Discards acknowledged inputs and replays remaining pending inputs.
   */
  public reconcile(
    serverState: PlayerPhysicsState,
    trackGeo: TrackGeometry,
    track: TrackData,
    totalLaps: number,
    raceConfig?: RaceConfig
  ) {
    if (!this.predictedState) {
      this.predictedState = JSON.parse(JSON.stringify(serverState));
      return;
    }

    // Respawn sequence handling: wait for server snapshot containing respawn ack
    if (this.isRespawning) {
      const serverRespawnTs = serverState.lastRespawnTimestamp || 0;
      const isAcknowledged = serverRespawnTs >= this.respawnRequestedTime - 200 || Math.abs(serverState.speed) < 1.0;
      if (isAcknowledged) {
        this.predictedState = JSON.parse(JSON.stringify(serverState));
        this.pendingInputs = [];
        this.isRespawning = false;
        this.errorOffsetPos = { x: 0, z: 0 };
        this.errorOffsetRot = 0;
      }
      return;
    }

    const serverAckSeq = serverState.lastProcessedSequenceNumber || 0;

    // Reset sequence tracking if server state indicates a reconnect or sequence reset
    if (serverAckSeq === 0 || this.sequenceNumber - serverAckSeq > 300) {
      this.predictedState = JSON.parse(JSON.stringify(serverState));
      this.sequenceNumber = serverAckSeq;
      this.pendingInputs = [];
      this.errorOffsetPos = { x: 0, z: 0 };
      this.errorOffsetRot = 0;
      return;
    }

    // Drop all acknowledged inputs
    this.pendingInputs = this.pendingInputs.filter((item) => item.sequenceNumber > serverAckSeq);
    this.lastAckSequenceNumber = serverAckSeq;

    // Cap pending replay to at most 30 inputs to avoid CPU thrashing / physics explosions
    if (this.pendingInputs.length > 30) {
      this.pendingInputs = this.pendingInputs.slice(-30);
    }

    // Simulate from server state forward to current sequence
    const replayedState: PlayerPhysicsState = JSON.parse(JSON.stringify(serverState));
    for (const pending of this.pendingInputs) {
      stepPhysics(
        replayedState,
        pending.input,
        pending.dt,
        trackGeo,
        track,
        totalLaps,
        DEFAULT_PHYSICS_CONFIG,
        true,
        raceConfig
      );
    }

    // Verify validity of replayed state
    if (!Number.isFinite(replayedState.x) || !Number.isFinite(replayedState.z)) {
      this.predictedState = JSON.parse(JSON.stringify(serverState));
      this.pendingInputs = [];
      this.errorOffsetPos = { x: 0, z: 0 };
      this.errorOffsetRot = 0;
      return;
    }

    // Current uncorrected predicted position and heading
    const oldX = this.predictedState.x;
    const oldZ = this.predictedState.z;
    const oldRot = this.predictedState.rotationY;

    // Evaluate prediction error magnitude
    const posError = Math.hypot(replayedState.x - oldX, replayedState.z - oldZ);
    this.lastCorrectionMagnitude = posError;

    if (posError < 0.03) {
      // Imperceptible error: keep predicted physical state, update meta fields (lap, checkpoint, powerups)
      this.copyMetaFields(this.predictedState, replayedState);
    } else if (posError <= 3.0) {
      // Moderate error: update physical state to replayedState and store visual delta offset for smooth transition
      const errX = oldX - replayedState.x;
      const errZ = oldZ - replayedState.z;
      
      let angleDiff = (oldRot - replayedState.rotationY + Math.PI * 3) % (Math.PI * 2) - Math.PI;

      // Add visual offset so position rendered stays continuous without snapping
      this.errorOffsetPos.x = Math.max(-1.5, Math.min(1.5, this.errorOffsetPos.x + errX * 0.8));
      this.errorOffsetPos.z = Math.max(-1.5, Math.min(1.5, this.errorOffsetPos.z + errZ * 0.8));
      this.errorOffsetRot = Math.max(-0.4, Math.min(0.4, this.errorOffsetRot + angleDiff * 0.8));

      this.predictedState = replayedState;
      this.reconciliationCount++;
    } else {
      // Severe discrepancy or teleport: hard reset prediction
      this.predictedState = replayedState;
      this.errorOffsetPos = { x: 0, z: 0 };
      this.errorOffsetRot = 0;
      this.reconciliationCount++;
    }
  }

  public triggerRespawn(trackGeo?: TrackGeometry) {
    this.isRespawning = true;
    this.respawnRequestedTime = Date.now();
    this.pendingInputs = [];
    this.errorOffsetPos = { x: 0, z: 0 };
    this.errorOffsetRot = 0;

    // Local instant projection to centerline if track geometry available
    if (this.predictedState && trackGeo) {
      const info = trackGeo.getTrackProgressAndOffset(this.predictedState.x, this.predictedState.z, this.predictedState.checkpointIndex);
      this.predictedState.x = info.nearestPoint.x;
      this.predictedState.y = info.nearestPoint.y + 0.1;
      this.predictedState.z = info.nearestPoint.z;
      this.predictedState.rotationY = Math.atan2(info.tangent.x, info.tangent.z);
      this.predictedState.speed = 0;
      this.predictedState.vx = 0;
      this.predictedState.vz = 0;
      this.predictedState.angularVelocity = 0;
      this.predictedState.steerAngle = 0;
    }
  }

  private copyMetaFields(target: PlayerPhysicsState, source: PlayerPhysicsState) {
    target.lap = source.lap;
    target.checkpointIndex = source.checkpointIndex;
    target.visitedCheckpointsCount = source.visitedCheckpointsCount;
    target.trackProgress = source.trackProgress;
    target.totalDistance = source.totalDistance;
    target.finished = source.finished;
    target.finishTime = source.finishTime;
    target.currentLapTime = source.currentLapTime;
    target.bestLapTime = source.bestLapTime;
    target.lapTimes = source.lapTimes;
    target.activePowerUp = source.activePowerUp;
    target.hasShield = source.hasShield;
    target.shieldTimer = source.shieldTimer;
    target.turboTimer = source.turboTimer;
    target.gripBoostTimer = source.gripBoostTimer;
    target.empSlowTimer = source.empSlowTimer;
    target.draftStreamTimer = source.draftStreamTimer;
    target.slipstreamFactor = source.slipstreamFactor;
  }
}
