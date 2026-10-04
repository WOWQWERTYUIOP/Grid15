import * as THREE from 'three';
import { TrackData, PowerUpBox, PlayerPhysicsState, Player, CarCustomization } from '../types/game';
import { createOpenWheelCarMesh, CarVisualObject } from './carModel';
import { POWER_UPS } from '../config/powerups';
import { buildProfessionalTrackEnvironment } from './trackVisuals';

export interface RendererOptions {
  container: HTMLElement;
  trackData: TrackData;
  localPlayerId: string;
  cameraDistance?: number;
  cameraHeight?: number;
}

export class RaceRenderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private trackData: TrackData;
  private localPlayerId: string;

  // Car visual mesh map
  private carMeshes: Map<string, CarVisualObject> = new Map();
  private remoteTargets: Map<string, { x: number; y: number; z: number; rotationY: number; speed: number; steer: number }> = new Map();
  private powerUpMeshes: Map<number, THREE.Group> = new Map();

  // Environmental meshes
  private trackMesh: THREE.Mesh | null = null;
  private oceanWaterMesh: THREE.Mesh | null = null;
  private animFrameId: number | null = null;

  // Collision Sparks Particle System
  private sparkParticles: THREE.Points | null = null;
  private sparkVelocities: THREE.Vector3[] = [];
  private sparkLifetimes: number[] = [];

  // Camera dynamics
  public cameraOffset = new THREE.Vector3(0, 2.4, -6.0);
  public cameraLookOffset = new THREE.Vector3(0, 1.0, 5.0);
  private currentCameraPos = new THREE.Vector3(0, 5, -10);
  private currentCameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraShakeIntensity = 0;
  private baseFov = 65;

  // Lighting
  private dirLight: THREE.DirectionalLight | null = null;

  constructor(options: RendererOptions) {
    this.container = options.container;
    this.trackData = options.trackData;
    this.localPlayerId = options.localPlayerId;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.trackData.skyColor);
    this.scene.fog = new THREE.FogExp2(this.trackData.fogColor, 0.0035);

    // Camera
    const aspect = this.container.clientWidth / this.container.clientHeight || 16 / 9;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.1, 1500);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.buildTrackEnvironment();
    this.setupResizeListener();
  }

  private setupLighting() {
    const theme = this.trackData.theme;

    if (theme === 'desert') {
      const ambient = new THREE.AmbientLight(0xffedd5, 0.75); // Warm desert sunlight ambient
      this.scene.add(ambient);

      const desertHemi = new THREE.HemisphereLight(0xfef3c7, 0x9a3412, 0.65);
      this.scene.add(desertHemi);

      this.dirLight = new THREE.DirectionalLight(0xffedd5, 1.6);
      this.dirLight.position.set(120, 160, 90);
    } else if (theme === 'harbor') {
      const ambient = new THREE.AmbientLight(0xf0f9ff, 0.7); // Bright coastal ambient
      this.scene.add(ambient);

      const seaHemi = new THREE.HemisphereLight(0xe0f2fe, 0x0369a1, 0.6);
      this.scene.add(seaHemi);

      this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
      this.dirLight.position.set(100, 150, 80);
    } else {
      // Neon night
      const ambient = new THREE.AmbientLight(0x1e1b4b, 0.5);
      this.scene.add(ambient);

      const cyberHemi = new THREE.HemisphereLight(0x00f0ff, 0xff007f, 0.85);
      this.scene.add(cyberHemi);

      this.dirLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
      this.dirLight.position.set(100, 150, 80);
    }

    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 500;
    this.dirLight.shadow.camera.left = -150;
    this.dirLight.shadow.camera.right = 150;
    this.dirLight.shadow.camera.top = 150;
    this.dirLight.shadow.camera.bottom = -150;
    this.scene.add(this.dirLight);
  }

  // Professional procedural circuit environment generation
  private buildTrackEnvironment() {
    const { trackMesh, oceanMesh } = buildProfessionalTrackEnvironment(this.scene, this.trackData);
    this.trackMesh = trackMesh;
    if (oceanMesh) {
      this.oceanWaterMesh = oceanMesh;
    }

    // Start/Finish Gantry, FIA 5-pod starting lights & checkered line
    this.createStartFinishArch();
  }

  private createStartFinishArch() {
    const archGroup = new THREE.Group();

    // Main Overhead Truss
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.9, roughness: 0.2 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.8, roughness: 0.3 });

    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 1.2), pillarMat);
    leftPillar.position.set(-11, 4.5, 0);

    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 1.2), pillarMat);
    rightPillar.position.set(11, 4.5, 0);

    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(23.2, 1.8, 1.8), trussMat);
    topBeam.position.set(0, 8.5, 0);

    // 5 FIA Starting Lights pods on the overhead beam
    for (let lightIdx = 0; lightIdx < 5; lightIdx++) {
      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.4, 16),
        new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8, roughness: 0.3 })
      );
      pod.rotation.x = Math.PI / 2;
      pod.position.set(-4 + lightIdx * 2.0, 7.2, 0.95);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })
      );
      bulb.position.set(0, 0.18, 0);
      pod.add(bulb);
      archGroup.add(pod);
    }

    // Holographic Start/Finish Banner
    const bannerGeo = new THREE.PlaneGeometry(16, 2.2);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 1008, 240);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 72px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GRID // 15  START / FINISH', 512, 145);

    const bannerTex = new THREE.CanvasTexture(canvas);
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide });
    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.position.set(0, 8.5, 0.95);

    archGroup.add(leftPillar, rightPillar, topBeam, bannerMesh);

    // Starting Line Chequered Ground Decal
    const lineGeo = new THREE.PlaneGeometry(16, 2.5);
    lineGeo.rotateX(-Math.PI / 2);
    const lineCanvas = document.createElement('canvas');
    lineCanvas.width = 256;
    lineCanvas.height = 64;
    const lctx = lineCanvas.getContext('2d')!;
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 4; y++) {
        lctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#111827';
        lctx.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    const lineTex = new THREE.CanvasTexture(lineCanvas);
    const lineMat = new THREE.MeshStandardMaterial({ map: lineTex, roughness: 0.6 });
    const startLine = new THREE.Mesh(lineGeo, lineMat);
    startLine.position.set(0, 0.08, 0);

    archGroup.add(startLine);
    this.scene.add(archGroup);
  }

  private createNameTagSprite(username: string, isLocal: boolean): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    // Background rounded box
    ctx.fillStyle = 'rgba(8, 12, 22, 0.72)';
    const radius = 16;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(384 - radius, 0);
    ctx.quadraticCurveTo(384, 0, 384, radius);
    ctx.lineTo(384, 96 - radius);
    ctx.quadraticCurveTo(384, 96, 384 - radius, 96);
    ctx.lineTo(radius, 96);
    ctx.quadraticCurveTo(0, 96, 0, 96 - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    // Glow border
    ctx.strokeStyle = isLocal ? 'rgba(0, 240, 255, 0.85)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Username Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const displayName = isLocal ? `YOU // ${username.toUpperCase()}` : username.toUpperCase();
    ctx.fillText(displayName, 192, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.4, 0.6, 1);
    return sprite;
  }

  // Sync player car 3D representations with interpolation for remote cars
  public syncPlayers(players: Player[], dt = 0.016, localPredictedState?: PlayerPhysicsState | null) {
    const activeIds = new Set<string>();

    for (const player of players) {
      if (player.state.finished && player.state.isQuit) continue; // clean up quit players
      activeIds.add(player.id);
      let carObj = this.carMeshes.get(player.id);

      const pState = (player.id === this.localPlayerId && localPredictedState) ? localPredictedState : player.state;

      // Sanitize physics state coordinates
      const px = Number.isFinite(pState.x) ? pState.x : 0;
      const py = Number.isFinite(pState.y) ? pState.y : 0.1;
      const pz = Number.isFinite(pState.z) ? pState.z : 0;
      const protY = Number.isFinite(pState.rotationY) ? pState.rotationY : 0;

      if (!carObj) {
        carObj = createOpenWheelCarMesh(player.carConfig);
        this.carMeshes.set(player.id, carObj);
        this.scene.add(carObj.root);
        carObj.root.position.set(px, py, pz);
        carObj.root.rotation.y = protY;
      }

      // 1. Manage username floating 3D nametags above vehicle
      let nameTag = carObj.root.getObjectByName('NameTagSprite') as THREE.Sprite | undefined;
      if (!nameTag) {
        nameTag = this.createNameTagSprite(player.name, player.id === this.localPlayerId);
        nameTag.name = 'NameTagSprite';
        nameTag.position.set(0, 1.48, 0); // Positioned above the safety halo
        carObj.root.add(nameTag);
      }

      // Distance-based adaptive scaling and visibility
      const dist = this.camera.position.distanceTo(carObj.root.position);
      if (player.id === this.localPlayerId) {
        nameTag.visible = true;
        nameTag.scale.set(1.4, 0.35, 1);
      } else {
        if (dist < 4) {
          nameTag.visible = true;
          nameTag.scale.set(1.4, 0.35, 1);
        } else if (dist > 115) {
          nameTag.visible = false;
        } else {
          nameTag.visible = true;
          const scale = Math.min(3.2, 1.4 + (dist - 4) * 0.02);
          nameTag.scale.set(scale, scale * 0.25, 1);
        }
      }

      const isBraking = (pState.pitch !== undefined && pState.pitch < -0.015);
      const isGripBoosted = Boolean(pState.gripBoostTimer && pState.gripBoostTimer > 0);
      const isDraftStreaming = Boolean(
        (pState.draftStreamTimer && pState.draftStreamTimer > 0) ||
        pState.slipstreamFactor > 0.4
      );

      if (player.id === this.localPlayerId) {
        // Local car: direct high-frequency prediction representation (NO LERP delay)
        carObj.root.position.set(px, py, pz);
        carObj.root.rotation.y = protY;

        carObj.updateVisualState(
          pState.steerAngle,
          pState.speed,
          pState.isBoosting || Boolean(pState.turboTimer && pState.turboTimer > 0),
          pState.hasShield,
          pState.isDrifting,
          dt,
          pState.pitch,
          pState.roll,
          isBraking,
          isGripBoosted,
          isDraftStreaming,
          pState.suspensionCompression
        );
      } else {
        // Remote car: smooth Hermite/LERP interpolation towards target snapshot
        let target = this.remoteTargets.get(player.id);
        if (!target) {
          target = {
            x: px,
            y: py,
            z: pz,
            rotationY: protY,
            speed: pState.speed,
            steer: pState.steerAngle,
          };
          this.remoteTargets.set(player.id, target);
        } else {
          target.x = px;
          target.y = py;
          target.z = pz;
          target.rotationY = protY;
          target.speed = pState.speed;
          target.steer = pState.steerAngle;
        }

        // Interpolate position smoothly
        const lerpFactor = Math.min(1.0, 16.0 * dt);
        carObj.root.position.x += (target.x - carObj.root.position.x) * lerpFactor;
        carObj.root.position.y += (target.y - carObj.root.position.y) * lerpFactor;
        carObj.root.position.z += (target.z - carObj.root.position.z) * lerpFactor;

        // Shortest-arc angle lerp
        const currentAngle = carObj.root.rotation.y;
        let targetAngle = target.rotationY;
        let angleDiff = (targetAngle - currentAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        carObj.root.rotation.y += angleDiff * lerpFactor;

        carObj.updateVisualState(
          pState.steerAngle,
          pState.speed,
          pState.isBoosting || Boolean(pState.turboTimer && pState.turboTimer > 0),
          pState.hasShield,
          pState.isDrifting,
          dt,
          pState.pitch,
          pState.roll,
          isBraking,
          isGripBoosted,
          isDraftStreaming,
          pState.suspensionCompression
        );
      }
    }

    // Clean up disconnected player cars
    for (const [id, carObj] of this.carMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(carObj.root);
        this.carMeshes.delete(id);
        this.remoteTargets.delete(id);
      }
    }
  }

  // Sync Power-Up Boxes
  public syncPowerUps(powerUps: PowerUpBox[]) {
    for (const box of powerUps) {
      let meshGroup = this.powerUpMeshes.get(box.id);

      if (!meshGroup) {
        meshGroup = new THREE.Group();
        const config = POWER_UPS[box.type];
        const hexColor = config ? config.color : '#00f0ff';

        // Floating Diamond Crystal
        const crystalGeo = new THREE.OctahedronGeometry(1.2, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
          color: hexColor,
          emissive: hexColor,
          emissiveIntensity: 0.8,
          metalness: 0.9,
          roughness: 0.1,
          transparent: true,
          opacity: 0.85,
        });
        const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
        meshGroup.add(crystalMesh);

        // Ground Glow Ring
        const ringGeo = new THREE.RingGeometry(0.8, 1.4, 16);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: hexColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.5,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.y = -0.9;
        meshGroup.add(ringMesh);

        meshGroup.position.set(box.x, box.y + 1.2, box.z);
        this.scene.add(meshGroup);
        this.powerUpMeshes.set(box.id, meshGroup);
      }

      meshGroup.visible = box.active;
      if (box.active) {
        meshGroup.rotation.y += 0.035;
        meshGroup.position.y = box.y + 1.2 + Math.sin(Date.now() * 0.004 + box.id) * 0.25;
      }
    }
  }

  // Trigger camera shake effect on collision or blast (restrained to avoid screen disorientation)
  public triggerCameraShake(amount = 0.25) {
    this.cameraShakeIntensity = Math.min(0.40, this.cameraShakeIntensity + amount);
  }

  // Update dynamic chase camera
  public updateCamera(localPlayerState: PlayerPhysicsState, dt: number) {
    if (!localPlayerState) return;

    const px = Number.isFinite(localPlayerState.x) ? localPlayerState.x : 0;
    const py = Number.isFinite(localPlayerState.y) ? localPlayerState.y : 0.1;
    const pz = Number.isFinite(localPlayerState.z) ? localPlayerState.z : 0;
    const carPos = new THREE.Vector3(px, py, pz);
    const carRotY = Number.isFinite(localPlayerState.rotationY) ? localPlayerState.rotationY : 0;

    // Forward and Right vectors of car
    const fwdX = Math.sin(carRotY);
    const fwdZ = Math.cos(carRotY);
    const rightX = Math.cos(carRotY);
    const rightZ = -Math.sin(carRotY);

    // Higher speed pulls camera slightly further back with higher elevation
    const speed = Number.isFinite(localPlayerState.speed) ? localPlayerState.speed : 0;
    const speedRatio = Math.min(1.0, Math.abs(speed) / 80);
    const dynamicDist = 6.4 + speedRatio * 1.8;
    const dynamicHeight = 2.5 + speedRatio * 0.5;

    // Camera follow offset (behind vehicle)
    const targetCamPos = new THREE.Vector3(
      carPos.x - fwdX * dynamicDist,
      carPos.y + dynamicHeight,
      carPos.z - fwdZ * dynamicDist
    );

    // Look-ahead target with corner anticipation:
    const forwardLead = 7.0 + speedRatio * 9.0;
    const steer = Number.isFinite(localPlayerState.steerAngle) ? localPlayerState.steerAngle : 0;
    const cornerLead = steer * 4.2;

    const targetLookAt = new THREE.Vector3(
      carPos.x + fwdX * forwardLead + rightX * cornerLead,
      carPos.y + 0.9,
      carPos.z + fwdZ * forwardLead + rightZ * cornerLead
    );

    // Respawn snap check: If distance jumped > 25 meters, snap immediately without wild camera sweep
    const distToTarget = this.currentCameraPos.distanceTo(targetCamPos);
    if (distToTarget > 25 || !Number.isFinite(this.currentCameraPos.x)) {
      this.currentCameraPos.copy(targetCamPos);
      this.currentCameraTarget.copy(targetLookAt);
    } else {
      // Smooth, high-stability camera lag
      const camLerp = Math.min(1.0, 8.5 * dt);
      this.currentCameraPos.lerp(targetCamPos, camLerp);
      this.currentCameraTarget.lerp(targetLookAt, camLerp * 1.15);
    }

    // Apply restrained camera shake if active (controlled, non-violent)
    if (this.cameraShakeIntensity > 0.01) {
      const shakeX = (Math.random() - 0.5) * this.cameraShakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.camera.position.set(
        this.currentCameraPos.x + shakeX,
        this.currentCameraPos.y + shakeY,
        this.currentCameraPos.z
      );
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 3.5);
    } else {
      this.camera.position.copy(this.currentCameraPos);
    }

    this.camera.lookAt(this.currentCameraTarget);

    // Dynamic FOV widening on boost & top speed
    const targetFov = this.baseFov + speedRatio * 14 + (localPlayerState.isBoosting ? 6 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1.0, dt * 5.0);
    this.camera.updateProjectionMatrix();

    // Directional sunlight follow player for crisp local shadow quality
    if (this.dirLight) {
      this.dirLight.position.set(carPos.x + 60, carPos.y + 120, carPos.z + 50);
      this.dirLight.target.position.copy(carPos);
      this.dirLight.target.updateMatrixWorld();
    }
  }

  // Render Loop
  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  private setupResizeListener() {
    const onResize = () => {
      if (!this.container) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      if (width === 0 || height === 0) return;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    };
    window.addEventListener('resize', onResize);
  }

  public dispose() {
    try {
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = 0;
      }
      if (this.renderer) {
        this.renderer.dispose();
        if (
          this.container &&
          this.renderer.domElement &&
          this.container.contains(this.renderer.domElement)
        ) {
          this.container.removeChild(this.renderer.domElement);
        }
      }
    } catch (err) {
      console.warn('⚠️ Safe renderer disposal notice:', err);
    }
  }
}
