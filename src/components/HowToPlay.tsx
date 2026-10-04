import React from 'react';
import { soundEngine } from '../game/audio';
import { POWER_UPS } from '../config/powerups';
import { X, Gamepad2, Wind, Shield, Zap, Radio, Gauge, Compass } from 'lucide-react';

interface HowToPlayProps {
  onClose: () => void;
}

export const HowToPlay: React.FC<HowToPlayProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel-glow border border-cyan-500/30 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-cyan-400" />
            <h2 className="font-display font-black text-xl text-white tracking-wider">
              PILOT MANUAL <span className="text-cyan-400">//</span> HOW TO PLAY
            </h2>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="p-2 rounded-lg glass-panel hover:bg-white/15 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-300">
          {/* Controls Section */}
          <div>
            <h3 className="font-display font-bold text-base text-cyan-400 mb-3 flex items-center gap-2">
              <Compass className="w-4 h-4" /> RACE CONTROLS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="glass-panel p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
                <span className="text-gray-300">Throttle (Gas)</span>
                <span className="font-mono-race px-2.5 py-1 rounded bg-white/10 text-white font-bold border border-white/20">
                  W / ↑ / GAS
                </span>
              </div>
              <div className="glass-panel p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
                <span className="text-gray-300">Brakes / Reverse</span>
                <span className="font-mono-race px-2.5 py-1 rounded bg-white/10 text-white font-bold border border-white/20">
                  S / ↓ / BRAKE
                </span>
              </div>
              <div className="glass-panel p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
                <span className="text-gray-300">Steering</span>
                <span className="font-mono-race px-2.5 py-1 rounded bg-white/10 text-white font-bold border border-white/20">
                  A / D or ← / →
                </span>
              </div>
              <div className="glass-panel p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
                <span className="text-gray-300">Kinetic Boost</span>
                <span className="font-mono-race px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-400/40">
                  SPACE / NITRO
                </span>
              </div>
              <div className="glass-panel p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
                <span className="text-gray-300">Trigger Power-up</span>
                <span className="font-mono-race px-2.5 py-1 rounded bg-pink-500/20 text-pink-400 font-bold border border-pink-400/40">
                  E KEY
                </span>
              </div>
              <div className="glass-panel p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
                <span className="text-gray-300">Respawn on Track</span>
                <span className="font-mono-race px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-400/40">
                  R KEY
                </span>
              </div>
            </div>
          </div>

          {/* Aerodynamics & Physics */}
          <div>
            <h3 className="font-display font-bold text-base text-cyan-400 mb-2 flex items-center gap-2">
              <Wind className="w-4 h-4" /> DRIVING DYNAMICS
            </h3>
            <ul className="space-y-2 list-disc list-inside text-gray-300 text-xs md:text-sm">
              <li>
                <strong className="text-white">Ground Effect Downforce:</strong> Open-wheel downforce increases grip quadratically with speed. Attack high-speed sweepers with confidence!
              </li>
              <li>
                <strong className="text-white">Slipstream Drafting:</strong> Drive directly behind an opponent to enter their low-drag wake, generating explosive overtaking speed.
              </li>
              <li>
                <strong className="text-white">Controlled Slide:</strong> Hard steering at high speeds breaks lateral tire adhesion into a manageable drift. Counter-steer to catch the slide.
              </li>
              <li>
                <strong className="text-white">Tarmac vs Runoff:</strong> Going off track into gravel/sand increases drag and penalizes speed. Stay between the kerbs!
              </li>
            </ul>
          </div>

          {/* Power-ups Matrix */}
          <div>
            <h3 className="font-display font-bold text-base text-cyan-400 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" /> POWER-UP ARSENAL
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.values(POWER_UPS).map((p) => (
                <div
                  key={p.type}
                  className="glass-panel p-3 rounded-xl border flex items-start gap-3"
                  style={{ borderColor: `${p.color}40` }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shrink-0 mt-0.5"
                    style={{ backgroundColor: `${p.color}30`, border: `1px solid ${p.color}` }}
                  >
                    {p.type === 'TURBO' && <Zap className="w-4 h-4 text-cyan-400" />}
                    {p.type === 'SHIELD' && <Shield className="w-4 h-4 text-emerald-400" />}
                    {p.type === 'GRIP_BOOST' && <Gauge className="w-4 h-4 text-pink-400" />}
                    {p.type === 'EMP' && <Radio className="w-4 h-4 text-yellow-400" />}
                    {p.type === 'SLIPSTREAM' && <Wind className="w-4 h-4 text-purple-400" />}
                  </div>
                  <div>
                    <div className="font-display font-bold text-xs" style={{ color: p.color }}>
                      {p.name}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{p.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 text-right bg-black/40">
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-display font-bold text-xs tracking-wider transition cursor-pointer active:scale-95"
          >
            UNDERSTOOD // RETURN
          </button>
        </div>
      </div>
    </div>
  );
};
