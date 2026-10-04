export type PowerUpType = 'TURBO' | 'SHIELD' | 'GRIP_BOOST' | 'EMP' | 'SLIPSTREAM';

export type BodyStyle = 'AERO_APEX' | 'VORTEX_GT' | 'PHANTOM_X';
export type WheelStyle = 'FORGED_SPOKE' | 'AERO_TURBINE' | 'CARBON_DISC';

export interface CarCustomization {
  driverName: string;
  carNumber: number;
  bodyStyle: BodyStyle;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  wheelStyle: WheelStyle;
  wheelColor: string;
  helmetColor: string;
}

export interface PlayerInput {
  throttle: number; // 0 to 1
  brake: number;    // 0 to 1
  steer: number;    // -1 (left) to 1 (right)
  boost: boolean;
  usePowerUp: boolean;
  respawn?: boolean;
  sequenceNumber?: number;
}

export interface PlayerPhysicsState {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;           // in m/s
  angularVelocity: number; // yaw rate
  vx: number;
  vz: number;
  steerAngle: number;
  isDrifting: boolean;
  isOffTrack: boolean;
  boostGauge: number;      // 0 to 100
  isBoosting: boolean;
  boostCooldownTimer: number; // seconds remaining before recharge resumes
  activePowerUp: PowerUpType | null;
  hasShield: boolean;
  shieldTimer?: number;
  turboTimer?: number;
  gripBoostTimer: number;
  empSlowTimer: number;
  draftStreamTimer?: number;
  slipstreamFactor: number;
  // Progress & race metrics
  lap: number;
  checkpointIndex: number;
  visitedCheckpointsCount: number; // Anti-skip validation
  trackProgress: number; // 0 to 1 along current lap
  totalDistance: number; // continuously increases
  finished: boolean;
  finishTime: number | null; // ms from race start
  currentLapTime: number;    // ms
  bestLapTime: number | null; // ms
  lapTimes: number[];
  gridSlot: number;
  currentGear: number;       // 1 to 7, 0 = Reverse
  engineRpm: number;         // 1000 to 15000
  // Four-wheel vehicle dynamics telemetry
  pitch?: number;            // chassis pitch angle in rad
  roll?: number;             // chassis roll angle in rad
  suspensionCompression?: [number, number, number, number]; // FL, FR, RL, RR compression fraction
  wheelSlip?: [number, number, number, number]; // FL, FR, RL, RR normalized slip magnitude
  // Networking Sequence Tracking & Respawn
  lastProcessedSequenceNumber?: number;
  lastRespawnTimestamp?: number;
}

export interface PlayerSnapshot {
  timestamp: number;
  players: { [id: string]: PlayerPhysicsState };
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  ping: number;
  carConfig: CarCustomization;
  state: PlayerPhysicsState;
}

export interface PowerUpBox {
  id: number;
  x: number;
  y: number;
  z: number;
  type: PowerUpType;
  active: boolean;
  respawnTimer: number;
}

export interface TrackPoint {
  x: number;
  y: number;
  z: number;
  width?: number;
}

export interface TrackData {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  lapLengthMeters: number;
  cornerCount: number;
  recommendedStyle: string;
  theme: 'harbor' | 'desert' | 'neon';
  skyColor: string;
  fogColor: string;
  tarmacColor: string;
  kerbColor1: string;
  kerbColor2: string;
  barrierColor: string;
  trackPoints: TrackPoint[];
  powerUpLocations: { x: number; y: number; z: number; type?: PowerUpType }[];
  startGridSlots: { x: number; y: number; z: number; rotationY: number }[];
  previewSvgPath?: string;
}

export type RoomState = 'LOBBY' | 'STARTING' | 'RACING' | 'RESULTS';

export interface RaceConfig {
  trackId: string;
  lapCount: number;
  preset: 'CASUAL' | 'STANDARD' | 'COMPETITIVE' | 'CUSTOM';
  
  // Power-up Settings
  powerUpsEnabled: boolean;
  powerUpFrequency: 'LOW' | 'MEDIUM' | 'HIGH';
  enabledPowerUps: {
    TURBO: boolean;
    SHIELD: boolean;
    GRIP_BOOST: boolean;
    EMP: boolean;
    SLIPSTREAM: boolean;
  };

  // Boost Settings
  boostEnabled: boolean;
  boostStrength: 'LOW' | 'STANDARD' | 'HIGH';
  boostDuration: 'SHORT' | 'STANDARD' | 'LONG';
  boostRegeneration: 'SLOW' | 'STANDARD' | 'FAST';
  maxBoostCharges: number;

  // Collisions Settings
  carCollisionsEnabled: boolean;
  barrierCollisionsEnabled: boolean;
  collisionStrength: 'LIGHT' | 'STANDARD' | 'HEAVY';

  // Assists
  steeringAssist: boolean;
  tractionAssist: boolean;
  stabilityAssist: boolean;
  brakeAssist: boolean;

  // Race Rules
  offTrackPenalty: boolean;
  respawnEnabled: boolean;
  respawnDelay: 'INSTANT' | 'SHORT' | 'STANDARD';
}

export interface RoomInfo {
  code: string;
  hostId: string;
  trackId: string;
  lapCount: number;
  state: RoomState;
  countdown: number; // 3, 2, 1, 0
  raceStartTime: number | null;
  raceElapsedMs: number;
  players: Player[];
  powerUps: PowerUpBox[];
  raceConfig?: RaceConfig;
}

export interface RaceResultEntry {
  rank: number;
  playerId: string;
  name: string;
  carNumber: number;
  carConfig: CarCustomization;
  totalTimeMs: number | null;
  gapMs: number;
  bestLapMs: number | null;
  completedLaps: number;
  powerUpsUsed: number;
}

// Client to Server Messages
export type ClientMessage =
  | { type: 'CREATE_ROOM'; payload: { player: { name: string; carConfig: CarCustomization } } }
  | { type: 'JOIN_ROOM'; payload: { roomCode: string; player: { name: string; carConfig: CarCustomization } } }
  | { type: 'RECONNECT'; payload: { roomCode: string; playerId: string; carConfig: CarCustomization } }
  | { type: 'SET_READY'; payload: { isReady: boolean } }
  | { type: 'UPDATE_CUSTOMIZATION'; payload: { carConfig: CarCustomization } }
  | { type: 'SELECT_TRACK'; payload: { trackId: string } }
  | { type: 'SET_LAPS'; payload: { lapCount: number } }
  | { type: 'START_RACE' }
  | { type: 'INPUT_UPDATE'; payload: { input: PlayerInput; sequenceNumber?: number; timestamp: number } }
  | { type: 'USE_POWERUP' }
  | { type: 'REQUEST_RESPAWN' }
  | { type: 'REMATCH' }
  | { type: 'RETURN_TO_LOBBY' }
  | { type: 'UPDATE_RACE_CONFIG'; payload: { raceConfig: RaceConfig } }
  | { type: 'PING'; payload: { timestamp: number } };

// Server to Client Messages
export type ServerMessage =
  | { type: 'ROOM_CREATED'; payload: { roomCode: string; playerId: string; room: RoomInfo } }
  | { type: 'ROOM_JOINED'; payload: { roomCode: string; playerId: string; room: RoomInfo } }
  | { type: 'ROOM_UPDATE'; payload: { room: RoomInfo } }
  | { type: 'RACE_COUNTDOWN'; payload: { countdown: number } }
  | { type: 'RACE_START'; payload: { raceStartTime: number; room: RoomInfo } }
  | { type: 'GAME_TICK'; payload: { players: { [id: string]: PlayerPhysicsState }; powerUps: PowerUpBox[]; raceElapsedMs: number } }
  | { type: 'POWERUP_COLLECTED'; payload: { playerId: string; powerUp: PowerUpType; boxId: number } }
  | { type: 'POWERUP_TRIGGERED'; payload: { playerId: string; powerUp: PowerUpType; targetIds?: string[] } }
  | { type: 'PLAYER_FINISHED'; payload: { playerId: string; rank: number; finishTime: number } }
  | { type: 'RACE_FINISHED'; payload: { results: RaceResultEntry[]; room?: RoomInfo } }
  | { type: 'PONG'; payload: { clientTimestamp: number; serverTimestamp: number } }
  | { type: 'ERROR'; payload: { message: string } };
