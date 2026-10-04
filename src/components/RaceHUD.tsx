import React, { useState, useEffect } from 'react';
import { Player, TrackData, PowerUpBox, PowerUpType, PlayerInput } from '../types/game';
import { Minimap } from './Minimap';
import { POWER_UPS } from '../config/powerups';
import { formatTimeMs } from '../utils/storage';
import { Zap, Shield, Gauge, Radio, Wind, RotateCcw, Volume2, VolumeX, Menu, LogOut, X, WifiOff, AlertTriangle } from 'lucide-react';
import { soundEngine } from '../game/audio';

interface RaceHUDProps {
  localPlayer: Player;
  players: Player[];
  trackData: TrackData;
  totalLaps: number;
  powerUps: PowerUpBox[];
  countdown: number | null;
  onUsePowerUp: () => void;
  onRequestRespawn: () => void;
  onQuitRace: () => void;
  touchInput: PlayerInput;
  setTouchInput: React.Dispatch<React.SetStateAction<PlayerInput>>;
  isMuted: boolean;
  onToggleMute: () => void;
  isConnected?: boolean;
  quitToasts?: { id: string; name: string }[];
}

export const RaceHUD: React.FC<RaceHUDProps> = ({
  localPlayer,
  players,
  trackData,
  totalLaps,
  powerUps,
  countdown,
  onUsePowerUp,
  onRequestRespawn,
  onQuitRace,
  touchInput,
  setTouchInput,
  isMuted,
  onToggleMute,
  isConnected = true,
  quitToasts = [],
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showControlsModal, setShowControlsModal] = useState(false);

  const state = localPlayer.state;
  const speedKmh = Math.round(Math.abs(state.speed) * 3.6);

  // Escape key toggle for Race Menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (showQuitConfirm) {
          setShowQuitConfirm(false);
        } else if (showControlsModal) {
          setShowControlsModal(false);
        } else {
          setShowMenu((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQuitConfirm, showControlsModal]);

  // Position calculation
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.state.isQuit && !b.state.isQuit) return 1;
    if (!a.state.isQuit && b.state.isQuit) return -1;
    if (a.state.finished && b.state.finished) {
      return (a.state.finishTime ?? Infinity) - (b.state.finishTime ?? Infinity);
    }
    if (a.state.finished) return -1;
    if (b.state.finished) return 1;
    return b.state.totalDistance - a.state.totalDistance;
  });

  const currentRank = sortedPlayers.findIndex((p) => p.id === localPlayer.id) + 1 || 1;
  const activeRacersCount = players.filter((p) => !p.state.isQuit).length;

  const powerUpConfig = state.activePowerUp ? POWER_UPS[state.activePowerUp] : null;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 overflow-hidden select-none">
      {/* Reconnection Status Banner Overlay */}
      {!isConnected && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 glass-panel-glow px-6 py-2.5 rounded-xl border border-amber-500/60 bg-amber-500/10 text-amber-300 font-mono-race text-xs tracking-wider shadow-2xl flex items-center gap-2.5 animate-pulse pointer-events-auto">
          <WifiOff className="w-4 h-4 text-amber-400" />
          <span>CONNECTION INTERRUPTED — RECONNECTING TO CIRCUIT...</span>
        </div>
      )}

      {/* Rival Player Quit Toasts */}
      {quitToasts.length > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 space-y-2 pointer-events-none">
          {quitToasts.map((toast) => (
            <div
              key={toast.id}
              className="glass-panel px-5 py-2 rounded-xl border border-rose-500/40 text-rose-300 font-mono-race text-xs tracking-wider shadow-xl flex items-center gap-2 animate-fadeIn"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>RACER {toast.name.toUpperCase()} WITHDREW (QUIT)</span>
            </div>
          ))}
        </div>
      )}
      {/* EMP disruption static effect */}
      {state.empSlowTimer > 0 && (
        <div className="absolute inset-0 bg-yellow-500/15 pointer-events-none border-4 border-yellow-400 animate-pulse flex items-center justify-center">
          <div className="glass-panel px-6 py-3 rounded-xl border border-yellow-400 text-yellow-400 font-display text-lg tracking-widest animate-bounce">
            ⚡ EMP INTERFERENCE // POWER REDUCED ⚡
          </div>
        </div>
      )}

      {/* Slipstream visual effect on screen edges */}
      {state.slipstreamFactor > 0.3 && (
        <div className="absolute inset-0 pointer-events-none border-x-8 border-purple-500/40 animate-pulse" />
      )}

      {/* Countdown 3, 2, 1, GO! */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
          <div className="text-center animate-pulse">
            <span
              className={`font-display text-8xl md:text-9xl font-black drop-shadow-[0_0_40px_rgba(0,240,255,0.8)] ${
                countdown === 0 ? 'text-green-400' : 'text-cyan-400'
              }`}
            >
              {countdown === 0 ? 'GO!' : countdown}
            </span>
            <div className="text-sm md:text-base font-racing tracking-widest text-gray-300 mt-2 uppercase">
              {countdown === 0 ? 'RACE COMMENCED' : 'ENGINES ARMED'}
            </div>
          </div>
        </div>
      )}

      {/* Finished Banner */}
      {state.finished && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40">
          <div className="glass-panel-glow px-8 py-4 rounded-2xl border-2 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.4)] text-center">
            <div className="text-xs font-mono-race text-emerald-400 tracking-widest uppercase">CHEQUERED FLAG</div>
            <div className="font-display text-3xl md:text-4xl font-black text-white mt-1">
              FINISHED P{currentRank}
            </div>
            <div className="text-xs text-gray-300 mt-1 font-mono-race">
              TIME: {formatTimeMs(state.finishTime)}
            </div>
          </div>
        </div>
      )}

      {/* TOP BAR: Position, Lap, Timers, Mute, Track */}
      <div className="flex items-start justify-between w-full">
        {/* Left: Position & Lap */}
        <div className="flex items-center gap-3">
          {/* Position Card */}
          <div className="glass-panel px-4 py-2 rounded-xl border border-white/15 flex items-baseline gap-1 shadow-xl">
            <span className="text-xs font-bold text-gray-400 font-racing">POS</span>
            <span className="font-display text-3xl md:text-4xl font-black text-cyan-400">
              {currentRank}
            </span>
            <span className="text-sm font-bold text-gray-400 font-mono-race">/{activeRacersCount}</span>
          </div>

          {/* Lap Counter Card */}
          <div className="glass-panel px-4 py-2 rounded-xl border border-white/15 shadow-xl">
            <div className="text-[10px] font-bold text-gray-400 font-racing tracking-wider">LAP</div>
            <div className="font-display text-2xl md:text-3xl font-bold text-white font-mono-race">
              {Math.min(totalLaps, state.lap)} <span className="text-sm text-gray-500">/ {totalLaps}</span>
            </div>
          </div>

          {/* Active Buff Badges */}
          <div className="hidden sm:flex items-center gap-2">
            {Boolean(state.turboTimer && state.turboTimer > 0) && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-400 text-xs font-mono-race animate-pulse">
                <Zap className="w-3.5 h-3.5" />
                TURBO ({((state.turboTimer || 0) / 1000).toFixed(1)}s)
              </div>
            )}
            {state.hasShield && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 text-xs font-mono-race animate-pulse">
                <Shield className="w-3.5 h-3.5" />
                SHIELD ACTIVE {state.shieldTimer ? `(${((state.shieldTimer || 0) / 1000).toFixed(1)}s)` : ''}
              </div>
            )}
            {state.gripBoostTimer > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/20 border border-pink-400/50 text-pink-400 text-xs font-mono-race animate-pulse">
                <Gauge className="w-3.5 h-3.5" />
                AERO GRIP ({(state.gripBoostTimer / 1000).toFixed(1)}s)
              </div>
            )}
            {(Boolean(state.draftStreamTimer && state.draftStreamTimer > 0) || state.slipstreamFactor > 0.3) && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-400/50 text-purple-400 text-xs font-mono-race animate-pulse">
                <Wind className="w-3.5 h-3.5" />
                DRAFT STREAM {state.draftStreamTimer ? `(${((state.draftStreamTimer || 0) / 1000).toFixed(1)}s)` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Center: Lap Timers */}
        <div className="glass-panel px-5 py-2.5 rounded-xl border border-white/15 shadow-xl text-center">
          <div className="flex items-center justify-center gap-4 text-xs font-mono-race">
            <div>
              <span className="text-gray-400 mr-1.5">LAP:</span>
              <span className="text-white font-bold">{formatTimeMs(state.currentLapTime)}</span>
            </div>
            <div className="w-px h-3 bg-white/20" />
            <div>
              <span className="text-gray-400 mr-1.5">BEST:</span>
              <span className="text-purple-400 font-bold">{formatTimeMs(state.bestLapTime)}</span>
            </div>
          </div>
        </div>

        {/* Right: Sound toggle, Respawn Helper & Race Menu */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onRequestRespawn}
            title="Respawn Car on Track (R)"
            className="glass-panel hover:bg-white/10 p-2.5 rounded-xl border border-white/15 text-gray-300 hover:text-white transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-mono-race"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">RESPAWN [R]</span>
          </button>

          <button
            onClick={onToggleMute}
            title="Toggle Sound"
            className="glass-panel hover:bg-white/10 p-2.5 rounded-xl border border-white/15 text-gray-300 hover:text-white transition active:scale-95 cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          <button
            onClick={() => setShowMenu(true)}
            title="Race Menu (ESC)"
            className="glass-panel hover:bg-white/10 px-3 py-2.5 rounded-xl border border-white/15 text-white font-mono-race text-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
          >
            <Menu className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">MENU</span>
          </button>
        </div>
      </div>

      {/* BOTTOM SECTION: Minimap on Left, Power-up & Boost Center, Speedometer on Right */}
      <div className="flex items-end justify-between w-full mt-auto">
        {/* Left: Circuit Radar Minimap */}
        <div className="pointer-events-auto hidden sm:block">
          <Minimap
            trackData={trackData}
            players={players}
            localPlayerId={localPlayer.id}
            powerUps={powerUps}
          />
        </div>

        {/* Center: Power-Up Slot & Boost Nitro Gauge */}
        <div className="flex flex-col items-center gap-3">
          {/* Power-up Slot */}
          <div className="pointer-events-auto">
            {powerUpConfig ? (
              <button
                onClick={onUsePowerUp}
                className="group relative glass-panel-glow px-5 py-3 rounded-2xl border-2 flex items-center gap-3 active:scale-95 transition cursor-pointer"
                style={{ borderColor: powerUpConfig.color, boxShadow: `0 0 25px ${powerUpConfig.color}60` }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shadow-lg animate-pulse"
                  style={{ backgroundColor: `${powerUpConfig.color}35`, border: `2px solid ${powerUpConfig.color}` }}
                >
                  {state.activePowerUp === 'TURBO' && <Zap className="w-6 h-6 text-cyan-400" />}
                  {state.activePowerUp === 'SHIELD' && <Shield className="w-6 h-6 text-emerald-400" />}
                  {state.activePowerUp === 'GRIP_BOOST' && <Gauge className="w-6 h-6 text-pink-400" />}
                  {state.activePowerUp === 'EMP' && <Radio className="w-6 h-6 text-yellow-400" />}
                  {state.activePowerUp === 'SLIPSTREAM' && <Wind className="w-6 h-6 text-purple-400" />}
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-mono-race text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>POWER-UP READY</span>
                  </div>
                  <div className="font-display font-black text-sm tracking-wider" style={{ color: powerUpConfig.color }}>
                    {powerUpConfig.name}
                  </div>
                </div>
                <span className="hidden md:inline-block px-2.5 py-1 rounded-lg bg-cyan-400 text-black font-extrabold text-[11px] font-mono-race shadow-[0_0_10px_rgba(0,240,255,0.6)]">
                  [SPACE]
                </span>
              </button>
            ) : Boolean(state.turboTimer && state.turboTimer > 0) || state.gripBoostTimer > 0 || state.hasShield || Boolean(state.draftStreamTimer && state.draftStreamTimer > 0) || state.empSlowTimer > 0 ? (
              <div className="glass-panel-glow px-4 py-2.5 rounded-xl border border-cyan-400/50 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-xs font-mono-race text-cyan-300 font-bold">
                  {Boolean(state.turboTimer && state.turboTimer > 0) && `⚡ KINETIC TURBO (${((state.turboTimer || 0) / 1000).toFixed(1)}s)`}
                  {state.hasShield && `🛡️ SHIELD ACTIVE ${state.shieldTimer ? `(${((state.shieldTimer || 0) / 1000).toFixed(1)}s)` : ''}`}
                  {state.gripBoostTimer > 0 && `🏎️ AERO GRIP (${(state.gripBoostTimer / 1000).toFixed(1)}s)`}
                  {Boolean(state.draftStreamTimer && state.draftStreamTimer > 0) && `💨 DRAFT STREAM (${((state.draftStreamTimer || 0) / 1000).toFixed(1)}s)`}
                  {state.empSlowTimer > 0 && `⚡ EMP SLOW (${(state.empSlowTimer / 1000).toFixed(1)}s)`}
                </span>
              </div>
            ) : (
              <div className="glass-panel px-4 py-2 rounded-xl border border-white/10 text-gray-500 text-xs font-mono-race flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-gray-400">POWER-UP // EMPTY</span>
                <span className="text-[10px] text-gray-600 hidden sm:inline">• DRIVE THROUGH CUBES</span>
              </div>
            )}
          </div>

          {/* Boost / KERS Gauge */}
          <div className="glass-panel px-4 py-2.5 rounded-xl border border-white/15 w-68 shadow-xl">
            <div className="flex items-center justify-between text-[10px] font-mono-race text-gray-400 mb-1">
              <span className="flex items-center gap-1 font-bold">
                <Zap className={`w-3.5 h-3.5 ${state.isBoosting ? 'text-amber-400 animate-pulse' : 'text-cyan-400'}`} />
                {state.isBoosting ? (
                  <span className="text-amber-400">BOOST ACTIVE ({(state.boostGauge / 35.0).toFixed(1)}s)</span>
                ) : state.boostGauge >= 90 ? (
                  <span className="text-emerald-400">BOOST READY</span>
                ) : state.boostGauge < 20 ? (
                  <span className="text-rose-400">LOW CHARGE (&lt;20%)</span>
                ) : (
                  <span className="text-cyan-300">BOOST RECHARGING</span>
                )}
              </span>
              <span className={`font-bold ${state.isBoosting ? 'text-amber-400' : state.boostGauge >= 20 ? 'text-cyan-400' : 'text-rose-400'}`}>
                {Math.round(state.boostGauge)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  state.isBoosting
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-pulse'
                    : state.boostGauge >= 20
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-[0_0_10px_rgba(0,240,255,0.8)]'
                    : 'bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                }`}
                style={{ width: `${state.boostGauge}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Digital Speedometer & Tachometer */}
        <div className="glass-panel px-6 py-4 rounded-2xl border border-white/15 shadow-2xl flex flex-col items-center">
          {/* Shift lights LEDs */}
          <div className="flex items-center gap-1 mb-1.5">
            {Array.from({ length: 9 }).map((_, i) => {
              const active = speedKmh > i * 32;
              let col = 'bg-emerald-400';
              if (i >= 5) col = 'bg-yellow-400';
              if (i >= 7) col = 'bg-red-500';
              return (
                <div
                  key={i}
                  className={`w-2.5 h-1.5 rounded-xs transition-colors duration-75 ${
                    active ? `${col} shadow-[0_0_6px_currentColor]` : 'bg-gray-800'
                  }`}
                />
              );
            })}
          </div>

          <div className="flex items-baseline gap-1">
            <span className="font-display text-4xl md:text-5xl font-black text-white font-mono-race tracking-tight">
              {speedKmh}
            </span>
            <span className="text-xs font-bold text-cyan-400 font-racing">KM/H</span>
          </div>

          {/* Gear & RPM Telemetry */}
          <div className="flex items-center gap-2 mt-1 text-xs font-mono-race">
            <span className="px-2 py-0.5 rounded bg-white/10 font-bold text-white border border-white/15">
              {state.currentGear === 0 ? 'R' : `GEAR ${state.currentGear}`}
            </span>
            <span className="text-gray-300 font-bold">
              {state.engineRpm} <span className="text-[10px] text-gray-400">RPM</span>
            </span>
          </div>

          {state.isDrifting && (
            <div className="text-[10px] font-mono-race text-pink-400 tracking-widest animate-pulse font-bold mt-1">
              DRIFT // SLIP
            </div>
          )}
          {state.isOffTrack && (
            <div className="text-[10px] font-mono-race text-amber-400 tracking-widest font-bold mt-1">
              OFF TRACK
            </div>
          )}
        </div>
      </div>

      {/* Mobile Touch Controls Layer */}
      <div className="pointer-events-auto sm:hidden fixed bottom-4 left-3 right-3 flex items-center justify-between z-30">
        {/* Left: Steer Buttons */}
        <div className="flex items-center gap-2">
          <button
            onTouchStart={() => setTouchInput((prev) => ({ ...prev, steer: -1 }))}
            onTouchEnd={() => setTouchInput((prev) => ({ ...prev, steer: 0 }))}
            onMouseDown={() => setTouchInput((prev) => ({ ...prev, steer: -1 }))}
            onMouseUp={() => setTouchInput((prev) => ({ ...prev, steer: 0 }))}
            className="w-16 h-16 rounded-2xl glass-panel border-2 border-white/20 active:bg-cyan-500/30 font-display text-xl text-white flex items-center justify-center active:scale-95 shadow-2xl"
          >
            ◀
          </button>
          <button
            onTouchStart={() => setTouchInput((prev) => ({ ...prev, steer: 1 }))}
            onTouchEnd={() => setTouchInput((prev) => ({ ...prev, steer: 0 }))}
            onMouseDown={() => setTouchInput((prev) => ({ ...prev, steer: 1 }))}
            onMouseUp={() => setTouchInput((prev) => ({ ...prev, steer: 0 }))}
            className="w-16 h-16 rounded-2xl glass-panel border-2 border-white/20 active:bg-cyan-500/30 font-display text-xl text-white flex items-center justify-center active:scale-95 shadow-2xl"
          >
            ▶
          </button>
        </div>

        {/* Center: Mobile Power-up button if active */}
        {powerUpConfig && (
          <button
            onClick={onUsePowerUp}
            className="w-14 h-14 rounded-2xl glass-panel-glow border-2 flex items-center justify-center active:scale-95 shadow-2xl animate-pulse"
            style={{ borderColor: powerUpConfig.color, backgroundColor: `${powerUpConfig.color}25` }}
          >
            {state.activePowerUp === 'TURBO' && <Zap className="w-6 h-6 text-cyan-400" />}
            {state.activePowerUp === 'SHIELD' && <Shield className="w-6 h-6 text-emerald-400" />}
            {state.activePowerUp === 'GRIP_BOOST' && <Gauge className="w-6 h-6 text-pink-400" />}
            {state.activePowerUp === 'EMP' && <Radio className="w-6 h-6 text-yellow-400" />}
            {state.activePowerUp === 'SLIPSTREAM' && <Wind className="w-6 h-6 text-purple-400" />}
          </button>
        )}

        {/* Right: Throttle, Brake, Boost */}
        <div className="flex items-center gap-2">
          <button
            onTouchStart={() => setTouchInput((prev) => ({ ...prev, brake: 1 }))}
            onTouchEnd={() => setTouchInput((prev) => ({ ...prev, brake: 0 }))}
            onMouseDown={() => setTouchInput((prev) => ({ ...prev, brake: 1 }))}
            onMouseUp={() => setTouchInput((prev) => ({ ...prev, brake: 0 }))}
            className="w-13 h-16 rounded-2xl glass-panel border-2 border-red-500/40 text-red-400 font-display text-xs active:bg-red-500/30 flex items-center justify-center active:scale-95"
          >
            BRAKE
          </button>
          <button
            onTouchStart={() => setTouchInput((prev) => ({ ...prev, boost: true }))}
            onTouchEnd={() => setTouchInput((prev) => ({ ...prev, boost: false }))}
            onMouseDown={() => setTouchInput((prev) => ({ ...prev, boost: true }))}
            onMouseUp={() => setTouchInput((prev) => ({ ...prev, boost: false }))}
            className="w-13 h-16 rounded-2xl glass-panel border-2 border-cyan-500/40 text-cyan-400 font-display text-xs active:bg-cyan-500/30 flex items-center justify-center active:scale-95"
          >
            NITRO
          </button>
          <button
            onTouchStart={() => setTouchInput((prev) => ({ ...prev, throttle: 1 }))}
            onTouchEnd={() => setTouchInput((prev) => ({ ...prev, throttle: 0 }))}
            onMouseDown={() => setTouchInput((prev) => ({ ...prev, throttle: 1 }))}
            onMouseUp={() => setTouchInput((prev) => ({ ...prev, throttle: 0 }))}
            className="w-15 h-16 rounded-2xl glass-panel border-2 border-green-500/40 text-green-400 font-display text-base active:bg-green-500/30 flex items-center justify-center active:scale-95 font-bold"
          >
            GAS
          </button>
        </div>
      </div>

      {/* PAUSE / RACE MENU OVERLAY */}
      {showMenu && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto animate-fadeIn">
          <div className="glass-panel-glow max-w-md w-full p-6 md:p-8 rounded-3xl border border-cyan-500/40 shadow-2xl text-center relative space-y-6">
            <button
              onClick={() => setShowMenu(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-xs font-mono-race text-cyan-400 tracking-widest uppercase">CIRCUIT TELEMETRY</div>
              <h2 className="font-display text-3xl font-black text-white tracking-wider mt-1">
                PAUSE // MENU
              </h2>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => setShowMenu(false)}
                className="w-full py-3.5 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-display font-black text-sm tracking-widest transition shadow-lg shadow-cyan-500/25 active:scale-98 cursor-pointer"
              >
                RESUME RACE
              </button>

              <button
                onClick={() => setShowControlsModal(true)}
                className="w-full py-3 px-6 rounded-xl glass-panel hover:bg-white/10 text-white font-mono-race text-xs tracking-wider border border-white/15 transition cursor-pointer"
              >
                CONTROLS & SHORTCUTS
              </button>

              <button
                onClick={onToggleMute}
                className="w-full py-3 px-6 rounded-xl glass-panel hover:bg-white/10 text-white font-mono-race text-xs tracking-wider border border-white/15 transition cursor-pointer flex items-center justify-center gap-2"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                <span>{isMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO'}</span>
              </button>

              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={() => setShowQuitConfirm(true)}
                  className="w-full py-3 px-6 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 font-display font-bold text-xs tracking-widest transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>QUIT RACE</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUIT RACE CONFIRMATION DIALOG */}
      {showQuitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto animate-fadeIn">
          <div className="glass-panel-glow max-w-sm w-full p-6 md:p-8 rounded-3xl border border-rose-500/50 shadow-2xl text-center space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-display text-xl font-black text-white tracking-wider">
                QUIT THIS RACE?
              </h3>
              <p className="text-xs font-mono-race text-gray-400 mt-2 leading-relaxed">
                You will voluntarily leave the current race session and be marked as <span className="text-rose-400 font-bold">DNF (QUIT)</span>. Other racers will continue.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowQuitConfirm(false)}
                className="py-3 px-4 rounded-xl glass-panel hover:bg-white/10 text-gray-300 hover:text-white font-mono-race text-xs tracking-wider border border-white/15 transition cursor-pointer"
              >
                CANCEL
              </button>

              <button
                onClick={() => {
                  setShowQuitConfirm(false);
                  setShowMenu(false);
                  onQuitRace();
                }}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-black text-xs tracking-wider transition shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                CONFIRM QUIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLS BRIEFING MODAL IN MENU */}
      {showControlsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto animate-fadeIn">
          <div className="glass-panel-glow max-w-lg w-full p-6 md:p-8 rounded-3xl border border-cyan-500/40 shadow-2xl text-left space-y-5 relative">
            <button
              onClick={() => setShowControlsModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-xs font-mono-race text-cyan-400 tracking-widest uppercase">GRID // 15</div>
              <h3 className="font-display text-2xl font-black text-white tracking-wider mt-1">
                RACE CONTROLS
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono-race">
              <div className="p-3 rounded-xl glass-panel border border-white/10">
                <span className="text-cyan-400 font-bold">ACCELERATE</span>
                <p className="text-gray-300 mt-0.5">W / Arrow Up</p>
              </div>
              <div className="p-3 rounded-xl glass-panel border border-white/10">
                <span className="text-rose-400 font-bold">BRAKE / REVERSE</span>
                <p className="text-gray-300 mt-0.5">S / Arrow Down</p>
              </div>
              <div className="p-3 rounded-xl glass-panel border border-white/10">
                <span className="text-emerald-400 font-bold">STEERING</span>
                <p className="text-gray-300 mt-0.5">A / D / Left / Right</p>
              </div>
              <div className="p-3 rounded-xl glass-panel border border-white/10">
                <span className="text-amber-400 font-bold">NITRO BOOST</span>
                <p className="text-gray-300 mt-0.5">Shift / Space</p>
              </div>
              <div className="p-3 rounded-xl glass-panel border border-white/10">
                <span className="text-purple-400 font-bold">USE POWER-UP</span>
                <p className="text-gray-300 mt-0.5">Spacebar</p>
              </div>
              <div className="p-3 rounded-xl glass-panel border border-white/10">
                <span className="text-cyan-300 font-bold">RESPAWN CAR</span>
                <p className="text-gray-300 mt-0.5">R Key</p>
              </div>
            </div>

            <button
              onClick={() => setShowControlsModal(false)}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-display font-black text-xs tracking-widest transition cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
