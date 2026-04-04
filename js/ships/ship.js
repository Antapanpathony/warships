/* ══════════════════════════════════════════════════════════════
   SHIP — Base class: 3D model, physics, damage, weapons
   ══════════════════════════════════════════════════════════════ */

'use strict';

class Ship {
  constructor(type, name, nation, isPlayer = false) {
    this.type      = type;
    this.name      = name;
    this.nation    = nation;
    this.isPlayer  = isPlayer;

    const def      = SHIP_DEFS[type];
    this.def       = def;
    this.maxHp     = def.maxHp;
    this.hp        = def.maxHp;

    // Movement
    this.speed        = 0;          // current speed (units/s)
    this.targetSpeed  = 0;
    this.heading      = 0;          // radians, 0 = north (+Z)
    this.turnRate     = def.turnRate;
    this.maxSpeed     = def.maxSpeed;

    // Position (Three.js Vector3-compatible)
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Damage systems
    this.propulsion   = 1.0;        // 0–1
    this.fireControl  = 1.0;        // 0–1
    this.isSinking    = false;
    this.isAlive      = true;
    this.onFire       = false;
    this.flooding     = false;
    this.fireTimer    = 0;
    this.floodTimer   = 0;

    // Weapons
    this.gunDef       = { ...def.guns };
    this.torpDef      = def.torpedoes ? { ...def.torpedoes } : null;
    this.reloadTimer  = 0;
    this.torpReload   = 0;
    this.torpCount    = def.torpedoes ? def.torpedoes.tubes : 0;
    this.gunAngle     = 0;          // current turret traverse (rad from bow)
    this.gunElevation = 0;

    // Stats
    this.shotsFired   = 0;
    this.shotsHit     = 0;
    this.damageDealt  = 0;
    this.torpsFired   = 0;

    // Three.js group
    this.group        = this._buildModel();

    // Visual damage (fires attached to group)
    this._fires       = [];
  }

  // ── 3D Model ─────────────────────────────────────────────

  _buildModel() {
    const g   = new THREE.Group();
    const def = this.def;
    const L   = def.length;
    const B   = def.beam;

    // Colour by nation
    const nationColors = {
      'UK':      0x8888aa,
      'US':      0x667788,
      'Germany': 0x666655,
      'Japan':   0x887766,
      'France':  0x8877aa,
      'Italy':   0x998877,
      'player':  0x4488cc,
    };
    const hullColor = this.isPlayer
      ? nationColors.player
      : (nationColors[this.nation] || 0x778899);

    const hullMat = new THREE.MeshPhongMaterial({
      color:    hullColor,
      emissive: 0x111111,
      specular: 0x223344,
      shininess: 30,
    });
    const darkMat = new THREE.MeshPhongMaterial({
      color:    0x222222,
      emissive: 0x050505,
      shininess: 10,
    });
    const metalMat = new THREE.MeshPhongMaterial({
      color:    0x888888,
      specular: 0x555555,
      shininess: 60,
    });

    // ── Hull ──────────────────────────────────────────────
    // Main hull body (tapered box)
    const hullGeo = new THREE.BoxGeometry(B, B * 0.55, L);
    const hull    = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0;
    g.add(hull);

    // Upper deck (narrower)
    const deckGeo = new THREE.BoxGeometry(B * 0.85, B * 0.15, L * 0.90);
    const deck    = new THREE.Mesh(deckGeo, hullMat);
    deck.position.y = B * 0.35;
    g.add(deck);

    // Bow cap (tapered)
    const bowGeo  = new THREE.CylinderGeometry(0, B * 0.42, B * 0.8, 4, 1);
    const bow     = new THREE.Mesh(bowGeo, hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(0, -B * 0.05, L / 2 + B * 0.3);
    g.add(bow);

    // Stern transom
    const sternGeo = new THREE.BoxGeometry(B * 0.9, B * 0.45, B * 0.3);
    const stern    = new THREE.Mesh(sternGeo, hullMat);
    stern.position.set(0, -B * 0.04, -L / 2);
    g.add(stern);

    // Keel
    const keelGeo  = new THREE.BoxGeometry(B * 0.15, B * 0.3, L * 1.05);
    const keel     = new THREE.Mesh(keelGeo, darkMat);
    keel.position.y = -B * 0.4;
    g.add(keel);

    // Waterline stripe
    const stripeGeo = new THREE.BoxGeometry(B * 1.01, B * 0.04, L * 0.95);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x882222 });
    const stripe    = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = -B * 0.1;
    g.add(stripe);

    // ── Superstructure (type-specific) ───────────────────
    this._addSuperstructure(g, L, B, hullMat, darkMat, metalMat);

    // ── Turrets ───────────────────────────────────────────
    this._addTurrets(g, L, B, metalMat, hullMat);

    // ── Wake / Propeller indicators ───────────────────────
    // (visual only)
    const propGeo = new THREE.CylinderGeometry(B * 0.15, B * 0.15, 0.05, 6);
    const prop    = new THREE.Mesh(propGeo, metalMat);
    prop.position.set(0, -B * 0.5, -L / 2 - 0.3);
    g.add(prop);
    this._propeller = prop;

    return g;
  }

  _addSuperstructure(g, L, B, hullMat, darkMat, metalMat) {
    const type = this.type;

    if (type === 'battleship') {
      // Heavy, multi-tiered superstructure
      const tiers = [
        { w: B * 0.65, h: B * 0.55, d: L * 0.22, z:  L * 0.08 },
        { w: B * 0.50, h: B * 0.45, d: L * 0.14, z:  L * 0.08 },
        { w: B * 0.38, h: B * 0.35, d: L * 0.10, z:  L * 0.06 },
      ];
      let yBase = B * 0.42;
      for (const t of tiers) {
        const geo  = new THREE.BoxGeometry(t.w, t.h, t.d);
        const mesh = new THREE.Mesh(geo, hullMat);
        mesh.position.set(0, yBase + t.h / 2, t.z);
        g.add(mesh);
        yBase += t.h;
      }

      // Conning tower
      const ctGeo  = new THREE.CylinderGeometry(B * 0.12, B * 0.15, B * 0.3, 8);
      const ct     = new THREE.Mesh(ctGeo, metalMat);
      ct.position.set(0, yBase + B * 0.15, L * 0.05);
      g.add(ct);
      yBase += B * 0.3;

      // Main mast
      const mast   = this._makeMast(B * 0.04, B * 2.2, metalMat);
      mast.position.set(0, yBase, L * 0.03);
      g.add(mast);

      // Aft superstructure (smaller)
      const aftGeo = new THREE.BoxGeometry(B * 0.45, B * 0.4, L * 0.12);
      const aft    = new THREE.Mesh(aftGeo, hullMat);
      aft.position.set(0, B * 0.62, -L * 0.15);
      g.add(aft);

      // Rear mast
      const mast2  = this._makeMast(B * 0.03, B * 1.4, metalMat);
      mast2.position.set(0, B * 1.0, -L * 0.2);
      g.add(mast2);

      // Funnel(s)
      this._addFunnels(g, L, B, 2, metalMat, darkMat);

    } else if (type === 'cruiser') {
      const tiers = [
        { w: B * 0.60, h: B * 0.50, d: L * 0.20, z:  L * 0.06 },
        { w: B * 0.44, h: B * 0.35, d: L * 0.12, z:  L * 0.06 },
      ];
      let yBase = B * 0.42;
      for (const t of tiers) {
        const geo  = new THREE.BoxGeometry(t.w, t.h, t.d);
        const mesh = new THREE.Mesh(geo, hullMat);
        mesh.position.set(0, yBase + t.h / 2, t.z);
        g.add(mesh);
        yBase += t.h;
      }

      const mast = this._makeMast(B * 0.035, B * 2.0, metalMat);
      mast.position.set(0, yBase, L * 0.05);
      g.add(mast);

      const aftGeo = new THREE.BoxGeometry(B * 0.40, B * 0.3, L * 0.10);
      const aft    = new THREE.Mesh(aftGeo, hullMat);
      aft.position.set(0, B * 0.55, -L * 0.18);
      g.add(aft);

      const mast2 = this._makeMast(B * 0.025, B * 1.5, metalMat);
      mast2.position.set(0, B * 0.85, -L * 0.22);
      g.add(mast2);

      this._addFunnels(g, L, B, 2, metalMat, darkMat);

    } else { // destroyer
      const superGeo = new THREE.BoxGeometry(B * 0.55, B * 0.45, L * 0.22);
      const sup      = new THREE.Mesh(superGeo, hullMat);
      sup.position.set(0, B * 0.62, L * 0.10);
      g.add(sup);

      const bridgeGeo = new THREE.BoxGeometry(B * 0.4, B * 0.3, L * 0.08);
      const bridge    = new THREE.Mesh(bridgeGeo, hullMat);
      bridge.position.set(0, B * 0.93, L * 0.13);
      g.add(bridge);

      const mast = this._makeMast(B * 0.03, B * 1.8, metalMat);
      mast.position.set(0, B * 1.1, L * 0.10);
      g.add(mast);

      // Torpedo tube launchers (visual)
      if (this.torpDef) {
        const tGeo = new THREE.CylinderGeometry(B * 0.05, B * 0.05, B * 0.6, 5);
        for (let i = -1; i <= 1; i += 2) {
          const t = new THREE.Mesh(tGeo, metalMat);
          t.rotation.z = Math.PI / 2;
          t.position.set(i * B * 0.5, B * 0.5, 0);
          g.add(t);
        }
      }

      this._addFunnels(g, L, B, 1, metalMat, darkMat);
    }
  }

  _makeMast(radius, height, mat) {
    const geo = new THREE.CylinderGeometry(radius * 0.3, radius, height, 5);
    const m   = new THREE.Mesh(geo, mat);
    m.position.y = height / 2;
    return m;
  }

  _addFunnels(g, L, B, count, metalMat, darkMat) {
    const spacing = L * 0.08;
    const startZ  = L * 0.04;
    for (let i = 0; i < count; i++) {
      const fGeo = new THREE.CylinderGeometry(B * 0.09, B * 0.11, B * 0.7, 8);
      const f    = new THREE.Mesh(fGeo, metalMat);
      f.position.set(0, B * 0.85, startZ - i * spacing);
      g.add(f);

      // Funnel top rim (dark)
      const capGeo = new THREE.CylinderGeometry(B * 0.10, B * 0.10, B * 0.04, 8);
      const cap    = new THREE.Mesh(capGeo, darkMat);
      cap.position.set(0, B * 1.22, startZ - i * spacing);
      g.add(cap);
    }
  }

  _addTurrets(g, L, B, metalMat, hullMat) {
    const def      = this.def;
    const count    = def.guns.turrets;
    const calibre  = def.guns.calibre;
    const barPerT  = Math.ceil(def.guns.barrels / count);

    // Turret positions
    const positions = this._turretPositions(L, count);

    this._turretGroups = [];
    this._barrelTips   = [];

    for (let i = 0; i < count; i++) {
      const tGroup = new THREE.Group();
      tGroup.position.set(0, positions[i].y, positions[i].z);

      // Base ring
      const baseGeo = new THREE.CylinderGeometry(B * 0.18, B * 0.2, B * 0.08, 8);
      const base    = new THREE.Mesh(baseGeo, metalMat);
      tGroup.add(base);

      // Turret body
      const tScale  = calibre / 203;
      const tW      = B * 0.34 * tScale;
      const tH      = B * 0.18 * tScale;
      const tD      = B * 0.30 * tScale;
      const bodyGeo = new THREE.BoxGeometry(tW, tH, tD);
      const body    = new THREE.Mesh(bodyGeo, metalMat);
      body.position.y = tH / 2 + B * 0.04;
      tGroup.add(body);

      // Barrels
      const barrelLen = calibre * 40 / 1000 / WORLD_SCALE; // barrel length ~40 calibres
      const barrelR   = calibre / 2000 / WORLD_SCALE * 0.7;
      const barrelGeo = new THREE.CylinderGeometry(barrelR, barrelR * 1.1, barrelLen, 6);

      const barrelGroup = new THREE.Group();
      barrelGroup.position.set(0, tH + B * 0.04, tD * 0.05);
      tGroup.add(barrelGroup);

      const bSpacing = tW * 0.28;
      const tips     = [];
      for (let b = 0; b < barPerT; b++) {
        const bGeo  = barrelGeo.clone();
        const bar   = new THREE.Mesh(bGeo, metalMat);
        bar.rotation.x = -Math.PI / 2;
        const xOff  = barPerT === 1 ? 0 : (b - (barPerT - 1) / 2) * bSpacing;
        bar.position.set(xOff, 0, barrelLen / 2);

        barrelGroup.add(bar);

        // Tip marker (for muzzle flash position)
        const tipDummy = new THREE.Object3D();
        tipDummy.position.set(xOff, 0, barrelLen);
        barrelGroup.add(tipDummy);
        tips.push(tipDummy);
      }

      g.add(tGroup);
      this._turretGroups.push({ tGroup, barrelGroup, aft: positions[i].z < 0 });
      this._barrelTips.push(tips);
    }
  }

  _turretPositions(L, count) {
    // Arrange turrets forward/aft in a historically-inspired layout
    const yDeck = this.def.beam * 0.44;
    if (count === 3) {
      return [
        { z: L * 0.35, y: yDeck },          // A turret
        { z: L * 0.20, y: yDeck + 0.3 },   // B turret (superfiring)
        { z: -L * 0.35, y: yDeck },         // X turret
      ];
    } else if (count === 4) {
      return [
        { z:  L * 0.38, y: yDeck },
        { z:  L * 0.22, y: yDeck + 0.25 },
        { z: -L * 0.22, y: yDeck + 0.25 },
        { z: -L * 0.38, y: yDeck },
      ];
    } else if (count === 5) {
      return [
        { z:  L * 0.40, y: yDeck },
        { z:  L * 0.18, y: yDeck + 0.2 },
        { z:  0,        y: yDeck },
        { z: -L * 0.18, y: yDeck + 0.2 },
        { z: -L * 0.40, y: yDeck },
      ];
    }
    // fallback: 2
    return [
      { z:  L * 0.35, y: yDeck },
      { z: -L * 0.35, y: yDeck },
    ];
  }

  // ── Update ────────────────────────────────────────────────

  update(dt) {
    if (!this.isAlive) return;

    this._updateMovement(dt);
    this._updateDamage(dt);
    this._updateWeapons(dt);
    this._updateModel();
  }

  _updateMovement(dt) {
    const def   = this.def;
    // Lerp speed
    const accel = this.targetSpeed > this.speed ? 0.4 : 0.6;
    this.speed += (this.targetSpeed - this.speed) * accel * dt;

    // Propulsion damage reduces max speed
    const effMax = this.maxSpeed * Math.max(0.1, this.propulsion);
    this.speed   = Math.min(this.speed, effMax);

    // Move
    const vx = Math.sin(this.heading) * this.speed;
    const vz = Math.cos(this.heading) * this.speed;
    this.velocity.set(vx, 0, vz);
    this.position.x += vx * dt;
    this.position.z += vz * dt;

    // Keep within bounds
    const bound = MAX_SEA_SIZE - 50;
    this.position.x = Math.max(-bound, Math.min(bound, this.position.x));
    this.position.z = Math.max(-bound, Math.min(bound, this.position.z));

    // Propeller rotation
    if (this._propeller) {
      this._propeller.rotation.z += this.speed * dt * 3;
    }
  }

  _updateDamage(dt) {
    if (this.onFire) {
      this.fireTimer += dt;
      if (this.fireTimer > 0.5) {
        this.hp -= DMG.fireDamagePerSec * dt;
        this.fireTimer = 0;
      }
    }

    if (this.flooding) {
      this.hp -= DMG.floodingDmgPerSec * dt;
    }

    if (this.hp <= 0 && !this.isSinking) {
      this._sink();
    }
  }

  _updateWeapons(dt) {
    if (this.reloadTimer > 0) {
      this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    }
    if (this.torpReload > 0) {
      this.torpReload = Math.max(0, this.torpReload - dt);
    }
  }

  _updateModel() {
    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;  // Y rotation = heading (bow faces +Z local = sin/cos heading world)

    // Subtle ship roll based on speed and turning
    const roll  = Math.sin(Date.now() / 2000) * 0.02 * (this.speed / this.maxSpeed);
    const pitch = Math.sin(Date.now() / 1800) * 0.01;
    this.group.rotation.z = roll;
    this.group.rotation.x = pitch;

    // Animate turrets to face gun direction
    if (this._turretGroups) {
      for (const t of this._turretGroups) {
        // Turn turret to match gunAngle (local Y rotation)
        const localAngle = this.gunAngle - this.heading;
        if (!t.aft) {
          t.tGroup.rotation.y = localAngle;
        } else {
          t.tGroup.rotation.y = localAngle + Math.PI;
        }
        // Elevation on barrel group
        if (t.barrelGroup) {
          t.barrelGroup.rotation.x = -this.gunElevation;
        }
      }
    }
  }

  // ── Damage ────────────────────────────────────────────────

  applyDamage(dmgResult, effects) {
    if (!this.isAlive) return;

    this.hp -= dmgResult.damage;

    if (dmgResult.fire && !this.onFire) {
      this.onFire = true;
      this._startFire(effects);
    }

    if (dmgResult.flooding) {
      this.flooding = true;
    }

    // System damage (random hit to propulsion or fire control)
    if (dmgResult.penetrated && Math.random() < 0.3) {
      if (Math.random() < 0.5) {
        this.propulsion = Math.max(0.1, this.propulsion - 0.2);
      } else {
        this.fireControl = Math.max(0.2, this.fireControl - 0.25);
      }
    }

    if (this.hp <= 0 && !this.isSinking) {
      this._sink();
    }
  }

  _startFire(effects) {
    if (!effects) return;
    const lp = new THREE.Vector3(
      (Math.random() - 0.5) * this.def.length * 0.4,
      this.def.beam * 0.6,
      (Math.random() - 0.5) * this.def.length * 0.5
    );
    const fireGroup = effects.createFire(this.group, lp);
    this._fires.push(fireGroup);
  }

  _sink() {
    this.isSinking = true;
    this.isAlive   = false;
    this.speed     = 0;
    this.targetSpeed = 0;
  }

  // ── Weapons ───────────────────────────────────────────────

  canFire()    { return this.isAlive && this.reloadTimer <= 0; }
  canTorpedo() { return this.torpDef && this.torpCount > 0 && this.torpReload <= 0; }

  startReload() {
    const fc = 1 + (1 - this.fireControl) * 0.5; // FC damage = slower reload
    this.reloadTimer = this.gunDef.reloadTime * fc;
    this.shotsFired += this.gunDef.barrels;
  }

  fireTorpedo() {
    if (!this.canTorpedo()) return false;
    this.torpCount--;
    this.torpsFired++;
    this.torpReload = this.torpDef.reloadTime;
    return true;
  }

  getMuzzleTipWorld(turretIdx = 0, barrelIdx = 0) {
    if (!this._barrelTips || !this._barrelTips[turretIdx]) {
      return this.position.clone().add(new THREE.Vector3(0, 1, 0));
    }
    const tip = this._barrelTips[turretIdx][barrelIdx] || this._barrelTips[turretIdx][0];
    const worldPos = new THREE.Vector3();
    tip.getWorldPosition(worldPos);
    return worldPos;
  }

  // ── Helpers ───────────────────────────────────────────────

  getHpPercent()    { return Math.max(0, this.hp / this.maxHp); }
  getReloadPercent(){ return this.reloadTimer / this.gunDef.reloadTime; }

  distanceTo(other) {
    return this.position.distanceTo(other.position);
  }

  bearingTo(other) {
    const dx = other.position.x - this.position.x;
    const dz = other.position.z - this.position.z;
    return Math.atan2(dx, dz);  // radians, 0 = north
  }

  getHeadingDeg() {
    return ((this.heading * 180 / Math.PI) % 360 + 360) % 360;
  }

  getSpeedKnots() {
    // 1 unit/s ≈ 10 m/s ≈ 19.4 kts
    return this.speed * 19.4;
  }
}
