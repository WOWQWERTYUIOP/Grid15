import React, { useState, useEffect, useRef } from 'react';
import {
  CarCustomization,
  RoomInfo,
  Player,
  PowerUpBox,
  RaceResultEntry,
  PlayerInput,
  PlayerPhysicsState,
  PowerUpType,
  RaceConfig,
} from './types/game';
import { TRACKS, DEFAULT_TRACK } from './config/tracks';
import { loadSavedCustomization, saveCustomization } from './utils/storage';
import { net } from './game/network';
import { InputManager } from './game/input';
import { RaceRenderer } from './game/renderer';
import { soundEngine } from './game/audio';
import { ClientPredictionEngine } from './game/prediction';
import { TrackGeometry } from './game/physics';
import { MainMenu } from './components/MainMenu';
import { Garage } from './components/Garage';
import { Lobby } from './components/Lobby';
import { RaceHUD } from './components/RaceHUD';
import { Results } from './components/Results';
import { HowToPlay } from './components/HowToPlay';
import { ControlsBriefing } from './components/ControlsBriefing';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';

export default function App() {
  // App navigation state
  const [view, setView] = useState<'MENU' | 'GARAGE' | 'LOBBY' | 'RACE' | 'RESULTS'>('MENU');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showControlsBriefing, setShowControlsBriefing] = useState(false);
  const [hasRacedBefore, setHasRacedBefore] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Customization
  const [customization, setCustomization] = useState<CarCustomization>(loadSavedCustomization());

  // Room state
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const roomRef = useRef<RoomInfo | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [results, setResults] = useState<RaceResultEntry[]>([]);
  const [fps, setFps] = useState(60);

  // Real-time race references
  const raceContainerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<RaceRenderer | null>(null);
  const inputManagerRef = useRef<InputManager | null>(null);
  const predictionEngineRef = useRef<ClientPredictionEngine>(new ClientPredictionEngine());
  const lastHudUpdateRef = useRef<number>(0);

  const [touchInput, setTouchInput] = useState<PlayerInput>({
    throttle: 0,
    brake: 0,
    steer: 0,
    boost: false,
    usePowerUp: false,
    respawn: false,
  });

  // Keep touch input synced with inputManager
  useEffect(() => {
    if (inputManagerRef.current) {
      inputManagerRef.current.touchInput = touchInput;
    }
  }, [touchInput]);

  const handleUserGesture = () => {
    soundEngine.init();
  };

  const handleToggleMute = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  const [isConnected, setIsConnected] = useState(true);
  const [quitToasts, setQuitToasts] = useState<{ id: string; name: string }[]>([]);

  // Setup WebSocket Listeners
  useEffect(() => {
    const unsubConn = net.on('CONNECTION_CHANGE', (payload: { isConnected: boolean }) => {
      setIsConnected(payload.isConnected);
    });

    const unsubCreated = net.on('ROOM_CREATED', (payload: { roomCode: string; playerId: string; room: RoomInfo }) => {
      setLocalPlayerId(payload.playerId);
      setRoom(payload.room);
      roomRef.current = payload.room;
      net.setSessionMeta({ roomCode: payload.roomCode, playerId: payload.playerId, carConfig: customization });
      setView('LOBBY');
      setIsConnecting(false);
    });

    const unsubJoined = net.on('ROOM_JOINED', (payload: { roomCode: string; playerId: string; room: RoomInfo }) => {
      setLocalPlayerId(payload.playerId);
      setRoom(payload.room);
      roomRef.current = payload.room;
      net.setSessionMeta({ roomCode: payload.roomCode, playerId: payload.playerId, carConfig: customization });

      const local = payload.room.players.find((p) => p.id === payload.playerId);
      if (local && payload.room.state === 'RACING') {
        predictionEngineRef.current.init(local.state);
        setView('RACE');
      } else if (payload.room.state === 'RESULTS') {
        setView('RESULTS');
      } else {
        setView('LOBBY');
      }
      setIsConnecting(false);
    });

    const unsubUpdate = net.on('ROOM_UPDATE', (payload: { room: RoomInfo }) => {
      setRoom(payload.room);
      roomRef.current = payload.room;
      if (payload.room.state === 'LOBBY' && view !== 'GARAGE') {
        setView('LOBBY');
      } else if (payload.room.state === 'RESULTS') {
        setView('RESULTS');
      } else if (payload.room.state === 'RACING' && view !== 'RACE') {
        setView('RACE');
      }
    });

    const unsubCountdown = net.on('RACE_COUNTDOWN', (payload: { countdown: number }) => {
      setCountdown(payload.countdown);
      if (payload.countdown === 3) {
        setShowControlsBriefing(true);
      }
      soundEngine.playCountdownBeep(payload.countdown === 0);
    });

    const unsubRaceStart = net.on('RACE_START', (payload: { raceStartTime: number; room: RoomInfo }) => {
      setRoom(payload.room);
      roomRef.current = payload.room;
      setCountdown(null);
      setShowControlsBriefing(false);
      setHasRacedBefore(true);

      const local = payload.room.players.find((p) => p.id === localPlayerId);
      if (local) {
        predictionEngineRef.current.init(local.state);
      }
      setView('RACE');
    });

    // Decoupled 30Hz network update into mutable ref + client prediction reconciliation
    const unsubGameTick = net.on('GAME_TICK', (payload: {
      players: { [id: string]: PlayerPhysicsState };
      powerUps: PowerUpBox[];
      raceElapsedMs: number;
    }) => {
      if (roomRef.current) {
        const trackData = TRACKS[roomRef.current.trackId] || DEFAULT_TRACK;
        const trackGeo = new TrackGeometry(trackData.trackPoints);

        for (const p of roomRef.current.players) {
          if (payload.players[p.id]) {
            if (p.id === localPlayerId) {
              predictionEngineRef.current.reconcile(
                payload.players[p.id],
                trackGeo,
                trackData,
                roomRef.current.lapCount,
                roomRef.current.raceConfig
              );
              const localRender = predictionEngineRef.current.getRenderState();
              p.state = localRender || payload.players[p.id];
            } else {
              p.state = payload.players[p.id];
            }
          }
        }
        roomRef.current.powerUps = payload.powerUps;
        roomRef.current.raceElapsedMs = payload.raceElapsedMs;

        // Throttle React state updates to 10Hz to prevent DOM thrashing
        const now = performance.now();
        if (now - lastHudUpdateRef.current > 100) {
          lastHudUpdateRef.current = now;
          setRoom({ ...roomRef.current });
        }
      }
    });

    const unsubPowerUpCollected = net.on('POWERUP_COLLECTED', (payload: { playerId: string; powerUp: PowerUpType }) => {
      if (payload.playerId === localPlayerId) {
        soundEngine.playPowerUpCollect();
      }
    });

    const unsubPowerUpTriggered = net.on('POWERUP_TRIGGERED', (payload: { playerId: string; powerUp: PowerUpType; targetIds?: string[] }) => {
      soundEngine.playPowerUpUse(payload.powerUp);
      if (rendererRef.current && (payload.powerUp === 'EMP' || payload.powerUp === 'TURBO')) {
        rendererRef.current.triggerCameraShake(0.4);
      }
    });

    const unsubPlayerQuit = net.on('PLAYER_QUIT', (payload: { playerId: string; name: string }) => {
      const toastId = `quit_${Date.now()}_${Math.random()}`;
      setQuitToasts((prev) => [...prev, { id: toastId, name: payload.name }]);
      setTimeout(() => {
        setQuitToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 4000);
    });

    const unsubRaceLeft = net.on('RACE_LEFT', () => {
      soundEngine.stopVehicleSound();
      setView('LOBBY');
      setErrorMessage('You left the race session');
      setTimeout(() => setErrorMessage(null), 3500);
    });

    const unsubFinished = net.on('RACE_FINISHED', (payload: { results: RaceResultEntry[]; room?: RoomInfo }) => {
      setResults(payload.results || []);
      if (payload.room) {
        setRoom(payload.room);
        roomRef.current = payload.room;
      }
      setView('RESULTS');
      soundEngine.stopVehicleSound();
    });

    const unsubError = net.on('ERROR', (payload: { message: string }) => {
      setErrorMessage(payload.message);
      setIsConnecting(false);
      setTimeout(() => setErrorMessage(null), 4000);
    });

    return () => {
      unsubConn();
      unsubCreated();
      unsubJoined();
      unsubUpdate();
      unsubCountdown();
      unsubRaceStart();
      unsubGameTick();
      unsubPowerUpCollected();
      unsubPowerUpTriggered();
      unsubPlayerQuit();
      unsubRaceLeft();
      unsubFinished();
      unsubError();
    };
  }, [localPlayerId, view]);

  // Create Room handler
  const handleCreateRoom = async () => {
    handleUserGesture();
    setIsConnecting(true);
    try {
      await net.connect();
      net.send({
        type: 'CREATE_ROOM',
        payload: {
          player: {
            name: customization.driverName,
            carConfig: customization,
          },
        },
      });
    } catch (e) {
      setErrorMessage('Failed to connect to multiplayer server');
      setIsConnecting(false);
    }
  };

  // Join Room handler
  const handleJoinRoom = async (code: string) => {
    handleUserGesture();
    setIsConnecting(true);
    try {
      await net.connect();
      net.send({
        type: 'JOIN_ROOM',
        payload: {
          roomCode: code,
          player: {
            name: customization.driverName,
            carConfig: customization,
          },
        },
      });
    } catch (e) {
      setErrorMessage('Failed to connect to multiplayer server');
      setIsConnecting(false);
    }
  };

  // Lobby actions
  const handleSetReady = (isReady: boolean) => {
    net.send({ type: 'SET_READY', payload: { isReady } });
  };

  const handleSelectTrack = (trackId: string) => {
    net.send({ type: 'SELECT_TRACK', payload: { trackId } });
  };

  const handleSetLaps = (lapCount: number) => {
    net.send({ type: 'SET_LAPS', payload: { lapCount } });
  };

  const handleUpdateRaceConfig = (raceConfig: RaceConfig) => {
    net.send({ type: 'UPDATE_RACE_CONFIG', payload: { raceConfig } });
  };

  const handleStartRace = () => {
    net.send({ type: 'START_RACE' });
  };

  const handleLeaveRoom = () => {
    net.setSessionMeta(null);
    net.disconnect();
    setRoom(null);
    roomRef.current = null;
    setLocalPlayerId(null);
    setView('MENU');
    soundEngine.stopVehicleSound();
  };

  const handleQuitRace = () => {
    net.send({ type: 'QUIT_RACE' });
  };

  const handleRematch = () => {
    net.send({ type: 'REMATCH' });
  };

  const handleReturnToLobby = () => {
    net.send({ type: 'RETURN_TO_LOBBY' });
  };

  const handleUsePowerUp = () => {
    net.send({ type: 'USE_POWERUP' });
  };

  const handleRequestRespawn = () => {
    const activeTrackData = TRACKS[roomRef.current?.trackId || ''] || DEFAULT_TRACK;
    const activeTrackGeo = new TrackGeometry(activeTrackData.trackPoints);
    predictionEngineRef.current.triggerRespawn(activeTrackGeo);
    net.send({ type: 'REQUEST_RESPAWN' });
  };

  // 3D Race Scene Lifecycle
  useEffect(() => {
    if (view !== 'RACE' || !roomRef.current || !localPlayerId) {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      if (inputManagerRef.current) {
        inputManagerRef.current.dispose();
        inputManagerRef.current = null;
      }
      return;
    }

    const container = raceContainerRef.current;
    if (!container) return;

    const trackData = TRACKS[roomRef.current.trackId] || DEFAULT_TRACK;

    // Instantiate Three.js Renderer
    const renderer = new RaceRenderer({
      container,
      trackData,
      localPlayerId,
    });
    rendererRef.current = renderer;

    // Input Manager
    const inputManager = new InputManager();
    inputManagerRef.current = inputManager;

    // Initialize local client prediction engine with current player state
    const currentLocalPlayer = roomRef.current.players.find((p) => p.id === localPlayerId);
    if (currentLocalPlayer) {
      predictionEngineRef.current.init(currentLocalPlayer.state);
    }

    let animId: number;
    let lastTime = performance.now();
    let lastNetworkSend = 0;
    let wasPowerUpPressed = false;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const gameLoop = (time: number) => {
      animId = requestAnimationFrame(gameLoop);
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      // Track FPS
      frameCount++;
      if (time - lastFpsTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (time - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = time;
      }

      // Sample local inputs (if local player already finished, coast safely to stop)
      const currentActiveRoom = roomRef.current;
      const currentLocal = currentActiveRoom?.players.find((p) => p.id === localPlayerId);
      const isFinished = currentLocal?.state.finished || false;
      const rawInput = isFinished
        ? { throttle: 0, brake: 0.25, steer: 0, boost: false, usePowerUp: false, respawn: false }
        : inputManager.getInput();

      const activeTrackData = TRACKS[currentActiveRoom?.trackId || ''] || DEFAULT_TRACK;
      const activeTrackGeo = new TrackGeometry(activeTrackData.trackPoints);

      // Run immediate 60+ FPS client-side prediction physics
      const predictedInput = predictionEngineRef.current.predictFrame(
        rawInput,
        dt,
        activeTrackGeo,
        activeTrackData,
        currentActiveRoom?.lapCount || 3,
        currentActiveRoom?.raceConfig
      );

      // Transmit input with sequenceNumber to authoritative server on each predicted frame
      if (!isFinished) {
        net.send({
          type: 'INPUT_UPDATE',
          payload: {
            input: predictedInput,
            sequenceNumber: predictedInput.sequenceNumber,
            timestamp: Date.now(),
          },
        });
      }

      if (predictedInput.usePowerUp) {
        if (!wasPowerUpPressed) {
          net.send({ type: 'USE_POWERUP' });
          wasPowerUpPressed = true;
        }
      } else {
        wasPowerUpPressed = false;
      }

      if (predictedInput.respawn) {
        handleRequestRespawn();
      }

      const localRenderState = predictionEngineRef.current.getRenderState() || currentLocal?.state;
      if (currentLocal && localRenderState) {
        currentLocal.state = localRenderState;
      }

      // Sync renderer with predicted state for local player and interpolated snapshots for opponents
      if (currentActiveRoom && currentActiveRoom.players) {
        renderer.syncPlayers(currentActiveRoom.players, dt, localRenderState);
        renderer.syncPowerUps(currentActiveRoom.powerUps);

        if (localRenderState) {
          renderer.updateCamera(localRenderState, dt);

          // Update dynamic engine audio pitch & tire screech
          const speedKmh = Math.abs(localRenderState.speed) * 3.6;
          soundEngine.updateVehicleSound(
            speedKmh,
            predictedInput.throttle > 0,
            localRenderState.isDrifting,
            localRenderState.isBoosting
          );
        }
      }

      renderer.render();
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      soundEngine.stopVehicleSound();
      renderer.dispose();
      inputManager.dispose();
    };
  }, [view, room?.trackId]);

  const activeRoom = roomRef.current || room;
  const localPlayer = activeRoom?.players.find((p) => p.id === localPlayerId) || null;
  const currentTrack = activeRoom ? TRACKS[activeRoom.trackId] || DEFAULT_TRACK : DEFAULT_TRACK;

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none" onClick={handleUserGesture}>
      {/* Dev Diagnostics Overlay (~ key to toggle) */}
      <DiagnosticsPanel
        room={activeRoom}
        localPlayer={localPlayer}
        fps={fps}
        predictionEngine={predictionEngineRef.current}
      />

      {/* Global Error Toast */}
      {errorMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-panel-glow px-6 py-3 rounded-xl border border-rose-500 text-rose-400 font-display text-sm tracking-wider shadow-2xl flex items-center gap-2 animate-bounce">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {/* VIEW 1: MAIN MENU */}
      {view === 'MENU' && (
        <MainMenu
          customization={customization}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onOpenGarage={() => setView('GARAGE')}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isConnecting={isConnecting}
        />
      )}

      {/* VIEW 2: GARAGE / CUSTOMIZATION */}
      {view === 'GARAGE' && (
        <Garage
          config={customization}
          onUpdateConfig={(newConf) => {
            setCustomization(newConf);
            saveCustomization(newConf);
            if (activeRoom && localPlayerId) {
              net.send({ type: 'UPDATE_CUSTOMIZATION', payload: { carConfig: newConf } });
            }
          }}
          onBack={() => {
            if (activeRoom) setView('LOBBY');
            else setView('MENU');
          }}
        />
      )}

      {/* VIEW 3: LOBBY */}
      {view === 'LOBBY' && activeRoom && localPlayerId && (
        <Lobby
          room={activeRoom}
          localPlayerId={localPlayerId}
          onSetReady={handleSetReady}
          onSelectTrack={handleSelectTrack}
          onSetLaps={handleSetLaps}
          onStartRace={handleStartRace}
          onLeaveRoom={handleLeaveRoom}
          onOpenGarage={() => setView('GARAGE')}
          onUpdateRaceConfig={handleUpdateRaceConfig}
        />
      )}

      {/* VIEW 4: RACE (3D Canvas + HUD) */}
      {view === 'RACE' && activeRoom && localPlayer && (
        <div className="relative w-full h-full">
          {/* Three.js 3D Viewport */}
          <div ref={raceContainerRef} className="w-full h-full" />

          {/* Interactive HUD Layer */}
          <RaceHUD
            localPlayer={localPlayer}
            players={activeRoom.players}
            trackData={currentTrack}
            totalLaps={activeRoom.lapCount}
            powerUps={activeRoom.powerUps}
            countdown={countdown}
            onUsePowerUp={handleUsePowerUp}
            onRequestRespawn={handleRequestRespawn}
            onQuitRace={handleQuitRace}
            touchInput={touchInput}
            setTouchInput={setTouchInput}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            isConnected={isConnected}
            quitToasts={quitToasts}
          />
        </div>
      )}

      {/* VIEW 5: RESULTS */}
      {view === 'RESULTS' && (
        <Results
          results={results}
          room={
            activeRoom || {
              code: 'GP',
              hostId: localPlayerId || 'local',
              trackId: 'harbor-gp',
              lapCount: 3,
              state: 'RESULTS',
              countdown: 0,
              players: [],
              powerUps: [],
              raceStartTime: null,
              raceElapsedMs: 0,
            }
          }
          localPlayerId={localPlayerId || ''}
          onRematch={handleRematch}
          onReturnToLobby={handleReturnToLobby}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {/* HOW TO PLAY MODAL OVERLAY */}
      {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}

      {/* PRE-RACE CONTROLS BRIEFING OVERLAY */}
      {showControlsBriefing && (
        <ControlsBriefing
          onDismiss={() => {
            setShowControlsBriefing(false);
            setHasRacedBefore(true);
          }}
          isRematch={hasRacedBefore}
        />
      )}
    </div>
  );
}
