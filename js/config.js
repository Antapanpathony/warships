/* ══════════════════════════════════════════════════════════════
   CONFIG — Ship definitions, weapon tables, world constants
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ── World scale ───────────────────────────────────────────────
// 1 unit = 10 metres.  1 km = 100 units.
// 1 unit/s = 10 m/s = 19.44 knots
const WORLD_SCALE  = 10;
const MAX_SEA_SIZE = 5000;

// ── Ship definitions ──────────────────────────────────────────
const SHIP_DEFS = {

  battleship: {
    name:        'Battleship',
    length:      22,           // units (220 m)
    beam:        3,            // units (30 m)
    maxHp:       3000,
    maxSpeed:    1.39,         // units/s = 27 kts  (1 unit/s = 19.44 kts)
    turnRate:    0.006,        // rad/s
    propDmgMod:  0.5,

    guns: {
      calibre:   406,          // mm  (16-inch)
      barrels:   9,
      turrets:   3,
      muzzleVel: 820,          // m/s
      range:     280,          // units (2.8 km game range — compressed scale)
      reloadTime: 28,          // seconds
      shellMass: 1225,         // kg
      armorPen:  600,          // mm RHA at 10 km
      dispersion: 0.0014,      // base Gaussian sigma (world units per unit range)
    },

    torpedoes:   null,

    armour: {
      belt:      310,
      deck:      180,
      turret:    500,
    },

    // OBB half-extents for hit detection (world units)
    hitbox: { halfLen: 11, halfBeam: 1.5 },
  },

  cruiser: {
    name:        'Heavy Cruiser',
    length:      18,
    beam:        2.2,
    maxHp:       1200,
    maxSpeed:    1.65,         // 32 kts
    turnRate:    0.012,
    propDmgMod:  0.55,

    guns: {
      calibre:   203,
      barrels:   8,
      turrets:   4,
      muzzleVel: 855,
      range:     220,
      reloadTime: 15,
      shellMass: 118,
      armorPen:  140,
      dispersion: 0.0016,
    },

    torpedoes: {
      tubes:      8,
      speed:      2.31,        // 45 kts
      range:      90,
      warhead:    600,
      reloadTime: 60,
    },

    armour: {
      belt:       76,
      deck:       51,
      turret:     127,
    },

    hitbox: { halfLen: 9, halfBeam: 1.1 },
  },

  destroyer: {
    name:        'Destroyer',
    length:      12,
    beam:        1.3,
    maxHp:       450,
    maxSpeed:    1.85,         // 36 kts
    turnRate:    0.024,
    propDmgMod:  0.6,

    guns: {
      calibre:   127,
      barrels:   5,
      turrets:   5,
      muzzleVel: 792,
      range:     130,
      reloadTime: 8,
      shellMass: 25,
      armorPen:  40,
      dispersion: 0.0020,
    },

    torpedoes: {
      tubes:      8,
      speed:      2.31,        // 45 kts
      range:      90,
      warhead:    500,
      reloadTime: 45,
    },

    armour: {
      belt:       19,
      deck:       13,
      turret:     13,
    },

    hitbox: { halfLen: 6, halfBeam: 0.65 },
  },
};

// ── Enemy ship pool per scenario ─────────────────────────────
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

// ── Allied ship pool per scenario ─────────────────────────────
const ALLY_SHIP_POOL = {
  jutland: [
    { type: 'battleship', name: 'HMS Barham',       nation: 'UK',   hpMod: 1.0 },
    { type: 'cruiser',    name: 'HMS Southampton',   nation: 'UK',   hpMod: 1.0 },
    { type: 'destroyer',  name: 'HMS Shark',         nation: 'UK',   hpMod: 1.0 },
  ],
  surigao: [
    { type: 'battleship', name: 'USS Tennessee',    nation: 'US',   hpMod: 1.0 },
    { type: 'cruiser',    name: 'USS Louisville',   nation: 'US',   hpMod: 1.0 },
    { type: 'destroyer',  name: 'USS Remey',        nation: 'US',   hpMod: 1.0 },
  ],
  north_cape: [
    { type: 'cruiser',    name: 'HMS Belfast',      nation: 'UK',   hpMod: 1.0 },
    { type: 'cruiser',    name: 'HMS Norfolk',      nation: 'UK',   hpMod: 1.0 },
    { type: 'destroyer',  name: 'HMS Scorpion',     nation: 'UK',   hpMod: 1.0 },
  ],
  cape_esperance: [
    { type: 'cruiser',    name: 'USS Boise',        nation: 'US',   hpMod: 1.0 },
    { type: 'cruiser',    name: 'USS Salt Lake City',nation: 'US',  hpMod: 1.0 },
    { type: 'destroyer',  name: 'USS Duncan',       nation: 'US',   hpMod: 1.0 },
  ],
};

// ── AI difficulty ─────────────────────────────────────────────
const AI_DIFFICULTY = {
  easy: {
    rangeErrorFactor:   0.10,  // fraction of range added as random error
    bearingErrorDeg:    3.0,
    reactionTimeSec:    4.0,
    fireRateMult:       0.5,   // multiplier on reload time (higher = slower)
    speedAggrMult:      0.55,
    maneuverProb:       0.1,
  },
  normal: {
    rangeErrorFactor:   0.04,
    bearingErrorDeg:    1.0,
    reactionTimeSec:    2.0,
    fireRateMult:       1.0,
    speedAggrMult:      0.80,
    maneuverProb:       0.3,
  },
  hard: {
    rangeErrorFactor:   0.015,
    bearingErrorDeg:    0.35,
    reactionTimeSec:    0.6,
    fireRateMult:       1.0,
    speedAggrMult:      1.0,
    maneuverProb:       0.55,
  },
};

// ── Damage constants ──────────────────────────────────────────
const DMG = {
  fireDamagePerSec:   2,
  floodingDmgPerSec:  1.5,
  explosionRadius:    8,
  nearMissThreshold:  4,
};

// ── Ballistics constants ──────────────────────────────────────
const GRAVITY          = 9.81;
const SHELL_DRAG_COEFF = 0.006;
