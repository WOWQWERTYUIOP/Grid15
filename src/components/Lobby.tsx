import React, { useState } from 'react';
import { RoomInfo, Player, CarCustomization, RaceConfig } from '../types/game';
import { TRACKS } from '../config/tracks';
import { soundEngine } from '../game/audio';
import { Copy, Check, Crown, Play, Users, Flag, MapPin, Gauge, ShieldCheck, ArrowLeft, Settings, Shield } from 'lucide-react';
import { RaceControlModal } from './RaceControlModal';

interface LobbyProps {
  room: RoomInfo;
  localPlayerId: string;
  onSetReady: (isReady: boolean) => void;
  onSelectTrack: (trackId: string) => void;
  onSetLaps: (laps: number) => void;
  onStartRace: () => void;
  onLeaveRoom: () => void;
  onOpenGarage: () => void;
  onUpdateRaceConfig: (config: RaceConfig) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  room,
  localPlayerId,
  onSetReady,
  onSelectTrack,
  onSetLaps,
  onStartRace,
  onLeaveRoom,
  onOpenGarage,
  onUpdateRaceConfig,
}) => {
  const [copied, setCopied] = useState(false);
  const [showRaceControl, setShowRaceControl] = useState(false);
  const localPlayer = room.players.find((p) => p.id === localPlayerId);
  const isHost = localPlayer?.isHost || false;
  const currentTrack = TRACKS[room.trackId] || TRACKS['harbor-gp'];

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    soundEngine.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const allReadyOrHost = room.players.every((p) => p.isReady || p.isHost);
  const canStart = isHost && room.players.length >= 1;

  return (
    <div className="relative w-full h-screen bg-carbon flex flex-col justify-between p-4 md:p-8 overflow-hidden">
      <div className="scanline-effect" />

      {/* TOP BAR: Room Code & Leave */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              soundEngine.playClick();
              onLeaveRoom();
            }}
            className="glass-panel hover:bg-white/15 px-3 py-2 rounded-xl border border-white/20 text-white flex items-center gap-2 font-mono-race text-xs transition cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>LEAVE ROOM</span>
          </button>

          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black tracking-wider text-white flex items-center gap-2">
              RACE PADDOCK <span className="text-cyan-400">//</span> LOBBY
            </h1>
            <p className="text-xs font-racing text-gray-400">MULTIPLAYER GRAND PRIX GRID (MAX 15 RACERS)</p>
          </div>
        </div>

        {/* Room Code Card with Copy */}
        <div className="flex items-center gap-3">
          <button
            onClick={copyRoomCode}
            className="glass-panel-glow px-5 py-2 rounded-xl border border-cyan-400/60 hover:bg-cyan-500/20 transition flex items-center gap-3 cursor-pointer active:scale-95 shadow-lg"
          >
            <div>
              <div className="text-[10px] font-mono-race text-cyan-300">ROOM CODE</div>
              <div className="font-display text-2xl font-black text-white tracking-widest">{room.code}</div>
            </div>
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            </div>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT: Track Selection & Players List */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 my-4 min-h-0">
        {/* Left: Track Selection & Race Configuration */}
        <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-4 overflow-y-auto">
          {/* Active Track Showcase Card */}
          <div className="glass-panel-glow rounded-2xl p-5 border border-cyan-500/30 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-1 rounded-md bg-cyan-500/20 text-cyan-400 text-xs font-mono-race font-bold border border-cyan-400/40">
                  CIRCUIT // {currentTrack.difficulty.toUpperCase()}
                </span>
                <span className="text-xs font-mono-race text-gray-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" /> {currentTrack.lapLengthMeters}m LAP
                </span>
              </div>

              <h2 className="font-display text-3xl font-black text-white tracking-wider mb-1">{currentTrack.name}</h2>
              <div className="text-xs font-racing text-cyan-300 tracking-wider mb-3">{currentTrack.subtitle}</div>
              <p className="text-xs text-gray-300 mb-4">{currentTrack.description}</p>

              <div className="grid grid-cols-2 gap-3 p-3 bg-black/40 rounded-xl border border-white/10 text-xs font-mono-race">
                <div>
                  <span className="text-gray-400 block text-[10px]">CORNER COUNT</span>
                  <span className="text-white font-bold text-sm">{currentTrack.cornerCount} Turns</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">SETUP ADVICE</span>
                  <span className="text-white font-bold text-sm">{currentTrack.recommendedStyle}</span>
                </div>
              </div>
            </div>

            {/* Track Selector buttons (Host Only) */}
            {isHost && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <label className="block text-xs font-mono-race text-gray-400 mb-2">SELECT CIRCUIT</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(TRACKS).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        soundEngine.playClick();
                        onSelectTrack(t.id);
                      }}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer active:scale-95 ${
                        room.trackId === t.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'glass-panel border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                      }`}
                    >
                      <div className="font-display text-xs font-bold">{t.name}</div>
                      <div className="text-[10px] font-mono-race text-gray-400">{t.difficulty}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lap Count Selector (Host Only) */}
            {isHost && (
              <div className="mt-3">
                <label className="block text-xs font-mono-race text-gray-400 mb-2">RACE DISTANCE (LAPS)</label>
                <div className="flex items-center gap-2">
                  {[1, 3, 5, 10].map((laps) => (
                    <button
                      key={laps}
                      onClick={() => {
                        soundEngine.playClick();
                        onSetLaps(laps);
                      }}
                      className={`flex-1 py-2 rounded-xl border text-xs font-mono-race font-bold transition cursor-pointer active:scale-95 ${
                        room.lapCount === laps
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'glass-panel border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {laps} {laps === 1 ? 'LAP' : 'LAPS'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* COMPACT RACE SETUP SUMMARY CARD */}
          <div className="glass-panel-glow rounded-2xl p-5 border border-cyan-500/20 flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono-race text-cyan-300 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
                RACE CONFIG SUMMARY
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300 font-mono-race text-[9px] font-bold border border-cyan-400/30">
                {(room.raceConfig?.preset || 'STANDARD').toUpperCase()} PRESET
              </span>
            </div>

            <div className="space-y-2 text-[11px] font-mono-race text-gray-300 mb-4 bg-black/40 p-3 rounded-xl border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">TRACK</span>
                <span className="font-bold text-white uppercase">{currentTrack.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">DISTANCE</span>
                <span className="font-bold text-white uppercase">{room.lapCount} LAPS</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">WEAPONS / POWER-UPS</span>
                <span className={`font-bold ${room.raceConfig?.powerUpsEnabled !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {room.raceConfig?.powerUpsEnabled !== false ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">KINETIC BOOST / KERS</span>
                <span className={`font-bold ${room.raceConfig?.boostEnabled !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {room.raceConfig?.boostEnabled !== false ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">VEHICLE COLLISIONS</span>
                <span className={`font-bold ${room.raceConfig?.carCollisionsEnabled !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {room.raceConfig?.carCollisionsEnabled !== false ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                soundEngine.playClick();
                setShowRaceControl(true);
              }}
              className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-display font-black text-xs tracking-wider transition cursor-pointer active:scale-95 text-center shadow-[0_0_15px_rgba(0,240,255,0.3)] uppercase flex items-center justify-center gap-1.5"
            >
              {isHost ? '🔧 OPEN RACE CONTROL' : '👁️ VIEW ACTIVE RACE SETTINGS'}
            </button>
          </div>
        </div>

        {/* Right: Grid Players List (Max 15) */}
        <div className="lg:col-span-6 xl:col-span-7 glass-panel rounded-2xl p-5 border border-white/10 flex flex-col shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <h3 className="font-display font-bold text-lg text-white">
                STARTING GRID ({room.players.length}/15)
              </h3>
            </div>
            <button
              onClick={() => {
                soundEngine.playClick();
                onOpenGarage();
              }}
              className="px-3 py-1.5 rounded-lg glass-panel hover:bg-white/15 text-cyan-300 text-xs font-mono-race border border-cyan-500/40 transition cursor-pointer active:scale-95"
            >
              EDIT CAR IN GARAGE
            </button>
          </div>

          {/* Player Grid Slot Cards */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {room.players.map((player, index) => {
              const isMe = player.id === localPlayerId;
              return (
                <div
                  key={player.id}
                  className={`p-3 rounded-xl border flex items-center justify-between transition ${
                    isMe
                      ? 'glass-panel-glow border-cyan-400 bg-cyan-500/10'
                      : 'glass-panel border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Grid Slot Position */}
                    <div className="w-7 h-7 rounded-lg bg-black/60 border border-white/20 flex items-center justify-center font-mono-race text-xs font-bold text-gray-300">
                      #{index + 1}
                    </div>

                    {/* Livery Color Swatch */}
                    <div
                      className="w-4 h-8 rounded-sm border border-white/30 shadow"
                      style={{
                        background: `linear-gradient(135deg, ${player.carConfig.primaryColor} 50%, ${player.carConfig.secondaryColor} 50%)`,
                      }}
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-sm text-white">
                          {player.name}
                        </span>
                        {player.isHost && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-mono-race border border-amber-400/40">
                            <Crown className="w-3 h-3" /> HOST
                          </span>
                        )}
                        {isMe && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-mono-race border border-cyan-400/40">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono-race text-gray-400">
                        Car #{player.carConfig.carNumber} • {player.carConfig.bodyStyle.replace('_', ' ')}
                      </div>
                    </div>
                  </div>

                  {/* Ready State Badge */}
                  <div>
                    {player.isHost ? (
                      <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-mono-race font-bold border border-amber-400/30">
                        HOST
                      </span>
                    ) : player.isReady ? (
                      <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-mono-race font-bold border border-emerald-400/40 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> READY
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-mono-race font-bold border border-rose-400/40">
                        NOT READY
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FOOTER ACTION BAR */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4">
        <div>
          {!isHost && (
            <button
              onClick={() => {
                soundEngine.playClick();
                onSetReady(!localPlayer?.isReady);
              }}
              className={`px-8 py-3.5 rounded-xl font-display font-black text-sm tracking-widest transition cursor-pointer active:scale-95 shadow-xl flex items-center gap-2 ${
                localPlayer?.isReady
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black'
              }`}
            >
              {localPlayer?.isReady ? 'CANCEL READY' : 'READY TO RACE'}
            </button>
          )}
        </div>

        <div>
          {isHost ? (
            <button
              onClick={() => {
                soundEngine.playCountdownBeep(true);
                onStartRace();
              }}
              disabled={!canStart}
              className={`px-10 py-3.5 rounded-xl font-display font-black text-base tracking-widest transition cursor-pointer active:scale-95 shadow-2xl flex items-center gap-3 ${
                canStart
                  ? 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-[0_0_30px_rgba(0,240,255,0.6)]'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              START GRAND PRIX
            </button>
          ) : (
            <div className="text-xs font-mono-race text-gray-400 animate-pulse">
              WAITING FOR HOST TO COMMENCE RACE...
            </div>
          )}
        </div>
      </div>
      {showRaceControl && (
        <RaceControlModal
          currentConfig={room.raceConfig || {
            trackId: room.trackId,
            lapCount: room.lapCount,
            preset: 'STANDARD',
            powerUpsEnabled: true,
            powerUpFrequency: 'MEDIUM',
            enabledPowerUps: { TURBO: true, SHIELD: true, GRIP_BOOST: true, EMP: true, SLIPSTREAM: true },
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
          }}
          isHost={isHost}
          onApplySettings={onUpdateRaceConfig}
          onClose={() => setShowRaceControl(false)}
        />
      )}
    </div>
  );
};
