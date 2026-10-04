import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ClientMessage,
  ServerMessage,
  RoomInfo,
  Player,
  PowerUpBox,
  RaceResultEntry,
  PlayerPhysicsState,
  PowerUpType,
  PlayerInput,
  CarCustomization,
  BodyStyle,
  WheelStyle,
  RaceConfig,
} from './src/types/game';
import { TRACKS, DEFAULT_TRACK } from './src/config/tracks';
import { TrackGeometry, createInitialPhysicsState, stepPhysics, computeLeaderboard, DEFAULT_PHYSICS_CONFIG } from './src/game/physics';
import { POWER_UPS, POWER_UP_BALANCING } from './src/config/powerups';
import { DEFAULT_RACE_CONFIG, validateRaceConfig } from './src/utils/raceConfig';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

interface ServerRoom extends RoomInfo {
  clients: Map<string, WebSocket>;
  playerInputs: Map<string, PlayerInput>;
  playerSequenceNumbers: Map<string, number>;
  lastRespawnTimes: Map<string, number>;
  trackGeo: TrackGeometry;
  tickInterval: NodeJS.Timeout | null;
  countdownInterval: NodeJS.Timeout | null;
  finishTimeout: NodeJS.Timeout | null;
  powerUpsUsedCount: Map<string, number>;
}

const rooms = new Map<string, ServerRoom>();

// Generate a clean 6-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Sanitize incoming player inputs (Prevents NaN/Infinity crashes and malicious inputs)
function sanitizeInput(raw: any): PlayerInput {
  if (!raw || typeof raw !== 'object') {
    return { throttle: 0, brake: 0, steer: 0, boost: false, usePowerUp: false };
  }
  const throttle = typeof raw.throttle === 'number' && Number.isFinite(raw.throttle)
    ? Math.max(0, Math.min(1, raw.throttle)) : 0;
  const brake = typeof raw.brake === 'number' && Number.isFinite(raw.brake)
    ? Math.max(0, Math.min(1, raw.brake)) : 0;
  const steer = typeof raw.steer === 'number' && Number.isFinite(raw.steer)
    ? Math.max(-1, Math.min(1, raw.steer)) : 0;
  const boost = Boolean(raw.boost);
  const usePowerUp = Boolean(raw.usePowerUp);
  const respawn = Boolean(raw.respawn);

  return { throttle, brake, steer, boost, usePowerUp, respawn };
}

// Sanitize car customization
function sanitizeCustomization(raw: any): CarCustomization {
  const validBodies: BodyStyle[] = ['AERO_APEX', 'VORTEX_GT', 'PHANTOM_X'];
  const validWheels: WheelStyle[] = ['FORGED_SPOKE', 'AERO_TURBINE', 'CARBON_DISC'];
  const hexRegex = /^#[0-9a-fA-F]{6}$/;

  const driverName = typeof raw?.driverName === 'string'
    ? raw.driverName.trim().replace(/[^\w\s-]/g, '').slice(0, 14) || 'DRIVER'
    : 'DRIVER';
  const carNumber = typeof raw?.carNumber === 'number' && Number.isFinite(raw.carNumber)
    ? Math.max(1, Math.min(99, Math.floor(raw.carNumber))) : 15;
  const bodyStyle = validBodies.includes(raw?.bodyStyle) ? raw.bodyStyle : 'AERO_APEX';
  const primaryColor = hexRegex.test(raw?.primaryColor) ? raw.primaryColor : '#ff2a5f';
  const secondaryColor = hexRegex.test(raw?.secondaryColor) ? raw.secondaryColor : '#00f0ff';
  const accentColor = hexRegex.test(raw?.accentColor) ? raw.accentColor : '#39ff14';
  const wheelStyle = validWheels.includes(raw?.wheelStyle) ? raw.wheelStyle : 'FORGED_SPOKE';
  const wheelColor = hexRegex.test(raw?.wheelColor) ? raw.wheelColor : '#ffd700';
  const helmetColor = hexRegex.test(raw?.helmetColor) ? raw.helmetColor : '#ffffff';

  return {
    driverName,
    carNumber,
    bodyStyle,
    primaryColor,
    secondaryColor,
    accentColor,
    wheelStyle,
    wheelColor,
    helmetColor,
  };
}

// Broadcast message to all connected clients in a room
function broadcastToRoom(room: ServerRoom, message: ServerMessage) {
  const data = JSON.stringify(message);
  for (const [_, client] of room.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Create power-up boxes for a track with type filters based on active config
function createTrackPowerUps(trackId: string, raceConfig?: RaceConfig): PowerUpBox[] {
  const track = TRACKS[trackId] || DEFAULT_TRACK;
  const types: PowerUpType[] = ['TURBO', 'SHIELD', 'GRIP_BOOST', 'EMP', 'SLIPSTREAM'];
  
  // Filter types by what's enabled in the custom configuration
  const allowedTypes = types.filter(t => raceConfig ? raceConfig.enabledPowerUps[t] !== false : true);
  const activeTypes = allowedTypes.length > 0 ? allowedTypes : types;

  return track.powerUpLocations.map((loc, idx) => ({
    id: idx,
    x: loc.x,
    y: loc.y,
    z: loc.z,
    type: loc.type && activeTypes.includes(loc.type) ? loc.type : activeTypes[idx % activeTypes.length],
    active: raceConfig ? raceConfig.powerUpsEnabled : true,
    respawnTimer: 0,
  }));
}

// Safe snapshot of RoomInfo for serialization
function getCleanRoomInfo(room: ServerRoom): RoomInfo {
  return {
    code: room.code,
    hostId: room.hostId,
    trackId: room.trackId,
    lapCount: room.lapCount,
    state: room.state,
    countdown: room.countdown,
    raceStartTime: room.raceStartTime,
    raceElapsedMs: room.raceElapsedMs,
    players: room.players.map((p) => ({ ...p })),
    powerUps: room.powerUps.map((p) => ({ ...p })),
    raceConfig: room.raceConfig || { ...DEFAULT_RACE_CONFIG, trackId: room.trackId, lapCount: room.lapCount },
  };
}

// Authoritative Power-Up Activation Execution
function executePlayerPowerUp(room: ServerRoom, player: Player): boolean {
  if (!player.state.activePowerUp || player.state.finished) return false;

  const pType = player.state.activePowerUp;
  player.state.activePowerUp = null;

  const usedCount = room.powerUpsUsedCount.get(player.id) || 0;
  room.powerUpsUsedCount.set(player.id, usedCount + 1);

  const targetIds: string[] = [];

  if (pType === 'TURBO') {
    player.state.turboTimer = POWER_UPS.TURBO.durationMs;
    player.state.isBoosting = true;
  } else if (pType === 'SHIELD') {
    player.state.hasShield = true;
    player.state.shieldTimer = POWER_UPS.SHIELD.durationMs;
  } else if (pType === 'GRIP_BOOST') {
    player.state.gripBoostTimer = POWER_UPS.GRIP_BOOST.durationMs;
  } else if (pType === 'EMP') {
    // Target opponents within EMP radius unless shielded
    for (const opp of room.players) {
      if (opp.id === player.id || opp.state.finished) continue;
      const dist = Math.hypot(opp.state.x - player.state.x, opp.state.z - player.state.z);
      if (dist < POWER_UP_BALANCING.empEffectRadiusMeters) {
        if (opp.state.hasShield) {
          opp.state.hasShield = false; // Absorbed by shield
          opp.state.shieldTimer = 0;
        } else {
          opp.state.empSlowTimer = POWER_UPS.EMP.durationMs;
          targetIds.push(opp.id);
        }
      }
    }
  } else if (pType === 'SLIPSTREAM') {
    player.state.draftStreamTimer = POWER_UPS.SLIPSTREAM.durationMs;
    player.state.slipstreamFactor = 1.0;
  }

  broadcastToRoom(room, {
    type: 'POWERUP_TRIGGERED',
    payload: { playerId: player.id, powerUp: pType, targetIds },
  });

  return true;
}

// Authoritative 30Hz Simulation Tick Loop
function startRaceLoop(room: ServerRoom) {
  if (room.tickInterval) clearInterval(room.tickInterval);
  if (room.finishTimeout) clearTimeout(room.finishTimeout);

  const tickRate = 30;
  const dt = 1.0 / tickRate;
  const track = TRACKS[room.trackId] || DEFAULT_TRACK;
  const trackGeo = room.trackGeo;

  room.tickInterval = setInterval(() => {
    if (room.state !== 'RACING') {
      if (room.tickInterval) clearInterval(room.tickInterval);
      return;
    }

    const now = Date.now();
    room.raceElapsedMs = room.raceStartTime ? now - room.raceStartTime : 0;

    // 1. Authoritative Physics step for every racer
    for (const player of room.players) {
      if (player.state.finished) continue;

      const input = room.playerInputs.get(player.id) || {
        throttle: 0,
        brake: 0,
        steer: 0,
        boost: false,
        usePowerUp: false,
      };

      const oldX = player.state.x;
      const oldZ = player.state.z;

      // Check if driver activated power-up via input
      if (input.usePowerUp && player.state.activePowerUp) {
        executePlayerPowerUp(room, player);
        input.usePowerUp = false;
      }

      stepPhysics(player.state, input, dt, trackGeo, track, room.lapCount, DEFAULT_PHYSICS_CONFIG, true, room.raceConfig);
      player.state.lastProcessedSequenceNumber = room.playerSequenceNumbers.get(player.id) || 0;

      // Server-side movement validation (Anti-Cheat check)
      const distMoved = Math.hypot(player.state.x - oldX, player.state.z - oldZ);
      const maxPossibleDistPerTick = (DEFAULT_PHYSICS_CONFIG.boostMaxSpeed + 15) * dt; // ~3.7m/tick
      if (distMoved > maxPossibleDistPerTick * 2.2) {
        // Rollback impossible teleportation
        player.state.x = oldX;
        player.state.z = oldZ;
        player.state.speed = Math.min(player.state.speed, DEFAULT_PHYSICS_CONFIG.maxSpeedForward);
      }
    }

    // 2. Power-up respawn countdowns
    for (const box of room.powerUps) {
      if (!box.active) {
        box.respawnTimer -= dt * 1000;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.respawnTimer = 0;
        }
      }
    }

    // 3. Slipstream drafting calculation
    for (let i = 0; i < room.players.length; i++) {
      const p1 = room.players[i];
      if (p1.state.finished) continue;

      let maxSlipstream = 0;
      for (let j = 0; j < room.players.length; j++) {
        if (i === j) continue;
        const p2 = room.players[j];
        const dx = p2.state.x - p1.state.x;
        const dz = p2.state.z - p1.state.z;
        const dist = Math.hypot(dx, dz);

        if (dist >= POWER_UP_BALANCING.slipstreamMinDistMeters && dist <= POWER_UP_BALANCING.slipstreamMaxDistMeters) {
          const forwardX = Math.sin(p1.state.rotationY);
          const forwardZ = Math.cos(p1.state.rotationY);
          const dot = (dx * forwardX + dz * forwardZ) / dist;
          if (dot > POWER_UP_BALANCING.slipstreamConeDotThreshold) {
            maxSlipstream = Math.max(maxSlipstream, 1.0 - dist / POWER_UP_BALANCING.slipstreamMaxDistMeters);
          }
        }
      }
      p1.state.slipstreamFactor = (p1.state.draftStreamTimer && p1.state.draftStreamTimer > 0)
        ? Math.max(1.0, maxSlipstream)
        : maxSlipstream;
    }

    // 4. Power-up crystal pickup detection (Only pick up if player inventory is empty and powerups enabled)
    const powerUpsEnabledByConfig = room.raceConfig ? room.raceConfig.powerUpsEnabled !== false : true;
    for (const player of room.players) {
      if (player.state.finished || player.state.activePowerUp !== null) continue;

      if (!powerUpsEnabledByConfig) continue;

      for (const box of room.powerUps) {
        if (box.active) {
          // If this specific power-up is disabled in config, skip picking it up
          const isPowerUpTypeEnabled = room.raceConfig ? room.raceConfig.enabledPowerUps[box.type] !== false : true;
          if (!isPowerUpTypeEnabled) continue;

          const dist = Math.hypot(player.state.x - box.x, player.state.z - box.z);
          if (dist < POWER_UP_BALANCING.pickupRadiusMeters) {
            box.active = false;
            
            // Respect custom power-up frequency spawn timer
            let spawnDelay = POWER_UP_BALANCING.respawnTimeMs; // standard 8000ms
            if (room.raceConfig) {
              if (room.raceConfig.powerUpFrequency === 'LOW') spawnDelay = 15000;
              else if (room.raceConfig.powerUpFrequency === 'HIGH') spawnDelay = 4000;
            }
            
            box.respawnTimer = spawnDelay;
            player.state.activePowerUp = box.type;

            broadcastToRoom(room, {
              type: 'POWERUP_COLLECTED',
              payload: { playerId: player.id, powerUp: box.type, boxId: box.id },
            });
            break; // One pickup per tick
          }
        }
      }
    }

    // 5. Car-to-Car collision resolution (cushioned plastic-elastic separation)
    const carCollisionsEnabled = room.raceConfig ? room.raceConfig.carCollisionsEnabled !== false : true;
    if (carCollisionsEnabled) {
      for (let i = 0; i < room.players.length; i++) {
        for (let j = i + 1; j < room.players.length; j++) {
          const p1 = room.players[i];
          const p2 = room.players[j];
          const dx = p2.state.x - p1.state.x;
          const dz = p2.state.z - p1.state.z;
          const dist = Math.hypot(dx, dz);
          const minDist = 2.1; // Open-wheel car collision hull

          if (dist < minDist && dist > 0.001) {
            const overlap = (minDist - dist) * 0.5;
            const nx = dx / dist;
            const nz = dz / dist;

            // Push apart to prevent overlap
            p1.state.x -= nx * overlap;
            p1.state.z -= nz * overlap;
            p2.state.x += nx * overlap;
            p2.state.z += nz * overlap;

            // Relative velocity impulse with cushioned restitution (never > 1.0)
            const rvx = p2.state.vx - p1.state.vx;
            const rvz = p2.state.vz - p1.state.vz;
            const velAlongNormal = rvx * nx + rvz * nz;

            if (velAlongNormal < 0) {
              const restitution = 0.25; // Damped, soft plastic-elastic separation
              const impulse = -(1.0 + restitution) * velAlongNormal;
              // Cap maximum impulse to prevent rocket launches in multi-car pileups
              const clampedImpulse = Math.min(18.0, impulse);
              p1.state.vx -= nx * clampedImpulse * 0.5;
              p1.state.vz -= nz * clampedImpulse * 0.5;
              p2.state.vx += nx * clampedImpulse * 0.5;
              p2.state.vz += nz * clampedImpulse * 0.5;

              // Re-sync vehicle forward speed component with modified velocities
              const f1x = Math.sin(p1.state.rotationY);
              const f1z = Math.cos(p1.state.rotationY);
              p1.state.speed = p1.state.vx * f1x + p1.state.vz * f1z;

              const f2x = Math.sin(p2.state.rotationY);
              const f2z = Math.cos(p2.state.rotationY);
              p2.state.speed = p2.state.vx * f2x + p2.state.vz * f2z;
            }
          }
        }
      }
    }

    // 6. Check for race finishes & Winner 30-second countdown
    let allFinished = true;
    let anyFinished = false;

    for (const player of room.players) {
      if (player.state.finished) {
        anyFinished = true;
        if (player.state.finishTime === null) {
          player.state.finishTime = room.raceElapsedMs;
          const ranked = computeLeaderboard(room.players);
          const rank = ranked.find((r) => r.id === player.id)?.rank || 1;

          broadcastToRoom(room, {
            type: 'PLAYER_FINISHED',
            payload: { playerId: player.id, rank, finishTime: player.state.finishTime },
          });

          // Start 30-second post-winner finish countdown so AFK players don't block the room
          if (rank === 1 && !room.finishTimeout) {
            room.finishTimeout = setTimeout(() => {
              if (room.state === 'RACING') {
                endRace(room);
              }
            }, 30000);
          }
        }
      } else {
        allFinished = false;
      }
    }

    // If all active players finished
    if (allFinished && room.players.length > 0) {
      endRace(room);
      return;
    }

    // 7. Broadcast authoritative 30Hz GAME_TICK
    const playerStatesMap: { [id: string]: PlayerPhysicsState } = {};
    for (const p of room.players) {
      playerStatesMap[p.id] = p.state;
    }

    broadcastToRoom(room, {
      type: 'GAME_TICK',
      payload: {
        players: playerStatesMap,
        powerUps: room.powerUps,
        raceElapsedMs: room.raceElapsedMs,
      },
    });
  }, 1000 / tickRate);
}

// End Race and compute results
function endRace(room: ServerRoom) {
  if (room.tickInterval) clearInterval(room.tickInterval);
  if (room.finishTimeout) clearTimeout(room.finishTimeout);
  room.state = 'RESULTS';

  const leaderboard = computeLeaderboard(room.players);
  const winnerFinishTime = room.players.find((p) => p.state.finished)?.state.finishTime || room.raceElapsedMs;

  const results: RaceResultEntry[] = leaderboard.map((item) => {
    const player = room.players.find((p) => p.id === item.id)!;
    const hasFinished = Boolean(player.state.finished);
    const playerTime = hasFinished ? (player.state.finishTime ?? room.raceElapsedMs) : null;
    const gapMs = item.rank === 1 ? 0 : (hasFinished && playerTime !== null ? Math.max(0, playerTime - winnerFinishTime) : 0);

    return {
      rank: item.rank,
      playerId: player.id,
      name: player.name,
      carNumber: player.carConfig.carNumber,
      carConfig: player.carConfig,
      totalTimeMs: playerTime,
      gapMs,
      bestLapMs: player.state.bestLapTime,
      completedLaps: Math.min(room.lapCount, player.state.lap - 1 + (hasFinished ? 1 : 0)),
      powerUpsUsed: room.powerUpsUsedCount.get(player.id) || 0,
    };
  });

  const cleanRoom = getCleanRoomInfo(room);

  broadcastToRoom(room, {
    type: 'RACE_FINISHED',
    payload: { results, room: cleanRoom },
  });

  broadcastToRoom(room, {
    type: 'ROOM_UPDATE',
    payload: { room: cleanRoom },
  });
}

// WebSocket Connection Router
wss.on('connection', (ws: WebSocket) => {
  let currentRoomCode: string | null = null;
  let currentPlayerId: string | null = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as ClientMessage;
      if (!msg || typeof msg !== 'object' || !msg.type) return;

      switch (msg.type) {
        case 'CREATE_ROOM': {
          const roomCode = generateRoomCode();
          const playerId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          const trackId = 'harbor-gp';
          const track = TRACKS[trackId] || DEFAULT_TRACK;
          const trackGeo = new TrackGeometry(track.trackPoints);
          const sanitizedCar = sanitizeCustomization(msg.payload?.player?.carConfig);

          const hostPlayer: Player = {
            id: playerId,
            name: sanitizedCar.driverName,
            isHost: true,
            isReady: true,
            isConnected: true,
            ping: 15,
            carConfig: sanitizedCar,
            state: createInitialPhysicsState(0, track),
          };

          const initialConfig = { ...DEFAULT_RACE_CONFIG, trackId, lapCount: 3 };

          const room: ServerRoom = {
            code: roomCode,
            hostId: playerId,
            trackId,
            lapCount: 3,
            state: 'LOBBY',
            countdown: 3,
            raceStartTime: null,
            raceElapsedMs: 0,
            players: [hostPlayer],
            powerUps: createTrackPowerUps(trackId, initialConfig),
            clients: new Map([[playerId, ws]]),
            playerInputs: new Map(),
            playerSequenceNumbers: new Map(),
            lastRespawnTimes: new Map(),
            trackGeo,
            tickInterval: null,
            countdownInterval: null,
            finishTimeout: null,
            powerUpsUsedCount: new Map([[playerId, 0]]),
            raceConfig: initialConfig,
          };

          rooms.set(roomCode, room);
          currentRoomCode = roomCode;
          currentPlayerId = playerId;

          ws.send(
            JSON.stringify({
              type: 'ROOM_CREATED',
              payload: { roomCode, playerId, room: getCleanRoomInfo(room) },
            })
          );
          break;
        }

        case 'JOIN_ROOM': {
          const roomCode = typeof msg.payload?.roomCode === 'string'
            ? msg.payload.roomCode.toUpperCase().trim() : '';
          const room = rooms.get(roomCode);

          if (!room) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: `Room '${roomCode}' does not exist` } }));
            return;
          }

          if (room.players.length >= 15) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Room has reached maximum grid capacity (15 players)' } }));
            return;
          }

          if (room.state !== 'LOBBY') {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Race is currently in progress. Please wait for next race.' } }));
            return;
          }

          const playerId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          const track = TRACKS[room.trackId] || DEFAULT_TRACK;
          const slotIndex = room.players.length;
          const sanitizedCar = sanitizeCustomization(msg.payload?.player?.carConfig);

          const newPlayer: Player = {
            id: playerId,
            name: sanitizedCar.driverName,
            isHost: false,
            isReady: false,
            isConnected: true,
            ping: 20,
            carConfig: sanitizedCar,
            state: createInitialPhysicsState(slotIndex, track),
          };

          room.players.push(newPlayer);
          room.clients.set(playerId, ws);
          room.powerUpsUsedCount.set(playerId, 0);

          currentRoomCode = roomCode;
          currentPlayerId = playerId;

          ws.send(
            JSON.stringify({
              type: 'ROOM_JOINED',
              payload: { roomCode, playerId, room: getCleanRoomInfo(room) },
            })
          );

          broadcastToRoom(room, {
            type: 'ROOM_UPDATE',
            payload: { room: getCleanRoomInfo(room) },
          });
          break;
        }

        case 'RECONNECT': {
          const roomCode = typeof msg.payload?.roomCode === 'string'
            ? msg.payload.roomCode.toUpperCase().trim() : '';
          const room = rooms.get(roomCode);
          if (!room) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: `Room '${roomCode}' expired or not found` } }));
            return;
          }

          const existingPlayer = room.players.find((p) => p.id === msg.payload?.playerId);
          if (existingPlayer) {
            existingPlayer.isConnected = true;
            existingPlayer.carConfig = sanitizeCustomization(msg.payload?.carConfig);
            room.clients.set(existingPlayer.id, ws);
            currentRoomCode = roomCode;
            currentPlayerId = existingPlayer.id;

            ws.send(
              JSON.stringify({
                type: 'ROOM_JOINED',
                payload: { roomCode, playerId: existingPlayer.id, room: getCleanRoomInfo(room) },
              })
            );

            broadcastToRoom(room, {
              type: 'ROOM_UPDATE',
              payload: { room: getCleanRoomInfo(room) },
            });
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Player session not found in room' } }));
          }
          break;
        }

        case 'SET_READY': {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const player = room.players.find((p) => p.id === currentPlayerId);
          if (player) {
            player.isReady = Boolean(msg.payload?.isReady);
            broadcastToRoom(room, {
              type: 'ROOM_UPDATE',
              payload: { room: getCleanRoomInfo(room) },
            });
          }
          break;
        }

        case 'UPDATE_CUSTOMIZATION': {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const player = room.players.find((p) => p.id === currentPlayerId);
          if (player) {
            player.carConfig = sanitizeCustomization(msg.payload?.carConfig);
            broadcastToRoom(room, {
              type: 'ROOM_UPDATE',
              payload: { room: getCleanRoomInfo(room) },
            });
          }
          break;
        }

        case 'SELECT_TRACK': {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.hostId !== currentPlayerId) return;

          const newTrackId = msg.payload?.trackId;
          if (!TRACKS[newTrackId]) return;

          const track = TRACKS[newTrackId];
          room.trackId = newTrackId;
          if (room.raceConfig) {
            room.raceConfig.trackId = newTrackId;
          }
          room.trackGeo = new TrackGeometry(track.trackPoints);
          room.powerUps = createTrackPowerUps(newTrackId, room.raceConfig);

          // Re-slot all player initial positions
          room.players.forEach((p, idx) => {
            p.state = createInitialPhysicsState(idx, track);
          });

          broadcastToRoom(room, {
            type: 'ROOM_UPDATE',
            payload: { room: getCleanRoomInfo(room) },
          });
          break;
        }

        case 'SET_LAPS': {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.hostId !== currentPlayerId) return;

          const laps = typeof msg.payload?.lapCount === 'number' && Number.isFinite(msg.payload.lapCount)
            ? Math.max(1, Math.min(20, Math.floor(msg.payload.lapCount))) : 3;

          room.lapCount = laps;
          if (room.raceConfig) {
            room.raceConfig.lapCount = laps;
          }
          broadcastToRoom(room, {
            type: 'ROOM_UPDATE',
            payload: { room: getCleanRoomInfo(room) },
          });
          break;
        }
        case 'START_RACE': {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.hostId !== currentPlayerId || room.state !== 'LOBBY') return;

          room.state = 'STARTING';
          room.countdown = 3;

          const track = TRACKS[room.trackId] || DEFAULT_TRACK;
          room.players.forEach((p, idx) => {
            p.state = createInitialPhysicsState(idx, track);
            room.powerUpsUsedCount.set(p.id, 0);
          });
          room.playerInputs.clear();
          room.lastRespawnTimes.clear();

          broadcastToRoom(room, {
            type: 'ROOM_UPDATE',
            payload: { room: getCleanRoomInfo(room) },
          });

          // Synchronized 3, 2, 1, 0 Countdown
          let count = 3;
          if (room.countdownInterval) clearInterval(room.countdownInterval);

          room.countdownInterval = setInterval(() => {
            broadcastToRoom(room, {
              type: 'RACE_COUNTDOWN',
              payload: { countdown: count },
            });

            if (count === 0) {
              if (room.countdownInterval) clearInterval(room.countdownInterval);
              room.state = 'RACING';
              room.raceStartTime = Date.now();
              room.raceElapsedMs = 0;

              broadcastToRoom(room, {
                type: 'RACE_START',
                payload: { raceStartTime: room.raceStartTime, room: getCleanRoomInfo(room) },
              });

              startRaceLoop(room);
            } else {
              count -= 1;
            }
          }, 1000);
          break;
        }

        case 'INPUT_UPDATE': {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.state !== 'RACING') return;

          const player = room.players.find((p) => p.id === currentPlayerId);
          if (player && !player.state.finished) {
            const sanitized = sanitizeInput(msg.payload?.input);
            const seq = typeof msg.payload?.sequenceNumber === 'number' && Number.isFinite(msg.payload.sequenceNumber)
              ? msg.payload.sequenceNumber
              : (typeof msg.payload?.input?.sequenceNumber === 'number' ? msg.payload.input.sequenceNumber : 0);
            
            const lastSeq = room.playerSequenceNumbers.get(currentPlayerId) || 0;
            if (seq > lastSeq || seq === 0) {
              room.playerInputs.set(currentPlayerId, sanitized);
              if (seq > 0) {
                room.playerSequenceNumbers.set(currentPlayerId, seq);
              }
            }
          }
          break;
        }

        case 'USE_POWERUP': {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.state !== 'RACING') return;

          const player = room.players.find((p) => p.id === currentPlayerId);
          if (player) {
            executePlayerPowerUp(room, player);
          }
          break;
        }

        case 'REQUEST_RESPAWN': {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.state !== 'RACING') return;

          // If respawn is disabled globally in config, block manual respawns
          const isRespawnEnabled = room.raceConfig ? room.raceConfig.respawnEnabled !== false : true;
          if (!isRespawnEnabled) return;

          // Determine cooldown based on config-defined respawn delay
          let respawnDelayMs = 3000; // standard
          if (room.raceConfig) {
            if (room.raceConfig.respawnDelay === 'INSTANT') respawnDelayMs = 500;
            else if (room.raceConfig.respawnDelay === 'SHORT') respawnDelayMs = 1500;
          }

          // Enforce custom cooldown between manual respawns
          const lastRespawn = room.lastRespawnTimes.get(currentPlayerId) || 0;
          const now = Date.now();
          if (now - lastRespawn < respawnDelayMs) return;
          room.lastRespawnTimes.set(currentPlayerId, now);

          const player = room.players.find((p) => p.id === currentPlayerId);
          if (player && !player.state.finished) {
            const info = room.trackGeo.getTrackProgressAndOffset(player.state.x, player.state.z, player.state.checkpointIndex);
            player.state.x = info.nearestPoint.x;
            player.state.y = info.nearestPoint.y + 0.1;
            player.state.z = info.nearestPoint.z;
            player.state.rotationY = Math.atan2(info.tangent.x, info.tangent.z);
            player.state.speed = 0;
            player.state.vx = 0;
            player.state.vz = 0;
            player.state.angularVelocity = 0;
            player.state.steerAngle = 0;
            player.state.lastRespawnTimestamp = now;
            room.playerSequenceNumbers.delete(currentPlayerId);
          }
          break;
        }

        case 'UPDATE_RACE_CONFIG': {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.hostId !== currentPlayerId) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Unauthorized: Only the Host can change race configuration' } }));
            return;
          }

          if (room.state !== 'LOBBY') {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Cannot modify settings while race is starting or active' } }));
            return;
          }

          const validated = validateRaceConfig(msg.payload?.raceConfig);
          room.raceConfig = validated;
          room.trackId = validated.trackId;
          room.lapCount = validated.lapCount;
          
          // Re-generate powerups for track
          room.powerUps = createTrackPowerUps(validated.trackId, validated);
          room.trackGeo = new TrackGeometry((TRACKS[validated.trackId] || DEFAULT_TRACK).trackPoints);

          // Update starting grid state positions for existing players
          const track = TRACKS[validated.trackId] || DEFAULT_TRACK;
          room.players.forEach((p, idx) => {
            p.state = createInitialPhysicsState(idx, track);
          });

          broadcastToRoom(room, {
            type: 'ROOM_UPDATE',
            payload: { room: getCleanRoomInfo(room) },
          });
          break;
        }

        case 'REMATCH': {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.hostId !== currentPlayerId) return;

          if (room.finishTimeout) clearTimeout(room.finishTimeout);

          room.state = 'STARTING';
          room.countdown = 3;
          room.powerUps = createTrackPowerUps(room.trackId);
          const track = TRACKS[room.trackId] || DEFAULT_TRACK;
          room.players.forEach((p, idx) => {
            p.state = createInitialPhysicsState(idx, track);
            room.powerUpsUsedCount.set(p.id, 0);
          });
          room.playerInputs.clear();
          room.lastRespawnTimes.clear();

          broadcastToRoom(room, {
            type: 'ROOM_UPDATE',
            payload: { room: getCleanRoomInfo(room) },
          });

          let count = 3;
          if (room.countdownInterval) clearInterval(room.countdownInterval);
          room.countdownInterval = setInterval(() => {
            broadcastToRoom(room, {
              type: 'RACE_COUNTDOWN',
              payload: { countdown: count },
            });

            if (count === 0) {
              if (room.countdownInterval) clearInterval(room.countdownInterval);
              room.state = 'RACING';
              room.raceStartTime = Date.now();
              room.raceElapsedMs = 0;

              broadcastToRoom(room, {
                type: 'RACE_START',
                payload: { raceStartTime: room.raceStartTime, room: getCleanRoomInfo(room) },
              });

              startRaceLoop(room);
            } else {
              count -= 1;
            }
          }, 1000);
          break;
        }

        case 'RETURN_TO_LOBBY': {
          if (!currentRoomCode || !currentPlayerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.hostId !== currentPlayerId) return;

          if (room.tickInterval) clearInterval(room.tickInterval);
          if (room.countdownInterval) clearInterval(room.countdownInterval);
          if (room.finishTimeout) clearTimeout(room.finishTimeout);

          room.state = 'LOBBY';
          room.raceStartTime = null;
          room.raceElapsedMs = 0;
          room.powerUps = createTrackPowerUps(room.trackId);
          const track = TRACKS[room.trackId] || DEFAULT_TRACK;
          room.players.forEach((p, idx) => {
            p.isReady = p.isHost;
            p.state = createInitialPhysicsState(idx, track);
            room.powerUpsUsedCount.set(p.id, 0);
          });
          room.playerInputs.clear();
          room.lastRespawnTimes.clear();

          broadcastToRoom(room, {
            type: 'ROOM_UPDATE',
            payload: { room: getCleanRoomInfo(room) },
          });
          break;
        }

        case 'PING': {
          ws.send(
            JSON.stringify({
              type: 'PONG',
              payload: { clientTimestamp: msg.payload?.timestamp || Date.now(), serverTimestamp: Date.now() },
            })
          );
          break;
        }
      }
    } catch (err) {
      console.error('Error handling websocket message:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomCode && currentPlayerId) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        room.clients.delete(currentPlayerId);
        room.playerInputs.delete(currentPlayerId);
        room.lastRespawnTimes.delete(currentPlayerId);
        const pIndex = room.players.findIndex((p) => p.id === currentPlayerId);

        if (pIndex !== -1) {
          if (room.state === 'LOBBY') {
            room.players.splice(pIndex, 1);
          } else {
            room.players[pIndex].isConnected = false;
          }
        }

        // Host migration
        if (room.hostId === currentPlayerId && room.players.length > 0) {
          if (pIndex !== -1 && room.players[pIndex]) {
            room.players[pIndex].isHost = false;
          }
          const nextActive = room.players.find((p) => p.isConnected) || room.players[0];
          room.hostId = nextActive.id;
          nextActive.isHost = true;
        }

        // Clean up empty rooms
        if (room.players.filter((p) => p.isConnected).length === 0) {
          if (room.tickInterval) clearInterval(room.tickInterval);
          if (room.countdownInterval) clearInterval(room.countdownInterval);
          if (room.finishTimeout) clearTimeout(room.finishTimeout);
          rooms.delete(currentRoomCode);
        } else {
          broadcastToRoom(room, {
            type: 'ROOM_UPDATE',
            payload: { room: getCleanRoomInfo(room) },
          });
        }
      }
    }
  });
});

// Full-stack Vite / Static handling
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[GRID//15] Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to start server:', err);
});
