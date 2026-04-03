/* ══════════════════════════════════════════════════════════════
   BALLISTICS — Realistic shell physics
   ══════════════════════════════════════════════════════════════ */

'use strict';

const Ballistics = (() => {

  // Convert world units to metres
  const toM = u => u * WORLD_SCALE;
  // Convert metres to world units
  const toU = m => m / WORLD_SCALE;

  /**
   * Solve elevation angle (radians) needed to hit a target at distance D (metres)
   * with muzzle velocity v0 (m/s).
   * Using simplified flat-earth ballistic:  D = v0² * sin(2θ) / g
   * Returns null if out of range.
   */
  function solveElevation(distMetres, muzzleVel) {
    const sinVal = (distMetres * GRAVITY) / (muzzleVel * muzzleVel);
    if (Math.abs(sinVal) > 1) return null; // out of range
    // Two solutions: low angle (direct) and high angle (plunging)
    // Naval guns typically use low angle at medium range, high angle at long range
    const thetaLow  = 0.5 * Math.asin(sinVal);
    const thetaHigh = Math.PI / 2 - thetaLow;
    return { low: thetaLow, high: thetaHigh };
  }

  /**
   * Time of flight (seconds) for a shell fired at elevation θ (rad) with v0 (m/s).
   */
  function timeOfFlight(elevationRad, muzzleVel) {
    // t = 2 * v0 * sin(θ) / g
    return (2 * muzzleVel * Math.sin(elevationRad)) / GRAVITY;
  }

  /**
   * Shell impact velocity (m/s) — simplified drag model.
   * Reduces ~10% per 10 km.
   */
  function impactVelocity(muzzleVel, distMetres) {
    const dragFactor = Math.exp(-SHELL_DRAG_COEFF * distMetres / 1000);
    return muzzleVel * dragFactor;
  }

  /**
   * Penetration (mm RHA) at a given distance using Nathan Okun simplified model.
   *   Pen = pen0 * (V_impact / V_muzzle)^1.1 * cos(impactAngle)^0.7
   * We use a lookup based on reference pen at 10 km.
   */
  function penetration(gunDef, distMetres, impactAngleDeg = 0) {
    const vImpact  = impactVelocity(gunDef.muzzleVel, distMetres);
    const vRatio   = vImpact / gunDef.muzzleVel;
    // Reference: gunDef.armorPen is at 10 km
    const ref10km  = gunDef.armorPen;
    const d10km    = 10000;
    const vRatio10 = impactVelocity(gunDef.muzzleVel, d10km) / gunDef.muzzleVel;
    const pen0     = ref10km / Math.pow(vRatio10, 1.1);
    const angleFac = Math.cos((impactAngleDeg * Math.PI) / 180);
    return pen0 * Math.pow(vRatio, 1.1) * Math.pow(angleFac, 0.7);
  }

  /**
   * Damage formula:
   *   - If shell penetrates armour: full damage (base = shellMass / 8)
   *   - Partial pen: proportional
   *   - No pen: 10% splash damage + chance of flooding
   */
  function computeDamage(gunDef, targetArmour, distMetres, hitZone = 'belt') {
    const armourMm  = targetArmour[hitZone] || targetArmour.belt;
    const penMm     = penetration(gunDef, distMetres);
    const baseDmg   = gunDef.shellMass / 8;

    let dmg, penetrated;
    if (penMm >= armourMm) {
      // Full penetration — full damage + fire/flooding chance
      dmg        = baseDmg * (1 + (penMm - armourMm) / armourMm * 0.3);
      penetrated = true;
    } else {
      // Partial: damage scales with pen/armour ratio
      dmg        = baseDmg * (penMm / armourMm) * 0.6;
      penetrated = false;
    }

    // Scatter: ±15%
    dmg *= 0.85 + Math.random() * 0.30;

    const fireChance    = penetrated ? 0.25 : 0.06;
    const floodChance   = penetrated && hitZone === 'belt' ? 0.18 : 0.03;

    return {
      damage:     Math.round(dmg),
      penetrated,
      fire:       Math.random() < fireChance,
      flooding:   Math.random() < floodChance,
    };
  }

  /**
   * Torpedo damage — always penetrates hull below waterline.
   */
  function torpedoDamage(torpDef) {
    const base = torpDef.warhead / 2;
    const dmg  = base * (0.85 + Math.random() * 0.3);
    return {
      damage:   Math.round(dmg),
      penetrated: true,
      fire:     Math.random() < 0.15,
      flooding: Math.random() < 0.65,
    };
  }

  /**
   * Dispersion model — CEP (circle of equal probability) in world units.
   * Larger at longer range; fire control system quality scales it.
   */
  function dispersion(gunDef, distUnits, fcDamage = 0) {
    // Base angular dispersion * range = lateral spread
    const fcPenalty = 1 + fcDamage * 1.8;  // damaged FC increases spread
    const spread    = gunDef.dispersion * distUnits * fcPenalty;
    return spread;
  }

  /**
   * Advance fire control: predict target position based on bearing rate.
   * Returns predicted future position in world units.
   */
  function leadTarget(targetPos, targetVel, tof) {
    return {
      x: targetPos.x + targetVel.x * tof,
      z: targetPos.z + targetVel.z * tof,
    };
  }

  /**
   * Full shot simulation: given shooter and target, returns
   * { hit: bool, dmgResult, impactPos, tof, elevation }
   */
  function simulateShot(gunDef, shooterPos, targetPos, targetArmour,
                        targetVel = {x:0,z:0}, fcDamage = 0, addNoise = true) {
    const dx = targetPos.x - shooterPos.x;
    const dz = targetPos.z - shooterPos.z;
    const distUnits  = Math.sqrt(dx * dx + dz * dz);
    const distMetres = toM(distUnits);

    const elev = solveElevation(distMetres, gunDef.muzzleVel);
    if (!elev) {
      return { hit: false, outOfRange: true };
    }

    // Choose plunging fire at ranges > 60% of max for deck penetration
    const useHighAngle = distUnits > gunDef.range * 0.60;
    const elevAngle    = useHighAngle ? elev.high : elev.low;
    const tof          = timeOfFlight(elevAngle, gunDef.muzzleVel);

    // Lead the target
    const predicted   = leadTarget(targetPos, targetVel, tof);

    // Apply dispersion
    const spread      = dispersion(gunDef, distUnits, fcDamage);
    let finalX = predicted.x;
    let finalZ = predicted.z;

    if (addNoise) {
      // Box-Muller random for Gaussian dispersion
      const u1 = Math.random(), u2 = Math.random();
      const gauss = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.cos(2 * Math.PI * u2);
      const gauss2= Math.sqrt(-2 * Math.log(u2 + 1e-9)) * Math.cos(2 * Math.PI * u1);
      finalX += gauss  * spread;
      finalZ += gauss2 * spread;
    }

    // Hit check: compare impact point to target bounding radius
    const impactDx = finalX - targetPos.x;
    const impactDz = finalZ - targetPos.z;
    const impactDist = Math.sqrt(impactDx * impactDx + impactDz * impactDz);

    // Determine hit zone (simplified: check if below or above waterline)
    let hitZone = 'belt';
    if (useHighAngle) hitZone = 'deck';

    const targetRadius = 2.0; // approximate width in units for hit detection
    const hit = impactDist < targetRadius;

    let dmgResult = null;
    if (hit) {
      dmgResult = computeDamage(gunDef, targetArmour, distMetres, hitZone);
    }

    return {
      hit,
      outOfRange: false,
      impactPos:  { x: finalX, z: finalZ },
      tof,
      elevation:  elevAngle,
      distMetres,
      distUnits,
      hitZone,
      dmgResult,
    };
  }

  return {
    solveElevation,
    timeOfFlight,
    impactVelocity,
    penetration,
    computeDamage,
    torpedoDamage,
    dispersion,
    leadTarget,
    simulateShot,
    toM,
    toU,
  };

})();
