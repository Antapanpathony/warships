/* ══════════════════════════════════════════════════════════════
   AI CONTROLLER — Tactical behaviour for enemy and allied ships
   ══════════════════════════════════════════════════════════════ */

'use strict';

class AIController {
  /**
   * @param {Ship}   ship        — the ship this controller drives
   * @param {string} difficulty  — 'easy' | 'normal' | 'hard'
   * @param {bool}   isAlly     — true = targets enemies, false = targets player
   */
  constructor(ship, difficulty = 'normal', isAlly = false) {
    this.ship      = ship;
    this.diff      = AI_DIFFICULTY[difficulty];
    this.isAlly    = isAlly;
    this.target    = null;
    this.state     = 'approach';
    this.timer     = 0;
    this.reactionCooldown = this.diff.reactionTimeSec;
    this.maneuverTimer = 0;
    this.maneuverDir   = 1;
  }

  setTarget(ship) { this.target = ship; }

  /**
   * @param {Ship[]} friendlyTargets — ships this AI may fire on
   */
  update(dt, friendlyTargets, effects, spawnTorpedoCb) {
    this._spawnTorpedoCb = spawnTorpedoCb || null;
    const ship = this.ship;
    if (!ship.isAlive) return;

    this.timer            += dt;
    this.reactionCooldown  = Math.max(0, this.reactionCooldown - dt);

    // Pick nearest live target
    if (!this.target || !this.target.isAlive) {
      this.target = this._pickTarget(friendlyTargets);
    }
    if (!this.target) return;

    const dist = ship.distanceTo(this.target);

    this._updateState(dist);

    if (this.reactionCooldown <= 0) {
      this._steer(dt, dist);
      this.reactionCooldown = this.diff.reactionTimeSec;
    }

    this._setSpeed(dist);
    this._maneuver(dt);
    this._gunnery(dt, dist, effects);
    this._torpedoes(dist, effects, this._spawnTorpedoCb);
  }

  _pickTarget(candidates) {
    let nearest = null, minDist = Infinity;
    for (const c of candidates) {
      if (!c || !c.isAlive) continue;
      const d = this.ship.distanceTo(c);
      if (d < minDist) { minDist = d; nearest = c; }
    }
    return nearest;
  }

  _updateState(dist) {
    const engageRange = this.ship.gunDef.range * 0.88;
    const tooClose    = this.ship.gunDef.range * 0.12;
    const hpPct       = this.ship.getHpPercent();

    if (hpPct < 0.18 && this.state !== 'retreat') {
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
      // Angle to present broadside (~30° off bow)
      const offset = (this.diff.speedAggrMult > 0.7) ? 0.5 : 0.28;
      desiredHeading = brg + (this.maneuverDir > 0 ? offset : -offset);
    } else if (this.state === 'evade') {
      desiredHeading = brg + Math.PI / 2 * this.maneuverDir;
    } else {
      desiredHeading = brg + Math.PI;
    }

    const diff = this._angleDiff(desiredHeading, ship.heading);
    const step = ship.turnRate * 60 * dt;
    ship.heading += Math.sign(diff) * Math.min(Math.abs(diff), step);
    ship.heading  = ((ship.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  }

  _setSpeed(dist) {
    const aggr = this.diff.speedAggrMult;
    if (this.state === 'retreat') {
      this.ship.targetSpeed = this.ship.maxSpeed;
    } else if (this.state === 'approach') {
      this.ship.targetSpeed = this.ship.maxSpeed * aggr;
    } else if (this.state === 'engage') {
      this.ship.targetSpeed = this.ship.maxSpeed * aggr * 0.7;
    } else {
      this.ship.targetSpeed = this.ship.maxSpeed;
    }
  }

  _maneuver(dt) {
    this.maneuverTimer -= dt;
    if (this.maneuverTimer <= 0) {
      this.maneuverDir   = Math.random() < 0.5 ? 1 : -1;
      this.maneuverTimer = 5 + Math.random() * 10;
      if ((this.state === 'engage' || this.state === 'evade') &&
          Math.random() < this.diff.maneuverProb) {
        this.ship.heading += (Math.random() - 0.5) * 0.35;
      }
    }
  }

  _gunnery(dt, dist, effects) {
    const ship   = this.ship;
    const target = this.target;

    // Don't fire if reloading
    if (!ship.canFire()) return;

    const maxRange = ship.gunDef.range;
    if (dist > maxRange) return;

    // Bearing to target with difficulty-based error
    const truebrg  = ship.bearingTo(target);
    const errBrg   = (Math.random() - 0.5) * (this.diff.bearingErrorDeg * Math.PI / 180) * 2;

    // Solve elevation for this range (+/- range error)
    const distM    = Ballistics.toM(dist * (1 + (Math.random() - 0.5) * this.diff.rangeErrorFactor * 2));
    const elev     = Ballistics.solveElevation(distM, ship.gunDef.muzzleVel);
    if (!elev) return;

    const useHigh     = dist > maxRange * 0.60;
    const elevAngle   = useHigh ? elev.high : elev.low;
    const tof         = Ballistics.timeOfFlight(elevAngle, ship.gunDef.muzzleVel);

    ship.gunAngle     = truebrg + errBrg;
    ship.gunElevation = elevAngle;

    // Deterministic fire: fire as soon as reload is done (with difficulty reload penalty)
    // Easy: reload time × 2×, hard: ×1× (no penalty)
    const reloadPenalty = this.diff.fireRateMult <= 0.5 ? 2.2 : 1.0;
    // The reload timer was already set; we just fire now that canFire() passed.
    // Apply extra delay for easy mode by checking a separate cooldown:
    if (!this._fireReady) this._fireReady = 0;
    this._fireReady -= dt;
    if (this._fireReady > 0) return;

    // Fire!
    ship.startReload();
    // Easy mode fires less often by resetting an extra cooldown after each shot
    this._fireReady = this.diff.fireRateMult <= 0.5
      ? ship.gunDef.reloadTime * 1.2    // easy: extra delay on top of reload
      : 0;

    // Simulate the actual shot using real target position (OBB hit check)
    const shotResult = Ballistics.simulateShot(
      ship.gunDef,
      ship.position,
      target.position,
      target.def.armour,
      { x: target.velocity.x, z: target.velocity.z },
      1 - ship.fireControl,
      true,                            // add noise
      target.def.hitbox,               // OBB
      target.heading
    );

    ship.shotsFired += ship.gunDef.barrels;

    if (effects) {
      const tipPos = ship.getMuzzleTipWorld(0, 0);
      effects.muzzleFlash(tipPos, ship.gunDef.calibre);

      const impactVec = new THREE.Vector3(shotResult.impactPos.x, 0, shotResult.impactPos.z);

      if (!shotResult.outOfRange) {
        effects.addShellTracer(
          ship.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
          impactVec,
          tof,
          ship.gunDef.calibre
        );
      }
    }

    if (shotResult.hit) {
      setTimeout(() => {
        if (!target.isAlive) return;
        target.applyDamage(shotResult.dmgResult, effects);
        ship.shotsHit++;
        ship.damageDealt += shotResult.dmgResult.damage;
        if (effects) {
          effects.explosion({ x: target.position.x, z: target.position.z });
        }
        if (!target.isAlive && effects) {
          effects.sinkShip(target.group);
        }
      }, tof * 1000);
    } else if (!shotResult.outOfRange) {
      setTimeout(() => {
        if (effects) effects.splash(shotResult.impactPos);
      }, tof * 1000);
    }
  }

  _torpedoes(dist, effects, spawnTorpedoCb) {
    const ship = this.ship;
    if (!ship.canTorpedo() || !ship.torpDef) return;

    const torpRange = ship.torpDef.range;
    if (dist > torpRange * 0.85) return;

    // Fire roughly once every 20-40 seconds probabilistically
    if (Math.random() < 0.003) {
      ship.fireTorpedo();

      if (spawnTorpedoCb) {
        // Lead the target: aim at where target will be when torpedo arrives
        const target = this.target;
        const ttof   = dist / ship.torpDef.speed;
        const leadX  = target.position.x + target.velocity.x * ttof;
        const leadZ  = target.position.z + target.velocity.z * ttof;
        const aimAngle = Math.atan2(
          leadX - ship.position.x,
          leadZ - ship.position.z
        );
        // Small bearing error based on difficulty
        const errBrg = (Math.random() - 0.5) * (this.diff.bearingErrorDeg * Math.PI / 180) * 3;
        spawnTorpedoCb(ship, aimAngle + errBrg, false);
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
