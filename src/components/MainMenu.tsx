import React, { useState } from 'react';
import { CarCustomization } from '../types/game';
import { soundEngine } from '../game/audio';
import { Play, PlusCircle, LogIn, Wrench, HelpCircle, Volume2, VolumeX, Flag, Sparkles } from 'lucide-react';

interface MainMenuProps {
  customization: CarCustomization;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onOpenGarage: () => void;
  onOpenHowToPlay: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isConnecting: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  customization,
  onCreateRoom,
  onJoinRoom,
  onOpenGarage,
  onOpenHowToPlay,
  isMuted,
  onToggleMute,
  isConnecting,
}) => {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length === 6) {
      soundEngine.playClick();
      onJoinRoom(joinCode.trim().toUpperCase());
    }
  };

  return (
    <div className="relative w-full h-screen bg-carbon flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none">
      <div className="scanline-effect" />

      {/* TOP HEADER: Branding & Driver Status */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center font-display font-black text-cyan-400 text-xl shadow-[0_0_15px_rgba(0,240,255,0.4)]">
            15
          </div>
          <div>
            <div className="font-display font-black text-2xl tracking-widest text-white flex items-center gap-2">
              GRID<span className="text-cyan-400">//</span>15
            </div>
            <div className="text-[10px] font-mono-race text-gray-400 tracking-wider">
              FORMULA MULTIPLAYER GRAND PRIX
            </div>
          </div>
        </div>

        {/* Audio Toggle & Pilot Profile Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMute}
            title="Toggle Sound"
            className="glass-panel hover:bg-white/15 p-2.5 rounded-xl border border-white/20 text-gray-300 hover:text-white transition cursor-pointer active:scale-95"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenGarage();
            }}
            className="glass-panel-glow px-4 py-2 rounded-xl border border-cyan-500/30 flex items-center gap-3 hover:bg-cyan-500/10 transition cursor-pointer active:scale-95 shadow-lg"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center font-display font-black text-cyan-400 text-sm">
              #{customization.carNumber}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-[9px] font-mono-race text-gray-400">REGISTERED PILOT</div>
              <div className="font-display font-bold text-xs text-white truncate max-w-[120px]">
                {customization.driverName}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* HERO CENTERPIECE */}
      <div className="relative z-10 max-w-2xl my-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-mono-race font-bold mb-4 animate-neon-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>15-PLAYER REAL-TIME OPEN-WHEEL RACING</span>
        </div>

        <h1 className="font-display text-5xl sm:text-7xl font-black text-white tracking-tight leading-none mb-4">
          HIGH-OCTANE <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-pink-500 drop-shadow-[0_0_30px_rgba(0,240,255,0.4)]">
            OPEN-WHEEL
          </span> <br />
          BATTLE.
        </h1>

        <p className="text-sm md:text-base font-racing text-gray-300 max-w-lg mb-8">
          Engage in pure arcade-simulation racing against up to 15 real pilots. Master ground-effect downforce, slipstream drafting, and dynamic power-up warfare.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <button
            onClick={() => {
              soundEngine.playClick();
              onCreateRoom();
            }}
            disabled={isConnecting}
            className="px-8 py-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black font-display font-black text-base tracking-wider transition cursor-pointer active:scale-95 shadow-[0_0_30px_rgba(0,240,255,0.6)] flex items-center justify-center gap-3"
          >
            <PlusCircle className="w-5 h-5 stroke-[2.5]" />
            CREATE ROOM
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setShowJoinModal(true);
            }}
            disabled={isConnecting}
            className="glass-panel hover:bg-white/15 px-8 py-4 rounded-2xl border border-white/20 text-white font-display font-bold text-base tracking-wider transition cursor-pointer active:scale-95 flex items-center justify-center gap-3 shadow-xl"
          >
            <LogIn className="w-5 h-5 text-cyan-400" />
            JOIN ROOM
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              onOpenGarage();
            }}
            className="glass-panel hover:bg-white/15 p-4 rounded-2xl border border-white/20 text-gray-300 hover:text-white transition cursor-pointer active:scale-95 flex items-center justify-center shadow-xl"
            title="Open Vehicle Garage"
          >
            <Wrench className="w-6 h-6 text-pink-400" />
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-mono-race text-gray-500">
        <div>SERVER TICK: 30 HZ // CLIENT INTERPOLATION READY</div>
        <button
          onClick={() => {
            soundEngine.playClick();
            onOpenHowToPlay();
          }}
          className="flex items-center gap-1.5 text-gray-400 hover:text-cyan-400 transition cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
          <span>HOW TO PLAY & CONTROLS</span>
        </button>
      </div>

      {/* JOIN ROOM MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-glow rounded-2xl border border-cyan-500/40 p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-display font-black text-2xl text-white mb-1">ENTER ROOM CODE</h2>
            <p className="text-xs font-mono-race text-gray-400 mb-5">
              Enter the 6-character alphanumeric code provided by the host.
            </p>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 7X9K2W"
                  className="w-full bg-black/70 border-2 border-cyan-500/50 rounded-xl px-4 py-3 text-center text-3xl font-display font-black tracking-widest text-cyan-300 uppercase focus:border-cyan-400 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setShowJoinModal(false);
                  }}
                  className="flex-1 glass-panel hover:bg-white/10 py-3 rounded-xl border border-white/20 text-gray-300 font-display font-bold text-xs tracking-wider transition cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={joinCode.trim().length !== 6 || isConnecting}
                  className="flex-1 bg-cyan-400 hover:bg-cyan-300 disabled:bg-gray-800 disabled:text-gray-500 text-black py-3 rounded-xl font-display font-black text-xs tracking-wider transition cursor-pointer active:scale-95 shadow-lg"
                >
                  JOIN GRAND PRIX
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
