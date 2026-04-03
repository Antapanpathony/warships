/* ══════════════════════════════════════════════════════════════
   AI CONTROLLER — Tactical behaviour for enemy ships
   ══════════════════════════════════════════════════════════════ */

'use strict';

class AIController {
  constructor(ship, difficulty = 'normal') {
    this.ship      = ship;
    this.diff      = AI_DIFFICULTY[difficulty];
    this.target    = null;        // Ship reference
    this.state     = 'approach'; // approach | engage | evade | retreat
    this.timer     = 0;
    this.reactionCooldown = this.diff.reactionTimeSec;
    this.maneuverTimer = 0;
    this.maneuverDir   = 1;
    this.burstTimer    = 0;
  }

  setTarget(ship) { this.target = ship; }

  update(dt, allEnemies, effects) {
    const ship = this.ship;
    if (!ship.isAlive) return;

    this.timer           += dt;
    this.reactionCooldown = Math.max(0, this.reactionCooldown - dt);

    if (!this.target || !this.target.isAlive) {
      // Find new target (nearest living enemy)
      this.target = this._pickTarget(allEnemies);
    }

    if (!this.target) return;

    const dist = ship.distanceTo(this.target);

    // ── State machine ──────────────────────────────────
    this._updateState(dist);

    // ── Steering ───────────────────────────────────────
    if (this.reactionCooldown <= 0) {
      this._steer(dt, dist);
      this.reactionCooldown = this.diff.reactionTimeSec;
    }

    // ── Speed control ─────────────────────────────────
    this._setSpeed(dist);

    // ── Maneuvering (evasion) ─────────────────────────
    this._maneuver(dt);

    // ── Gunnery ───────────────────────────────────────
    this._gunnery(dt, dist, effects);

    // ── Torpedo attack ────────────────────────────────
    this._torpedoes(dist, effects);
  }

  _pickTarget(enemies) {
    let nearest = null, minDist = Infinity;
    for (const e of enemies) {
      if (!e.isAlive) continue;
      const d = this.ship.distanceTo(e);
      if (d < minDist) { minDist = d; nearest = e; }
    }
    return nearest;
  }

  _updateState(dist) {
    const engageRange  = this.ship.gunDef.range * 0.85;
    const tooClose     = this.ship.gunDef.range * 0.15;
    const hpPct        = this.ship.getHpPercent();

    if (hpPct < 0.2 && this.state !== 'retreat') {
      this.state = 'retreat';
    } else if (dist > engageRange && this.state !== 'retreat') {
      this.state = 'approach';
    } else if (dist < tooClose) {
      this.state = 'evade';
    } else if (this.state !== 'retreat') {
      this.state = 'engage';
    }
  }

  _steer(dt, dist) {
    const ship   = this.ship;
    const target = this.target;
    const brg    = ship.bearingTo(target);

    let desiredHeading;

    if (this.state === 'approach' || this.state === 'engage') {
      // Angle toward target — offset to present broadside (historical: angling ~30° off bow)
      const brsideOffset = (this.diff.speedAggrMult > 0.7) ? 0.45 : 0.25;
      desiredHeading = brg + (Math.random() < 0.5 ? brsideOffset : -brsideOffset);

    } else if (this.state === 'evade') {
      // Turn 90° to open range
      desiredHeading = brg + Math.PI / 2 * this.maneuverDir;

    } else { // retreat
      desiredHeading = brg + Math.PI; // run away
    }

    // Normalise
    const diff = this._angleDiff(desiredHeading, ship.heading);
    const step = ship.turnRate * 60 * dt;  // apply turn
    ship.heading += Math.sign(diff) * Math.min(Math.abs(diff), step);
    ship.heading  = ((ship.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  }

  _setSpeed(dist) {
    const ship  = this.ship;
    const aggr  = this.diff.speedAggrMult;

    if (this.state === 'retreat') {
      ship.targetSpeed = ship.maxSpeed;
    } else if (this.state === 'approach') {
      ship.targetSpeed = ship.maxSpeed * aggr;
    } else if (this.state === 'engage') {
      ship.targetSpeed = ship.maxSpeed * aggr * 0.7;
    } else {
      ship.targetSpeed = ship.maxSpeed;
    }
  }

  _maneuver(dt) {
    this.maneuverTimer -= dt;
    if (this.maneuverTimer <= 0 && Math.random() < this.diff.maneuverProb) {
      this.maneuverDir   = Math.random() < 0.5 ? 1 : -1;
      this.maneuverTimer = 4 + Math.random() * 8;

      // Add small random heading jink for evasion
      if (this.state === 'engage' || this.state === 'evade') {
        this.ship.heading += (Math.random() - 0.5) * 0.3;
      }
    }
  }

  _gunnery(dt, dist, effects) {
    const ship   = this.ship;
    const target = this.target;
    if (!ship.canFire()) return;

    const maxRange = ship.gunDef.range;
    if (dist > maxRange) return;

    // Aim at target with error based on difficulty
    const brg     = ship.bearingTo(target);
    const errBrg  = (Math.random() - 0.5) * (this.diff.bearingErrorDeg * Math.PI / 180) * 2;
    const errDist = dist * (Math.random() - 0.5) * this.diff.rangeErrorFactor * 2;

    // Lead the target: predict where it will be after tof
    const distM   = Ballistics.toM(dist);
    const elev    = Ballistics.solveElevation(distM, ship.gunDef.muzzleVel);
    if (!elev) return;

    const useHigh = dist > ship.gunDef.range * 0.60;
    const tof     = Ballistics.timeOfFlight(useHigh ? elev.high : elev.low, ship.gunDef.muzzleVel);

    ship.gunAngle    = brg + errBrg;
    ship.gunElevation = useHigh ? elev.high : elev.low;

    // Fire if in arc and rate allows
    const fireRateMultiplier = this.diff.fireRateMult;
    if (Math.random() < fireRateMultiplier * dt * 0.5) {
      // Simulate shot
      const result = Ballistics.simulateShot(
        ship.gunDef,
        ship.position,
        target.position,
        target.def.armour,
        { x: target.velocity.x, z: target.velocity.z },
        1 - ship.fireControl,
        true
      );

      ship.startReload();

      // Muzzle flash
      if (effects) {
        const tipPos = ship.getMuzzleTipWorld(0, 0);
        effects.muzzleFlash(tipPos, ship.gunDef.calibre);

        const impactY = new THREE.Vector3(result.impactPos.x, 0, result.impactPos.z);

        if (result.hit) {
          // Delay damage by tof
          setTimeout(() => {
            if (!target.isAlive) return;
            target.applyDamage(result.dmgResult, effects);
            ship.shotsHit++;
            ship.damageDealt += result.dmgResult.damage;
            effects.explosion({ x: target.position.x, z: target.position.z });
          }, result.tof * 1000);

          effects.addShellTracer(
            ship.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
            impactY,
            result.tof,
            ship.gunDef.calibre
          );
        } else if (!result.outOfRange) {
          setTimeout(() => {
            if (effects) effects.splash(result.impactPos);
          }, result.tof * 1000);

          effects.addShellTracer(
            ship.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
            impactY,
            result.tof,
            ship.gunDef.calibre
          );
        }
      }
    }
  }

  _torpedoes(dist, effects) {
    const ship = this.ship;
    if (!ship.canTorpedo()) return;
    if (!ship.torpDef) return;

    const torpRange = ship.torpDef.range;
    if (dist > torpRange * 0.9) return;

    // Fire torpedoes when at good range and angle
    if (Math.random() < 0.008) {
      ship.fireTorpedo();
      // Torpedo damage is applied probabilistically (simplified)
      const hitChance = 0.35 - dist / torpRange * 0.25;
      if (Math.random() < hitChance) {
        const torp = this.target;
        const ttof = dist / ship.torpDef.speed;
        setTimeout(() => {
          if (!torp.isAlive) return;
          const dmg = Ballistics.torpedoDamage(ship.torpDef);
          torp.applyDamage(dmg, effects);
          ship.damageDealt += dmg.damage;
          if (effects) effects.explosion({ x: torp.position.x, z: torp.position.z }, 2.5);
        }, ttof * 1000);
      }
    }
  }

  _angleDiff(a, b) {
    let d = a - b;
    while (d >  Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
}
