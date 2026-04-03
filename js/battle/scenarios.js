/* ══════════════════════════════════════════════════════════════
   SCENARIOS — Historical battle configurations
   Distances: enemies start ~150-200 units away (within engagement range).
   Allies start ~40-80 units from player on the flanks.
   ══════════════════════════════════════════════════════════════ */

'use strict';

const SCENARIOS = {

  jutland: {
    name:        'Battle of Jutland',
    subtitle:    '31 May 1916 — North Sea',
    description: 'Grand Fleet vs. High Seas Fleet. Poor visibility, gun smoke and torpedo attacks.',

    skyZenith:    0x1a2533,
    skyHorizon:   0x4a5f6a,
    seaColor:     0x1a3048,
    seaEmissive:  0x001020,
    fogColor:     0x6a7f88,
    fogDensity:   0.0014,
    ambientColor: 0x607080,
    ambientInt:   0.75,
    sunColor:     0xaabbcc,
    sunInt:       0.9,
    sunDir:       { x: 0.3, y: 0.4, z: 0.6 },
    seaShininess: 45,
    waveHeight:   0.8,
    waveSpeed:    0.5,

    // Player start — heading north (toward enemies)
    playerStart: { x: 0, z: -120, heading: 0 },

    // Enemies ~150-220 units north, in a line-of-battle column
    enemyFormation: [
      { shipIdx: 0, x:  20, z: 180, heading: Math.PI },
      { shipIdx: 1, x: -20, z: 220, heading: Math.PI },
      { shipIdx: 2, x:  60, z: 155, heading: Math.PI + 0.1 },
      { shipIdx: 3, x: 130, z: 140, heading: Math.PI - 0.2 },
      { shipIdx: 4, x: -80, z: 140, heading: Math.PI + 0.2 },
    ],

    // Allies flanking the player
    allyFormation: [
      { shipIdx: 0, x: -50, z: -80,  heading: 0 },
      { shipIdx: 1, x:  50, z: -60,  heading: 0.1 },
      { shipIdx: 2, x: -90, z: -100, heading: 0.05 },
    ],

    briefing: [
      'You are in the vanguard of the Grand Fleet.',
      'The High Seas Fleet has been sighted to the north.',
      'Engage and destroy the enemy formation.',
      'Beware of torpedo attacks from their destroyers.',
    ],
  },

  surigao: {
    name:        'Battle of Surigao Strait',
    subtitle:    '25 October 1944 — Leyte Gulf, Philippines',
    description: 'Night action. The IJN Southern Force is caught crossing the T.',

    skyZenith:   0x040810,
    skyHorizon:  0x0f1a24,
    seaColor:    0x0a1a2a,
    seaEmissive: 0x000812,
    fogColor:    0x0a1220,
    fogDensity:  0.0010,
    ambientColor: 0x203040,
    ambientInt:  0.3,
    sunColor:    0xffffff,
    sunInt:      0.0,
    sunDir:      { x: 0, y: -1, z: 0 },
    seaShininess: 30,
    waveHeight:  0.4,
    waveSpeed:   0.3,

    playerStart: { x: 0, z: -120, heading: 0 },

    enemyFormation: [
      { shipIdx: 0, x:  10, z: 180, heading: Math.PI },
      { shipIdx: 1, x: -10, z: 230, heading: Math.PI },
      { shipIdx: 2, x:  50, z: 160, heading: Math.PI - 0.15 },
      { shipIdx: 3, x: -50, z: 150, heading: Math.PI + 0.15 },
    ],

    allyFormation: [
      { shipIdx: 0, x: -60, z: -80,  heading: 0 },
      { shipIdx: 1, x:  60, z: -70,  heading: 0.1 },
      { shipIdx: 2, x: -100, z: -110, heading: 0 },
    ],

    briefing: [
      'It is 0300. The strait is dark.',
      'IJN Southern Force is advancing from the south.',
      'PT boats and destroyers have already struck.',
      'Cross the T. Open fire when in range.',
    ],
  },

  north_cape: {
    name:        'Battle of North Cape',
    subtitle:    '26 December 1943 — Arctic Ocean',
    description: 'HMS Duke of York has caught Scharnhorst after a brutal stern chase.',

    skyZenith:   0x060a12,
    skyHorizon:  0x161e28,
    seaColor:    0x0e2030,
    seaEmissive: 0x001018,
    fogColor:    0x1a2530,
    fogDensity:  0.0009,
    ambientColor: 0x304050,
    ambientInt:  0.35,
    sunColor:    0xccddff,
    sunInt:      0.15,
    sunDir:      { x: -0.5, y: 0.1, z: 0.5 },
    seaShininess: 50,
    waveHeight:  1.4,
    waveSpeed:   0.7,

    playerStart: { x: 0, z: -130, heading: 0.1 },

    enemyFormation: [
      { shipIdx: 0, x:   0, z: 200, heading: Math.PI + 0.3 },
      { shipIdx: 1, x: -70, z: 160, heading: Math.PI },
      { shipIdx: 2, x:  80, z: 145, heading: Math.PI - 0.2 },
      { shipIdx: 3, x: -20, z: 135, heading: Math.PI + 0.1 },
    ],

    allyFormation: [
      { shipIdx: 0, x: -55, z: -75,  heading: 0.1 },
      { shipIdx: 1, x:  55, z: -65,  heading: 0 },
      { shipIdx: 2, x: -90, z: -100, heading: 0.05 },
    ],

    briefing: [
      'Arctic Ocean. Sub-zero temperatures. Force 8 gale.',
      'DKM Scharnhorst has been caught off Bear Island.',
      'She is fast and dangerous — do not underestimate her.',
      'Destroyers have already launched torpedoes. Finish her.',
    ],
  },

  cape_esperance: {
    name:        'Battle of Cape Esperance',
    subtitle:    '11–12 October 1942 — Guadalcanal',
    description: 'Night cruiser action at close range off Guadalcanal.',

    skyZenith:   0x050810,
    skyHorizon:  0x0d1820,
    seaColor:    0x0b1f2c,
    seaEmissive: 0x000a14,
    fogColor:    0x101820,
    fogDensity:  0.0008,
    ambientColor: 0x182838,
    ambientInt:  0.28,
    sunColor:    0xffffff,
    sunInt:      0.0,
    sunDir:      { x: 0, y: -1, z: 0 },
    seaShininess: 25,
    waveHeight:  0.35,
    waveSpeed:   0.28,

    playerStart: { x: 0, z: -110, heading: 0.1 },

    enemyFormation: [
      { shipIdx: 0, x: -15,  z: 160, heading: Math.PI + 0.4 },
      { shipIdx: 1, x:  80,  z: 175, heading: Math.PI - 0.25 },
      { shipIdx: 2, x: -80,  z: 175, heading: Math.PI + 0.2 },
      { shipIdx: 3, x:  150, z: 145, heading: Math.PI - 0.45 },
      { shipIdx: 4, x: -130, z: 145, heading: Math.PI + 0.4 },
    ],

    allyFormation: [
      { shipIdx: 0, x: -50, z: -70,  heading: 0.1 },
      { shipIdx: 1, x:  50, z: -60,  heading: 0.0 },
      { shipIdx: 2, x: -85, z: -95,  heading: 0.05 },
    ],

    briefing: [
      'Night action. Radar contact bearing 000.',
      'IJN reinforcement convoy detected.',
      'Cruiser forces have crossed their T.',
      'Engage before they reach the anchorage.',
    ],
  },
};
