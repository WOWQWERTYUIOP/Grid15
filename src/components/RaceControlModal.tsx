import React, { useState, useEffect } from 'react';
import { RaceConfig } from '../types/game';
import { TRACKS } from '../config/tracks';
import { PRESETS, DEFAULT_RACE_CONFIG } from '../utils/raceConfig';
import { soundEngine } from '../game/audio';
import { X, Check, Save, Zap, AlertTriangle, Shield, Eye, Flame, Compass, RefreshCw } from 'lucide-react';

interface RaceControlModalProps {
  currentConfig: RaceConfig;
  isHost: boolean;
  onApplySettings: (config: RaceConfig) => void;
  onClose: () => void;
}

export const RaceControlModal: React.FC<RaceControlModalProps> = ({
  currentConfig,
  isHost,
  onApplySettings,
  onClose,
}) => {
  const [config, setConfig] = useState<RaceConfig>({ ...DEFAULT_RACE_CONFIG, ...currentConfig });
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'DRIVING' | 'POWERUPS' | 'BOOST' | 'COLLISIONS' | 'RULES'>('GENERAL');

  // Sync state if server config updates while open
  useEffect(() => {
    setConfig({ ...DEFAULT_RACE_CONFIG, ...currentConfig });
  }, [currentConfig]);

  const handlePresetSelect = (presetType: 'CASUAL' | 'STANDARD' | 'COMPETITIVE') => {
    if (!isHost) return;
    soundEngine.playClick();
    const presetData = PRESETS[presetType];
    setConfig((prev) => ({
      ...prev,
      ...presetData,
      preset: presetType,
    }));
  };

  const updateField = (key: keyof RaceConfig, value: any) => {
    if (!isHost) return;
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      // Check if we mutated away from standard presets
      let isPresetMatched = false;
      for (const [pType, pData] of Object.entries(PRESETS)) {
        let match = true;
        for (const [fKey, fVal] of Object.entries(pData)) {
          if (fKey !== 'preset' && (next as any)[fKey] !== fVal) {
            match = false;
            break;
          }
        }
        if (match) {
          next.preset = pType as any;
          isPresetMatched = true;
          break;
        }
      }
      if (!isPresetMatched) {
        next.preset = 'CUSTOM';
      }
      return next;
    });
  };

  const updatePowerUpToggle = (key: 'TURBO' | 'SHIELD' | 'GRIP_BOOST' | 'EMP' | 'SLIPSTREAM', val: boolean) => {
    if (!isHost) return;
    setConfig((prev) => {
      const nextEnabled = { ...prev.enabledPowerUps, [key]: val };
      return {
        ...prev,
        enabledPowerUps: nextEnabled,
        preset: 'CUSTOM',
      };
    });
  };

  const handleApply = () => {
    if (!isHost) return;
    soundEngine.playClick();
    onApplySettings(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 select-none animate-fadeIn">
      <div className="max-w-4xl w-full h-[90vh] md:h-[80vh] bg-[#0c101b] border-2 border-cyan-400/80 rounded-3xl flex flex-col shadow-[0_0_60px_rgba(0,240,255,0.25)] overflow-hidden">
        
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-white/10 p-5 bg-black/40">
          <div>
            <div className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              GRID//15 • {isHost ? 'HOST RACE CONTROL' : 'RACE CONTROL SPECTATOR VIEW'}
            </div>
            <h2 className="font-display text-xl md:text-2xl font-black tracking-wider text-white mt-0.5">
              RACE RULES & RACE CONFIGURATION
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition cursor-pointer active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Header Strip */}
        <div className="bg-black/20 p-4 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs font-mono text-gray-400">RACE PRESET CONFIG</div>
          <div className="flex gap-2 w-full sm:w-auto">
            {(['CASUAL', 'STANDARD', 'COMPETITIVE'] as const).map((pType) => {
              const active = config.preset === pType;
              return (
                <button
                  key={pType}
                  disabled={!isHost}
                  onClick={() => handlePresetSelect(pType)}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-xl border text-xs font-mono font-bold tracking-wider transition ${
                    active
                      ? 'bg-cyan-400 text-black border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                      : 'bg-white/5 border-white/15 text-gray-400 hover:text-white'
                  } ${!isHost ? 'opacity-80 cursor-default' : 'cursor-pointer active:scale-95'}`}
                >
                  {pType}
                </button>
              );
            })}
            {config.preset === 'CUSTOM' && (
              <span className="px-4 py-1.5 rounded-xl border border-pink-500/50 bg-pink-500/10 text-pink-400 text-xs font-mono font-bold">
                CUSTOM
              </span>
            )}
          </div>
        </div>

        {/* Tab content wrapper */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Vertical Menu Tabs */}
          <div className="w-24 sm:w-48 bg-black/30 border-r border-white/5 flex flex-col">
            {([
              { id: 'GENERAL', label: 'GENERAL', icon: Compass },
              { id: 'DRIVING', label: 'DRIVING', icon: Flame },
              { id: 'POWERUPS', label: 'POWER-UPS', icon: Zap },
              { id: 'BOOST', label: 'BOOST/KERS', icon: Flame },
              { id: 'COLLISIONS', label: 'COLLISIONS', icon: AlertTriangle },
              { id: 'RULES', label: 'RULES', icon: Shield },
            ] as const).map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    soundEngine.playClick();
                    setActiveTab(tab.id);
                  }}
                  className={`w-full p-4 flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left border-b border-white/5 transition font-mono ${
                    active
                      ? 'bg-cyan-500/10 text-cyan-300 border-l-4 border-l-cyan-400 font-bold'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-cyan-400' : 'text-gray-500'}`} />
                  <span className="text-[10px] sm:text-xs tracking-wider">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Form Controls Content Section */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            
            {/* GENERAL CONTROLS */}
            {activeTab === 'GENERAL' && (
              <div className="space-y-5">
                <h3 className="text-white font-display font-bold text-sm tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-cyan-400" /> GENERAL RACE RULES
                </h3>

                {/* Track Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-gray-400">GRAND PRIX CIRCUIT</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {Object.values(TRACKS).map((t) => {
                      const selected = config.trackId === t.id;
                      return (
                        <button
                          key={t.id}
                          disabled={!isHost}
                          onClick={() => updateField('trackId', t.id)}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                            selected
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                              : 'bg-white/5 border-white/10 text-gray-400'
                          } ${!isHost ? 'opacity-80 cursor-default' : 'cursor-pointer active:scale-95'}`}
                        >
                          <div>
                            <div className="font-bold text-xs text-white">{t.name}</div>
                            <div className="text-[10px] font-mono text-gray-400 uppercase mt-0.5">{t.difficulty} DIFFICULTY</div>
                          </div>
                          <div className="text-[10px] font-mono text-cyan-300/80 mt-2">{t.lapLengthMeters}m LAP</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lap Stepper */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white">RACE LAPS</div>
                    <p className="text-[10px] font-mono text-gray-400">Total distance before finish flag.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      disabled={!isHost || config.lapCount <= 1}
                      onClick={() => updateField('lapCount', config.lapCount - 1)}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold flex items-center justify-center cursor-pointer active:scale-90 disabled:opacity-50"
                    >
                      -
                    </button>
                    <span className="font-display font-black text-white text-sm w-12 text-center">{config.lapCount} LAPS</span>
                    <button
                      disabled={!isHost || config.lapCount >= 20}
                      onClick={() => updateField('lapCount', config.lapCount + 1)}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold flex items-center justify-center cursor-pointer active:scale-90 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* DRIVING PHYSICS & ASSISTS */}
            {activeTab === 'DRIVING' && (
              <div className="space-y-5">
                <h3 className="text-white font-display font-bold text-sm tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-cyan-400" /> DRIVING PHYSICS & CORE CONTROLS
                </h3>

                {/* Steering Assist */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white uppercase">STEERING ASSIST</div>
                    <p className="text-[10px] font-mono text-gray-400">Stabilizes vehicle yaw alignment inside high speed corners.</p>
                  </div>
                  <button
                    disabled={!isHost}
                    onClick={() => updateField('steeringAssist', !config.steeringAssist)}
                    className={`px-4 py-1.5 rounded-lg border font-mono text-xs font-bold transition ${
                      config.steeringAssist
                        ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                  >
                    {config.steeringAssist ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Traction Assist */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white uppercase">TRACTION ASSIST</div>
                    <p className="text-[10px] font-mono text-gray-400">Helps prevent excessive tire slippage during aggressive cornering.</p>
                  </div>
                  <button
                    disabled={!isHost}
                    onClick={() => updateField('tractionAssist', !config.tractionAssist)}
                    className={`px-4 py-1.5 rounded-lg border font-mono text-xs font-bold transition ${
                      config.tractionAssist
                        ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                  >
                    {config.tractionAssist ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Stability Control */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white uppercase">STABILITY CONTROL</div>
                    <p className="text-[10px] font-mono text-gray-400">Applies automatic yaw counter-steer forces during drift slides.</p>
                  </div>
                  <button
                    disabled={!isHost}
                    onClick={() => updateField('stabilityAssist', !config.stabilityAssist)}
                    className={`px-4 py-1.5 rounded-lg border font-mono text-xs font-bold transition ${
                      config.stabilityAssist
                        ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                  >
                    {config.stabilityAssist ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Brake Assist */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white uppercase">BRAKE ASSIST</div>
                    <p className="text-[10px] font-mono text-gray-400">Improves rear-axle stability during high velocity threshold braking.</p>
                  </div>
                  <button
                    disabled={!isHost}
                    onClick={() => updateField('brakeAssist', !config.brakeAssist)}
                    className={`px-4 py-1.5 rounded-lg border font-mono text-xs font-bold transition ${
                      config.brakeAssist
                        ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                  >
                    {config.brakeAssist ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            )}

            {/* POWER-UP SYSTEMS */}
            {activeTab === 'POWERUPS' && (
              <div className="space-y-5">
                <h3 className="text-white font-display font-bold text-sm tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" /> WEAPONS & POWER-UP SUBSYSTEMS
                </h3>

                {/* Master Power-ups Toggle */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white uppercase">POWER-UP CRATES</div>
                    <p className="text-[10px] font-mono text-gray-400">Enables dynamic weapon pickup pods around the tarmac circuit.</p>
                  </div>
                  <button
                    disabled={!isHost}
                    onClick={() => updateField('powerUpsEnabled', !config.powerUpsEnabled)}
                    className={`px-4 py-1.5 rounded-lg border font-mono text-xs font-bold transition ${
                      config.powerUpsEnabled
                        ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                  >
                    {config.powerUpsEnabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                {config.powerUpsEnabled && (
                  <>
                    {/* Power-up Spawn Frequency */}
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-gray-400 uppercase">SPAWN FREQUENCY</label>
                      <div className="flex gap-2">
                        {(['LOW', 'MEDIUM', 'HIGH'] as const).map((freq) => {
                          const active = config.powerUpFrequency === freq;
                          return (
                            <button
                              key={freq}
                              disabled={!isHost}
                              onClick={() => updateField('powerUpFrequency', freq)}
                              className={`flex-1 py-2 rounded-lg border text-xs font-mono font-bold transition ${
                                active
                                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                                  : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
                              } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                            >
                              {freq === 'LOW' && 'SLOW (15s)'}
                              {freq === 'MEDIUM' && 'STANDARD (8s)'}
                              {freq === 'HIGH' && 'RAPID (4s)'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Individual Power-up toggles */}
                    <div className="space-y-2.5">
                      <label className="text-xs font-mono text-gray-400 uppercase">INDIVIDUAL POWER-UPS ALLOWED</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {([
                          { key: 'TURBO', label: 'Kinetic Turbo (Sprint)' },
                          { key: 'SHIELD', label: 'Energy Shield (Invuln)' },
                          { key: 'GRIP_BOOST', label: 'Aero Grip (Cornering)' },
                          { key: 'EMP', label: 'Neural EMP (Shock Slow)' },
                          { key: 'SLIPSTREAM', label: 'Draft Stream (Drafting)' },
                        ] as const).map((item) => {
                          const val = config.enabledPowerUps[item.key] !== false;
                          return (
                            <button
                              key={item.key}
                              disabled={!isHost}
                              onClick={() => updatePowerUpToggle(item.key, !val)}
                              className={`p-3 rounded-lg border text-xs font-mono font-bold flex items-center justify-between transition ${
                                val
                                  ? 'bg-white/5 border-cyan-400/40 text-cyan-300'
                                  : 'bg-black/40 border-white/5 text-gray-600'
                              } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                            >
                              <span>{item.label}</span>
                              <span className={val ? 'text-cyan-400' : 'text-gray-600'}>
                                {val ? '● ACTIVE' : '○ OFF'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* KINETIC BOOST / TURBO SETTINGS */}
            {activeTab === 'BOOST' && (
              <div className="space-y-5">
                <h3 className="text-white font-display font-bold text-sm tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-cyan-400" /> KINETIC BOOST / NITRO TUNING
                </h3>

                {/* Boost Enabled */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white uppercase">BOOST SYSTEM</div>
                    <p className="text-[10px] font-mono text-gray-400">Driver-controlled kinetic energy reserve system (KERS).</p>
                  </div>
                  <button
                    disabled={!isHost}
                    onClick={() => updateField('boostEnabled', !config.boostEnabled)}
                    className={`px-4 py-1.5 rounded-lg border font-mono text-xs font-bold transition ${
                      config.boostEnabled
                        ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                  >
                    {config.boostEnabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                {config.boostEnabled && (
                  <>
                    {/* Boost Strength */}
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-gray-400 uppercase">BOOST THRUST LEVEL</label>
                      <div className="flex gap-2">
                        {(['LOW', 'STANDARD', 'HIGH'] as const).map((lvl) => {
                          const active = config.boostStrength === lvl;
                          return (
                            <button
                              key={lvl}
                              disabled={!isHost}
                              onClick={() => updateField('boostStrength', lvl)}
                              className={`flex-1 py-2 rounded-lg border text-xs font-mono font-bold transition ${
                                active
                                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                                  : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
                              } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                            >
                              {lvl === 'LOW' && 'MILD (+0.45g)'}
                              {lvl === 'STANDARD' && 'BALANCED (+0.85g)'}
                              {lvl === 'HIGH' && 'THRUST (+1.25g)'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Boost Duration */}
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-gray-400 uppercase">BOOST DISCHARGE SPEED</label>
                      <div className="flex gap-2">
                        {(['SHORT', 'STANDARD', 'LONG'] as const).map((dur) => {
                          const active = config.boostDuration === dur;
                          return (
                            <button
                              key={dur}
                              disabled={!isHost}
                              onClick={() => updateField('boostDuration', dur)}
                              className={`flex-1 py-2 rounded-lg border text-xs font-mono font-bold transition ${
                                active
                                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                                  : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
                              } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                            >
                              {dur === 'SHORT' && 'FAST DRAIN (2.2s)'}
                              {dur === 'STANDARD' && 'BALANCED (2.8s)'}
                              {dur === 'LONG' && 'EFFICIENT (4.0s)'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Boost Regeneration */}
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-gray-400 uppercase">RECHARGE SPEED</label>
                      <div className="flex gap-2">
                        {(['SLOW', 'STANDARD', 'FAST'] as const).map((regen) => {
                          const active = config.boostRegeneration === regen;
                          return (
                            <button
                              key={regen}
                              disabled={!isHost}
                              onClick={() => updateField('boostRegeneration', regen)}
                              className={`flex-1 py-2 rounded-lg border text-xs font-mono font-bold transition ${
                                active
                                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                                  : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
                              } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                            >
                              {regen === 'SLOW' && 'SLOW (40s)'}
                              {regen === 'STANDARD' && 'BALANCED (22s)'}
                              {regen === 'FAST' && 'FAST (12s)'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* COLLISIONS */}
            {activeTab === 'COLLISIONS' && (
              <div className="space-y-5">
                <h3 className="text-white font-display font-bold text-sm tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-cyan-400" /> COLLISION & CONTACT POLICIES
                </h3>

                {/* Car-to-Car Collisions */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white uppercase">CAR-TO-CAR COLLISIONS</div>
                    <p className="text-[10px] font-mono text-gray-400">Enables rigid body contact physics between opponents.</p>
                  </div>
                  <button
                    disabled={!isHost}
                    onClick={() => updateField('carCollisionsEnabled', !config.carCollisionsEnabled)}
                    className={`px-4 py-1.5 rounded-lg border font-mono text-xs font-bold transition ${
                      config.carCollisionsEnabled
                        ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                  >
                    {config.carCollisionsEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Collision Strength */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-gray-400 uppercase">CONTACT IMPACT SEVERITY</label>
                  <div className="flex gap-2">
                    {(['LIGHT', 'STANDARD', 'HEAVY'] as const).map((sev) => {
                      const active = config.collisionStrength === sev;
                      return (
                        <button
                          key={sev}
                          disabled={!isHost}
                          onClick={() => updateField('collisionStrength', sev)}
                          className={`flex-1 py-2 rounded-lg border text-xs font-mono font-bold transition ${
                            active
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                              : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
                          } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                        >
                          {sev === 'LIGHT' && 'CUSHIONED (LIGHT)'}
                          {sev === 'STANDARD' && 'BALANCED'}
                          {sev === 'HEAVY' && 'EXPLOSIVE (HEAVY)'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* RACE RULES */}
            {activeTab === 'RULES' && (
              <div className="space-y-5">
                <h3 className="text-white font-display font-bold text-sm tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" /> MULTIPLAYER RULES & INTEGRITY
                </h3>

                {/* Off-Track slowing penalty */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white uppercase">OFF-TRACK PENALTY</div>
                    <p className="text-[10px] font-mono text-gray-400">Applies high friction slowing drag on green trackside borders.</p>
                  </div>
                  <button
                    disabled={!isHost}
                    onClick={() => updateField('offTrackPenalty', !config.offTrackPenalty)}
                    className={`px-4 py-1.5 rounded-lg border font-mono text-xs font-bold transition ${
                      config.offTrackPenalty
                        ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                  >
                    {config.offTrackPenalty ? 'ACTIVE' : 'IGNORE'}
                  </button>
                </div>

                {/* Manual Respawn toggle */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div className="text-xs font-mono font-bold text-white uppercase">MANUAL RESPAWN [R]</div>
                    <p className="text-[10px] font-mono text-gray-400">Allows drivers to relocate car onto circuit centerline.</p>
                  </div>
                  <button
                    disabled={!isHost}
                    onClick={() => updateField('respawnEnabled', !config.respawnEnabled)}
                    className={`px-4 py-1.5 rounded-lg border font-mono text-xs font-bold transition ${
                      config.respawnEnabled
                        ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                  >
                    {config.respawnEnabled ? 'ALLOWED' : 'BLOCKED'}
                  </button>
                </div>

                {config.respawnEnabled && (
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-gray-400 uppercase">RESPAWN COOLDOWN RECOVERY</label>
                    <div className="flex gap-2">
                      {(['INSTANT', 'SHORT', 'STANDARD'] as const).map((delay) => {
                        const active = config.respawnDelay === delay;
                        return (
                          <button
                            key={delay}
                            disabled={!isHost}
                            onClick={() => updateField('respawnDelay', delay)}
                            className={`flex-1 py-2 rounded-lg border text-xs font-mono font-bold transition ${
                              active
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                                : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
                            } ${!isHost ? 'opacity-80' : 'cursor-pointer active:scale-95'}`}
                          >
                            {delay === 'INSTANT' && 'RAPID (0.5s)'}
                            {delay === 'SHORT' && 'SHORT (1.5s)'}
                            {delay === 'STANDARD' && 'STANDARD (3.0s)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Locked integrity variables */}
                <div className="space-y-2 pt-2">
                  <div className="text-[10px] font-mono text-rose-400 tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> CRITICAL RULES LOCKED AT ALL TIMES
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-3 bg-emerald-950/20 border border-emerald-400/30 text-emerald-400 rounded-lg flex items-center justify-between">
                      <span>CHECKPOINT VALIDATION</span>
                      <span className="font-bold">ALWAYS ON</span>
                    </div>
                    <div className="p-3 bg-emerald-950/20 border border-emerald-400/30 text-emerald-400 rounded-lg flex items-center justify-between">
                      <span>ANTI-SKIP VERIFICATION</span>
                      <span className="font-bold">ALWAYS ON</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Footer controls applying */}
        <div className="border-t border-white/10 p-5 bg-black/40 flex items-center justify-between gap-4">
          <div className="text-left hidden sm:block">
            <span className="text-[10px] font-mono text-gray-400 block uppercase">ACTIVE PROFILE</span>
            <span className="text-white text-xs font-bold font-mono tracking-wide">{config.preset} SETUP // PRE-GRID</span>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-2xl bg-white/5 border border-white/15 text-gray-300 hover:text-white text-xs font-mono font-bold transition cursor-pointer active:scale-95"
            >
              DISCARD CHANGES
            </button>

            {isHost && (
              <button
                onClick={handleApply}
                className="px-8 py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-display font-black tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.4)] transition cursor-pointer active:scale-95 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>APPLY & BROADCAST RULES</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
