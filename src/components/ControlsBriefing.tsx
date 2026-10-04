import React, { useEffect, useState } from 'react';
import { Zap, Play, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import { soundEngine } from '../game/audio';

interface ControlsBriefingProps {
  onDismiss: () => void;
  isRematch?: boolean;
}

export const ControlsBriefing: React.FC<ControlsBriefingProps> = ({ onDismiss, isRematch = false }) => {
  const totalDuration = isRematch ? 1.8 : 3.5;
  const [timeLeft, setTimeLeft] = useState(totalDuration);

  useEffect(() => {
    soundEngine.playCountdownBeep(false);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return Math.max(0, prev - 0.1);
      });
    }, 100);

    const handleKey = (e: KeyboardEvent) => {
      if (['Space', 'Enter', 'KeyW', 'ArrowUp'].includes(e.code)) {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onDismiss, totalDuration]);

  const progressPct = ((totalDuration - timeLeft) / totalDuration) * 100;

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none cursor-pointer animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-2xl w-full bg-[#0d121d] border-2 border-cyan-400/80 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(0,240,255,0.3)] relative overflow-hidden"
      >
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-6">
          <div>
            <div className="text-xs font-mono tracking-widest text-cyan-400 uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              GRID//15 • PRE-RACE BRIEFING
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-black tracking-wider text-white mt-1">
              DRIVER CONTROLS
            </h2>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono text-gray-400">RACE STARTS IN</span>
            <div className="font-mono text-xl font-bold text-cyan-400">{timeLeft.toFixed(1)}s</div>
          </div>
        </div>

        {/* Controls Layout Cards (Desktop & Mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
          
          {/* DESKTOP CONTROLS */}
          <div className="bg-black/50 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
            <div className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>⌨️ DESKTOP KEYBOARD</span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl">
                <span className="text-gray-300">STEER LEFT / RIGHT</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 rounded bg-black/80 border border-cyan-400/50 text-cyan-300 font-bold">A</kbd>
                  <kbd className="px-2 py-1 rounded bg-black/80 border border-cyan-400/50 text-cyan-300 font-bold">D</kbd>
                  <span className="text-gray-500 self-center">or</span>
                  <kbd className="px-2 py-1 rounded bg-black/80 border border-white/20 text-white font-bold">←</kbd>
                  <kbd className="px-2 py-1 rounded bg-black/80 border border-white/20 text-white font-bold">→</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl">
                <span className="text-gray-300">ACCELERATE (GAS)</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 rounded bg-black/80 border border-emerald-400/50 text-emerald-300 font-bold">W</kbd>
                  <span className="text-gray-500 self-center">or</span>
                  <kbd className="px-2 py-1 rounded bg-black/80 border border-white/20 text-white font-bold">↑</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl">
                <span className="text-gray-300">BRAKE / REVERSE</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 rounded bg-black/80 border border-red-400/50 text-red-300 font-bold">S</kbd>
                  <span className="text-gray-500 self-center">or</span>
                  <kbd className="px-2 py-1 rounded bg-black/80 border border-white/20 text-white font-bold">↓</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between bg-cyan-950/40 border border-cyan-400/40 px-3 py-2 rounded-xl">
                <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" /> USE POWER-UP
                </span>
                <kbd className="px-3 py-1 rounded bg-cyan-400 text-black font-extrabold shadow-[0_0_10px_rgba(0,240,255,0.6)]">
                  SPACE
                </kbd>
              </div>
            </div>
          </div>

          {/* MOBILE TOUCH CONTROLS */}
          <div className="bg-black/50 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
            <div className="text-xs font-mono font-bold text-pink-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>📱 MOBILE ON-SCREEN BUTTONS</span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl">
                <span className="text-gray-300">STEERING BUTTONS</span>
                <div className="flex gap-1">
                  <span className="px-2.5 py-1 rounded-lg bg-black/80 border border-cyan-400 text-cyan-300 font-bold">◀ LEFT</span>
                  <span className="px-2.5 py-1 rounded-lg bg-black/80 border border-cyan-400 text-cyan-300 font-bold">RIGHT ▶</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl">
                <span className="text-gray-300">THROTTLE & BRAKE</span>
                <div className="flex gap-1">
                  <span className="px-2 py-1 rounded-lg bg-red-950 border border-red-500 text-red-300 font-bold">BRAKE</span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-400 text-emerald-300 font-bold">GAS</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-purple-950/40 border border-purple-400/40 px-3 py-2 rounded-xl">
                <span className="text-purple-300 font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-purple-400" /> POWER-UP BUTTON
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-500 text-white font-bold shadow-[0_0_10px_rgba(168,85,247,0.6)]">
                  ⚡ TAP ICON
                </span>
              </div>

              <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl text-gray-400 text-[11px]">
                <span>RESPAWN ON TRACK</span>
                <span className="font-mono text-gray-300">PRESS [R] / TAP ↺</span>
              </div>
            </div>
          </div>

        </div>

        {/* Progress bar countdown */}
        <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden my-4 border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(0,240,255,0.8)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            soundEngine.playClick();
            onDismiss();
          }}
          className="w-full py-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black font-display font-black text-sm tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,240,255,0.6)] active:scale-98"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>I'M READY // START RACE (SPACE / ENTER)</span>
        </button>
      </div>
    </div>
  );
};
