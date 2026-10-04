import * as THREE from 'three';
import { TrackData } from '../types/game';

// Fictional professional racing sponsors
export const RACING_SPONSORS = [
  { name: 'VERTEX AERO', subtitle: 'AERODYNAMIC SYSTEMS', primary: '#dc2626', secondary: '#ffffff' },
  { name: 'APEX DYNAMICS', subtitle: 'PERFORMANCE HYBRID POWER', primary: '#0284c7', secondary: '#ffffff' },
  { name: 'HYPERION ENERGY', subtitle: 'ADVANCED BIO-SYNTHETICS', primary: '#16a34a', secondary: '#ffffff' },
  { name: 'KINETIC RACING', subtitle: 'PRECISION MOTORSPORT TECH', primary: '#f59e0b', secondary: '#000000' },
  { name: 'CHRONO SPEED', subtitle: 'OFFICIAL TIMEKEEPER', primary: '#8b5cf6', secondary: '#ffffff' },
  { name: 'NEXUS COMPOUND', subtitle: 'COMPETITION TIRES', primary: '#ea580c', secondary: '#ffffff' },
  { name: 'QUANTUM FLUIDS', subtitle: 'SYNTHETIC LUBRICANTS', primary: '#06b6d4', secondary: '#000000' },
  { name: 'GRID // 15', subtitle: 'WORLD OPEN-WHEEL CUP', primary: '#111827', secondary: '#00f0ff' },
];

// Texture cache to prevent repeated canvas allocations
const textureCache = new Map<string, THREE.Texture>();

function createSafeCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Calculates minimum distance from a 2D point (x, z) to the entire track centerline.
 */
export function getMinDistanceToTrack(
  x: number,
  z: number,
  sampledPoints: THREE.Vector3[]
): number {
  let minSq = Infinity;
  for (let i = 0; i < sampledPoints.length; i++) {
    const pt = sampledPoints[i];
    const dx = pt.x - x;
    const dz = pt.z - z;
    const dSq = dx * dx + dz * dz;
    if (dSq < minSq) minSq = dSq;
  }
  return Math.sqrt(minSq);
}

/**
 * Validates if an object's position is safely outside the protected racing corridor.
 * Protected corridor = Track (8m) + Kerbs/Runoff (4.4m) + Barrier (1.6m) + Safe Buffer (4m) + object radius.
 */
export function isOutsideTrackSafetyCorridor(
  x: number,
  z: number,
  sampledPoints: THREE.Vector3[],
  objectRadius = 2.0,
  extraMargin = 6.0
): boolean {
  const minClearance = 8.0 + 4.4 + 1.6 + extraMargin + objectRadius;
  return getMinDistanceToTrack(x, z, sampledPoints) >= minClearance;
}

/**
 * Generate seamless procedural racing asphalt texture.
 * Features:
 * - Fine aggregate basalt grain with zero cross-track seam lines.
 * - Longitudinal dark tire rubber tracks on the racing line.
 * - Crisp FIA white boundary lines on outer edges with subtle repair patch variations.
 */
export function getOrCreateAsphaltTexture(theme: string, tarmacColorHex: string | number): THREE.Texture {
  const cacheKey = `asphalt_${theme}_${tarmacColorHex}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const canvas = createSafeCanvas(1024, 1024);
  if (!canvas) {
    const fallback = new THREE.Texture();
    textureCache.set(cacheKey, fallback);
    return fallback;
  }
  const ctx = canvas.getContext('2d')!;

  // Base asphalt tone
  const baseColor = new THREE.Color(tarmacColorHex as any);
  ctx.fillStyle = `#${baseColor.getHexString()}`;
  ctx.fillRect(0, 0, 1024, 1024);

  // Micro-aggregate fine noise (uniform isotropic grain, NO horizontal stripes)
  const imgData = ctx.getImageData(0, 0, 1024, 1024);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 24;
    data[i] = Math.max(0, Math.min(255, data[i] + grain));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
  }
  ctx.putImageData(imgData, 0, 0);

  // Longitudinal tire rubber grooves along the driving arc (vertical gradient along track direction)
  const grooveGrad = ctx.createLinearGradient(0, 0, 1024, 0);
  grooveGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
  grooveGrad.addColorStop(0.22, 'rgba(10, 10, 14, 0.32)'); // Left wheel rubber line
  grooveGrad.addColorStop(0.34, 'rgba(0, 0, 0, 0.08)');
  grooveGrad.addColorStop(0.66, 'rgba(0, 0, 0, 0.08)');
  grooveGrad.addColorStop(0.78, 'rgba(10, 10, 14, 0.32)'); // Right wheel rubber line
  grooveGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grooveGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle tar seam repairs
  ctx.strokeStyle = 'rgba(15, 15, 20, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(350, 0);
  ctx.bezierCurveTo(360, 400, 340, 700, 355, 1024);
  ctx.stroke();

  // Crisp FIA white track-limit boundary lines (14px wide along outer edges)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8, 0, 14, 1024);   // Left edge line
  ctx.fillRect(1002, 0, 14, 1024); // Right edge line

  // Soft edge line drop-shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(22, 0, 4, 1024);
  ctx.fillRect(998, 0, 4, 1024);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 36);
  texture.anisotropy = 8;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generate alternating red & white racing kerb texture with bevel shading and tire scuffs.
 */
export function getOrCreateKerbTexture(
  theme: string,
  kerbColor1: string | number,
  kerbColor2: string | number
): THREE.Texture {
  const cacheKey = `kerb_${theme}_${kerbColor1}_${kerbColor2}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const canvas = createSafeCanvas(512, 128);
  if (!canvas) {
    const fallback = new THREE.Texture();
    textureCache.set(cacheKey, fallback);
    return fallback;
  }
  const ctx = canvas.getContext('2d')!;

  const isNeon = theme === 'neon';
  const c1 = isNeon ? '#ff0055' : '#dc2626'; // FIA Red
  const c2 = isNeon ? '#00f0ff' : '#f8fafc'; // Crisp White / Cyan

  // Draw 8 alternating red and white teeth
  const stripeWidth = 512 / 8;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? c1 : c2;
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, 128);

    // Bevel highlights & shadow on teeth edges
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(i * stripeWidth, 0, 3, 128);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect((i + 1) * stripeWidth - 3, 0, 3, 128);

    // Black tire scuff marks across the kerb teeth
    ctx.fillStyle = 'rgba(15, 15, 20, 0.18)';
    ctx.fillRect(i * stripeWidth + 6, 20, stripeWidth - 12, 35);
  }

  // Cross-sectional bevel shading
  const bevelGrad = ctx.createLinearGradient(0, 0, 0, 128);
  bevelGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.35)');
  bevelGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.25)');
  bevelGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.05)');
  bevelGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = bevelGrad;
  ctx.fillRect(0, 0, 512, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generate gravel trap pebble texture.
 */
export function getOrCreateGravelTexture(): THREE.Texture {
  const cacheKey = 'gravel_texture';
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const canvas = createSafeCanvas(512, 512);
  if (!canvas) {
    const fallback = new THREE.Texture();
    textureCache.set(cacheKey, fallback);
    return fallback;
  }
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3000; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const pr = 1 + Math.random() * 2.5;
    const shade = Math.random();
    ctx.fillStyle = shade > 0.6 ? '#fef3c7' : shade > 0.3 ? '#78350f' : '#d97706';
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 16);
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generate sponsor banner texture for circuit walls and bridges.
 */
export function createSponsorBannerTexture(sponsorIdx: number): THREE.Texture {
  const sponsor = RACING_SPONSORS[sponsorIdx % RACING_SPONSORS.length];
  const cacheKey = `sponsor_${sponsor.name}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const canvas = createSafeCanvas(1024, 256);
  if (!canvas) {
    const fallback = new THREE.Texture();
    textureCache.set(cacheKey, fallback);
    return fallback;
  }
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = sponsor.primary;
  ctx.fillRect(0, 0, 1024, 256);

  ctx.fillStyle = sponsor.secondary;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(80, 0);
  ctx.lineTo(160, 256);
  ctx.lineTo(80, 256);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(944, 0);
  ctx.lineTo(1024, 0);
  ctx.lineTo(944, 256);
  ctx.lineTo(864, 256);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = sponsor.secondary;
  ctx.font = '900 68px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sponsor.name, 512, 105);

  ctx.font = '700 22px Orbitron, sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText(sponsor.subtitle, 512, 175);

  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, 1024, 12);
  ctx.fillRect(0, 244, 1024, 12);

  const texture = new THREE.CanvasTexture(canvas);
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Procedural Armco guardrail metallic texture with corrugated W-beam profile.
 */
export function getOrCreateArmcoTexture(barrierColorHex: string | number, isNeon: boolean): THREE.Texture {
  const cacheKey = `armco_${barrierColorHex}_${isNeon}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const canvas = createSafeCanvas(512, 128);
  if (!canvas) {
    const fallback = new THREE.Texture();
    textureCache.set(cacheKey, fallback);
    return fallback;
  }
  const ctx = canvas.getContext('2d')!;

  const baseCol = new THREE.Color(barrierColorHex as any);
  ctx.fillStyle = `#${baseCol.getHexString()}`;
  ctx.fillRect(0, 0, 512, 128);

  const ribGrad = ctx.createLinearGradient(0, 0, 0, 128);
  ribGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.45)');
  ribGrad.addColorStop(0.18, 'rgba(255, 255, 255, 0.45)');
  ribGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.35)');
  ribGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.6)');
  ribGrad.addColorStop(0.68, 'rgba(255, 255, 255, 0.45)');
  ribGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.35)');
  ribGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = ribGrad;
  ctx.fillRect(0, 0, 512, 128);

  // Vertical steel post seams
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  for (let x = 0; x < 512; x += 64) {
    ctx.fillRect(x, 0, 6, 128);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(x + 2, 28, 3, 3);
    ctx.fillRect(x + 2, 92, 3, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  }

  if (isNeon) {
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(0, 0, 512, 6);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(16, 1);
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generate brake distance marker boards (150m, 100m, 50m).
 */
export function createBrakeBoardMesh(distanceText: string): THREE.Group {
  const group = new THREE.Group();

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), poleMat);
  pole.position.set(0, 1.1, 0);
  pole.castShadow = true;
  group.add(pole);

  const canvas = createSafeCanvas(256, 180);
  let texture: THREE.Texture;
  if (canvas) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 180);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 246, 170);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 86px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(distanceText, 128, 90);
    texture = new THREE.CanvasTexture(canvas);
  } else {
    texture = new THREE.Texture();
  }

  const boardMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.1), boardMat);
  board.position.set(0, 1.8, 0);
  board.castShadow = true;
  group.add(board);

  return group;
}

/**
 * Sector Timing Gantry Mesh (Sector 1, Sector 2, Sector 3, Speed Trap).
 */
export function createSectorTimingGantry(sectorName: string): THREE.Group {
  const gantry = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });

  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7.5, 0.8), metalMat);
  leftPost.position.set(-10.5, 3.75, 0);
  const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7.5, 0.8), metalMat);
  rightPost.position.set(10.5, 3.75, 0);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(22.0, 1.0, 1.0), metalMat);
  beam.position.set(0, 7.2, 0);

  const canvas = createSafeCanvas(512, 128);
  if (canvas) {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#00f0ff';
    ctx.font = '900 52px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sectorName, 256, 64);
    screenMat.map = new THREE.CanvasTexture(canvas);
  }

  const display = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 1.6), screenMat);
  display.position.set(0, 7.2, 0.55);

  gantry.add(leftPost, rightPost, beam, display);
  return gantry;
}

/**
 * Low-poly professional marshal safety post meshes with 3 distinct variants:
 * 1. Elevated Turn-Entry Safety Watchtower with canopy & railing
 * 2. Low-Profile Armco Barrier Flag Station with digital beacon & extinguisher
 * 3. Corner Observation & Recovery Post with shelter & communication antenna
 */
export function createMarshalStationMesh(variant: number, isGreen: boolean): THREE.Group {
  const station = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.7 });
  const hutMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
  const marshalMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 }); // FIA High-Vis Orange overalls
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }); // Safety helmet/cap
  const flagMat = new THREE.MeshBasicMaterial({
    color: isGreen ? 0x22c55e : 0xeab308,
    side: THREE.DoubleSide,
  });
  const extinguisherMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.3, roughness: 0.3 }); // Red fire extinguisher
  const beaconMat = new THREE.MeshBasicMaterial({ color: isGreen ? 0x4ade80 : 0xfacc15 }); // Digital warning light

  if (variant === 0) {
    // Variant 0: Elevated Turn-Entry Safety Watchtower
    // Platform & Support Legs
    const platform = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 2.6), woodMat);
    platform.position.set(0, 1.4, 0);
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), steelMat);
    leg1.position.set(-1.1, 0.7, -1.1);
    const leg2 = leg1.clone();
    leg2.position.set(1.1, 0.7, -1.1);
    const leg3 = leg1.clone();
    leg3.position.set(-1.1, 0.7, 1.1);
    const leg4 = leg1.clone();
    leg4.position.set(1.1, 0.7, 1.1);

    // Safety Handrails
    const railFront = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.06), steelMat);
    railFront.position.set(0, 1.9, 1.25);
    const railBack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.06), steelMat);
    railBack.position.set(0, 1.9, -1.25);

    // Cantilevered Shelter Canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.15, 2.8), hutMat);
    canopy.position.set(0, 3.6, 0);
    canopy.rotation.x = -0.05;

    // Marshal Figure
    const marshalBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.3, 8), marshalMat);
    marshalBody.position.set(-0.3, 2.2, 0.2);
    const marshalHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), hatMat);
    marshalHead.position.set(-0.3, 2.95, 0.2);

    // Angled Safety Flag
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 6), steelMat);
    flagPole.position.set(0.7, 2.5, 0.8);
    flagPole.rotation.z = -0.2;
    const flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.75), flagMat);
    flagMesh.position.set(1.4, 3.4, 0.8);

    // Fire Extinguisher Canister mounted on rail
    const extBody = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 8), extinguisherMat);
    extBody.position.set(-1.0, 1.8, 1.1);

    // Electronic Yellow/Green Light Box
    const lightBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.2), steelMat);
    lightBox.position.set(1.0, 3.2, 1.2);
    const lightBulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), beaconMat);
    lightBulb.position.set(1.0, 3.2, 1.32);

    station.add(
      platform, leg1, leg2, leg3, leg4,
      railFront, railBack, canopy,
      marshalBody, marshalHead,
      flagPole, flagMesh, extBody, lightBox, lightBulb
    );
  } else if (variant === 1) {
    // Variant 1: Low-Profile Armco Barrier Flag Station
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 1.6), woodMat);
    base.position.set(0, 0.2, 0);

    const shieldWall = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 0.1), steelMat);
    shieldWall.position.set(0, 0.95, 0.75);

    const marshalBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.3, 8), marshalMat);
    marshalBody.position.set(0, 1.05, 0);
    const marshalHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), hatMat);
    marshalHead.position.set(0, 1.8, 0);

    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), steelMat);
    flagPole.position.set(0.6, 1.4, 0.5);
    const flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.65), flagMat);
    flagMesh.position.set(1.2, 2.2, 0.5);

    const extBody = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 8), extinguisherMat);
    extBody.position.set(-0.7, 0.6, 0.6);

    station.add(base, shieldWall, marshalBody, marshalHead, flagPole, flagMesh, extBody);
  } else {
    // Variant 2: Corner Observation & Recovery Post with Shelter & Antenna
    const shelter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.0), hutMat);
    shelter.position.set(0, 1.2, -0.4);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 2.4), steelMat);
    roof.position.set(0, 2.45, -0.4);

    const marshalBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.3, 8), marshalMat);
    marshalBody.position.set(0.4, 0.85, 0.8);
    const marshalHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), hatMat);
    marshalHead.position.set(0.4, 1.6, 0.8);

    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6), steelMat);
    flagPole.position.set(0.9, 1.4, 0.8);
    const flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), flagMat);
    flagMesh.position.set(1.5, 2.3, 0.8);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 6), steelMat);
    antenna.position.set(-0.9, 3.8, -0.4);

    station.add(shelter, roof, marshalBody, marshalHead, flagPole, flagMesh, antenna);
  }

  return station;
}

/**
 * Grandstand 3D mesh with tiered spectator seating, canopy roofs, and high-density instanced crowd.
 */
export function createGrandstandMesh(isNeon: boolean): THREE.Group {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 });
  const seatMat = new THREE.MeshStandardMaterial({ color: isNeon ? 0x0ea5e9 : 0xdc2626, roughness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.2, roughness: 0.3 });

  // 6 Tiered Seating Rows
  for (let tier = 0; tier < 6; tier++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(22, 0.8, 1.6), seatMat);
    step.position.set(0, tier * 0.8 + 0.4, -tier * 1.4);
    group.add(step);
  }

  // Back structure wall
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(22.4, 7.2, 0.5), baseMat);
  backWall.position.set(0, 3.6, -8.6);
  group.add(backWall);

  // Cantilevered Canopy Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(23.0, 0.35, 10.5), roofMat);
  roof.position.set(0, 7.8, -3.8);
  roof.rotation.x = 0.08;
  roof.castShadow = true;
  group.add(roof);

  // High-Density Low-Poly Instanced Spectator Crowd
  const crowdCount = 120;
  const personGeo = new THREE.BoxGeometry(0.32, 0.65, 0.32);
  const personMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const crowdMesh = new THREE.InstancedMesh(personGeo, personMat, crowdCount);

  const dummy = new THREE.Object3D();
  const colors = [
    new THREE.Color('#38bdf8'),
    new THREE.Color('#ef4444'),
    new THREE.Color('#ffffff'),
    new THREE.Color('#eab308'),
    new THREE.Color('#10b981'),
    new THREE.Color('#a855f7'),
    new THREE.Color('#f97316'),
  ];

  let pIdx = 0;
  for (let tier = 0; tier < 6; tier++) {
    for (let col = -10; col <= 10; col += 1.1) {
      if (pIdx >= crowdCount) break;
      dummy.position.set(
        col + (Math.random() - 0.5) * 0.2,
        tier * 0.8 + 1.1,
        -tier * 1.4 + (Math.random() - 0.5) * 0.2
      );
      dummy.updateMatrix();
      crowdMesh.setMatrixAt(pIdx, dummy.matrix);
      crowdMesh.setColorAt(pIdx, colors[Math.floor(Math.random() * colors.length)]);
      pIdx++;
    }
  }
  crowdMesh.instanceMatrix.needsUpdate = true;
  if (crowdMesh.instanceColor) crowdMesh.instanceColor.needsUpdate = true;
  group.add(crowdMesh);

  // Rooftop Sponsor Flags
  const flagMat = new THREE.MeshBasicMaterial({ color: isNeon ? 0x00f0ff : 0xdc2626 });
  for (let f = -9; f <= 9; f += 6) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6), baseMat);
    pole.position.set(f, 9.0, -8.4);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), flagMat);
    flag.position.set(f + 0.7, 9.6, -8.4);
    group.add(pole, flag);
  }

  return group;
}

/**
 * Generate 15 FIA starting grid position decals matching startGridSlots.
 */
export function createStartingGridDecals(
  startSlots: { x: number; y: number; z: number; rotationY: number }[]
): THREE.Group {
  const gridGroup = new THREE.Group();

  startSlots.forEach((slot, idx) => {
    const slotNumber = idx + 1;
    const canvas = createSafeCanvas(256, 256);
    let texture: THREE.Texture;
    if (canvas) {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 256, 256);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 12;
      ctx.strokeRect(16, 16, 224, 224);

      ctx.fillStyle = '#facc15';
      ctx.fillRect(16, 16, 224, 28);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 100px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${slotNumber}`, 128, 140);
      texture = new THREE.CanvasTexture(canvas);
    } else {
      texture = new THREE.Texture();
    }

    const boxMat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    const boxMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.0), boxMat);
    boxMesh.rotation.x = -Math.PI / 2;
    boxMesh.position.set(slot.x, slot.y + 0.06, slot.z);
    boxMesh.rotation.z = -slot.rotationY;
    gridGroup.add(boxMesh);
  });

  return gridGroup;
}

/**
 * Main procedural track environment builder.
 * Guarantees:
 * 1. Continuous clean asphalt with zero transverse cross-track lines.
 * 2. Independent left and right kerb meshes that never connect across the centerline.
 * 3. Strictly protected safety corridor: all environmental props validated against full track spline.
 */
export function buildProfessionalTrackEnvironment(
  scene: THREE.Scene,
  trackData: TrackData
): {
  trackMesh: THREE.Mesh;
  oceanMesh?: THREE.Mesh;
} {
  const pts = trackData.trackPoints.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.15);
  const divisions = 600; // High fidelity spline resolution
  const sampledPoints = curve.getSpacedPoints(divisions);

  const trackWidth = 16;
  const halfW = trackWidth / 2; // 8.0m
  const isNeon = trackData.theme === 'neon';
  const isDesert = trackData.theme === 'desert';
  const isHarbor = trackData.theme === 'harbor';

  // 1. Curvature & Tangent Analysis
  const tangents: THREE.Vector3[] = [];
  const rights: THREE.Vector3[] = [];
  const curvatures: number[] = [];

  for (let i = 0; i < divisions; i++) {
    const curr = sampledPoints[i];
    const next = sampledPoints[(i + 1) % divisions];
    const prev = sampledPoints[(i - 1 + divisions) % divisions];

    const t = new THREE.Vector3().subVectors(next, curr).normalize();
    tangents.push(t);

    const r = new THREE.Vector3(-t.z, 0, t.x).normalize();
    rights.push(r);

    const v1 = new THREE.Vector3().subVectors(curr, prev);
    const v2 = new THREE.Vector3().subVectors(next, curr);
    const angle = v1.angleTo(v2);
    const cross = new THREE.Vector3().crossVectors(v1, v2);
    const sign = cross.y >= 0 ? 1 : -1;
    curvatures.push(angle * sign);
  }

  // 2. Build Continuous Asphalt Road Surface
  const roadPos: number[] = [];
  const roadNorm: number[] = [];
  const roadUv: number[] = [];
  const roadIdx: number[] = [];

  for (let i = 0; i <= divisions; i++) {
    const ptIdx = i % divisions;
    const pt = sampledPoints[ptIdx];
    const r = rights[ptIdx];
    const uFraction = i / divisions;

    const leftX = pt.x - r.x * halfW;
    const leftZ = pt.z - r.z * halfW;
    const rightX = pt.x + r.x * halfW;
    const rightZ = pt.z + r.z * halfW;

    roadPos.push(leftX, pt.y, leftZ);
    roadNorm.push(0, 1, 0);
    roadUv.push(0, uFraction);

    roadPos.push(rightX, pt.y, rightZ);
    roadNorm.push(0, 1, 0);
    roadUv.push(1, uFraction);

    if (i < divisions) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;

      roadIdx.push(v0, v1, v2);
      roadIdx.push(v1, v3, v2);
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNorm, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUv, 2));
  roadGeo.setIndex(roadIdx);

  const asphaltTex = getOrCreateAsphaltTexture(trackData.theme, trackData.tarmacColor);
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.72,
    metalness: 0.18,
    envMapIntensity: 0.6,
  });

  const trackMesh = new THREE.Mesh(roadGeo, roadMat);
  trackMesh.receiveShadow = true;
  scene.add(trackMesh);

  // 3. Independent Left & Right Kerb Geometries
  const kerbWidth = 1.4;
  const kerbHeight = 0.12;
  const kerbTex = getOrCreateKerbTexture(trackData.theme, trackData.kerbColor1, trackData.kerbColor2);
  const kerbMat = new THREE.MeshStandardMaterial({
    map: kerbTex,
    roughness: 0.65,
    metalness: 0.15,
  });

  const leftKerbPos: number[] = [];
  const leftKerbUv: number[] = [];
  const leftKerbIdx: number[] = [];
  let leftKerbVertCount = 0;

  const rightKerbPos: number[] = [];
  const rightKerbUv: number[] = [];
  const rightKerbIdx: number[] = [];
  let rightKerbVertCount = 0;

  for (let i = 0; i < divisions; i++) {
    const pt = sampledPoints[i];
    const r = rights[i];
    const curv = curvatures[i];

    // Left apex kerb (inside of left turn)
    if (curv > 0.015) {
      const pInnerX = pt.x - r.x * halfW;
      const pInnerZ = pt.z - r.z * halfW;
      const pCrestX = pt.x - r.x * (halfW + kerbWidth * 0.4);
      const pCrestZ = pt.z - r.z * (halfW + kerbWidth * 0.4);
      const pOuterX = pt.x - r.x * (halfW + kerbWidth);
      const pOuterZ = pt.z - r.z * (halfW + kerbWidth);

      leftKerbPos.push(pInnerX, pt.y + 0.01, pInnerZ);
      leftKerbUv.push(0, i * 0.1);
      leftKerbPos.push(pCrestX, pt.y + kerbHeight, pCrestZ);
      leftKerbUv.push(0.5, i * 0.1);
      leftKerbPos.push(pOuterX, pt.y + 0.02, pOuterZ);
      leftKerbUv.push(1, i * 0.1);

      if (leftKerbVertCount >= 3) {
        const c = leftKerbVertCount;
        const p = c - 3;
        leftKerbIdx.push(p, p + 1, c);
        leftKerbIdx.push(p + 1, c + 1, c);
        leftKerbIdx.push(p + 1, p + 2, c + 1);
        leftKerbIdx.push(p + 2, c + 2, c + 1);
      }
      leftKerbVertCount += 3;
    } else {
      leftKerbVertCount = 0;
    }

    // Right apex kerb (inside of right turn)
    if (curv < -0.015) {
      const pInnerX = pt.x + r.x * halfW;
      const pInnerZ = pt.z + r.z * halfW;
      const pCrestX = pt.x + r.x * (halfW + kerbWidth * 0.4);
      const pCrestZ = pt.z + r.z * (halfW + kerbWidth * 0.4);
      const pOuterX = pt.x + r.x * (halfW + kerbWidth);
      const pOuterZ = pt.z + r.z * (halfW + kerbWidth);

      rightKerbPos.push(pInnerX, pt.y + 0.01, pInnerZ);
      rightKerbUv.push(0, i * 0.1);
      rightKerbPos.push(pCrestX, pt.y + kerbHeight, pCrestZ);
      rightKerbUv.push(0.5, i * 0.1);
      rightKerbPos.push(pOuterX, pt.y + 0.02, pOuterZ);
      rightKerbUv.push(1, i * 0.1);

      if (rightKerbVertCount >= 3) {
        const c = rightKerbVertCount;
        const p = c - 3;
        rightKerbIdx.push(p, c, p + 1);
        rightKerbIdx.push(p + 1, c, c + 1);
        rightKerbIdx.push(p + 1, c + 1, p + 2);
        rightKerbIdx.push(p + 2, c + 1, c + 2);
      }
      rightKerbVertCount += 3;
    } else {
      rightKerbVertCount = 0;
    }
  }

  if (leftKerbPos.length > 0) {
    const leftKerbGeo = new THREE.BufferGeometry();
    leftKerbGeo.setAttribute('position', new THREE.Float32BufferAttribute(leftKerbPos, 3));
    leftKerbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(leftKerbUv, 2));
    leftKerbGeo.setIndex(leftKerbIdx);
    leftKerbGeo.computeVertexNormals();
    const leftKerbMesh = new THREE.Mesh(leftKerbGeo, kerbMat);
    leftKerbMesh.castShadow = true;
    leftKerbMesh.receiveShadow = true;
    scene.add(leftKerbMesh);
  }

  if (rightKerbPos.length > 0) {
    const rightKerbGeo = new THREE.BufferGeometry();
    rightKerbGeo.setAttribute('position', new THREE.Float32BufferAttribute(rightKerbPos, 3));
    rightKerbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rightKerbUv, 2));
    rightKerbGeo.setIndex(rightKerbIdx);
    rightKerbGeo.computeVertexNormals();
    const rightKerbMesh = new THREE.Mesh(rightKerbGeo, kerbMat);
    rightKerbMesh.castShadow = true;
    rightKerbMesh.receiveShadow = true;
    scene.add(rightKerbMesh);
  }

  // 4. Runoff Verge & Gravel Traps
  const runoffPos: number[] = [];
  const runoffUv: number[] = [];
  const runoffIdx: number[] = [];

  const runoffWidth = 3.5;
  for (let i = 0; i <= divisions; i++) {
    const ptIdx = i % divisions;
    const pt = sampledPoints[ptIdx];
    const r = rights[ptIdx];
    const uFraction = i / divisions;

    const lInnerX = pt.x - r.x * halfW;
    const lInnerZ = pt.z - r.z * halfW;
    const lOuterX = pt.x - r.x * (halfW + runoffWidth);
    const lOuterZ = pt.z - r.z * (halfW + runoffWidth);

    runoffPos.push(lOuterX, pt.y - 0.02, lOuterZ);
    runoffUv.push(0, uFraction);
    runoffPos.push(lInnerX, pt.y - 0.01, lInnerZ);
    runoffUv.push(1, uFraction);

    const rInnerX = pt.x + r.x * halfW;
    const rInnerZ = pt.z + r.z * halfW;
    const rOuterX = pt.x + r.x * (halfW + runoffWidth);
    const rOuterZ = pt.z + r.z * (halfW + runoffWidth);

    runoffPos.push(rInnerX, pt.y - 0.01, rInnerZ);
    runoffUv.push(0, uFraction);
    runoffPos.push(rOuterX, pt.y - 0.02, rOuterZ);
    runoffUv.push(1, uFraction);

    if (i < divisions) {
      const base = i * 4;
      runoffIdx.push(base, base + 1, base + 4);
      runoffIdx.push(base + 1, base + 5, base + 4);
      runoffIdx.push(base + 2, base + 3, base + 6);
      runoffIdx.push(base + 3, base + 7, base + 6);
    }
  }

  const runoffGeo = new THREE.BufferGeometry();
  runoffGeo.setAttribute('position', new THREE.Float32BufferAttribute(runoffPos, 3));
  runoffGeo.setAttribute('uv', new THREE.Float32BufferAttribute(runoffUv, 2));
  runoffGeo.setIndex(runoffIdx);
  runoffGeo.computeVertexNormals();

  const gravelTex = getOrCreateGravelTexture();
  const runoffMat = new THREE.MeshStandardMaterial({
    map: gravelTex,
    roughness: 0.95,
    metalness: 0.05,
  });
  const runoffMesh = new THREE.Mesh(runoffGeo, runoffMat);
  runoffMesh.receiveShadow = true;
  scene.add(runoffMesh);

  // 5. Armco Safety Barriers
  const barrierOffset = halfW + 1.2;
  const barrierHeight = 1.2;
  const armcoTex = getOrCreateArmcoTexture(trackData.barrierColor, isNeon);
  const barrierMat = new THREE.MeshStandardMaterial({
    map: armcoTex,
    metalness: 0.85,
    roughness: 0.28,
  });

  const barrierPos: number[] = [];
  const barrierUv: number[] = [];
  const barrierIdx: number[] = [];

  for (let i = 0; i <= divisions; i++) {
    const ptIdx = i % divisions;
    const pt = sampledPoints[ptIdx];
    const r = rights[ptIdx];
    const uFraction = i / divisions;

    const lX = pt.x - r.x * barrierOffset;
    const lZ = pt.z - r.z * barrierOffset;
    barrierPos.push(lX, pt.y, lZ);
    barrierUv.push(uFraction * 32, 0);
    barrierPos.push(lX, pt.y + barrierHeight, lZ);
    barrierUv.push(uFraction * 32, 1);

    const rX = pt.x + r.x * barrierOffset;
    const rZ = pt.z + r.z * barrierOffset;
    barrierPos.push(rX, pt.y, rZ);
    barrierUv.push(uFraction * 32, 0);
    barrierPos.push(rX, pt.y + barrierHeight, rZ);
    barrierUv.push(uFraction * 32, 1);

    if (i < divisions) {
      const base = i * 4;
      barrierIdx.push(base, base + 1, base + 4);
      barrierIdx.push(base + 1, base + 5, base + 4);
      barrierIdx.push(base + 2, base + 6, base + 3);
      barrierIdx.push(base + 3, base + 6, base + 7);
    }
  }

  const barrierGeo = new THREE.BufferGeometry();
  barrierGeo.setAttribute('position', new THREE.Float32BufferAttribute(barrierPos, 3));
  barrierGeo.setAttribute('uv', new THREE.Float32BufferAttribute(barrierUv, 2));
  barrierGeo.setIndex(barrierIdx);
  barrierGeo.computeVertexNormals();

  const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
  barrierMesh.castShadow = true;
  barrierMesh.receiveShadow = true;
  scene.add(barrierMesh);

  // 6. Trackside Infrastructure: Brake Boards, Sector Gantries, Marshal Posts
  const infraGroup = new THREE.Group();

  // Starting Grid Markings (15 FIA boxes)
  infraGroup.add(createStartingGridDecals(trackData.startGridSlots));

  // Brake marker distance boards (150m, 100m, 50m before heavy braking zones)
  for (let i = 0; i < divisions; i++) {
    if (Math.abs(curvatures[i]) > 0.05 && Math.abs(curvatures[(i - 12 + divisions) % divisions]) < 0.02) {
      [
        { idx: (i - 18 + divisions) % divisions, text: '150' },
        { idx: (i - 12 + divisions) % divisions, text: '100' },
        { idx: (i - 6 + divisions) % divisions, text: '50' },
      ].forEach(({ idx, text }) => {
        const pt = sampledPoints[idx];
        const r = rights[idx];
        const bPos = new THREE.Vector3().addVectors(pt, r.clone().multiplyScalar(halfW + 2.5));
        
        if (isOutsideTrackSafetyCorridor(bPos.x, bPos.z, sampledPoints, 1.0, 1.5)) {
          const board = createBrakeBoardMesh(text);
          board.position.set(bPos.x, bPos.y, bPos.z);
          board.lookAt(new THREE.Vector3().addVectors(bPos, tangents[idx]));
          infraGroup.add(board);
        }
      });
    }
  }

  // Sector Timing Gantries (Sector 1, Sector 2, Sector 3)
  const sectorInterval = Math.floor(divisions / 3);
  ['SECTOR 1 // TIMING', 'SECTOR 2 // TIMING', 'SECTOR 3 // SPEED TRAP'].forEach((label, sIdx) => {
    const sPosIdx = (sIdx + 1) * sectorInterval % divisions;
    const pt = sampledPoints[sPosIdx];
    const t = tangents[sPosIdx];
    const gantry = createSectorTimingGantry(label);
    gantry.position.set(pt.x, pt.y, pt.z);
    gantry.lookAt(new THREE.Vector3().addVectors(pt, t));
    infraGroup.add(gantry);
  });

  // Marshal Posts along the circuit (varied positioning specifically at turn entry points & corner observation stations)
  let marshalCount = 0;
  for (let i = 0; i < divisions; i++) {
    const currCurv = Math.abs(curvatures[i]);
    const prevCurv = Math.abs(curvatures[(i - 12 + divisions) % divisions]);

    // 1. Turn Entry Point Detection (transitioning from straight into turn)
    const isTurnEntry = currCurv > 0.03 && prevCurv < 0.02;
    // 2. Regular interval observation post
    const isIntervalPost = i % 70 === 0;

    if (isTurnEntry || isIntervalPost) {
      const pt = sampledPoints[i];
      const r = rights[i];
      const t = tangents[i];
      const curvSign = curvatures[i] >= 0 ? 1 : -1;

      // Turn entry: place on outside of turn entry (opposite to turn apex direction)
      // or alternate for interval posts
      const side = isTurnEntry ? -curvSign : (marshalCount % 2 === 0 ? 1 : -1);
      const mOffset = halfW + (isTurnEntry ? 4.2 : 3.6);
      const mPos = new THREE.Vector3().addVectors(pt, r.clone().multiplyScalar(side * mOffset));

      if (isOutsideTrackSafetyCorridor(mPos.x, mPos.z, sampledPoints, 2.2, 1.8)) {
        const variant = isTurnEntry ? (marshalCount % 2) : 2; // Variant 0 (Elevated Tower) or 1 (Barrier Post) for entries, 2 (Observation Hut) for straights
        const isGreen = marshalCount % 3 !== 0; // Mix of green and yellow caution flags
        const post = createMarshalStationMesh(variant, isGreen);
        post.position.set(mPos.x, mPos.y, mPos.z);

        // Turn entry posts face towards oncoming cars on the approach straight
        if (isTurnEntry) {
          post.lookAt(new THREE.Vector3().addVectors(mPos, t.clone().multiplyScalar(-1)));
        } else {
          post.lookAt(new THREE.Vector3().addVectors(mPos, t));
        }

        infraGroup.add(post);
        marshalCount++;
      }
    }
  }

  scene.add(infraGroup);

  // Sponsor Advertising Boards along fast straights
  const sponsorGroup = new THREE.Group();
  let sponsorCounter = 0;
  for (let i = 0; i < divisions; i += 28) {
    if (Math.abs(curvatures[i]) < 0.03) {
      const pt = sampledPoints[i];
      const r = rights[i];
      const side = sponsorCounter % 2 === 0 ? 1 : -1;
      const bPos = new THREE.Vector3().addVectors(pt, r.clone().multiplyScalar(side * (halfW + 1.7)));

      if (isOutsideTrackSafetyCorridor(bPos.x, bPos.z, sampledPoints, 2.0, 1.0)) {
        const sMat = new THREE.MeshStandardMaterial({
          map: createSponsorBannerTexture(sponsorCounter),
          metalness: 0.4,
          roughness: 0.3,
        });
        const sMesh = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.4, 0.15), sMat);
        sMesh.position.set(bPos.x, bPos.y + 1.2, bPos.z);
        sMesh.lookAt(new THREE.Vector3().addVectors(bPos, r.clone().multiplyScalar(-side)));
        sMesh.castShadow = true;
        sponsorGroup.add(sMesh);
        sponsorCounter++;
      }
    }
  }
  scene.add(sponsorGroup);

  // Grandstands with tiered spectator seating, canopy roofs, and live crowd
  const grandstandGroup = new THREE.Group();
  for (let i = 10; i < divisions; i += 65) {
    if (Math.abs(curvatures[i]) < 0.06) {
      const pt = sampledPoints[i];
      const r = rights[i];
      const standPos = new THREE.Vector3().addVectors(pt, r.clone().multiplyScalar(halfW + 12.0));

      if (isOutsideTrackSafetyCorridor(standPos.x, standPos.z, sampledPoints, 12.0, 4.0)) {
        const stand = createGrandstandMesh(isNeon);
        stand.position.set(standPos.x, standPos.y, standPos.z);
        stand.lookAt(new THREE.Vector3().addVectors(standPos, r.clone().multiplyScalar(-1)));
        grandstandGroup.add(stand);
      }
    }
  }
  scene.add(grandstandGroup);

  // Themed Environmental Scenery
  let oceanMesh: THREE.Mesh | undefined;
  if (isHarbor) {
    oceanMesh = buildHarborEnvironment(scene, sampledPoints, rights);
  } else if (isDesert) {
    buildDesertEnvironment(scene, sampledPoints, rights);
  } else if (isNeon) {
    buildNeonEnvironment(scene, sampledPoints, tangents, rights);
  }

  return { trackMesh, oceanMesh };
}

/**
 * Harbor GP theme: luxury yachts, palm trees, ocean water, coastal promenade.
 */
function buildHarborEnvironment(
  scene: THREE.Scene,
  sampledPoints: THREE.Vector3[],
  rights: THREE.Vector3[]
): THREE.Mesh {
  const waterGeo = new THREE.PlaneGeometry(1600, 1600, 32, 32);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x004477,
    roughness: 0.08,
    metalness: 0.92,
  });
  const oceanMesh = new THREE.Mesh(waterGeo, waterMat);
  oceanMesh.position.set(60, -1.0, 0);
  oceanMesh.receiveShadow = true;
  scene.add(oceanMesh);

  // Detailed luxury yachts moored in open ocean bay
  const yachtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.1 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });

  for (let i = 0; i < 18; i++) {
    const yAngle = i * 0.38;
    const yDist = 135 + (i % 4) * 28;
    const yX = 80 + Math.cos(yAngle) * yDist;
    const yZ = 60 + Math.sin(yAngle) * yDist;

    if (isOutsideTrackSafetyCorridor(yX, yZ, sampledPoints, 14.0, 10.0)) {
      const yacht = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.2, 22), yachtMat);
      hull.position.set(0, 0.5, 0);
      yacht.add(hull);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.2, 21), woodMat);
      deck.position.set(0, 2.15, 0);
      yacht.add(deck);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.4, 11), yachtMat);
      cabin.position.set(0, 3.4, -1);
      yacht.add(cabin);

      const win = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.0, 4.5), glassMat);
      win.position.set(0, 4.0, 2);
      yacht.add(win);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 6.0, 6), yachtMat);
      mast.position.set(0, 6.5, -2);
      yacht.add(mast);

      yacht.position.set(yX, -0.6, yZ);
      yacht.rotation.y = yAngle + Math.PI / 4;
      scene.add(yacht);
    }
  }

  // Coastal Promenade Palm Trees & Streetlamps along the inland verge
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3825, roughness: 0.9 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  for (let i = 0; i < rights.length; i += 28) {
    const pt = sampledPoints[i];
    const r = rights[i];
    const treePos = new THREE.Vector3().addVectors(pt, r.clone().multiplyScalar(-16.0));

    if (isOutsideTrackSafetyCorridor(treePos.x, treePos.z, sampledPoints, 2.5, 4.0)) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7.5, 7), trunkMat);
      trunk.position.set(0, 3.75, 0);
      trunk.castShadow = true;
      tree.add(trunk);

      const fronds = new THREE.Mesh(new THREE.ConeGeometry(3.5, 3.0, 6), frondMat);
      fronds.position.set(0, 8.0, 0);
      fronds.castShadow = true;
      tree.add(fronds);

      tree.position.set(treePos.x, treePos.y, treePos.z);
      scene.add(tree);

      // Promenade Streetlamp
      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6.5, 6), lampMat);
      pole.position.set(0, 3.25, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.12), lampMat);
      arm.position.set(0.6, 6.4, 0);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), bulbMat);
      bulb.position.set(1.2, 6.3, 0);
      lamp.add(pole, arm, bulb);
      lamp.position.set(treePos.x + 4, treePos.y, treePos.z);
      scene.add(lamp);
    }
  }

  return oceanMesh;
}

/**
 * Desert Velocity theme: massive sandstone mesas, stadium floodlight towers, and sand dunes.
 */
function buildDesertEnvironment(
  scene: THREE.Scene,
  sampledPoints: THREE.Vector3[],
  rights: THREE.Vector3[]
) {
  const groundGeo = new THREE.PlaneGeometry(1800, 1800);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.98,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(60, -0.2, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // Sandstone mesas & rocky canyon bluffs
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.95 });
  
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    const rad = 200 + (i % 6) * 55;
    const mX = Math.cos(angle) * rad;
    const mZ = Math.sin(angle) * rad;
    const mesaRadius = 22 + (i % 4) * 8;

    if (isOutsideTrackSafetyCorridor(mX, mZ, sampledPoints, mesaRadius, 8.0)) {
      const mesa = new THREE.Mesh(
        new THREE.CylinderGeometry(mesaRadius * 0.7, mesaRadius, 30 + (i % 5) * 8, 7),
        rockMat
      );
      mesa.position.set(mX, 15, mZ);
      mesa.castShadow = true;
      scene.add(mesa);
    }
  }

  // Grand Prix Stadium Floodlight Towers
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.25 });
  const lightHeadMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });

  for (let i = 15; i < rights.length; i += 45) {
    const pt = sampledPoints[i];
    const r = rights[i];
    const towerPos = new THREE.Vector3().addVectors(pt, r.clone().multiplyScalar(16.0));

    if (isOutsideTrackSafetyCorridor(towerPos.x, towerPos.z, sampledPoints, 2.5, 4.0)) {
      const tower = new THREE.Group();
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, 18, 6), towerMat);
      pylon.position.set(0, 9, 0);
      pylon.castShadow = true;
      tower.add(pylon);

      const head = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.8, 1.2), lightHeadMat);
      head.position.set(0, 18, 0);
      head.lookAt(new THREE.Vector3().addVectors(head.position, r.clone().multiplyScalar(-1)));
      tower.add(head);

      tower.position.set(towerPos.x, towerPos.y, towerPos.z);
      scene.add(tower);
    }
  }
}

/**
 * Neon District theme: cyberpunk skyscrapers, illuminated overhead tunnel arches.
 */
function buildNeonEnvironment(
  scene: THREE.Scene,
  sampledPoints: THREE.Vector3[],
  tangents: THREE.Vector3[],
  rights: THREE.Vector3[]
) {
  const bldgMat = new THREE.MeshStandardMaterial({
    color: 0x090b14,
    roughness: 0.25,
    metalness: 0.85,
  });

  // Cyberpunk skyscrapers: strictly placed outside the track safety corridor
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2;
    const rad = 150 + (i % 5) * 50;
    const bX = Math.cos(angle) * rad;
    const bZ = Math.sin(angle) * rad;
    const bldgHalfWidth = 14 + (i % 3) * 6;

    if (isOutsideTrackSafetyCorridor(bX, bZ, sampledPoints, bldgHalfWidth, 8.0)) {
      const height = 50 + (i % 6) * 25;
      const bldg = new THREE.Mesh(
        new THREE.BoxGeometry(bldgHalfWidth * 1.8, height, bldgHalfWidth * 1.8),
        bldgMat
      );
      bldg.position.set(bX, height / 2, bZ);
      bldg.castShadow = true;
      scene.add(bldg);

      const ribColor = i % 2 === 0 ? 0x00f0ff : 0xff007f;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, height, 1.4),
        new THREE.MeshBasicMaterial({ color: ribColor })
      );
      rib.position.set(bX, height / 2, bZ);
      scene.add(rib);
    }
  }

  // Futuristic illuminated overhead tunnel arches
  const archMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9, roughness: 0.2 });
  const neonRingMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  for (let i = 280; i < 360; i += 24) {
    const pt = sampledPoints[i];
    const t = tangents[i];

    const arch = new THREE.Group();

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9.0, 1.4), archMat);
    leftLeg.position.set(-12.0, 4.5, 0);
    arch.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9.0, 1.4), archMat);
    rightLeg.position.set(12.0, 4.5, 0);
    arch.add(rightLeg);

    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(25.4, 1.4, 1.8), archMat);
    topBeam.position.set(0, 8.5, 0);
    arch.add(topBeam);

    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(22.0, 0.35, 0.35), neonRingMat);
    neonStrip.position.set(0, 7.6, 0.9);
    arch.add(neonStrip);

    arch.position.set(pt.x, pt.y, pt.z);
    arch.lookAt(new THREE.Vector3().addVectors(pt, t));
    scene.add(arch);
  }
}
