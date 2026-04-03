/* ══════════════════════════════════════════════════════════════
   GAME — Main loop, input, camera, state management
   ══════════════════════════════════════════════════════════════ */

'use strict';

const Game = (() => {

  // ── State ─────────────────────────────────────────────────
  let renderer, scene, camera, clock;
  let ocean, effects, hud;
  let player, enemies, allies;
  let enemyAIs, allyAIs;
  let scenario, scenarioCfg, difficulty;
  let viewMode = 'bridge';
  let targetIdx = 0;
  let elapsed   = 0;
  let gameOver  = false;
  let gameStarted = false;

  // Label overlays (tactical view)
  let labelContainer = null;

  // Input
  const keys = {};
  let mouseDX = 0, mouseDY = 0;
  let isPointerLocked = false;

  // Camera
  const CAM = {
    yaw:          0,
    pitch:        0,
    pitchMin:    -0.35,
    pitchMax:     0.45,
    bridgeHeight: 0,
  };

  // ── Init ──────────────────────────────────────────────────

  function init() {
    _setupRenderer();
    _setupLabelContainer();
    _setupMenu();
  }

  function _setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.id = 'game-canvas';
    document.body.prepend(renderer.domElement);

    window.addEventListener('resize', () => {
      if (camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      }
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function _setupLabelContainer() {
    labelContainer = document.createElement('div');
    labelContainer.id = 'label-container';
    labelContainer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:55;
      font-family:'Courier New',monospace; font-size:0.6rem;
    `;
    document.body.appendChild(labelContainer);
  }

  function _setupMenu() {
    document.querySelectorAll('.ship-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.ship-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    document.querySelectorAll('.scenario-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.scenario-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
      });
    });

    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    document.getElementById('start-battle-btn').addEventListener('click', () => {
      const shipType = document.querySelector('.ship-card.selected').dataset.ship;
      const scenKey  = document.querySelector('.scenario-item.selected').dataset.scenario;
      const diffKey  = document.querySelector('.diff-btn.selected').dataset.diff;
      startBattle(shipType, scenKey, diffKey);
    });

    document.getElementById('play-again-btn').addEventListener('click', () => location.reload());
    document.getElementById('main-menu-btn').addEventListener('click',  () => location.reload());
  }

  // ── Battle start ─────────────────────────────────────────

  async function startBattle(shipType, scenKey, diffKey) {
    document.getElementById('main-menu').style.display     = 'none';
    document.getElementById('loading-screen').style.display = 'flex';

    scenario    = scenKey;
    scenarioCfg = SCENARIOS[scenKey];
    difficulty  = diffKey;

    await _progress(0.1, 'Initialising world...');
    _setupScene();
    await _progress(0.3, 'Building ocean...');
    ocean   = new Ocean(scene, scenarioCfg);
    effects = new EffectsManager(scene);
    await _progress(0.5, 'Deploying fleet...');
    _spawnShips(shipType, scenKey, diffKey);
    await _progress(0.75, 'Calibrating fire control...');
    hud = new HUD();
    await _progress(0.9, 'Battle stations!');
    _setupInput();
    clock     = new THREE.Clock();
    gameOver  = false;
    elapsed   = 0;
    await _progress(1.0, 'ENGAGE!');

    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('game-hud').style.display       = 'block';
    hud.show();
    hud.setShipName(player.name);

    if (player.torpDef) {
      document.getElementById('torpedo-help').style.display = 'block';
    }

    _showBriefing(scenarioCfg.briefing);
    gameStarted = true;
    _gameLoop();
  }

  function _progress(frac, text) {
    document.getElementById('loading-bar').style.width  = (frac * 100) + '%';
    document.getElementById('loading-text').textContent = text;
    return new Promise(r => setTimeout(r, 80));
  }

  function _setupScene() {
    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 8000);
  }

  function _spawnShips(shipType, scenKey, diffKey) {
    const scenConf = SCENARIOS[scenKey];
    const enemyPool = AI_SHIP_POOL[scenKey];
    const allyPool  = ALLY_SHIP_POOL[scenKey] || [];

    const playerNames = {
      jutland:        { battleship:'HMS Iron Duke',     cruiser:'HMS Invincible', destroyer:'HMS Nestor' },
      surigao:        { battleship:'USS West Virginia', cruiser:'USS Denver',     destroyer:'USS Melvin' },
      north_cape:     { battleship:'HMS Duke of York',  cruiser:'HMS Jamaica',    destroyer:'HMS Savage' },
      cape_esperance: { battleship:'USS Washington',    cruiser:'USS San Francisco', destroyer:'USS Buchanan' },
    };
    const pName = (playerNames[scenKey] || {})[shipType] || 'Your Ship';

    // ── Player ─────────────────────────────────────────────
    player = new Ship(shipType, pName, 'UK', true);
    player.position.set(scenConf.playerStart.x, 0, scenConf.playerStart.z);
    player.heading = scenConf.playerStart.heading;
    player.targetSpeed = player.maxSpeed * 0.5;
    scene.add(player.group);
    CAM.bridgeHeight = SHIP_DEFS[shipType].beam * 1.5;

    // Intercept player damage for HUD flash
    const origApply = player.applyDamage.bind(player);
    player.applyDamage = (dmgResult, eff) => {
      origApply(dmgResult, eff);
      _onPlayerHit(dmgResult);
    };

    // ── Enemies ────────────────────────────────────────────
    enemies  = [];
    enemyAIs = [];
    for (let i = 0; i < enemyPool.length; i++) {
      const entry = enemyPool[i];
      const pos   = scenConf.enemyFormation[i] || { x: (i - 2) * 60, z: 180, heading: Math.PI };
      const e     = new Ship(entry.type, entry.name, entry.nation, false);
      e.hp        = Math.round(e.maxHp * entry.hpMod);
      e.position.set(pos.x, 0, pos.z);
      e.heading   = pos.heading;
      e.targetSpeed = e.maxSpeed * 0.65;
      scene.add(e.group);
      enemies.push(e);

      const ai = new AIController(e, diffKey, false);
      enemyAIs.push(ai);
    }

    // ── Allies ─────────────────────────────────────────────
    allies  = [];
    allyAIs = [];
    const allyForm = scenConf.allyFormation || [];
    for (let i = 0; i < allyPool.length; i++) {
      const entry = allyPool[i];
      const pos   = allyForm[i] || { x: (i - 1) * 50, z: -80, heading: 0 };
      const a     = new Ship(entry.type, entry.name, entry.nation, false);
      a.hp        = Math.round(a.maxHp * entry.hpMod);
      a.position.set(pos.x, 0, pos.z);
      a.heading   = pos.heading;
      a.targetSpeed = a.maxSpeed * 0.55;
      // Tint allies distinctly (slightly greener hull)
      a.group.traverse(obj => {
        if (obj.isMesh && obj.material && obj.material.color) {
          obj.material = obj.material.clone();
          obj.material.color.multiplyScalar(0.85);
          obj.material.color.g = Math.min(1, obj.material.color.g * 1.25);
        }
      });
      scene.add(a.group);
      allies.push(a);

      const ai = new AIController(a, diffKey, true);
      allyAIs.push(ai);
    }

    player.gunAngle = player.heading;
    targetIdx = 0;
  }

  // ── Input ─────────────────────────────────────────────────

  function _setupInput() {
    document.addEventListener('keydown', e => { keys[e.code] = true; _handleKeyDown(e); });
    document.addEventListener('keyup',   e => { keys[e.code] = false; });

    document.addEventListener('mousemove', e => {
      if (isPointerLocked) { mouseDX += e.movementX; mouseDY += e.movementY; }
    });

    document.addEventListener('mousedown', e => {
      if (e.button === 0) _handleFire();
      if (e.button === 2) _toggleGunSight();
    });

    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
    renderer.domElement.addEventListener('click', () => {
      if (!isPointerLocked) renderer.domElement.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = document.pointerLockElement === renderer.domElement;
    });
  }

  function _handleKeyDown(e) {
    if (!gameStarted || gameOver) return;
    switch (e.code) {
      case 'KeyT': _cycleTarget(); break;
      case 'KeyV': _cycleView();   break;
      case 'Digit1': player.targetSpeed = player.maxSpeed * 0.25; break;
      case 'Digit2': player.targetSpeed = player.maxSpeed * 0.55; break;
      case 'Digit3': player.targetSpeed = player.maxSpeed;        break;
      case 'KeyX':   player.targetSpeed = 0;                      break;
      case 'KeyF':   _fireTorpedo(); break;
      case 'Escape': document.exitPointerLock(); break;
    }
  }

  function _cycleTarget() {
    const alive = enemies.filter(e => e.isAlive);
    if (!alive.length) return;
    targetIdx = (targetIdx + 1) % alive.length;
  }

  function getTarget() {
    const alive = enemies.filter(e => e.isAlive);
    if (!alive.length) return null;
    return alive[targetIdx % alive.length];
  }

  function _cycleView() {
    const modes = ['bridge', 'gunSight', 'overhead'];
    viewMode    = modes[(modes.indexOf(viewMode) + 1) % modes.length];
    hud.setViewMode(viewMode);
    hud.showGunSight(viewMode === 'gunSight');
  }

  function _toggleGunSight() {
    viewMode = viewMode === 'gunSight' ? 'bridge' : 'gunSight';
    hud.setViewMode(viewMode);
    hud.showGunSight(viewMode === 'gunSight');
  }

  // ── Player firing ─────────────────────────────────────────

  function _handleFire() {
    if (!gameStarted || gameOver) return;
    if (!player.canFire()) return;
    const target = getTarget();
    if (!target) return;

    const result = Ballistics.simulateShot(
      player.gunDef,
      player.position,
      target.position,
      target.def.armour,
      { x: target.velocity.x, z: target.velocity.z },
      1 - player.fireControl,
      true,
      target.def.hitbox,
      target.heading
    );

    player.startReload();
    player.shotsFired += player.gunDef.barrels;

    const tipPos = player.getMuzzleTipWorld(0, 0);
    effects.muzzleFlash(tipPos, player.gunDef.calibre);
    _cameraShake(0.25);

    if (!result.outOfRange) {
      const impactVec = new THREE.Vector3(result.impactPos.x, 0, result.impactPos.z);
      effects.addShellTracer(
        player.position.clone().add(new THREE.Vector3(0, CAM.bridgeHeight, 0)),
        impactVec,
        result.tof,
        player.gunDef.calibre
      );

      if (result.hit) {
        setTimeout(() => {
          if (!target.isAlive) return;
          target.applyDamage(result.dmgResult, effects);
          player.shotsHit++;
          player.damageDealt += result.dmgResult.damage;
          effects.explosion({ x: target.position.x, z: target.position.z });
          hud.addKillEntry(
            result.dmgResult.penetrated
              ? `HIT ${target.name} — ${result.dmgResult.damage} dmg (PEN)`
              : `HIT ${target.name} — ${result.dmgResult.damage} dmg`
          );
          if (!target.isAlive) {
            hud.addKillEntry(`✦ ${target.name} SUNK`);
            effects.sinkShip(target.group);
          }
        }, result.tof * 1000);
      } else {
        setTimeout(() => effects.splash(result.impactPos), result.tof * 1000);
        hud.addKillEntry(`MISS — straddling ${target.name}`);
      }
    } else {
      hud.addKillEntry('OUT OF RANGE');
    }
  }

  function _fireTorpedo() {
    if (!player.canTorpedo()) return;
    const target = getTarget();
    if (!target) return;

    player.fireTorpedo();
    const dist    = player.distanceTo(target);
    const hitProb = 0.45 - (dist / player.torpDef.range) * 0.30;

    hud.addKillEntry('TORPEDOES AWAY');

    if (Math.random() < Math.max(0.05, hitProb)) {
      const ttof = dist / player.torpDef.speed;
      setTimeout(() => {
        if (!target.isAlive) return;
        const dmg = Ballistics.torpedoDamage(player.torpDef);
        target.applyDamage(dmg, effects);
        player.damageDealt += dmg.damage;
        effects.explosion({ x: target.position.x, z: target.position.z }, 2.5);
        hud.addKillEntry(`TORPEDO HIT — ${target.name} (${dmg.damage} dmg)`);
        if (!target.isAlive) {
          hud.addKillEntry(`✦ ${target.name} SUNK`);
          effects.sinkShip(target.group);
        }
      }, ttof * 1000);
    } else {
      hud.addKillEntry('TORPEDO MISSED');
    }
  }

  // ── Camera shake ──────────────────────────────────────────

  let _shakeTimer = 0, _shakeAmt = 0;

  function _cameraShake(intensity) {
    _shakeAmt   = intensity;
    _shakeTimer = 0.3;
  }

  function _onPlayerHit(dmgResult) {
    _cameraShake(0.55);
    hud.triggerHitFlash(dmgResult.damage, dmgResult.penetrated);
    hud.addKillEntry(
      dmgResult.penetrated
        ? `⚡ ${player.name} HIT — ${dmgResult.damage} dmg (PEN)`
        : `⚡ ${player.name} HIT — ${dmgResult.damage} dmg`
    );
  }

  // ── Camera ───────────────────────────────────────────────

  function _updateCamera(dt) {
    const sensitivity = 0.0018;
    CAM.yaw   -= mouseDX * sensitivity;
    CAM.pitch -= mouseDY * sensitivity;
    CAM.pitch  = Math.max(CAM.pitchMin, Math.min(CAM.pitchMax, CAM.pitch));
    mouseDX    = 0;
    mouseDY    = 0;

    let shakeX = 0, shakeY = 0;
    if (_shakeTimer > 0) {
      _shakeTimer -= dt;
      const frac = _shakeTimer / 0.3;
      shakeX = (Math.random() - 0.5) * _shakeAmt * frac;
      shakeY = (Math.random() - 0.5) * _shakeAmt * frac;
    }

    if (viewMode !== 'overhead') {
      // Bridge / gun-sight
      camera.position.copy(player.position);
      camera.position.y += CAM.bridgeHeight;

      const totalYaw   = player.heading + CAM.yaw;
      const totalPitch = CAM.pitch + player.group.rotation.x * 0.3 + shakeY;

      camera.rotation.order = 'YXZ';
      camera.rotation.y     = -totalYaw + shakeX;
      camera.rotation.x     = totalPitch;
      camera.rotation.z     = -player.group.rotation.z * 0.5;

      player.gunAngle     = totalYaw;
      player.gunElevation = Math.max(0, -totalPitch * 1.5);

      camera.fov = viewMode === 'gunSight' ? 16 : 70;
      camera.updateProjectionMatrix();

      // Hide labels in bridge mode
      labelContainer.style.display = 'none';

    } else {
      // ── Tactical overhead ──────────────────────────────
      labelContainer.style.display = 'block';

      // Find spread of all ships to auto-zoom
      const allShips = [player, ...enemies, ...allies].filter(s => s.isAlive);
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const s of allShips) {
        minX = Math.min(minX, s.position.x); maxX = Math.max(maxX, s.position.x);
        minZ = Math.min(minZ, s.position.z); maxZ = Math.max(maxZ, s.position.z);
      }
      const spreadX   = maxX - minX;
      const spreadZ   = maxZ - minZ;
      const midX      = (minX + maxX) / 2;
      const midZ      = (minZ + maxZ) / 2;
      const camHeight = Math.max(100, Math.max(spreadX, spreadZ) * 0.85 + 40);

      camera.position.set(midX, camHeight, midZ + camHeight * 0.35);
      camera.lookAt(midX, 0, midZ);
      camera.fov = 60;
      camera.updateProjectionMatrix();

      // Draw labels
      _updateLabels(allShips);
    }
  }

  // ── Ship labels (tactical view) ───────────────────────────

  function _updateLabels(ships) {
    labelContainer.innerHTML = '';

    for (const ship of ships) {
      const screenPos = _worldToScreen(ship.position);
      if (!screenPos) continue;

      const isEnemy  = enemies.includes(ship);
      const isAlly   = allies.includes(ship);
      const isP      = ship === player;
      const color    = isP ? '#4488cc' : isAlly ? '#3ddc84' : '#e5473d';
      const hpPct    = Math.round(ship.getHpPercent() * 100);

      const el = document.createElement('div');
      el.style.cssText = `
        position:absolute;
        left:${screenPos.x}px; top:${screenPos.y - 22}px;
        transform:translateX(-50%);
        color:${color};
        text-shadow:0 1px 3px #000;
        white-space:nowrap;
        pointer-events:none;
      `;
      el.textContent = `${ship.name} ${hpPct}%`;
      labelContainer.appendChild(el);

      // Small dot at ship position
      const dot = document.createElement('div');
      dot.style.cssText = `
        position:absolute;
        left:${screenPos.x - 3}px; top:${screenPos.y - 3}px;
        width:6px; height:6px; border-radius:50%;
        background:${color};
        border:1px solid rgba(0,0,0,0.5);
      `;
      labelContainer.appendChild(dot);
    }
  }

  function _worldToScreen(worldPos) {
    const vec = worldPos.clone();
    vec.project(camera);
    if (vec.z > 1) return null; // behind camera
    return {
      x: (vec.x *  0.5 + 0.5) * window.innerWidth,
      y: (vec.y * -0.5 + 0.5) * window.innerHeight,
    };
  }

  // ── Input update ─────────────────────────────────────────

  function _updateInput(dt) {
    if (!player.isAlive) return;

    const accel = player.maxSpeed * 0.6 * dt;
    if (keys['KeyW'] || keys['ArrowUp']) {
      player.targetSpeed = Math.min(player.maxSpeed, player.targetSpeed + accel);
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
      player.targetSpeed = Math.max(-player.maxSpeed * 0.25, player.targetSpeed - accel);
    }

    const rudder = player.turnRate * 60 * dt;
    if (keys['KeyA'] || keys['ArrowLeft'])  player.heading -= rudder;
    if (keys['KeyD'] || keys['ArrowRight']) player.heading += rudder;

    player.heading = ((player.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  }

  // ── AI update ─────────────────────────────────────────────

  function _updateAI(dt) {
    // Enemies target player (and optionally nearby allies)
    for (let i = 0; i < enemies.length; i++) {
      const e  = enemies[i];
      const ai = enemyAIs[i];
      if (!e.isAlive) continue;
      e.update(dt);
      // Enemies pick the nearest of: player + allies
      const friendlies = [player, ...allies].filter(s => s.isAlive);
      ai.update(dt, friendlies, effects);
    }

    // Allies target enemies
    for (let i = 0; i < allies.length; i++) {
      const a  = allies[i];
      const ai = allyAIs[i];
      if (!a.isAlive) continue;
      a.update(dt);
      const liveEnemies = enemies.filter(e => e.isAlive);
      ai.update(dt, liveEnemies, effects);

      // Announce ally kills
      if (!a.isAlive) {
        hud.addKillEntry(`✦ ${a.name} SUNK`);
        effects.sinkShip(a.group);
      }
    }
  }

  // ── Briefing ─────────────────────────────────────────────

  function _showBriefing(lines) {
    const div = document.createElement('div');
    div.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      z-index:80; background:rgba(8,14,22,0.94);
      border:1px solid rgba(200,168,75,0.4);
      padding:28px 36px; max-width:480px;
      font-family:'Courier New',monospace;
      color:rgba(200,185,150,0.9); line-height:2;
      font-size:0.78rem; letter-spacing:0.06em;
    `;
    div.innerHTML = `
      <div style="color:rgba(200,168,75,0.9);font-size:0.65rem;
                  letter-spacing:0.24em;margin-bottom:14px;text-transform:uppercase">
        FLEET SIGNAL
      </div>
      ${lines.map(l => `<div>— ${l}</div>`).join('')}
      <div style="margin-top:20px;text-align:right">
        <button id="briefing-ok" style="
          background:none;border:1px solid rgba(200,168,75,0.5);
          color:rgba(200,168,75,0.8);font-family:'Courier New',monospace;
          font-size:0.7rem;letter-spacing:0.18em;padding:8px 20px;cursor:pointer">
          ACKNOWLEDGED
        </button>
      </div>`;
    document.body.appendChild(div);
    document.getElementById('briefing-ok').addEventListener('click', () => div.remove());
  }

  // ── End condition ─────────────────────────────────────────

  function _checkEndConditions() {
    const allEnemiesDead = enemies.every(e => !e.isAlive);
    const playerDead     = !player.isAlive;
    if (!allEnemiesDead && !playerDead) return;

    gameOver = true;
    labelContainer.style.display = 'none';

    const accuracy = player.shotsFired > 0
      ? Math.round((player.shotsHit / player.shotsFired) * 100)
      : 0;
    const alliesLost = allies.filter(a => !a.isAlive).length;

    document.getElementById('end-stats').innerHTML = `
      Shots fired: ${player.shotsFired}<br>
      Hits: ${player.shotsHit} (${accuracy}% accuracy)<br>
      Damage dealt: ${player.damageDealt.toLocaleString()}<br>
      Torpedoes: ${player.torpsFired}<br>
      Allied ships lost: ${alliesLost} / ${allies.length}<br>
      Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s
    `;

    if (allEnemiesDead) {
      document.getElementById('end-result').textContent = 'VICTORY';
      document.getElementById('end-result').className   = 'end-result victory';
      document.getElementById('end-detail').innerHTML   =
        `All enemy ships sunk.<br><em>${scenarioCfg.name}</em> — ${scenarioCfg.subtitle}`;
    } else {
      document.getElementById('end-result').textContent = 'SHIP LOST';
      document.getElementById('end-result').className   = 'end-result defeat';
      document.getElementById('end-detail').innerHTML   =
        `Your vessel was sunk.<br><em>${scenarioCfg.name}</em> — ${scenarioCfg.subtitle}`;
      effects.sinkShip(player.group);
    }
    document.getElementById('end-screen').style.display = 'flex';
  }

  // ── Main loop ─────────────────────────────────────────────

  function _gameLoop() {
    requestAnimationFrame(_gameLoop);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    if (gameOver) {
      effects.update(dt);
      renderer.render(scene, camera);
      return;
    }

    _updateInput(dt);
    player.update(dt);
    _updateAI(dt);
    ocean.update(dt);
    effects.update(dt);

    const target       = getTarget();
    const enemiesAlive = enemies.filter(e => e.isAlive).length;
    hud.update(dt, player, target, enemiesAlive, scenarioCfg, elapsed);

    _updateCamera(dt);
    _checkEndConditions();
    renderer.render(scene, camera);
  }

  return { init };

})();

document.addEventListener('DOMContentLoaded', () => Game.init());
