/* ══════════════════════════════════════════════════════════════
   GAME — Main loop, input, camera, state management
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ── Global game instance ──────────────────────────────────────
const Game = (() => {

  // ── State ─────────────────────────────────────────────────
  let renderer, scene, camera, clock;
  let ocean, effects, hud;
  let player, enemies, aiControllers;
  let scenario, scenarioCfg, difficulty;
  let viewMode = 'bridge';  // bridge | gunSight | overhead
  let targetIdx = 0;
  let elapsed   = 0;
  let gameOver  = false;
  let gameStarted = false;

  // Player input state
  const keys   = {};
  let   mouseDX = 0, mouseDY = 0;
  let   mouseDown = { left: false, right: false };
  let   isPointerLocked = false;

  // Camera state
  const CAM = {
    yaw:       0,         // horizontal look
    pitch:     0,         // vertical look
    pitchMin: -0.4,
    pitchMax:  0.5,
    bridgeHeight: 0,      // set per ship type
    // Overhead
    overheadY:  120,
    overheadTgt: new THREE.Vector3(),
  };

  // ── Init ──────────────────────────────────────────────────

  function init() {
    _setupRenderer();
    _setupMenu();
  }

  function _setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = false;
    renderer.outputEncoding    = THREE.sRGBEncoding;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.id     = 'game-canvas';
    document.body.prepend(renderer.domElement);

    window.addEventListener('resize', () => {
      camera && camera.aspect && (camera.aspect = window.innerWidth / window.innerHeight);
      camera && camera.updateProjectionMatrix && camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function _setupMenu() {
    // Ship card selection
    document.querySelectorAll('.ship-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.ship-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    // Scenario selection
    document.querySelectorAll('.scenario-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.scenario-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
      });
    });

    // Difficulty buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Start battle
    document.getElementById('start-battle-btn').addEventListener('click', () => {
      const shipType   = document.querySelector('.ship-card.selected').dataset.ship;
      const scenKey    = document.querySelector('.scenario-item.selected').dataset.scenario;
      const diffKey    = document.querySelector('.diff-btn.selected').dataset.diff;
      startBattle(shipType, scenKey, diffKey);
    });

    // End screen buttons
    document.getElementById('play-again-btn').addEventListener('click', () => {
      location.reload();
    });
    document.getElementById('main-menu-btn').addEventListener('click', () => {
      location.reload();
    });
  }

  // ── Battle start ─────────────────────────────────────────

  async function startBattle(shipType, scenKey, diffKey) {
    document.getElementById('main-menu').style.display    = 'none';
    document.getElementById('loading-screen').style.display = 'flex';

    scenario    = scenKey;
    scenarioCfg = SCENARIOS[scenKey];
    difficulty  = diffKey;

    await _loadProgress(0.1,  'Initialising world...');
    _setupScene();
    await _loadProgress(0.3,  'Building ocean...');
    ocean    = new Ocean(scene, scenarioCfg);
    await _loadProgress(0.5,  'Deploying ships...');
    _spawnShips(shipType, scenKey, diffKey);
    await _loadProgress(0.7,  'Calibrating fire control...');
    hud      = new HUD();
    effects  = new EffectsManager(scene);
    _patchPlayerDamage();
    await _loadProgress(0.9,  'Battle stations!');
    _setupInput();
    clock    = new THREE.Clock();
    gameOver = false;
    elapsed  = 0;
    await _loadProgress(1.0,  'ENGAGE!');

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

  function _loadProgress(frac, text) {
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
    const pool     = AI_SHIP_POOL[scenKey];

    // Determine player ship name from scenario (Allied side)
    const playerNames = {
      jutland:        { battleship:'HMS Iron Duke', cruiser:'HMS Invincible', destroyer:'HMS Nestor' },
      surigao:        { battleship:'USS West Virginia', cruiser:'USS Denver', destroyer:'USS Melvin' },
      north_cape:     { battleship:'HMS Duke of York', cruiser:'HMS Jamaica', destroyer:'HMS Savage' },
      cape_esperance: { battleship:'USS Washington', cruiser:'USS San Francisco', destroyer:'USS Buchanan' },
    };

    const pName = (playerNames[scenKey] && playerNames[scenKey][shipType]) || 'Your Ship';

    player = new Ship(shipType, pName, 'UK', true);
    player.position.set(scenConf.playerStart.x, 0, scenConf.playerStart.z);
    player.heading = scenConf.playerStart.heading;
    player.targetSpeed = player.maxSpeed * 0.6;
    scene.add(player.group);

    // Bridge height for camera
    CAM.bridgeHeight = SHIP_DEFS[shipType].beam * 1.4;

    enemies        = [];
    aiControllers  = [];

    for (let i = 0; i < pool.length; i++) {
      const entry   = pool[i];
      const pos     = scenConf.enemyFormation[i] || { x: (i - 2) * 100, z: 300, heading: Math.PI };
      const e       = new Ship(entry.type, entry.name, entry.nation, false);
      e.hp          = Math.round(e.maxHp * entry.hpMod);
      e.position.set(pos.x, 0, pos.z);
      e.heading     = pos.heading;
      e.targetSpeed = e.maxSpeed * 0.7;
      scene.add(e.group);
      enemies.push(e);

      const ai = new AIController(e, diffKey);
      ai.setTarget(player);
      aiControllers.push(ai);
    }

    // Init gun aim
    player.gunAngle = player.heading;
    targetIdx       = 0;
  }

  // ── Input ─────────────────────────────────────────────────

  function _setupInput() {
    // Keyboard
    document.addEventListener('keydown', e => {
      keys[e.code] = true;
      _handleKeyDown(e);
    });
    document.addEventListener('keyup',   e => { keys[e.code] = false; });

    // Mouse look
    document.addEventListener('mousemove', e => {
      if (isPointerLocked) {
        mouseDX += e.movementX;
        mouseDY += e.movementY;
      }
    });

    // Mouse buttons
    document.addEventListener('mousedown', e => {
      if (e.button === 0) { mouseDown.left  = true; _handleFire(); }
      if (e.button === 2) { mouseDown.right = true; _toggleGunSight(); }
    });

    document.addEventListener('mouseup', e => {
      if (e.button === 0) mouseDown.left  = false;
      if (e.button === 2) mouseDown.right = false;
    });

    // Prevent context menu
    renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

    // Pointer lock
    renderer.domElement.addEventListener('click', () => {
      if (!isPointerLocked) {
        renderer.domElement.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = document.pointerLockElement === renderer.domElement;
    });
  }

  function _handleKeyDown(e) {
    if (!gameStarted || gameOver) return;

    switch (e.code) {
      case 'KeyT':
        // Next target
        _cycleTarget();
        break;

      case 'KeyV':
        // Cycle view
        _cycleView();
        break;

      case 'Digit1':
        player.targetSpeed = player.maxSpeed * 0.25;
        break;
      case 'Digit2':
        player.targetSpeed = player.maxSpeed * 0.5;
        break;
      case 'Digit3':
        player.targetSpeed = player.maxSpeed;
        break;
      case 'KeyX':
        player.targetSpeed = 0;
        break;

      case 'KeyF':
        _fireTorpedo();
        break;

      case 'Escape':
        // Unlock pointer
        document.exitPointerLock();
        break;
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
    const modes  = ['bridge', 'gunSight', 'overhead'];
    const curIdx = modes.indexOf(viewMode);
    viewMode     = modes[(curIdx + 1) % modes.length];
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
      true
    );

    player.startReload();
    player.shotsFired += player.gunDef.barrels;

    // Muzzle flash at nearest forward turret tip
    const tipPos = player.getMuzzleTipWorld(0, 0);
    effects.muzzleFlash(tipPos, player.gunDef.calibre);

    // Camera shake
    _cameraShake(0.3);

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
              ? `HIT on ${target.name} (${result.dmgResult.damage} dmg, PEN)`
              : `HIT on ${target.name} (${result.dmgResult.damage} dmg)`
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
      hud.addKillEntry('TARGET OUT OF RANGE');
    }
  }

  function _fireTorpedo() {
    if (!player.canTorpedo()) return;
    const target = getTarget();
    if (!target) return;

    player.fireTorpedo();
    const dist    = player.distanceTo(target);
    const hitProb = 0.4 - dist / player.torpDef.range * 0.3;

    hud.addKillEntry('TORPEDOES AWAY');

    if (Math.random() < Math.max(0.05, hitProb)) {
      const ttof = dist / player.torpDef.speed;
      setTimeout(() => {
        if (!target.isAlive) return;
        const dmg = Ballistics.torpedoDamage(player.torpDef);
        target.applyDamage(dmg, effects);
        player.damageDealt += dmg.damage;
        effects.explosion({ x: target.position.x, z: target.position.z }, 2.5);
        hud.addKillEntry(`TORPEDO HIT on ${target.name} (${dmg.damage} dmg)`);
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
    _shakeAmt  = intensity;
    _shakeTimer = 0.35;
  }

  // Called when player ship takes a hit
  function _onPlayerHit(dmgResult) {
    _cameraShake(0.6);
    hud.triggerHitFlash(dmgResult.damage, dmgResult.penetrated);
  }

  // ── Camera ───────────────────────────────────────────────

  function _updateCamera(dt) {
    // Mouse look
    const sensitivity = 0.002;
    CAM.yaw   -= mouseDX * sensitivity;
    CAM.pitch -= mouseDY * sensitivity;
    CAM.pitch  = Math.max(CAM.pitchMin, Math.min(CAM.pitchMax, CAM.pitch));
    mouseDX    = 0;
    mouseDY    = 0;

    // Shake
    let shakeX = 0, shakeY = 0;
    if (_shakeTimer > 0) {
      _shakeTimer -= dt;
      shakeX = (Math.random() - 0.5) * _shakeAmt * (_shakeTimer / 0.35);
      shakeY = (Math.random() - 0.5) * _shakeAmt * (_shakeTimer / 0.35);
    }

    if (viewMode === 'bridge' || viewMode === 'gunSight') {
      // ── First-person bridge view ──────────────────────────
      const hullRoll  = player.group.rotation.z;
      const hullPitch = player.group.rotation.x;

      // Camera sits on the bridge
      camera.position.copy(player.position);
      camera.position.y += CAM.bridgeHeight;

      // Apply ship motion offsets (gentle sway)
      const sway = Math.sin(Date.now() / 2000) * 0.04;
      camera.position.x += Math.cos(player.heading) * sway;
      camera.position.z += Math.sin(player.heading) * sway;

      // Look direction: ship heading + camera yaw
      const totalYaw   = player.heading + CAM.yaw;
      const totalPitch = CAM.pitch + hullPitch * 0.3 + shakeY;

      camera.rotation.order = 'YXZ';
      camera.rotation.y     = -totalYaw + shakeX;
      camera.rotation.x     = totalPitch;
      camera.rotation.z     = -hullRoll * 0.5;

      // Gun aiming follows camera look direction
      player.gunAngle     = totalYaw;
      player.gunElevation = Math.max(0, -totalPitch * 1.5);

      // Narrow FOV in gun sight
      camera.fov = viewMode === 'gunSight' ? 18 : 70;
      camera.updateProjectionMatrix();

    } else {
      // ── Overhead tactical view ─────────────────────────────
      const target = getTarget();
      const midX   = target
        ? (player.position.x + target.position.x) / 2
        : player.position.x;
      const midZ   = target
        ? (player.position.z + target.position.z) / 2
        : player.position.z;

      CAM.overheadTgt.lerp(new THREE.Vector3(midX, 0, midZ), 0.05);
      camera.position.set(
        CAM.overheadTgt.x,
        CAM.overheadY,
        CAM.overheadTgt.z + 40
      );
      camera.lookAt(CAM.overheadTgt);
      camera.fov = 60;
      camera.updateProjectionMatrix();
    }
  }

  // ── Player input update ───────────────────────────────────

  function _updateInput(dt) {
    if (!player.isAlive) return;

    // Throttle
    if (keys['KeyW'] || keys['ArrowUp']) {
      player.targetSpeed = Math.min(player.maxSpeed, player.targetSpeed + player.maxSpeed * 0.5 * dt);
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
      player.targetSpeed = Math.max(-player.maxSpeed * 0.2, player.targetSpeed - player.maxSpeed * 0.5 * dt);
    }

    // Rudder
    const rudderRate = player.turnRate * 60;
    if (keys['KeyA'] || keys['ArrowLeft']) {
      player.heading -= rudderRate * dt;
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
      player.heading += rudderRate * dt;
    }

    player.heading = ((player.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  }

  // ── Briefing overlay ─────────────────────────────────────

  function _showBriefing(lines) {
    const div  = document.createElement('div');
    div.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      z-index:80; background:rgba(8,14,22,0.93); border:1px solid rgba(200,168,75,0.4);
      padding:28px 36px; max-width:480px; font-family:'Courier New',monospace;
      color:rgba(200,185,150,0.9); line-height:2; font-size:0.78rem; letter-spacing:0.06em;
    `;
    div.innerHTML = `
      <div style="color:rgba(200,168,75,0.9);font-size:0.65rem;letter-spacing:0.24em;
                  margin-bottom:14px;text-transform:uppercase">FLEET SIGNAL</div>
      ${lines.map(l => `<div>— ${l}</div>`).join('')}
      <div style="margin-top:20px;text-align:right">
        <button id="briefing-ok" style="
          background:none;border:1px solid rgba(200,168,75,0.5);
          color:rgba(200,168,75,0.8);font-family:'Courier New',monospace;
          font-size:0.7rem;letter-spacing:0.18em;padding:8px 20px;cursor:pointer
        ">ACKNOWLEDGED</button>
      </div>
    `;
    document.body.appendChild(div);
    document.getElementById('briefing-ok').addEventListener('click', () => div.remove());
  }

  // ── End game ─────────────────────────────────────────────

  function _checkEndConditions() {
    const allEnemiesDead = enemies.every(e => !e.isAlive);
    const playerDead     = !player.isAlive;

    if (!allEnemiesDead && !playerDead) return;

    gameOver = true;

    const endScreen = document.getElementById('end-screen');
    const endResult = document.getElementById('end-result');
    const endDetail = document.getElementById('end-detail');
    const endStats  = document.getElementById('end-stats');

    const accuracy  = player.shotsFired > 0
      ? Math.round((player.shotsHit / player.shotsFired) * 100)
      : 0;

    endStats.innerHTML = `
      Shots fired: ${player.shotsFired}<br>
      Hits: ${player.shotsHit} (${accuracy}% accuracy)<br>
      Damage dealt: ${player.damageDealt.toLocaleString()}<br>
      Torpedoes: ${player.torpsFired}<br>
      Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s
    `;

    if (allEnemiesDead) {
      endResult.textContent   = 'VICTORY';
      endResult.className     = 'end-result victory';
      endDetail.innerHTML     = `
        All enemy ships have been sunk.<br>
        <em>${scenarioCfg.name}</em> — ${scenarioCfg.subtitle}
      `;
    } else {
      endResult.textContent   = 'SHIP LOST';
      endResult.className     = 'end-result defeat';
      endDetail.innerHTML     = `
        Your vessel has been sunk.<br>
        <em>${scenarioCfg.name}</em> — ${scenarioCfg.subtitle}
      `;
      effects.sinkShip(player.group);
    }

    endScreen.style.display = 'flex';
  }

  // ── AI update ─────────────────────────────────────────────

  function _updateAI(dt) {
    for (let i = 0; i < enemies.length; i++) {
      const e  = enemies[i];
      const ai = aiControllers[i];
      if (!e.isAlive) continue;

      ai.setTarget(player);
      e.update(dt);
      ai.update(dt, [player], effects);
    }
  }

  // Patch player.applyDamage to also trigger HUD flash
  function _patchPlayerDamage() {
    const origApply = player.applyDamage.bind(player);
    player.applyDamage = (dmgResult, eff) => {
      origApply(dmgResult, eff);
      _onPlayerHit(dmgResult);
    };
  }

  // ── Main game loop ────────────────────────────────────────

  function _gameLoop() {
    requestAnimationFrame(_gameLoop);

    const dt = Math.min(clock.getDelta(), 0.05); // cap at 50ms
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

    const target        = getTarget();
    const enemiesAlive  = enemies.filter(e => e.isAlive).length;

    hud.update(dt, player, target, enemiesAlive, scenarioCfg, elapsed);
    _updateCamera(dt);

    _checkEndConditions();

    renderer.render(scene, camera);
  }

  // ── Public ────────────────────────────────────────────────

  return {
    init,
    startBattle,
    _patchPlayerDamage, // called after spawn
  };

})();

// ── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Game.init();
});
