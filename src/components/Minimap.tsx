import React, { useRef, useEffect } from 'react';
import { TrackData, Player, PowerUpBox } from '../types/game';

interface MinimapProps {
  trackData: TrackData;
  players: Player[];
  localPlayerId: string;
  powerUps: PowerUpBox[];
}

export const Minimap: React.FC<MinimapProps> = ({ trackData, players, localPlayerId, powerUps }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Compute bounding box of track points
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of trackData.trackPoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    const padding = 28;
    const rangeX = (maxX - minX) || 1;
    const rangeZ = (maxZ - minZ) || 1;
    const scale = Math.min((width - padding * 2) / rangeX, (height - padding * 2) / rangeZ);

    const offsetX = padding + (width - padding * 2 - rangeX * scale) / 2;
    const offsetY = padding + (height - padding * 2 - rangeZ * scale) / 2;

    const transformX = (x: number) => offsetX + (x - minX) * scale;
    const transformY = (z: number) => offsetY + (z - minZ) * scale;

    // Draw track background outline
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Track outer glow border
    ctx.beginPath();
    trackData.trackPoints.forEach((p, idx) => {
      const tx = transformX(p.x);
      const ty = transformY(p.z);
      if (idx === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 14;
    ctx.stroke();

    // Track road surface
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 9;
    ctx.stroke();

    // Centerline dashed guide
    ctx.beginPath();
    trackData.trackPoints.forEach((p, idx) => {
      const tx = transformX(p.x);
      const ty = transformY(p.z);
      if (idx === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    });
    ctx.closePath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // Start/Finish line mark
    if (trackData.trackPoints.length > 0) {
      const s0 = trackData.trackPoints[0];
      const sx = transformX(s0.x);
      const sy = transformY(s0.z);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Power-up boxes
    for (const box of powerUps) {
      if (box.active) {
        const bx = transformX(box.x);
        const by = transformY(box.z);
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Opponent players (render first so local player is always on top)
    for (const p of players) {
      if (p.id === localPlayerId) continue;
      const px = transformX(p.state.x);
      const py = transformY(p.state.z);

      ctx.fillStyle = p.carConfig.primaryColor || '#94a3b8';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Local player (highlighted with pulsing neon border and heading arrow)
    const localPlayer = players.find((p) => p.id === localPlayerId);
    if (localPlayer) {
      const lx = transformX(localPlayer.state.x);
      const ly = transformY(localPlayer.state.z);

      // Heading arrow
      const angle = localPlayer.state.rotationY;
      const forwardX = Math.sin(angle) * 9;
      const forwardY = Math.cos(angle) * 9;

      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + forwardX, ly + forwardY);
      ctx.stroke();

      // Local player dot
      ctx.fillStyle = '#39ff14';
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(lx, ly, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [trackData, players, localPlayerId, powerUps]);

  return (
    <div className="relative glass-panel rounded-xl p-2 border border-cyan-500/20 shadow-2xl">
      <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-white/10">
        <span className="text-[10px] font-bold tracking-widest text-cyan-400 font-display">CIRCUIT RADAR</span>
        <span className="text-[10px] text-gray-400 font-mono-race">{trackData.name}</span>
      </div>
      <canvas ref={canvasRef} width={200} height={200} className="w-[180px] h-[180px] block" />
    </div>
  );
};
