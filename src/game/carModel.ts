import * as THREE from 'three';
import { BodyStyle, CarCustomization, WheelStyle } from '../types/game';

export interface CarVisualObject {
  root: THREE.Group;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  exhaustFlame1: THREE.Mesh;
  exhaustFlame2: THREE.Mesh;
  shieldBubble: THREE.Mesh;
  haloGlow: THREE.PointLight;
  bodyMesh: THREE.Mesh;
  updateMaterials: (config: CarCustomization) => void;
  updateVisualState: (
    steerAngle: number,
    speed: number,
    isBoosting: boolean,
    hasShield: boolean,
    isDrifting: boolean,
    dt: number,
    pitch?: number,
    roll?: number,
    isBraking?: boolean,
    isGripBoosted?: boolean,
    isDraftStreaming?: boolean,
    suspensionComp?: [number, number, number, number]
  ) => void;
}

// Generate canvas texture for race number and decals
function createDecalTexture(carNumber: number, driverName: string, primaryColor: string, secondaryColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base livery gradient stripes
  ctx.fillStyle = primaryColor;
  ctx.fillRect(0, 0, 512, 512);

  // Dynamic racing chevrons & speed cuts
  ctx.fillStyle = secondaryColor;
  ctx.beginPath();
  ctx.moveTo(0, 100);
  ctx.lineTo(512, 220);
  ctx.lineTo(512, 320);
  ctx.lineTo(0, 200);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 230, 512, 10);

  // Driver Number Circle / Hexagon
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(256, 120, 75, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Draw Number
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 80px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${carNumber}`, 256, 122);

  // Driver Name text
  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 36px Rajdhani, sans-serif';
  ctx.fillText(driverName.toUpperCase().slice(0, 12), 256, 420);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Build 3D Open-Wheel Car Mesh
export function createOpenWheelCarMesh(config: CarCustomization): CarVisualObject {
  const root = new THREE.Group();

  // Materials
  const primaryMat = new THREE.MeshStandardMaterial({
    color: config.primaryColor,
    metalness: 0.85,
    roughness: 0.25,
    envMapIntensity: 1.2,
  });

  const secondaryMat = new THREE.MeshStandardMaterial({
    color: config.secondaryColor,
    metalness: 0.7,
    roughness: 0.3,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: config.accentColor,
    emissive: config.accentColor,
    emissiveIntensity: 0.4,
    metalness: 0.5,
    roughness: 0.2,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.5,
    metalness: 0.4,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1f2421,
    roughness: 0.85,
    metalness: 0.1,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: config.wheelColor,
    metalness: 0.9,
    roughness: 0.2,
  });

  const brakeMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    metalness: 0.9,
    roughness: 0.3,
  });

  const helmetMat = new THREE.MeshStandardMaterial({
    color: config.helmetColor,
    metalness: 0.75,
    roughness: 0.15,
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    metalness: 0.95,
    roughness: 0.05,
  });

  // Main Chassis Monocoque & Nose cone
  const chassisGroup = new THREE.Group();

  // Monocoque Central Cockpit & Sidepods
  let mainBodyGeo: THREE.BufferGeometry;
  if (config.bodyStyle === 'VORTEX_GT') {
    // Sharp angular twin-keel nose
    mainBodyGeo = new THREE.BoxGeometry(0.9, 0.45, 3.2);
  } else if (config.bodyStyle === 'PHANTOM_X') {
    // Sleek stealth delta wedge
    mainBodyGeo = new THREE.ConeGeometry(0.55, 3.5, 6);
    mainBodyGeo.rotateX(Math.PI / 2);
  } else {
    // AERO_APEX: Classic refined aerodynamic open-wheel
    mainBodyGeo = new THREE.BoxGeometry(0.82, 0.42, 3.4);
  }

  const bodyMesh = new THREE.Mesh(mainBodyGeo, primaryMat);
  bodyMesh.position.set(0, 0.35, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  chassisGroup.add(bodyMesh);

  // Aerodynamic Pointed Nose Cone
  const noseGeo = new THREE.ConeGeometry(0.35, 1.4, 8);
  noseGeo.rotateX(Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeo, primaryMat);
  noseMesh.position.set(0, 0.3, 2.2);
  noseMesh.castShadow = true;
  chassisGroup.add(noseMesh);

  // Front Wing assembly
  const frontWingMain = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.5), carbonMat);
  frontWingMain.position.set(0, 0.15, 2.6);
  frontWingMain.castShadow = true;
  chassisGroup.add(frontWingMain);

  // Front Wing Endplates
  const leftEndplate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.55), accentMat);
  leftEndplate.position.set(-1.0, 0.22, 2.6);
  const rightEndplate = leftEndplate.clone();
  rightEndplate.position.x = 1.0;
  chassisGroup.add(leftEndplate, rightEndplate);

  // Sidepods (Left & Right Air Intakes)
  const sidepodGeo = new THREE.BoxGeometry(0.4, 0.38, 1.6);
  const leftSidepod = new THREE.Mesh(sidepodGeo, secondaryMat);
  leftSidepod.position.set(-0.62, 0.32, -0.1);
  leftSidepod.castShadow = true;

  const rightSidepod = new THREE.Mesh(sidepodGeo, secondaryMat);
  rightSidepod.position.set(0.62, 0.32, -0.1);
  rightSidepod.castShadow = true;
  chassisGroup.add(leftSidepod, rightSidepod);

  // Engine Airbox & Roll Hoop (Intake above driver's head)
  const airbox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.9), primaryMat);
  airbox.position.set(0, 0.68, -0.45);
  airbox.castShadow = true;
  chassisGroup.add(airbox);

  // Titanium Halo Cockpit Safety Bar
  const haloCurve = new THREE.TorusGeometry(0.3, 0.035, 8, 16, Math.PI);
  haloCurve.rotateX(-Math.PI / 2);
  const halo = new THREE.Mesh(haloCurve, carbonMat);
  halo.position.set(0, 0.65, 0.35);
  chassisGroup.add(halo);

  const haloPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.25, 8), carbonMat);
  haloPillar.position.set(0, 0.52, 0.65);
  chassisGroup.add(haloPillar);

  // Stylized Driver Torso/Shoulders inside the cockpit
  const torsoMat = new THREE.MeshStandardMaterial({
    color: config.primaryColor, // Matches team livery primary color
    metalness: 0.5,
    roughness: 0.4,
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.28), torsoMat);
  torso.position.set(0, 0.44, 0.16);
  torso.rotation.x = -0.15; // Realistic racing reclined stance
  torso.castShadow = true;
  chassisGroup.add(torso);

  // Driver Helmet & Visor attached seamlessly to Torso
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), helmetMat);
  helmet.position.set(0, 0.20, 0.02); // Positioned perfectly on top of shoulders
  helmet.castShadow = true;

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.08), visorMat);
  visor.position.set(0, 0.02, 0.11); // Placed precisely on front face of helmet
  helmet.add(visor);
  torso.add(helmet);

  // Rear Wing Assembly with DRS Winglets
  const rearWingMain = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.06, 0.4), carbonMat);
  rearWingMain.position.set(0, 0.85, -1.75);
  rearWingMain.castShadow = true;
  chassisGroup.add(rearWingMain);

  const rearWingUpperFlap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.25), accentMat);
  rearWingUpperFlap.position.set(0, 0.92, -1.82);
  chassisGroup.add(rearWingUpperFlap);

  // Rear Wing Pylons & Endplates
  const leftRearEndplate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.48), secondaryMat);
  leftRearEndplate.position.set(-0.82, 0.75, -1.75);
  const rightRearEndplate = leftRearEndplate.clone();
  rightRearEndplate.position.x = 0.82;
  chassisGroup.add(leftRearEndplate, rightRearEndplate);

  const leftPylon = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6), carbonMat);
  leftPylon.position.set(-0.25, 0.55, -1.65);
  const rightPylon = leftPylon.clone();
  rightPylon.position.x = 0.25;
  chassisGroup.add(leftPylon, rightPylon);

  // Rear Diffuser
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.5), carbonMat);
  diffuser.position.set(0, 0.15, -1.85);
  diffuser.rotation.x = -0.3;
  chassisGroup.add(diffuser);

  // Suspension Wishbones (Mounted firmly to chassis, connecting to wheel uprights)
  function createSuspensionArms(isFront: boolean, isLeft: boolean): THREE.Group {
    const suspGroup = new THREE.Group();
    const signX = isLeft ? -1 : 1;
    const zPos = isFront ? 1.55 : -1.35;
    const hubX = signX * (isFront ? 0.95 : 1.02);
    const chassisX = signX * (isFront ? 0.42 : 0.48);
    const armLength = Math.abs(hubX - chassisX);

    // Upper A-Arm
    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, armLength, 8),
      carbonMat
    );
    upperArm.position.set((chassisX + hubX) / 2, 0.38, zPos);
    upperArm.rotation.z = isLeft ? -0.12 : 0.12;
    upperArm.rotation.y = isLeft ? 0.1 : -0.1;
    suspGroup.add(upperArm);

    // Lower A-Arm
    const lowerArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, armLength, 8),
      carbonMat
    );
    lowerArm.position.set((chassisX + hubX) / 2, 0.22, zPos);
    lowerArm.rotation.z = isLeft ? 0.08 : -0.08;
    lowerArm.rotation.y = isLeft ? -0.1 : 0.1;
    suspGroup.add(lowerArm);

    // Steering Tie-Rod / Pushrod (Carbon aerodynamic blade)
    const tieRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, armLength * 1.05, 8),
      carbonMat
    );
    tieRod.position.set((chassisX + hubX) / 2, 0.30, zPos + (isFront ? -0.12 : 0.1));
    tieRod.rotation.z = isLeft ? -0.22 : 0.22;
    suspGroup.add(tieRod);

    return suspGroup;
  }

  // Add all 4 suspension assemblies to chassis
  chassisGroup.add(createSuspensionArms(true, true));
  chassisGroup.add(createSuspensionArms(true, false));
  chassisGroup.add(createSuspensionArms(false, true));
  chassisGroup.add(createSuspensionArms(false, false));

  // Wheel Assembly Builder: Decouples Steering Hub from Rolling Spinner
  interface WheelAssembly {
    hub: THREE.Group;
    spinner: THREE.Group;
  }

  function createWheel(isFront: boolean, isLeft: boolean, wheelStyle: WheelStyle): WheelAssembly {
    // Hub group: Handles steering yaw (Y-axis rotation only)
    const hub = new THREE.Group();
    hub.name = isFront ? (isLeft ? 'FrontLeftHub' : 'FrontRightHub') : (isLeft ? 'RearLeftHub' : 'RearRightHub');

    // Spinner group: Handles tire rolling spin (X-axis rotation only)
    const spinner = new THREE.Group();
    spinner.name = 'WheelSpinner';
    hub.add(spinner);

    const tireRadius = isFront ? 0.32 : 0.35;
    const tireWidth = isFront ? 0.32 : 0.42;

    // Upright / Spindle Kingpin Housing (Stays oriented with hub, does not roll)
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.14), carbonMat);
    upright.position.set(isLeft ? 0.04 : -0.04, 0, 0);
    hub.add(upright);

    // Brake Caliper: Mounted to the upright hub!
    // Turns with steering, but stays fixed at the top/rear of the brake disc without rolling
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.16), brakeMat);
    caliper.position.set(isLeft ? 0.05 : -0.05, 0.14, -0.04);
    hub.add(caliper);

    // ---- INSIDE SPINNER: Components that rotate when driving ----

    // Tire Cylinder (native axis Y, rotated to axle X)
    const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 28);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    spinner.add(tire);

    // Wheel Rim
    let rimGeo: THREE.BufferGeometry;
    if (wheelStyle === 'CARBON_DISC') {
      rimGeo = new THREE.CylinderGeometry(tireRadius * 0.72, tireRadius * 0.72, tireWidth * 1.02, 20);
      rimGeo.rotateZ(Math.PI / 2);
    } else if (wheelStyle === 'AERO_TURBINE') {
      rimGeo = new THREE.CylinderGeometry(tireRadius * 0.7, tireRadius * 0.7, tireWidth * 1.01, 16);
      rimGeo.rotateZ(Math.PI / 2);
    } else {
      // FORGED_SPOKE
      rimGeo = new THREE.CylinderGeometry(tireRadius * 0.68, tireRadius * 0.68, tireWidth * 1.02, 20);
      rimGeo.rotateZ(Math.PI / 2);
    }
    const rim = new THREE.Mesh(rimGeo, rimMat);
    spinner.add(rim);

    // Centerlock Nut / Hub Cap
    const centerNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, tireWidth * 1.06, 12).rotateZ(Math.PI / 2),
      accentMat
    );
    spinner.add(centerNut);

    // Ventilated Brake Disc: Spins inside the caliper
    const brakeDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(tireRadius * 0.58, tireRadius * 0.58, tireWidth * 0.55, 20).rotateZ(Math.PI / 2),
      carbonMat
    );
    spinner.add(brakeDisc);

    return { hub, spinner };
  }

  // Four Wheels
  const flWheel = createWheel(true, true, config.wheelStyle);
  flWheel.hub.position.set(-0.95, 0.32, 1.55);

  const frWheel = createWheel(true, false, config.wheelStyle);
  frWheel.hub.position.set(0.95, 0.32, 1.55);

  const rlWheel = createWheel(false, true, config.wheelStyle);
  rlWheel.hub.position.set(-1.02, 0.35, -1.35);

  const rrWheel = createWheel(false, false, config.wheelStyle);
  rrWheel.hub.position.set(1.02, 0.35, -1.35);

  const frontLeftWheel = flWheel.hub;
  const frontRightWheel = frWheel.hub;
  const rearLeftWheel = rlWheel.hub;
  const rearRightWheel = rrWheel.hub;

  root.add(chassisGroup);
  root.add(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

  // Brake disc glow overlay meshes for high-speed deceleration
  const discGlowMat = new THREE.MeshBasicMaterial({
    color: 0xff3b00,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });

  const flBrakeGlow = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.20, 16).rotateY(Math.PI / 2), discGlowMat);
  flBrakeGlow.position.set(-0.95, 0.32, 1.55);
  const frBrakeGlow = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.20, 16).rotateY(Math.PI / 2), discGlowMat);
  frBrakeGlow.position.set(0.95, 0.32, 1.55);
  root.add(flBrakeGlow, frBrakeGlow);

  // Aero Grip Ground-Effect Underglow Vortex
  const aeroGripGeo = new THREE.RingGeometry(0.6, 1.2, 16);
  aeroGripGeo.rotateX(-Math.PI / 2);
  const aeroGripMat = new THREE.MeshBasicMaterial({
    color: 0xff007f,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const aeroGripMesh = new THREE.Mesh(aeroGripGeo, aeroGripMat);
  aeroGripMesh.position.set(0, 0.08, 0);
  root.add(aeroGripMesh);

  // Draft Stream Wake Ribbon Streamers (Rear Wing vortex)
  const wakeGeo = new THREE.PlaneGeometry(0.12, 2.2);
  wakeGeo.rotateX(-Math.PI / 2);
  const wakeMat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const leftWake = new THREE.Mesh(wakeGeo, wakeMat);
  leftWake.position.set(-0.8, 0.85, -2.8);
  const rightWake = new THREE.Mesh(wakeGeo, wakeMat);
  rightWake.position.set(0.8, 0.85, -2.8);
  root.add(leftWake, rightWake);

  // Exhaust Boost Flames (Visible during boost & acceleration)
  const flameGeo = new THREE.ConeGeometry(0.08, 0.7, 8);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0,
  });

  const exhaustFlame1 = new THREE.Mesh(flameGeo, flameMat);
  exhaustFlame1.position.set(-0.15, 0.35, -1.95);
  const exhaustFlame2 = new THREE.Mesh(flameGeo, flameMat.clone());
  exhaustFlame2.position.set(0.15, 0.35, -1.95);
  root.add(exhaustFlame1, exhaustFlame2);

  // Energy Shield Bubble (Sphere mesh around car)
  const shieldGeo = new THREE.SphereGeometry(2.3, 24, 24);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x39ff14,
    emissive: 0x39ff14,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0,
    wireframe: true,
  });
  const shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
  shieldBubble.position.set(0, 0.5, 0);
  root.add(shieldBubble);

  // Halo Underglow / Tail Safety Light
  const haloGlow = new THREE.PointLight(0xff0055, 0, 8);
  haloGlow.position.set(0, 0.35, -1.9);
  root.add(haloGlow);

  // Method to update colors and decals
  const updateMaterials = (newConfig: CarCustomization) => {
    primaryMat.color.set(newConfig.primaryColor);
    secondaryMat.color.set(newConfig.secondaryColor);
    accentMat.color.set(newConfig.accentColor);
    accentMat.emissive.set(newConfig.accentColor);
    rimMat.color.set(newConfig.wheelColor);
    helmetMat.color.set(newConfig.helmetColor);
  };

  // Method to animate wheels, steering, boost flame, and shield
  const updateVisualState = (
    steerAngle: number,
    speed: number,
    isBoosting: boolean,
    hasShield: boolean,
    isDrifting: boolean,
    dt: number,
    pitch?: number,
    roll?: number,
    isBraking?: boolean,
    isGripBoosted?: boolean,
    isDraftStreaming?: boolean,
    suspensionComp?: [number, number, number, number]
  ) => {
    // 1. STEERING GEOMETRY (Ackermann principle for open-wheel racing)
    // Left turn (steerAngle > 0): inside wheel (left) turns slightly sharper than outside wheel (right).
    // Right turn (steerAngle < 0): inside wheel (right) turns slightly sharper than outside wheel (left).
    let leftSteer = steerAngle;
    let rightSteer = steerAngle;

    if (steerAngle > 0) {
      // Turning left (counter-clockwise)
      leftSteer = steerAngle * 1.12;   // Inside wheel turns more
      rightSteer = steerAngle * 0.90;  // Outside wheel turns less
    } else if (steerAngle < 0) {
      // Turning right (clockwise)
      rightSteer = steerAngle * 1.12;  // Inside wheel turns more
      leftSteer = steerAngle * 0.90;   // Outside wheel turns less
    }

    // Apply steering ONLY to front wheel upright hubs around physical Y axis
    frontLeftWheel.rotation.y = leftSteer;
    frontRightWheel.rotation.y = rightSteer;

    // Rear wheels NEVER steer
    rearLeftWheel.rotation.y = 0;
    rearRightWheel.rotation.y = 0;

    // Vertical suspension compliance: subtle hub deflection on bumps / roll
    if (suspensionComp) {
      frontLeftWheel.position.y = 0.32 + (0.5 - suspensionComp[0]) * 0.08;
      frontRightWheel.position.y = 0.32 + (0.5 - suspensionComp[1]) * 0.08;
      rearLeftWheel.position.y = 0.35 + (0.5 - suspensionComp[2]) * 0.08;
      rearRightWheel.position.y = 0.35 + (0.5 - suspensionComp[3]) * 0.08;
    }

    // 2. WHEEL SPINNING: Rotates tires, rims & brake discs ONLY around local X axis
    // Spinner is isolated from hub steering to prevent Euler gimbal wobble
    const wheelRotDelta = (speed / 0.34) * dt;
    flWheel.spinner.rotation.x += wheelRotDelta;
    frWheel.spinner.rotation.x += wheelRotDelta;
    rlWheel.spinner.rotation.x += wheelRotDelta;
    rrWheel.spinner.rotation.x += wheelRotDelta;

    // Brake disc heating glow
    if (isBraking && speed > 10) {
      discGlowMat.opacity = Math.min(0.75, (speed / 45) * 0.75);
    } else {
      discGlowMat.opacity = Math.max(0, discGlowMat.opacity - dt * 2.5);
    }

    // Aero Grip ground-effect pulse
    if (isGripBoosted) {
      aeroGripMat.opacity = 0.65;
      aeroGripMesh.rotation.z += dt * 3.0;
    } else {
      aeroGripMat.opacity = 0;
    }

    // Draft stream wake ribbons
    if (isDraftStreaming) {
      wakeMat.opacity = 0.55;
      leftWake.scale.z = 1.0 + Math.random() * 0.3;
      rightWake.scale.z = 1.0 + Math.random() * 0.3;
    } else {
      wakeMat.opacity = 0;
    }

    // Boost flames animation
    if (isBoosting) {
      const flicker = 0.8 + Math.random() * 0.4;
      exhaustFlame1.scale.set(flicker, flicker, flicker * (1.2 + Math.random() * 0.5));
      exhaustFlame2.scale.set(flicker, flicker, flicker * (1.2 + Math.random() * 0.5));
      (exhaustFlame1.material as THREE.MeshBasicMaterial).opacity = 0.9;
      (exhaustFlame2.material as THREE.MeshBasicMaterial).opacity = 0.9;
      haloGlow.intensity = 3.5;
    } else if (speed > 40) {
      // Subtle exhaust trail on high throttle
      (exhaustFlame1.material as THREE.MeshBasicMaterial).opacity = 0.2;
      (exhaustFlame2.material as THREE.MeshBasicMaterial).opacity = 0.2;
      exhaustFlame1.scale.set(0.5, 0.5, 0.4);
      exhaustFlame2.scale.set(0.5, 0.5, 0.4);
      haloGlow.intensity = 0.8;
    } else {
      (exhaustFlame1.material as THREE.MeshBasicMaterial).opacity = 0;
      (exhaustFlame2.material as THREE.MeshBasicMaterial).opacity = 0;
      haloGlow.intensity = 0.3;
    }

    // Shield bubble pulse
    if (hasShield) {
      (shieldBubble.material as THREE.MeshStandardMaterial).opacity = 0.45;
      shieldBubble.rotation.y += dt * 2.0;
    } else {
      (shieldBubble.material as THREE.MeshStandardMaterial).opacity = 0;
    }

    // Chassis body roll during hard turns and drifts (derived from 4-wheel physics)
    const effectiveRoll = roll !== undefined ? roll : -steerAngle * Math.min(1.0, speed / 30) * 0.08;
    chassisGroup.rotation.z += (effectiveRoll - chassisGroup.rotation.z) * Math.min(1.0, dt * 14);
    
    // Pitch forward on heavy braking, rear on heavy acceleration (derived from 4-wheel physics)
    const effectivePitch = pitch !== undefined ? pitch : (isBoosting ? -0.03 : 0);
    chassisGroup.rotation.x += (effectivePitch - chassisGroup.rotation.x) * Math.min(1.0, dt * 12);
  };

  return {
    root,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,
    exhaustFlame1,
    exhaustFlame2,
    shieldBubble,
    haloGlow,
    bodyMesh,
    updateMaterials,
    updateVisualState,
  };
}
