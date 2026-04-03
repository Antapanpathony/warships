/* ══════════════════════════════════════════════════════════════
   CONFIG — Ship definitions, weapon tables, world constants
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ── World scale ───────────────────────────────────────────────
// 1 unit = 10 metres.  1 km = 100 units.
// A typical naval engagement is 5–20 km (500–2000 units).
const WORLD_SCALE  = 10;       // metres per unit
const MAX_SEA_SIZE = 5000;     // half-extent of ocean plane

// ── Ship definitions ──────────────────────────────────────────
const SHIP_DEFS = {

  battleship: {
    name:        'Battleship',
    length:      22,           // units (220 m)
    beam:        3,            // units (30 m)
    maxHp:       3000,
    maxSpeed:    2.8,          // units/s ≈ 28 kts
    turnRate:    0.008,        // rad/s
    propDmgMod:  0.5,          // speed penalty per propulsion damage %

    guns: {
      calibre:   406,          // mm  (16-inch)
      barrels:   9,            // total barrels (3×3 turrets)
      turrets:   3,
      muzzleVel: 820,          // m/s
      range:     350,          // units ≈ 35 km effective
      reloadTime: 28,          // seconds (real: ~28s for 16")
      shellMass: 1225,         // kg
      armorPen:  600,          // mm RHA at 10 km
      dispersion: 0.0012,      // base angular dispersion (rad)
    },

    torpedoes:   null,

    armour: {
      belt:      310,          // mm — main belt
      deck:      180,
      turret:    500,
    },

    silhouette:  { r: 5, h: 8 }, // approx bounding for targeting
  },

  cruiser: {
    name:        'Heavy Cruiser',
    length:      18,
    beam:        2.2,
    maxHp:       1200,
    maxSpeed:    3.6,
    turnRate:    0.014,
    propDmgMod:  0.55,

    guns: {
      calibre:   203,          // mm  (8-inch)
      barrels:   8,
      turrets:   4,
      muzzleVel: 855,
      range:     280,
      reloadTime: 15,
      shellMass: 118,
      armorPen:  140,
      dispersion: 0.0015,
    },

    torpedoes: {
      tubes:      8,
      speed:      5.2,         // units/s ≈ 52 kts
      range:      100,         // units ≈ 10 km
      warhead:    600,         // kg TNT equivalent → damage
      reloadTime: 60,
    },

    armour: {
      belt:       76,
      deck:       51,
      turret:     127,
    },

    silhouette: { r: 3.5, h: 6 },
  },

  destroyer: {
    name:        'Destroyer',
    length:      12,
    beam:        1.3,
    maxHp:       450,
    maxSpeed:    5.2,          // ≈52 kts
    turnRate:    0.028,
    propDmgMod:  0.6,

    guns: {
      calibre:   127,          // mm  (5-inch)
      barrels:   5,
      turrets:   5,
      muzzleVel: 792,
      range:     160,
      reloadTime: 8,
      shellMass: 25,
      armorPen:  40,
      dispersion: 0.002,
    },

    torpedoes: {
      tubes:      8,
      speed:      6.0,
      range:      100,
      warhead:    500,
      reloadTime: 45,
    },

    armour: {
      belt:       19,
      deck:       13,
      turret:     13,
    },

    silhouette: { r: 2.2, h: 4 },
  },
};

// ── Enemy ship pool per scenario ─────────────────────────────
// Each entry: { type, name, nation, hp_mod (1=full) }
const AI_SHIP_POOL = {
  jutland: [
    { type: 'battleship', name: 'SMS Bayern',      nation: 'Germany', hpMod: 1.0 },
    { type: 'battleship', name: 'SMS König',        nation: 'Germany', hpMod: 1.0 },
    { type: 'cruiser',    name: 'SMS Roon',         nation: 'Germany', hpMod: 1.0 },
    { type: 'destroyer',  name: 'G39',              nation: 'Germany', hpMod: 1.0 },
    { type: 'destroyer',  name: 'V45',              nation: 'Germany', hpMod: 1.0 },
  ],
  surigao: [
    { type: 'battleship', name: 'IJN Yamashiro',    nation: 'Japan',   hpMod: 1.0 },
    { type: 'battleship', name: 'IJN Fuso',         nation: 'Japan',   hpMod: 0.9 },
    { type: 'cruiser',    name: 'IJN Mogami',       nation: 'Japan',   hpMod: 1.0 },
    { type: 'destroyer',  name: 'IJN Shigure',      nation: 'Japan',   hpMod: 1.0 },
  ],
  north_cape: [
    { type: 'battleship', name: 'DKM Scharnhorst',  nation: 'Germany', hpMod: 1.0 },
    { type: 'cruiser',    name: 'DKM Nürnberg',     nation: 'Germany', hpMod: 0.85 },
    { type: 'destroyer',  name: 'Z29',              nation: 'Germany', hpMod: 1.0 },
    { type: 'destroyer',  name: 'Z30',              nation: 'Germany', hpMod: 1.0 },
  ],
  cape_esperance: [
    { type: 'cruiser',    name: 'IJN Furutaka',     nation: 'Japan',   hpMod: 1.0 },
    { type: 'cruiser',    name: 'IJN Aoba',         nation: 'Japan',   hpMod: 1.0 },
    { type: 'cruiser',    name: 'IJN Kinugasa',     nation: 'Japan',   hpMod: 1.0 },
    { type: 'destroyer',  name: 'IJN Fubuki',       nation: 'Japan',   hpMod: 1.0 },
    { type: 'destroyer',  name: 'IJN Hatsuyuki',    nation: 'Japan',   hpMod: 1.0 },
  ],
};

// ── AI difficulty ─────────────────────────────────────────────
const AI_DIFFICULTY = {
  easy: {
    rangeErrorFactor:   0.12,  // ±12% range error
    bearingErrorDeg:    3.5,   // ±3.5° bearing error
    reactionTimeSec:    5.0,
    fireRateMult:       0.45,  // fires at 45% of max rate
    speedAggrMult:      0.55,
    maneuverProb:       0.1,
  },
  normal: {
    rangeErrorFactor:   0.05,
    bearingErrorDeg:    1.2,
    reactionTimeSec:    2.5,
    fireRateMult:       0.75,
    speedAggrMult:      0.80,
    maneuverProb:       0.3,
  },
  hard: {
    rangeErrorFactor:   0.018,
    bearingErrorDeg:    0.4,
    reactionTimeSec:    0.8,
    fireRateMult:       1.0,
    speedAggrMult:      1.0,
    maneuverProb:       0.55,
  },
};

// ── Damage constants ──────────────────────────────────────────
const DMG = {
  fireDamagePerSec: 2,         // hp/sec when burning
  floodingDmgPerSec: 1.5,
  explosionRadius: 8,          // units — splash damage range
  nearMissThreshold: 4,        // units — near-miss shake
};

// ── Ballistics constants ──────────────────────────────────────
const GRAVITY = 9.81;          // m/s²  (real, scaled internally)
const SHELL_DRAG_COEFF = 0.006; // simplified drag per unit of velocity²
