import { TrackData } from '../types/game';

// Helper to generate starting grid positions along the start straight
function generateGridSlots(
  startX: number,
  startZ: number,
  dirX: number,
  dirZ: number,
  rightX: number,
  rightZ: number,
  count = 15,
  spacing = 8,
  lateralOffset = 3.2
) {
  const slots = [];
  const rotY = Math.atan2(dirX, dirZ);

  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1; // Left or right slot
    const row = Math.floor(i / 2);
    const distBack = (row + 1) * spacing;
    
    slots.push({
      x: startX - dirX * distBack + rightX * (side * lateralOffset),
      y: 0.1,
      z: startZ - dirZ * distBack + rightZ * (side * lateralOffset),
      rotationY: rotY,
    });
  }
  return slots;
}

// Track 1: Harbor GP (Coastal Street Circuit)
const harborPoints = [
  { x: 0, y: 0, z: 0 },         // Start/Finish straight
  { x: 0, y: 0, z: 120 },       // Main straight end
  { x: 30, y: 0, z: 170 },      // Turn 1 right
  { x: 80, y: 1, z: 200 },      // Turn 2 coastal terrace
  { x: 140, y: 2, z: 200 },     // Marina curve
  { x: 190, y: 2.5, z: 160 },   // Overpass approach
  { x: 210, y: 2, z: 100 },     // Technical hairpin 1
  { x: 170, y: 1, z: 60 },      // Infield chicane left
  { x: 120, y: 0.5, z: 70 },    // Infield chicane right
  { x: 80, y: 0, z: 20 },       // Marina basin exit
  { x: 100, y: 0, z: -60 },     // Harbor bridge south
  { x: 120, y: 1, z: -140 },    // Bridge straight
  { x: 110, y: 1.5, z: -210 },  // North pier hairpin
  { x: 60, y: 0.5, z: -240 },   // Pier apex
  { x: 0, y: 0, z: -210 },      // Promenade sweep
  { x: -40, y: 0, z: -150 },    // Yacht club kink
  { x: -50, y: 0, z: -70 },     // Final turn entry
  { x: -30, y: 0, z: -20 },     // Final turn exit onto straight
];

// Track 2: Desert Velocity (High-Speed Circuit)
const desertPoints = [
  { x: 0, y: 0, z: 0 },         // Main canyon straight
  { x: 0, y: 0, z: 220 },       // Super straight
  { x: 40, y: 2, z: 290 },      // Turn 1 sweeping right
  { x: 120, y: 4, z: 330 },     // Red rock bend
  { x: 220, y: 6, z: 300 },     // Uphill crest
  { x: 280, y: 4, z: 220 },     // Plateau straight
  { x: 290, y: 2, z: 110 },     // High-speed banked curve
  { x: 260, y: 1, z: 0 },       // Downhill transition
  { x: 210, y: 0, z: -90 },     // Dune chicane
  { x: 140, y: 0, z: -120 },    // Dune apex
  { x: 80, y: 1, z: -180 },     // Canyon entrance
  { x: 10, y: 2, z: -250 },     // Canyon pass
  { x: -70, y: 1.5, z: -260 },  // Sweeper left
  { x: -140, y: 0.5, z: -200 }, // Mirage curve
  { x: -160, y: 0, z: -110 },   // Long sweeping left
  { x: -120, y: 0, z: -30 },    // Acceleration zone
  { x: -50, y: 0, z: -10 },     // Straight entry
];

// Track 3: Neon District (Cyberpunk Night Circuit)
const neonPoints = [
  { x: 0, y: 0, z: 0 },         // Neon Strip straight
  { x: 0, y: 0, z: 160 },       // Boulevard
  { x: -40, y: 2, z: 220 },     // Skybridge ramp
  { x: -100, y: 5, z: 260 },    // Elevated highway left
  { x: -180, y: 5, z: 240 },    // Cyber plaza turn
  { x: -220, y: 4, z: 170 },    // Spiral descent
  { x: -210, y: 1, z: 80 },     // Neon tunnel entry
  { x: -160, y: 0, z: 20 },     // Underpass technical section
  { x: -90, y: 0, z: -30 },     // Underpass exit
  { x: -120, y: 2, z: -110 },   // Overpass flyover
  { x: -110, y: 4, z: -190 },   // Rooftop high-speed kink
  { x: -50, y: 3, z: -250 },    // Hologram corner
  { x: 30, y: 1.5, z: -260 },   // Downtown descent
  { x: 110, y: 0, z: -220 },    // Metro terminal turn
  { x: 140, y: 0, z: -140 },    // Grid hairpin
  { x: 100, y: 0, z: -70 },     // S-bends left
  { x: 60, y: 0, z: -30 },      // S-bends right onto start straight
];

export const TRACKS: Record<string, TrackData> = {
  'harbor-gp': {
    id: 'harbor-gp',
    name: 'HARBOR GP',
    subtitle: 'COASTAL STREET CIRCUIT',
    description: 'A prestigious waterfront track featuring tight technical marina chicanes, rapid elevation changes, and high-speed ocean straightaways.',
    difficulty: 'Medium',
    lapLengthMeters: 1850,
    cornerCount: 14,
    recommendedStyle: 'High Downforce & Precision Braking',
    theme: 'harbor',
    skyColor: '#0a192f',
    fogColor: '#0e2439',
    tarmacColor: '#1a1f2c',
    kerbColor1: '#ff2a5f',
    kerbColor2: '#ffffff',
    barrierColor: '#00d2ff',
    trackPoints: harborPoints,
    startGridSlots: generateGridSlots(0, 0, 0, 1, 1, 0, 15, 9, 3.2),
    powerUpLocations: [
      { x: 0, y: 0.5, z: 80 },
      { x: 110, y: 1.5, z: 200 },
      { x: 145, y: 1, z: 65 },
      { x: 115, y: 1.2, z: -170 },
      { x: -45, y: 0.5, z: -110 },
    ],
  },
  'desert-velocity': {
    id: 'desert-velocity',
    name: 'DESERT VELOCITY',
    subtitle: 'HIGH-SPEED CANYON SUPERTRACK',
    description: 'An expansive circuit through sun-baked red rock canyons with wide asphalt runoffs, sweeping banked turns, and extreme slipstreaming zones.',
    difficulty: 'Easy',
    lapLengthMeters: 2450,
    cornerCount: 11,
    recommendedStyle: 'Maximum Top Speed & Low Drag',
    theme: 'desert',
    skyColor: '#1c0f0a',
    fogColor: '#2b1911',
    tarmacColor: '#241b17',
    kerbColor1: '#ff6600',
    kerbColor2: '#f3ede2',
    barrierColor: '#e65100',
    trackPoints: desertPoints,
    startGridSlots: generateGridSlots(0, 0, 0, 1, 1, 0, 15, 10, 3.5),
    powerUpLocations: [
      { x: 0, y: 0.5, z: 140 },
      { x: 260, y: 5, z: 260 },
      { x: 230, y: 0.5, z: -50 },
      { x: 40, y: 1.8, z: -220 },
      { x: -140, y: 0.2, z: -70 },
    ],
  },
  'neon-district': {
    id: 'neon-district',
    name: 'NEON DISTRICT',
    subtitle: 'CYBERPUNK NIGHT COMPLEX',
    description: 'A multi-tier futuristic city circuit featuring glowing neon skybridges, atmospheric subterranean tunnels, and fast technical sequences.',
    difficulty: 'Hard',
    lapLengthMeters: 2150,
    cornerCount: 16,
    recommendedStyle: 'Agile Steering & Balanced Downforce',
    theme: 'neon',
    skyColor: '#05030a',
    fogColor: '#090514',
    tarmacColor: '#100e17',
    kerbColor1: '#00ffff',
    kerbColor2: '#ff007f',
    barrierColor: '#b026ff',
    trackPoints: neonPoints,
    startGridSlots: generateGridSlots(0, 0, 0, 1, 1, 0, 15, 9, 3.2),
    powerUpLocations: [
      { x: 0, y: 0.5, z: 100 },
      { x: -150, y: 5, z: 250 },
      { x: -180, y: 0.5, z: 50 },
      { x: -80, y: 3.5, z: -220 },
      { x: 120, y: 0.5, z: -180 },
    ],
  },
};

export const DEFAULT_TRACK = TRACKS['harbor-gp'];
