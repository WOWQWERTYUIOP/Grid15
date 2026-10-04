import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { BodyStyle, CarCustomization, WheelStyle } from '../types/game';
import { createOpenWheelCarMesh, CarVisualObject } from '../game/carModel';
import { saveCustomization } from '../utils/storage';
import { soundEngine } from '../game/audio';
import { ArrowLeft, Check, Sparkles, User, Palette, Disc, Shield } from 'lucide-react';

interface GarageProps {
  config: CarCustomization;
  onUpdateConfig: (newConfig: CarCustomization) => void;
  onBack: () => void;
}

const PRESET_COLORS = [
  { name: 'Apex Crimson', hex: '#ff2a5f' },
  { name: 'Cyber Cyan', hex: '#00f0ff' },
  { name: 'Acid Volt', hex: '#39ff14' },
  { name: 'Hyper Violet', hex: '#b026ff' },
  { name: 'Solar Flare', hex: '#ff8800' },
  { name: 'Forged Gold', hex: '#ffd700' },
  { name: 'Monaco White', hex: '#ffffff' },
  { name: 'Obsidian Black', hex: '#111827' },
];

export const Garage: React.FC<GarageProps> = ({ config, onUpdateConfig, onBack }) => {
  const [currentConfig, setCurrentConfig] = useState<CarCustomization>(config);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const carVisualRef = useRef<CarVisualObject | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'chassis' | 'livery' | 'wheels'>('chassis');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Three.js Turntable Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c14);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(4.8, 2.5, 4.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Studio Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(8, 12, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 1.5);
    rimLight.position.set(-8, 6, -6);
    scene.add(rimLight);

    const warmFill = new THREE.DirectionalLight(0xff88aa, 0.8);
    warmFill.position.set(0, -2, -6);
    scene.add(warmFill);

    // Pedestal turntable grid
    const floorGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.2, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.2,
      metalness: 0.8,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    // Glowing rim circle around pedestal
    const ringGeo = new THREE.RingGeometry(4.4, 4.5, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.01;
    scene.add(ring);

    // Create Car Model
    let carObj = createOpenWheelCarMesh(currentConfig);
    carVisualRef.current = carObj;
    scene.add(carObj.root);

    camera.lookAt(0, 0.4, 0);

    let isDragging = false;
    let previousMouseX = 0;
    let autoRotate = true;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMouseX = e.clientX;
      autoRotate = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMouseX;
      carObj.root.rotation.y += deltaX * 0.01;
      previousMouseX = e.clientX;
    };

    const onMouseUp = () => {
      isDragging = false;
      setTimeout(() => {
        autoRotate = true;
      }, 4000);
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (autoRotate && carObj) {
        carObj.root.rotation.y += 0.006;
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [currentConfig.bodyStyle, currentConfig.wheelStyle]);

  // Update materials live when colors change
  const handleChange = (partial: Partial<CarCustomization>) => {
    const updated = { ...currentConfig, ...partial };
    setCurrentConfig(updated);
    saveCustomization(updated);
    onUpdateConfig(updated);
    if (carVisualRef.current) {
      carVisualRef.current.updateMaterials(updated);
    }
  };

  return (
    <div className="relative w-full h-screen bg-carbon flex flex-col justify-between p-4 md:p-8 overflow-hidden">
      <div className="scanline-effect" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              soundEngine.playClick();
              onBack();
            }}
            className="glass-panel hover:bg-white/15 p-2.5 rounded-xl border border-white/20 text-white flex items-center gap-2 font-mono-race text-sm transition cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>BACK TO MENU</span>
          </button>

          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black tracking-wider text-white flex items-center gap-2">
              GARAGE <span className="text-cyan-400">//</span> WORKSHOP
            </h1>
            <p className="text-xs font-racing text-gray-400 tracking-wider">
              CONFIGURE YOUR OPEN-WHEEL FORMULA MACHINE
            </p>
          </div>
        </div>

        {/* Driver Badge Preview */}
        <div className="glass-panel px-4 py-2 rounded-xl border border-cyan-500/30 flex items-center gap-3 shadow-lg">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center font-display font-black text-cyan-400 text-lg">
            #{currentConfig.carNumber}
          </div>
          <div>
            <div className="text-[10px] font-mono-race text-gray-400 uppercase">DRIVER REGISTERED</div>
            <div className="font-display font-bold text-sm text-white">{currentConfig.driverName}</div>
          </div>
        </div>
      </div>

      {/* Main Studio Viewport & Sidebar */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 my-4 min-h-0">
        {/* 3D Turntable Car Viewer */}
        <div className="lg:col-span-7 xl:col-span-8 glass-panel rounded-2xl relative overflow-hidden border border-white/10 flex flex-col justify-between shadow-2xl">
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Turntable Hint */}
          <div className="absolute bottom-4 left-4 pointer-events-none glass-panel px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-mono-race text-gray-400">
            DRAG TO ROTATE 3D CAR PREVIEW
          </div>
        </div>

        {/* Customization Options Panel */}
        <div className="lg:col-span-5 xl:col-span-4 glass-panel rounded-2xl p-5 border border-white/10 flex flex-col shadow-2xl overflow-y-auto">
          {/* Navigation Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded-xl mb-5 border border-white/10">
            <button
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('profile');
              }}
              className={`py-2 rounded-lg text-xs font-racing font-bold tracking-wider transition flex flex-col items-center gap-1 cursor-pointer ${
                activeTab === 'profile' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-gray-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              PROFILE
            </button>
            <button
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('chassis');
              }}
              className={`py-2 rounded-lg text-xs font-racing font-bold tracking-wider transition flex flex-col items-center gap-1 cursor-pointer ${
                activeTab === 'chassis' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              CHASSIS
            </button>
            <button
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('livery');
              }}
              className={`py-2 rounded-lg text-xs font-racing font-bold tracking-wider transition flex flex-col items-center gap-1 cursor-pointer ${
                activeTab === 'livery' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              LIVERY
            </button>
            <button
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('wheels');
              }}
              className={`py-2 rounded-lg text-xs font-racing font-bold tracking-wider transition flex flex-col items-center gap-1 cursor-pointer ${
                activeTab === 'wheels' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              WHEELS
            </button>
          </div>

          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono-race text-gray-400 mb-1.5">DRIVER ALIAS</label>
                <input
                  type="text"
                  maxLength={14}
                  value={currentConfig.driverName}
                  onChange={(e) => handleChange({ driverName: e.target.value })}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-2.5 text-white font-display text-base uppercase focus:border-cyan-400 focus:outline-none"
                  placeholder="DRIVER NAME"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-race text-gray-400 mb-1.5">RACE NUMBER (#1 - #99)</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={currentConfig.carNumber}
                  onChange={(e) => handleChange({ carNumber: Math.max(1, Math.min(99, parseInt(e.target.value) || 1)) })}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-2.5 text-white font-display text-xl focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-race text-gray-400 mb-2">HELMET COLOR</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleChange({ helmetColor: c.hex })}
                      className="h-10 rounded-lg flex items-center justify-center border transition relative active:scale-95"
                      style={{
                        backgroundColor: c.hex,
                        borderColor: currentConfig.helmetColor === c.hex ? '#00f0ff' : 'rgba(255,255,255,0.2)',
                      }}
                    >
                      {currentConfig.helmetColor === c.hex && <Check className="w-4 h-4 text-black drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHASSIS */}
          {activeTab === 'chassis' && (
            <div className="space-y-3">
              {[
                {
                  id: 'AERO_APEX' as BodyStyle,
                  name: 'AERO APEX',
                  subtitle: 'BALANCED LOW-DRAG MONOCOQUE',
                  desc: 'Aerodynamic pointed front cone with side airboxes and DRS rear wing.',
                },
                {
                  id: 'VORTEX_GT' as BodyStyle,
                  name: 'VORTEX GT',
                  subtitle: 'AGGRESSIVE TWIN-KEEL WEDGE',
                  desc: 'Sculpted wide ground-effect sidepods and multi-element endplates.',
                },
                {
                  id: 'PHANTOM_X' as BodyStyle,
                  name: 'PHANTOM X',
                  subtitle: 'STEALTH DELTA FIGHTER',
                  desc: 'Futuristic angular delta geometry optimized for ultra-high velocity stability.',
                },
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => {
                    soundEngine.playClick();
                    handleChange({ bodyStyle: style.id });
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition cursor-pointer active:scale-[0.98] ${
                    currentConfig.bodyStyle === style.id
                      ? 'glass-panel-glow border-cyan-400 bg-cyan-500/10'
                      : 'glass-panel border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-black text-sm text-white tracking-wide">{style.name}</span>
                    {currentConfig.bodyStyle === style.id && <span className="text-xs font-mono-race text-cyan-400 font-bold">SELECTED</span>}
                  </div>
                  <div className="text-[11px] font-mono-race text-cyan-400/80 mt-0.5">{style.subtitle}</div>
                  <div className="text-xs text-gray-400 mt-1">{style.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* TAB 3: LIVERY COLORS */}
          {activeTab === 'livery' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono-race text-gray-400 mb-2">PRIMARY PAINT FINISH</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleChange({ primaryColor: c.hex })}
                      className="h-10 rounded-lg flex items-center justify-center border transition relative active:scale-95 cursor-pointer"
                      style={{
                        backgroundColor: c.hex,
                        borderColor: currentConfig.primaryColor === c.hex ? '#00f0ff' : 'rgba(255,255,255,0.2)',
                      }}
                    >
                      {currentConfig.primaryColor === c.hex && <Check className="w-4 h-4 text-black drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-race text-gray-400 mb-2">SECONDARY STRIPE LIVERY</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleChange({ secondaryColor: c.hex })}
                      className="h-10 rounded-lg flex items-center justify-center border transition relative active:scale-95 cursor-pointer"
                      style={{
                        backgroundColor: c.hex,
                        borderColor: currentConfig.secondaryColor === c.hex ? '#00f0ff' : 'rgba(255,255,255,0.2)',
                      }}
                    >
                      {currentConfig.secondaryColor === c.hex && <Check className="w-4 h-4 text-black drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-race text-gray-400 mb-2">AERO ACCENT & WINGTRIM</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleChange({ accentColor: c.hex })}
                      className="h-10 rounded-lg flex items-center justify-center border transition relative active:scale-95 cursor-pointer"
                      style={{
                        backgroundColor: c.hex,
                        borderColor: currentConfig.accentColor === c.hex ? '#00f0ff' : 'rgba(255,255,255,0.2)',
                      }}
                    >
                      {currentConfig.accentColor === c.hex && <Check className="w-4 h-4 text-black drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WHEELS */}
          {activeTab === 'wheels' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono-race text-gray-400 mb-2">RIM GEOMETRY</label>
                <div className="space-y-2">
                  {[
                    { id: 'FORGED_SPOKE' as WheelStyle, name: 'FORGED 18-SPOKE', desc: 'Ultra-lightweight magnesium alloy' },
                    { id: 'AERO_TURBINE' as WheelStyle, name: 'AERO TURBINE', desc: 'Brake cooling aerodynamic flow' },
                    { id: 'CARBON_DISC' as WheelStyle, name: 'CARBON DISC', desc: 'Full carbon fiber drag reduction cover' },
                  ].map((w) => (
                    <button
                      key={w.id}
                      onClick={() => {
                        soundEngine.playClick();
                        handleChange({ wheelStyle: w.id });
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition cursor-pointer ${
                        currentConfig.wheelStyle === w.id
                          ? 'glass-panel-glow border-cyan-400 bg-cyan-500/10'
                          : 'glass-panel border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-sm text-white">{w.name}</span>
                        {currentConfig.wheelStyle === w.id && <span className="text-xs text-cyan-400 font-mono-race">ACTIVE</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{w.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-race text-gray-400 mb-2">RIM COLOR</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleChange({ wheelColor: c.hex })}
                      className="h-10 rounded-lg flex items-center justify-center border transition relative active:scale-95 cursor-pointer"
                      style={{
                        backgroundColor: c.hex,
                        borderColor: currentConfig.wheelColor === c.hex ? '#00f0ff' : 'rgba(255,255,255,0.2)',
                      }}
                    >
                      {currentConfig.wheelColor === c.hex && <Check className="w-4 h-4 text-black drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
