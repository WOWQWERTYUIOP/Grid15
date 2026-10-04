import React, { useState, useEffect } from 'react';
import { Player, RoomInfo } from '../types/game';
import { net } from '../game/network';
import { ClientPredictionEngine } from '../game/prediction';
import { Activity, X, Wifi, Cpu, Layers } from 'lucide-react';

interface DiagnosticsPanelProps {
  room: RoomInfo | null;
  localPlayer: Player | null;
  fps: number;
  predictionEngine?: ClientPredictionEngine | null;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ room, localPlayer, fps, predictionEngine }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle diagnostics panel with Backquote (~) or F3
      if (e.code === 'Backquote' || e.code === 'F3') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-2 left-2 z-50 px-2 py-1 rounded bg-black/60 hover:bg-black/90 text-[10px] font-mono-race text-cyan-400 border border-cyan-500/30 backdrop-blur-sm cursor-pointer opacity-60 hover:opacity-100 transition"
        title="Toggle Dev Diagnostics (~)"
      >
        DEV // STATS [~]
      </button>
    );
  }

  const speedKmh = localPlayer ? (localPlayer.state.speed * 3.6).toFixed(1) : '0.0';
  const vx = localPlayer ? localPlayer.state.vx.toFixed(2) : '0.00';
  const vz = localPlayer ? localPlayer.state.vz.toFixed(2) : '0.00';
  const rot = localPlayer ? ((localPlayer.state.rotationY * 180) / Math.PI).toFixed(1) : '0.0';

  return (
    <div className="fixed top-14 left-4 z-50 w-80 glass-panel-glow p-3.5 rounded-xl border border-cyan-400/40 text-xs font-mono-race shadow-2xl animate-fadeIn max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
        <span className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-wider">
          <Activity className="w-3.5 h-3.5" /> SYSTEM DIAGNOSTICS
        </span>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 rounded text-gray-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5 text-gray-300">
        <div className="flex justify-between">
          <span className="text-gray-400">FRAME RATE:</span>
          <span className={fps >= 55 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
            {fps} FPS
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">NETWORK RTT / PING:</span>
          <span className="text-cyan-400 font-bold">{net.latency} ms</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">SERVER SIM TICK:</span>
          <span className="text-white">30 Hz (Fixed)</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">WS CONNECTION:</span>
          <span className={net.isConnected ? 'text-emerald-400' : 'text-rose-400'}>
            {net.isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">ROOM CODE:</span>
          <span className="text-amber-300 font-bold">{room?.code || 'N/A'}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">ACTIVE RACERS:</span>
          <span className="text-cyan-300 font-bold">{room?.players.length || 0} / 15</span>
        </div>

        {predictionEngine && (
          <>
            <div className="border-t border-white/10 pt-1.5 mt-1.5 text-[11px] text-cyan-300 font-bold">
              CLIENT PREDICTION & RECONCILIATION
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">PREDICTION MODE:</span>
              <span className={predictionEngine.isRespawning ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                {predictionEngine.isRespawning ? 'RESPAWNING' : 'ACTIVE PREDICTION'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">LOCAL INPUT SEQ:</span>
              <span className="text-white font-bold">#{predictionEngine.sequenceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ACKNOWLEDGED SEQ:</span>
              <span className="text-cyan-400 font-bold">#{predictionEngine.lastAckSequenceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">UNACKNOWLEDGED QUEUE:</span>
              <span className="text-white font-bold">{predictionEngine.pendingInputs.length} inputs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">RECONCILIATION COUNT:</span>
              <span className="text-purple-400 font-bold">{predictionEngine.reconciliationCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">CORRECTION MAGNITUDE:</span>
              <span className={predictionEngine.lastCorrectionMagnitude > 0.5 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                {predictionEngine.lastCorrectionMagnitude.toFixed(3)} m
              </span>
            </div>
          </>
        )}

        {localPlayer && (
          <>
            <div className="border-t border-white/10 pt-1.5 mt-1.5 text-[11px] text-gray-400 font-bold">
              LOCAL VEHICLE TELEMETRY
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">SPEED (KM/H):</span>
              <span className="text-white font-bold">{speedKmh}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">VELOCITY V(x,z):</span>
              <span className="text-white">[{vx}, {vz}]</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">YAW HEADING:</span>
              <span className="text-white">{rot}°</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">CHECKPOINT:</span>
              <span className="text-white font-bold">
                CP {localPlayer.state.checkpointIndex} (Visited: {localPlayer.state.visitedCheckpointsCount})
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">TRACK PROGRESS:</span>
              <span className="text-cyan-400">
                {(localPlayer.state.trackProgress * 100).toFixed(1)}%
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">TRANSMISSION:</span>
              <span className="text-white font-bold">
                GEAR {localPlayer.state.currentGear} // {localPlayer.state.engineRpm} RPM
              </span>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-white/10 pt-1.5 mt-2 text-[10px] text-gray-500 text-center">
        PRESS [~] TO HIDE DIAGNOSTICS
      </div>
    </div>
  );
};
