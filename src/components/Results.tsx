import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RaceResultEntry, RoomInfo } from '../types/game';
import { formatTimeMs } from '../utils/storage';
import { soundEngine } from '../game/audio';
import { Trophy, RotateCcw, ArrowLeft, Award, Flag, Clock, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

interface ResultsProps {
  results: RaceResultEntry[];
  room: RoomInfo;
  localPlayerId: string;
  onRematch: () => void;
  onReturnToLobby: () => void;
  onLeaveRoom: () => void;
}

export const Results: React.FC<ResultsProps> = ({
  results,
  room,
  localPlayerId,
  onRematch,
  onReturnToLobby,
  onLeaveRoom,
}) => {
  const localPlayer = room?.players?.find((p) => p.id === localPlayerId);
  const isHost = localPlayer?.isHost || room?.hostId === localPlayerId;
  const totalLaps = room?.lapCount || 3;

  // Defensive fallback: build results from room players if results array is empty
  const activeResults: RaceResultEntry[] =
    results && results.length > 0
      ? results
      : (room?.players || []).map((p, idx) => ({
          rank: idx + 1,
          playerId: p.id,
          name: p.name || 'RACER',
          carNumber: p.carConfig?.carNumber || idx + 1,
          carConfig: p.carConfig || {
            driverName: p.name,
            carNumber: idx + 1,
            bodyStyle: 'AERO_APEX',
            primaryColor: '#00f0ff',
            secondaryColor: '#ff2a5f',
            accentColor: '#39ff14',
            wheelStyle: 'FORGED_SPOKE',
            wheelColor: '#ffd700',
            helmetColor: '#ffffff',
          },
          totalTimeMs: p.state?.finished ? p.state.finishTime : null,
          gapMs: 0,
          bestLapMs: p.state?.bestLapTime || null,
          completedLaps: p.state?.lap ? Math.min(totalLaps, p.state.lap - 1 + (p.state.finished ? 1 : 0)) : 0,
          powerUpsUsed: 0,
        }));

  const myResult = activeResults.find((r) => r.playerId === localPlayerId);
  const isWinner = myResult?.rank === 1 && myResult?.totalTimeMs !== null;
  const isDNF = !myResult || myResult.totalTimeMs === null;

  useEffect(() => {
    try {
      soundEngine.playFinishFanfare();
    } catch (e) {
      console.warn('Audio notice:', e);
    }

    // Trigger confetti cannon for podium finish
    try {
      if (myResult && myResult.rank <= 3 && !isDNF) {
        const duration = 3.0 * 1000;
        const animationEnd = Date.now() + duration;
        const interval: number = window.setInterval(() => {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) {
            return clearInterval(interval);
          }
          confetti({
            particleCount: 35,
            startVelocity: 30,
            spread: 360,
            origin: { x: Math.random(), y: Math.random() - 0.2 },
            colors: ['#00f0ff', '#ff2a5f', '#39ff14', '#ffd700', '#ffffff'],
          });
        }, 250);
        return () => clearInterval(interval);
      }
    } catch (e) {
      console.warn('Confetti notice:', e);
    }
  }, [myResult?.rank, isDNF]);

  // Find best overall lap
  let bestOverallLapTime: number | null = null;
  let bestLapHolder: string | null = null;
  for (const r of activeResults) {
    if (r.bestLapMs !== null) {
      if (bestOverallLapTime === null || r.bestLapMs < bestOverallLapTime) {
        bestOverallLapTime = r.bestLapMs;
        bestLapHolder = r.name;
      }
    }
  }

  return (
    <div className="relative w-full h-screen bg-[#07090e] text-white flex flex-col justify-between p-4 md:p-8 overflow-hidden select-none">
      {/* Background Cyber Grid Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,240,255,0.08),transparent_70%)] pointer-events-none" />
      <div className="scanline-effect pointer-events-none" />

      {/* 1. HEADER SECTION */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs tracking-widest uppercase">
            <Flag className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>GRID//15 • OFFICIAL CLASSIFICATION</span>
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-white mt-0.5">
            RACE COMPLETE
          </h1>
        </div>

        {bestOverallLapTime !== null && (
          <div className="hidden sm:flex items-center gap-3 bg-purple-950/40 border border-purple-500/40 px-4 py-2 rounded-xl backdrop-blur-md shadow-lg">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-purple-300 uppercase tracking-wider">Fastest Lap Award</div>
              <div className="font-display font-bold text-sm text-white">
                {bestLapHolder} — <span className="text-purple-400 font-mono">{formatTimeMs(bestOverallLapTime)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. MAIN RESULTS GRID: YOUR RESULT HERO CARD + FULL CLASSIFICATION TABLE */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 my-4 min-h-0 overflow-hidden">
        
        {/* Left Card: YOUR RESULT (Hero Summary) */}
        <div className="lg:col-span-4 bg-[#0d121d]/90 border border-white/10 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="text-xs font-mono tracking-widest text-gray-400 uppercase">DRIVER TELEMETRY</div>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {myResult?.name || 'YOU'} #{myResult?.carNumber || '15'}
              </span>
            </div>

            <div className="text-center my-4">
              <div className="text-xs font-mono text-gray-400 tracking-widest uppercase mb-1">FINISHING POSITION</div>
              <div className="flex items-center justify-center gap-3">
                {isWinner && <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />}
                <div
                  className={`font-display text-6xl md:text-7xl font-black tracking-tight ${
                    isWinner
                      ? 'text-amber-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]'
                      : isDNF
                      ? 'text-rose-400'
                      : myResult?.rank === 2
                      ? 'text-slate-300 drop-shadow-[0_0_20px_rgba(203,213,225,0.4)]'
                      : myResult?.rank === 3
                      ? 'text-amber-600 drop-shadow-[0_0_20px_rgba(217,119,6,0.4)]'
                      : 'text-cyan-400 drop-shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                  }`}
                >
                  {isDNF ? 'DNF' : `P${myResult?.rank || 1}`}
                </div>
              </div>
              <div className="text-xs font-mono text-gray-300 mt-1">
                {isWinner
                  ? '🏆 1ST PLACE VICTORY'
                  : isDNF
                  ? 'DID NOT FINISH'
                  : `OUT OF ${activeResults.length} RACERS`}
              </div>
            </div>

            {/* Performance Stats Cards */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="bg-black/50 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] font-mono text-gray-400 uppercase flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>FINAL TIME</span>
                </div>
                <div className="font-mono text-base font-bold text-white">
                  {isDNF ? 'DNF' : formatTimeMs(myResult?.totalTimeMs)}
                </div>
              </div>

              <div className="bg-black/50 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] font-mono text-gray-400 uppercase flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span>BEST LAP</span>
                </div>
                <div className="font-mono text-base font-bold text-purple-400">
                  {formatTimeMs(myResult?.bestLapMs)}
                </div>
              </div>

              <div className="bg-black/50 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] font-mono text-gray-400 uppercase flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>LAPS COMPLETED</span>
                </div>
                <div className="font-mono text-base font-bold text-emerald-400">
                  {myResult?.completedLaps || 0} / {totalLaps}
                </div>
              </div>

              <div className="bg-black/50 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] font-mono text-gray-400 uppercase flex items-center gap-1.5 mb-1">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>GAP TO LEADER</span>
                </div>
                <div className="font-mono text-base font-bold text-amber-300">
                  {isWinner ? 'WINNER' : isDNF ? '—' : `+${formatTimeMs(myResult?.gapMs)}`}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pt-2 border-t border-white/10">
            <span className="text-[11px] font-mono text-gray-400">
              TRACK: <strong className="text-white">{room?.trackId?.toUpperCase() || 'HARBOR GP'}</strong>
            </span>
          </div>
        </div>

        {/* Right Card: FULL RACE RESULTS TABLE */}
        <div className="lg:col-span-8 bg-[#0d121d]/90 border border-white/10 rounded-2xl p-6 flex flex-col justify-between backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <h2 className="font-display text-lg font-bold text-white tracking-wider flex items-center gap-2">
              <span>RACE RESULTS</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-gray-300">
                {activeResults.length} DRIVERS
              </span>
            </h2>
            <span className="text-xs font-mono text-gray-400 hidden sm:inline">POSITION | DRIVER | TIME | BEST LAP</span>
          </div>

          {/* Scrollable Leaderboard List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 custom-scrollbar min-h-0">
            {activeResults.map((entry) => {
              const isMe = entry.playerId === localPlayerId;
              const hasFinished = entry.totalTimeMs !== null;
              const isFastest = entry.bestLapMs === bestOverallLapTime && bestOverallLapTime !== null;

              return (
                <div
                  key={entry.playerId}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    isMe
                      ? 'bg-cyan-950/40 border-cyan-400/80 shadow-[0_0_15px_rgba(0,240,255,0.2)] ring-1 ring-cyan-400/40'
                      : 'bg-black/40 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Position Pill */}
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-display font-black text-sm shrink-0 ${
                        entry.rank === 1 && hasFinished
                          ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.6)]'
                          : entry.rank === 2 && hasFinished
                          ? 'bg-slate-300 text-black'
                          : entry.rank === 3 && hasFinished
                          ? 'bg-amber-700 text-white'
                          : !hasFinished
                          ? 'bg-rose-950/60 border border-rose-500/50 text-rose-400'
                          : 'bg-black/60 border border-white/20 text-white'
                      }`}
                    >
                      {hasFinished ? `P${entry.rank}` : 'DNF'}
                    </div>

                    {/* Livery Swatch */}
                    <div
                      className="w-3.5 h-8 rounded-sm border border-white/30 shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${entry.carConfig?.primaryColor || '#00f0ff'} 50%, ${
                          entry.carConfig?.secondaryColor || '#ff2a5f'
                        } 50%)`,
                      }}
                    />

                    {/* Driver Identity */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-display font-bold text-sm text-white truncate">{entry.name}</span>
                        {isMe && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-400/20 border border-cyan-400 text-cyan-300 text-[10px] font-mono font-bold shrink-0">
                            YOU
                          </span>
                        )}
                        {isFastest && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-500/20 border border-purple-400 text-purple-300 text-[10px] font-mono font-bold shrink-0">
                            PURPLE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-gray-400 truncate">
                        Car #{entry.carNumber} • {entry.completedLaps}/{totalLaps} Laps
                      </div>
                    </div>
                  </div>

                  {/* Timing Stats */}
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-mono font-bold text-sm text-white">
                      {hasFinished
                        ? entry.rank === 1
                          ? formatTimeMs(entry.totalTimeMs)
                          : `+${formatTimeMs(entry.gapMs)}`
                        : <span className="text-rose-400 font-bold">DNF</span>}
                    </div>
                    <div className="text-[11px] font-mono text-purple-400">
                      BEST: {formatTimeMs(entry.bestLapMs)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. FOOTER ACTIONS */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4">
        <button
          onClick={() => {
            soundEngine.playClick();
            onLeaveRoom();
          }}
          className="bg-white/5 hover:bg-white/15 px-5 py-3 rounded-xl border border-white/20 text-white flex items-center gap-2 font-mono text-xs transition cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-400" />
          <span>EXIT TO MAIN MENU</span>
        </button>

        <div className="flex items-center gap-3">
          {isHost ? (
            <>
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onReturnToLobby();
                }}
                className="bg-white/5 hover:bg-white/15 px-6 py-3 rounded-xl border border-cyan-500/40 text-cyan-300 font-display font-bold text-xs tracking-wider transition cursor-pointer active:scale-95"
              >
                RETURN TO PADDOCK
              </button>

              <button
                onClick={() => {
                  soundEngine.playCountdownBeep(true);
                  onRematch();
                }}
                className="px-8 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-display font-black text-sm tracking-wider transition cursor-pointer active:scale-95 shadow-[0_0_25px_rgba(0,240,255,0.6)] flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>REMATCH RACE</span>
              </button>
            </>
          ) : (
            <div className="text-xs font-mono text-gray-400 animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>WAITING FOR HOST TO SELECT REMATCH OR LOBBY...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
