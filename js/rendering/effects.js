/* ══════════════════════════════════════════════════════════════
   EFFECTS — Muzzle flash, shell splashes, fire, smoke, explosions
   ══════════════════════════════════════════════════════════════ */

'use strict';

class EffectsManager {
  constructor(scene) {
    this.scene    = scene;
    this._pool    = [];
    this._active  = [];
    this._shells  = []; // in-flight shell tracers
  }

  // ── Particle / sprite helpers ─────────────────────────────

  _sprite(color, size) {
    const geo = new THREE.SphereGeometry(size, 5, 5);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    return new THREE.Mesh(geo, mat);
  }

  // ── Muzzle flash ─────────────────────────────────────────
  muzzleFlash(position, calibre) {
    const scale = calibre / 100;
    const flash = this._sprite(0xffcc44, 0.6 * scale);
    flash.position.copy(position);
    this.scene.add(flash);

    // smoke ring
    const smoke = this._buildSmokeCloud(position, scale * 1.5, 0x888888);

    // auto-remove
    let t = 0;
    const ticker = (dt) => {
      t += dt;
      flash.material.opacity = Math.max(0, 0.85 - t * 8);
      flash.scale.setScalar(1 + t * 12);
      if (t > 0.12) {
        this.scene.remove(flash);
        return false; // done
      }
      return true;
    };
    this._active.push(ticker);
  }

  // ── Shell splash ─────────────────────────────────────────
  splash(position) {
    // Water column
    const geo = new THREE.CylinderGeometry(0.2, 0.8, 4, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xaaccdd, transparent: true, opacity: 0.8 });
    const col = new THREE.Mesh(geo, mat);
    col.position.set(position.x, 2, position.z);
    this.scene.add(col);

    // Spray particles
    const particles = [];
    for (let i = 0; i < 12; i++) {
      const p = this._sprite(0xbbddee, 0.25);
      p.position.set(
        position.x + (Math.random() - 0.5) * 2,
        0.5 + Math.random() * 3,
        position.z + (Math.random() - 0.5) * 2
      );
      p._vy  = 4 + Math.random() * 6;
      p._vx  = (Math.random() - 0.5) * 2;
      p._vz  = (Math.random() - 0.5) * 2;
      this.scene.add(p);
      particles.push(p);
    }

    let t = 0;
    const ticker = (dt) => {
      t += dt;
      col.scale.y  = Math.max(0, 1 - t * 0.6);
      col.material.opacity = Math.max(0, 0.8 - t * 0.9);
      col.position.y = 2 + t * 2;

      for (const p of particles) {
        p._vy -= 9.8 * dt;
        p.position.x += p._vx * dt;
        p.position.y += p._vy * dt;
        p.position.z += p._vz * dt;
        p.material.opacity = Math.max(0, 0.8 - t * 1.2);
      }

      if (t > 1.2) {
        this.scene.remove(col);
        for (const p of particles) this.scene.remove(p);
        return false;
      }
      return true;
    };
    this._active.push(ticker);
  }

  // ── Explosion ─────────────────────────────────────────────
  explosion(position, scale = 1) {
    const sphere = this._sprite(0xff6600, 1.2 * scale);
    sphere.position.set(position.x, 0.8, position.z);
    this.scene.add(sphere);

    const inner = this._sprite(0xffee00, 0.6 * scale);
    inner.position.copy(sphere.position);
    this.scene.add(inner);

    const smoke = this._buildSmokeCloud(position, scale * 2.5, 0x444444);

    // Debris shards
    const debris = [];
    for (let i = 0; i < 8; i++) {
      const d = this._sprite(0xcc4400, 0.15 * scale);
      d.position.copy(sphere.position);
      const ang = Math.random() * Math.PI * 2;
      d._vx = Math.cos(ang) * (3 + Math.random() * 5);
      d._vy = 2 + Math.random() * 6;
      d._vz = Math.sin(ang) * (3 + Math.random() * 5);
      this.scene.add(d);
      debris.push(d);
    }

    let t = 0;
    const ticker = (dt) => {
      t += dt;
      sphere.scale.setScalar(1 + t * 8);
      sphere.material.opacity  = Math.max(0, 0.9 - t * 2.5);
      inner.scale.setScalar(1  + t * 12);
      inner.material.opacity   = Math.max(0, 1.0 - t * 3.5);

      for (const d of debris) {
        d._vy -= 9.8 * dt;
        d.position.x += d._vx * dt;
        d.position.y += d._vy * dt;
        d.position.z += d._vz * dt;
        d.material.opacity = Math.max(0, 0.8 - t * 0.8);
      }

      if (t > 1.5) {
        this.scene.remove(sphere);
        this.scene.remove(inner);
        for (const d of debris) this.scene.remove(d);
        return false;
      }
      return true;
    };
    this._active.push(ticker);
  }

  // ── Persistent fire (attached to ship) ───────────────────
  createFire(parentGroup, localPos) {
    const group = new THREE.Group();
    group.position.copy(localPos);
    parentGroup.add(group);

    const flames = [];
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.ConeGeometry(0.3 + Math.random() * 0.3, 1.2 + Math.random() * 0.8, 5);
      const mat = new THREE.MeshBasicMaterial({
        color:       0xff5500,
        transparent: true,
        opacity:     0.75,
      });
      const f  = new THREE.Mesh(geo, mat);
      f.position.set(
        (Math.random() - 0.5) * 1,
        0,
        (Math.random() - 0.5) * 1
      );
      f._phase = Math.random() * Math.PI * 2;
      f._speed = 2 + Math.random() * 3;
      group.add(f);
      flames.push(f);
    }

    let t = 0;
    const ticker = (dt) => {
      t += dt;
      for (const f of flames) {
        f.scale.y = 0.7 + 0.4 * Math.sin(t * f._speed + f._phase);
        f.scale.x = f.scale.z = 0.8 + 0.3 * Math.sin(t * f._speed * 1.3 + f._phase);
        f.material.color.setHSL(
          0.04 + 0.06 * Math.sin(t * 2 + f._phase),
          1.0,
          0.4 + 0.2 * Math.sin(t * f._speed + f._phase)
        );
      }
      // return true = keep alive; caller removes group when fire extinguished
      return group.parent !== null;
    };
    this._active.push(ticker);
    return group;
  }

  // ── Smoke puff trail ─────────────────────────────────────
  _buildSmokeCloud(position, size, color) {
    const puffs = [];
    for (let i = 0; i < 5; i++) {
      const p = this._sprite(color, size * (0.5 + Math.random() * 0.5));
      p.position.set(
        position.x + (Math.random() - 0.5) * size,
        (Math.random()) * size * 0.8,
        position.z + (Math.random() - 0.5) * size
      );
      p._vy = 0.5 + Math.random() * 1;
      this.scene.add(p);
      puffs.push(p);
    }

    let t = 0;
    const ticker = (dt) => {
      t += dt;
      for (const p of puffs) {
        p.position.y += p._vy * dt;
        p.scale.setScalar(1 + t * 0.8);
        p.material.opacity = Math.max(0, 0.65 - t * 0.5);
      }
      if (t > 2.5) {
        for (const p of puffs) this.scene.remove(p);
        return false;
      }
      return true;
    };
    this._active.push(ticker);
    return puffs;
  }

  // ── Shell tracer (in-flight) ──────────────────────────────
  addShellTracer(startPos, endPos, tof, calibre) {
    const scale = Math.max(0.08, calibre / 1000);
    const geo   = new THREE.SphereGeometry(scale, 4, 4);
    const mat   = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    const mesh  = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    // Trail line
    const trailPts = [startPos.clone(), startPos.clone()];
    const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPts);
    const trailMat = new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.4 });
    const trail    = new THREE.Line(trailGeo, trailMat);
    this.scene.add(trail);

    const elapsed = { v: 0 };
    const gravity  = 9.8 * WORLD_SCALE; // scaled gravity

    const dx   = endPos.x - startPos.x;
    const dz   = endPos.z - startPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const maxH = dist * 0.18; // arc height

    const ticker = (dt) => {
      elapsed.v += dt;
      const frac = Math.min(elapsed.v / tof, 1);

      // Parabolic arc
      mesh.position.x = startPos.x + dx * frac;
      mesh.position.z = startPos.z + dz * frac;
      mesh.position.y = startPos.y + maxH * 4 * frac * (1 - frac);

      // Update trail
      const p = [mesh.position.clone(), mesh.position.clone()];
      p[0].x -= dx / dist * 1.5;
      p[0].y -= maxH * 4 * (2 * frac - 1) / dist * 1.5; // approximate tangent
      trailGeo.setFromPoints(p);
      trailMat.opacity = 0.4 * (1 - frac * 0.5);

      if (frac >= 1) {
        this.scene.remove(mesh);
        this.scene.remove(trail);
        return false;
      }
      return true;
    };

    this._active.push(ticker);
  }

  // ── Near miss spray ──────────────────────────────────────
  nearMiss(position) {
    this.splash(position);
  }

  // ── Sinking effect ────────────────────────────────────────
  sinkShip(shipGroup, duration = 12) {
    let t = 0;
    const startY = shipGroup.position.y;
    const ticker = (dt) => {
      t += dt;
      const frac = t / duration;
      shipGroup.position.y  = startY - frac * 15;
      shipGroup.rotation.z  = frac * 0.4;
      shipGroup.rotation.x  = frac * 0.2;
      if (t > 1.5) {
        // Bubbles / smoke
        if (Math.random() < dt * 3) {
          this._buildSmokeCloud(
            { x: shipGroup.position.x + (Math.random()-0.5)*5,
              z: shipGroup.position.z + (Math.random()-0.5)*5 },
            1.5, 0x7799aa
          );
        }
      }
      if (frac >= 1) {
        this.scene.remove(shipGroup);
        return false;
      }
      return true;
    };
    this._active.push(ticker);
  }

  // ── Update all active effects ────────────────────────────
  update(dt) {
    this._active = this._active.filter(fn => fn(dt) !== false);
  }
}
