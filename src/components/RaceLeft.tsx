import React from 'react';
import { Flag, ArrowLeft, Home, LogOut } from 'lucide-react';

interface RaceLeftProps {
  onReturnToLobby: () => void;
  onLeaveRoom: () => void;
}

export const RaceLeft: React.FC<RaceLeftProps> = ({ onReturnToLobby, onLeaveRoom }) => {
  return (
    <div className="relative w-full h-full min-h-screen bg-slate-950 flex items-center justify-center p-6 overflow-hidden select-none">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />

      {/* Main glass panel */}
      <div className="relative z-10 w-full max-w-lg glass-panel-glow p-8 rounded-2xl border border-rose-500/30 shadow-2xl text-center space-y-6 animate-fadeIn">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10">
          <Flag className="w-8 h-8" />
        </div>

        <div>
          <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-mono-race text-xs tracking-widest uppercase border border-rose-500/30">
            STATUS: DNF // WITHDRAWN
          </span>
          <h1 className="text-3xl font-display font-black tracking-wider text-white mt-3">
            RACE LEFT
          </h1>
          <p className="text-gray-400 text-sm font-sans mt-2">
            You have voluntarily retired your vehicle from the active session.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2 text-left font-mono-race text-xs">
          <div className="flex justify-between text-gray-400">
            <span>OFFICIAL CLASSIFICATION:</span>
            <span className="text-rose-400 font-bold">DNF (Did Not Finish)</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>GRID RE-ENTRY:</span>
            <span className="text-emerald-400 font-bold">LOBBY / MAIN MENU</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={onReturnToLobby}
            className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-display font-bold text-sm tracking-wider shadow-lg shadow-cyan-500/25 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            RETURN TO LOBBY
          </button>
          <button
            onClick={onLeaveRoom}
            className="px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-gray-300 hover:text-white border border-white/10 font-display font-bold text-sm tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};
