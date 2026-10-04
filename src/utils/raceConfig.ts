import { RaceConfig } from '../types/game';

export const DEFAULT_RACE_CONFIG: RaceConfig = {
  trackId: 'harbor-gp',
  lapCount: 3,
  preset: 'STANDARD',
  
  // Power-up Settings
  powerUpsEnabled: true,
  powerUpFrequency: 'MEDIUM',
  enabledPowerUps: {
    TURBO: true,
    SHIELD: true,
    GRIP_BOOST: true,
    EMP: true,
    SLIPSTREAM: true
  },

  // Boost Settings
  boostEnabled: true,
  boostStrength: 'STANDARD',
  boostDuration: 'STANDARD',
  boostRegeneration: 'STANDARD',
  maxBoostCharges: 1,

  // Collisions Settings
  carCollisionsEnabled: true,
  barrierCollisionsEnabled: true,
  collisionStrength: 'STANDARD',

  // Assists
  steeringAssist: true,
  tractionAssist: true,
  stabilityAssist: true,
  brakeAssist: true,

  // Race Rules
  offTrackPenalty: true,
  respawnEnabled: true,
  respawnDelay: 'STANDARD'
};

export const PRESETS: Record<'CASUAL' | 'STANDARD' | 'COMPETITIVE', Partial<RaceConfig>> = {
  CASUAL: {
    preset: 'CASUAL',
    powerUpsEnabled: true,
    powerUpFrequency: 'HIGH',
    enabledPowerUps: {
      TURBO: true,
      SHIELD: true,
      GRIP_BOOST: true,
      EMP: true,
      SLIPSTREAM: true
    },
    boostEnabled: true,
    boostStrength: 'HIGH',
    boostDuration: 'LONG',
    boostRegeneration: 'FAST',
    maxBoostCharges: 1,
    carCollisionsEnabled: true,
    barrierCollisionsEnabled: true,
    collisionStrength: 'LIGHT',
    steeringAssist: true,
    tractionAssist: true,
    stabilityAssist: true,
    brakeAssist: true,
    offTrackPenalty: false,
    respawnEnabled: true,
    respawnDelay: 'INSTANT'
  },
  STANDARD: {
    preset: 'STANDARD',
    powerUpsEnabled: true,
    powerUpFrequency: 'MEDIUM',
    enabledPowerUps: {
      TURBO: true,
      SHIELD: true,
      GRIP_BOOST: true,
      EMP: true,
      SLIPSTREAM: true
    },
    boostEnabled: true,
    boostStrength: 'STANDARD',
    boostDuration: 'STANDARD',
    boostRegeneration: 'STANDARD',
    maxBoostCharges: 1,
    carCollisionsEnabled: true,
    barrierCollisionsEnabled: true,
    collisionStrength: 'STANDARD',
    steeringAssist: true,
    tractionAssist: true,
    stabilityAssist: true,
    brakeAssist: true,
    offTrackPenalty: true,
    respawnEnabled: true,
    respawnDelay: 'STANDARD'
  },
  COMPETITIVE: {
    preset: 'COMPETITIVE',
    powerUpsEnabled: true,
    powerUpFrequency: 'LOW',
    enabledPowerUps: {
      TURBO: true,
      SHIELD: true,
      GRIP_BOOST: true,
      EMP: true,
      SLIPSTREAM: true
    },
    boostEnabled: true,
    boostStrength: 'STANDARD',
    boostDuration: 'SHORT',
    boostRegeneration: 'SLOW',
    maxBoostCharges: 1,
    carCollisionsEnabled: true,
    barrierCollisionsEnabled: true,
    collisionStrength: 'HEAVY',
    steeringAssist: false,
    tractionAssist: false,
    stabilityAssist: false,
    brakeAssist: false,
    offTrackPenalty: true,
    respawnEnabled: true,
    respawnDelay: 'STANDARD'
  }
};

export function validateRaceConfig(raw: any): RaceConfig {
  const config = { ...DEFAULT_RACE_CONFIG };

  if (!raw || typeof raw !== 'object') return config;

  // Track validation
  if (['harbor-gp', 'desert-velocity', 'neon-district'].includes(raw.trackId)) {
    config.trackId = raw.trackId;
  }

  // Lap Count validation
  if (typeof raw.lapCount === 'number' && Number.isFinite(raw.lapCount)) {
    config.lapCount = Math.max(1, Math.min(20, Math.floor(raw.lapCount)));
  }

  // Preset validation
  if (['CASUAL', 'STANDARD', 'COMPETITIVE', 'CUSTOM'].includes(raw.preset)) {
    config.preset = raw.preset;
  }

  // Power-up validations
  config.powerUpsEnabled = Boolean(raw.powerUpsEnabled);
  if (['LOW', 'MEDIUM', 'HIGH'].includes(raw.powerUpFrequency)) {
    config.powerUpFrequency = raw.powerUpFrequency;
  }
  if (raw.enabledPowerUps && typeof raw.enabledPowerUps === 'object') {
    config.enabledPowerUps = {
      TURBO: Boolean(raw.enabledPowerUps.TURBO),
      SHIELD: Boolean(raw.enabledPowerUps.SHIELD),
      GRIP_BOOST: Boolean(raw.enabledPowerUps.GRIP_BOOST),
      EMP: Boolean(raw.enabledPowerUps.EMP),
      SLIPSTREAM: Boolean(raw.enabledPowerUps.SLIPSTREAM)
    };
  }

  // Boost validations
  config.boostEnabled = Boolean(raw.boostEnabled);
  if (['LOW', 'STANDARD', 'HIGH'].includes(raw.boostStrength)) {
    config.boostStrength = raw.boostStrength;
  }
  if (['SHORT', 'STANDARD', 'LONG'].includes(raw.boostDuration)) {
    config.boostDuration = raw.boostDuration;
  }
  if (['SLOW', 'STANDARD', 'FAST'].includes(raw.boostRegeneration)) {
    config.boostRegeneration = raw.boostRegeneration;
  }
  if (typeof raw.maxBoostCharges === 'number' && [1, 2, 3].includes(raw.maxBoostCharges)) {
    config.maxBoostCharges = raw.maxBoostCharges;
  }

  // Collisions validations
  config.carCollisionsEnabled = Boolean(raw.carCollisionsEnabled);
  config.barrierCollisionsEnabled = Boolean(raw.barrierCollisionsEnabled);
  if (['LIGHT', 'STANDARD', 'HEAVY'].includes(raw.collisionStrength)) {
    config.collisionStrength = raw.collisionStrength;
  }

  // Assists validations
  config.steeringAssist = Boolean(raw.steeringAssist);
  config.tractionAssist = Boolean(raw.tractionAssist);
  config.stabilityAssist = Boolean(raw.stabilityAssist);
  config.brakeAssist = Boolean(raw.brakeAssist);

  // Race Rules validations
  config.offTrackPenalty = Boolean(raw.offTrackPenalty);
  config.respawnEnabled = Boolean(raw.respawnEnabled);
  if (['INSTANT', 'SHORT', 'STANDARD'].includes(raw.respawnDelay)) {
    config.respawnDelay = raw.respawnDelay;
  }

  return config;
}
