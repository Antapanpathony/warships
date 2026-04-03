/* ══════════════════════════════════════════════════════════════
   SCENARIOS — Historical battle configurations and initial positions
   ══════════════════════════════════════════════════════════════ */

'use strict';

const SCENARIOS = {

  jutland: {
    name:        'Battle of Jutland',
    subtitle:    '31 May 1916 — North Sea',
    description: 'The largest battleship engagement in history. Heavy gun smoke, poor visibility, and deadly line-of-battle tactics.',

    // Environment
    skyZenith:    0x1a2533,
    skyHorizon:   0x4a5f6a,
    seaColor:     0x1a3048,
    seaEmissive:  0x001020,
    fogColor:     0x6a7f88,
    fogDensity:   0.0012,
    ambientColor: 0x607080,
    ambientInt:   0.75,
    sunColor:     0xaabbcc,
    sunInt:       0.9,
    sunDir:       { x: 0.3, y: 0.4, z: 0.6 },
    seaShininess: 45,
    waveHeight:   0.8,
    waveSpeed:    0.5,

    // Player start
    playerStart:  { x: 0, z: -400, heading: 0 },

    // Enemy formation — column of battleships
    enemyFormation: [
      { shipIdx: 0, x: 80,  z: 300, heading: Math.PI },
      { shipIdx: 1, x: 120, z: 370, heading: Math.PI },
      { shipIdx: 2, x: -60, z: 260, heading: Math.PI },
      { shipIdx: 3, x: 200, z: 200, heading: Math.PI + 0.2 },
      { shipIdx: 4, x: -80, z: 180, heading: Math.PI - 0.2 },
    ],

    // Historically, gun smoke severely reduced visibility
    gunSmokeVisReduction: true,

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
    description: 'Night action in a narrow strait. The Japanese Southern Force steams into a waiting ambush.',

    skyZenith:   0x040810,
    skyHorizon:  0x0f1a24,
    seaColor:    0x0a1a2a,
    seaEmissive: 0x000812,
    fogColor:    0x0a1220,
    fogDensity:  0.0008,
    ambientColor: 0x203040,
    ambientInt:  0.3,
    sunColor:    0xffffff,
    sunInt:      0.0,          // night
    sunDir:      { x: 0, y: -1, z: 0 },
    seaShininess: 30,
    waveHeight:  0.4,
    waveSpeed:   0.3,

    playerStart: { x: 0, z: -500, heading: 0 },

    enemyFormation: [
      { shipIdx: 0, x: 0,   z: 400, heading: Math.PI },
      { shipIdx: 1, x: 80,  z: 500, heading: Math.PI },
      { shipIdx: 2, x: -50, z: 350, heading: Math.PI },
      { shipIdx: 3, x: 150, z: 300, heading: Math.PI },
    ],

    briefing: [
      'It is 0300. The strait is dark.',
      'IJN Southern Force is advancing from the south.',
      'Our PT boats and destroyers have already struck.',
      'Cross the T. Open fire when in range.',
    ],
  },

  north_cape: {
    name:        'Battle of North Cape',
    subtitle:    '26 December 1943 — Arctic Ocean',
    description: 'Arctic winter darkness. HMS Duke of York has caught the Scharnhorst after a brutal stern chase.',

    skyZenith:   0x060a12,
    skyHorizon:  0x161e28,
    seaColor:    0x0e2030,
    seaEmissive: 0x001018,
    fogColor:    0x1a2530,
    fogDensity:  0.0007,
    ambientColor: 0x304050,
    ambientInt:  0.35,
    sunColor:    0xccddff,
    sunInt:      0.15,
    sunDir:      { x: -0.5, y: 0.1, z: 0.5 },
    seaShininess: 50,
    waveHeight:  1.4,          // heavy Arctic swell
    waveSpeed:   0.7,

    playerStart: { x: 0, z: -600, heading: 0 },

    enemyFormation: [
      { shipIdx: 0, x: 0,   z: 450, heading: Math.PI + 0.3 },
      { shipIdx: 1, x: -80, z: 280, heading: Math.PI },
      { shipIdx: 2, x: 100, z: 200, heading: Math.PI - 0.2 },
      { shipIdx: 3, x: -30, z: 150, heading: Math.PI + 0.1 },
    ],

    briefing: [
      'Arctic Ocean. Sub-zero temperatures. Force 8 gale.',
      'DKM Scharnhorst has been caught off Bear Island.',
      'She is fast and dangerous — do not underestimate her.',
      'Destroyers have already launched torpedo attacks. Finish her.',
    ],
  },

  cape_esperance: {
    name:        'Battle of Cape Esperance',
    subtitle:    '11–12 October 1942 — Guadalcanal',
    description: 'Night surface action. Cruisers and destroyers fight at close range in confined waters.',

    skyZenith:   0x050810,
    skyHorizon:  0x0d1820,
    seaColor:    0x0b1f2c,
    seaEmissive: 0x000a14,
    fogColor:    0x101820,
    fogDensity:  0.0006,
    ambientColor: 0x182838,
    ambientInt:  0.28,
    sunColor:    0xffffff,
    sunInt:      0.0,
    sunDir:      { x: 0, y: -1, z: 0 },
    seaShininess: 25,
    waveHeight:  0.35,
    waveSpeed:   0.28,

    playerStart: { x: 0, z: -350, heading: 0.1 },

    enemyFormation: [
      { shipIdx: 0, x: -20,  z: 280, heading: Math.PI + 0.5 },
      { shipIdx: 1, x: 100,  z: 300, heading: Math.PI - 0.3 },
      { shipIdx: 2, x: -100, z: 320, heading: Math.PI + 0.2 },
      { shipIdx: 3, x: 200,  z: 200, heading: Math.PI - 0.5 },
      { shipIdx: 4, x: -150, z: 250, heading: Math.PI + 0.4 },
    ],

    briefing: [
      'Night action. Radar contact bearing 000.',
      'IJN reinforcement convoy detected.',
      'Cruiser forces have crossed their T.',
      'Engage before they reach the anchorage.',
    ],
  },
};
