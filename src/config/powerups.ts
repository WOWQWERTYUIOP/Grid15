import { PowerUpType } from '../types/game';

export interface PowerUpConfig {
  type: PowerUpType;
  name: string;
  description: string;
  color: string;
  icon: string;
  durationMs: number;
  cooldownMs: number;
  effectMagnitude: number;
}

export const POWER_UP_BALANCING = {
  respawnTimeMs: 9000,
  pickupRadiusMeters: 3.4,
  empEffectRadiusMeters: 45,
  slipstreamMinDistMeters: 3.5,
  slipstreamMaxDistMeters: 20.0,
  slipstreamConeDotThreshold: 0.82,
};

export const POWER_UPS: Record<PowerUpType, PowerUpConfig> = {
  TURBO: {
    type: 'TURBO',
    name: 'KINETIC TURBO',
    description: 'Instant rocket-grade acceleration boost exceeding normal top speed limit.',
    color: '#00f0ff',
    icon: 'Zap',
    durationMs: 3200,
    cooldownMs: 8000,
    effectMagnitude: 1.35, // 35% extra top speed
  },
  SHIELD: {
    type: 'SHIELD',
    name: 'ENERGY SHIELD',
    description: 'Deploy an impenetrable kinetic energy bubble absorbing one incoming hazard or EMP.',
    color: '#39ff14',
    icon: 'Shield',
    durationMs: 7000,
    cooldownMs: 12000,
    effectMagnitude: 1.0,
  },
  GRIP_BOOST: {
    type: 'GRIP_BOOST',
    name: 'AERO GRIP',
    description: 'Maximizes ground-effect downforce for extreme high-speed cornering without sliding.',
    color: '#ff007f',
    icon: 'Gauge',
    durationMs: 4500,
    cooldownMs: 10000,
    effectMagnitude: 1.6, // +60% lateral grip
  },
  EMP: {
    type: 'EMP',
    name: 'NEURAL EMP',
    description: 'Discharge an electromagnetic pulse that disrupts throttle and slows nearby opponents.',
    color: '#ffe600',
    icon: 'Radio',
    durationMs: 2800,
    cooldownMs: 14000,
    effectMagnitude: 0.45, // 55% reduction
  },
  SLIPSTREAM: {
    type: 'SLIPSTREAM',
    name: 'DRAFT STREAM',
    description: 'Creates a vortex channel accelerating your car through clean air behind opponents.',
    color: '#a855f7',
    icon: 'Wind',
    durationMs: 4000,
    cooldownMs: 8000,
    effectMagnitude: 1.25,
  },
};
