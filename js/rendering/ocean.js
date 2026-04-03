/* ══════════════════════════════════════════════════════════════
   OCEAN — Animated sea surface, sky, and environment
   ══════════════════════════════════════════════════════════════ */

'use strict';

class Ocean {
  constructor(scene, scenarioCfg) {
    this.scene = scene;
    this.cfg   = scenarioCfg;
    this.time  = 0;

    this._buildSky();
    this._buildSea();
    this._buildFog();
    this._buildSun();
  }

  _buildSky() {
    const cfg = this.cfg;
    // Gradient sky via a large sphere with vertex colours
    const geo  = new THREE.SphereGeometry(4000, 16, 8);
    const mat  = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      vertexColors: true,
    });

    const colors = [];
    const pos    = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y    = pos.getY(i);
      const norm = (y + 4000) / 8000; // 0=bottom, 1=top
      const c    = new THREE.Color();
      c.lerpColors(
        new THREE.Color(cfg.skyHorizon),
        new THREE.Color(cfg.skyZenith),
        Math.pow(norm, 0.6)
      );
      colors.push(c.r, c.g, c.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.sky = new THREE.Mesh(geo, mat);
    this.scene.add(this.sky);
  }

  _buildSea() {
    const cfg  = this.cfg;
    const size = MAX_SEA_SIZE * 2;
    const segs = 256;

    const geo  = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    // Store original Y positions for wave animation
    this._origY = new Float32Array(geo.attributes.position.count);
    for (let i = 0; i < geo.attributes.position.count; i++) {
      this._origY[i] = geo.attributes.position.getY(i);
    }

    const mat  = new THREE.MeshPhongMaterial({
      color:       new THREE.Color(cfg.seaColor),
      emissive:    new THREE.Color(cfg.seaEmissive || 0x001122),
      specular:    new THREE.Color(0x336688),
      shininess:   cfg.seaShininess || 60,
      transparent: true,
      opacity:     0.88,
    });

    this.sea = new THREE.Mesh(geo, mat);
    this.sea.receiveShadow = true;
    this.sea.position.y    = -0.5;
    this.scene.add(this.sea);
  }

  _buildFog() {
    const cfg = this.cfg;
    this.scene.fog = new THREE.FogExp2(
      new THREE.Color(cfg.fogColor  || 0x8899aa),
      cfg.fogDensity || 0.0006
    );
  }

  _buildSun() {
    const cfg = this.cfg;
    // Ambient
    const ambient = new THREE.AmbientLight(
      new THREE.Color(cfg.ambientColor || 0x607080),
      cfg.ambientInt   || 0.7
    );
    this.scene.add(ambient);

    // Directional sun
    const sun = new THREE.DirectionalLight(
      new THREE.Color(cfg.sunColor || 0xffeedd),
      cfg.sunInt       || 1.2
    );
    const sd  = cfg.sunDir || { x: 0.5, y: 0.8, z: 0.3 };
    sun.position.set(sd.x * 1000, sd.y * 1000, sd.z * 1000);
    sun.castShadow = false;
    this.scene.add(sun);
    this.sun = sun;
  }

  update(dt) {
    this.time += dt;

    // Wave animation — offset vertex Y with overlapping sinusoids
    const pos  = this.sea.geometry.attributes.position;
    const t    = this.time;
    const cfg  = this.cfg;
    const wH   = cfg.waveHeight  || 0.6;
    const wS   = cfg.waveSpeed   || 0.4;

    for (let i = 0; i < pos.count; i++) {
      const x  = pos.getX(i);
      const z  = pos.getZ(i);
      const y  = this._origY[i]
               + Math.sin(x * 0.015 + t * wS)           * wH
               + Math.sin(z * 0.012 + t * wS * 0.7)     * wH * 0.7
               + Math.sin((x + z) * 0.008 + t * wS * 1.3) * wH * 0.4;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    this.sea.geometry.computeVertexNormals();
  }
}
