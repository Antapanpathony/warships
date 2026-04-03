/* ══════════════════════════════════════════════════════════════
   HUD — Heads-up display update and compass rendering
   ══════════════════════════════════════════════════════════════ */

'use strict';

class HUD {
  constructor() {
    this._els = {
      scenarioName:   document.getElementById('hud-scenario-name'),
      time:           document.getElementById('hud-time'),
      enemies:        document.getElementById('hud-enemies-remaining'),
      shipName:       document.getElementById('hud-ship-name'),
      hpBar:          document.getElementById('hp-bar'),
      hpValue:        document.getElementById('hp-value'),
      propBar:        document.getElementById('prop-bar'),
      fcBar:          document.getElementById('fc-bar'),
      damageReports:  document.getElementById('damage-reports'),
      heading:        document.getElementById('hud-heading'),
      speed:          document.getElementById('hud-speed'),
      range:          document.getElementById('hud-range'),
      bearing:        document.getElementById('hud-bearing'),
      gunTarget:      document.getElementById('gun-target'),
      gunElev:        document.getElementById('gun-elevation'),
      gunTraverse:    document.getElementById('gun-traverse'),
      gunReload:      document.getElementById('gun-reload'),
      torpBlock:      document.getElementById('torpedo-block'),
      torpCount:      document.getElementById('torpedo-count'),
      salvoMode:      document.getElementById('salvo-mode'),
      gunSight:       document.getElementById('gun-sight'),
      sightRange:     document.getElementById('sight-range-label'),
      viewMode:       document.getElementById('view-mode-indicator'),
      hitFlash:       document.getElementById('hit-flash'),
      hitIndicator:   document.getElementById('hit-indicator'),
      killFeed:       document.getElementById('kill-feed'),
      torpHelp:       document.getElementById('torpedo-help'),
    };

    this._compassCtx = document.getElementById('compass-canvas').getContext('2d');
    this._elapsed    = 0;
    this._damageList = [];
  }

  // ── Show / hide ───────────────────────────────────────────

  show() { document.getElementById('game-hud').style.display = 'block'; }
  hide() { document.getElementById('game-hud').style.display = 'none'; }

  showGunSight(show) {
    this._els.gunSight.style.display = show ? 'block' : 'none';
  }

  // ── Per-frame update ──────────────────────────────────────

  update(dt, player, target, enemiesAlive, scenario, elapsed) {
    this._elapsed = elapsed;
    this._updateShipStatus(player);
    this._updateNavigation(player);
    this._updateGunnery(player, target);
    this._updateTopBar(scenario, enemiesAlive, elapsed);
    if (target) {
      const abbr = target.def ? target.def.typeAbbr || '' : '';
      this._els.gunTarget.textContent = abbr ? `${target.name} [${abbr}]` : target.name;
    } else {
      this._els.gunTarget.textContent = 'NO TARGET';
    }
  }

  _updateShipStatus(player) {
    const hpPct  = player.getHpPercent();
    const hpPx   = Math.round(hpPct * 100);

    this._els.hpBar.style.width = hpPx + '%';
    this._els.hpValue.textContent = hpPx + '%';

    // Colour based on hp
    if (hpPct > 0.6)      this._els.hpBar.style.background = '#3ddc84';
    else if (hpPct > 0.3) this._els.hpBar.style.background = '#f5c518';
    else                  this._els.hpBar.style.background = '#e5473d';

    this._els.propBar.style.width = Math.round(player.propulsion * 100) + '%';
    this._els.fcBar.style.width   = Math.round(player.fireControl * 100) + '%';

    // Damage report text
    const reports = [];
    if (player.onFire)    reports.push('⚠ FIRE');
    if (player.flooding)  reports.push('⚠ FLOODING');
    if (player.propulsion < 0.7) reports.push('⚠ PROPULSION DAMAGE');
    if (player.fireControl < 0.7) reports.push('⚠ FIRE CONTROL DAMAGE');
    this._els.damageReports.innerHTML = reports.join('<br>');
  }

  _updateNavigation(player) {
    const hdg = player.getHeadingDeg();
    this._els.heading.textContent = hdg.toFixed(0).padStart(3, '0') + '°';

    const kts = player.getSpeedKnots();
    this._els.speed.textContent = kts.toFixed(1) + ' kts';

    this._drawCompass(hdg);
  }

  _updateGunnery(player, target) {
    const elevDeg = (player.gunElevation * 180 / Math.PI).toFixed(1);
    const travDeg = (((player.gunAngle - player.heading) * 180 / Math.PI) % 360 + 360) % 360;
    this._els.gunElev.textContent    = elevDeg + '°';
    this._els.gunTraverse.textContent = travDeg.toFixed(1) + '°';

    // Reload
    const reload = player.getReloadPercent();
    if (reload <= 0) {
      this._els.gunReload.textContent  = 'READY';
      this._els.gunReload.className    = 'gun-value reload-ready';
    } else {
      const rem = (player.gunDef.reloadTime * reload).toFixed(0);
      this._els.gunReload.textContent  = rem + 's';
      this._els.gunReload.className    = 'gun-value reloading';
    }

    // Torpedoes
    if (player.torpDef) {
      this._els.torpBlock.style.display = 'block';
      this._els.torpCount.textContent   = player.torpCount + ' / ' + player.def.torpedoes.tubes;
      this._els.torpHelp.style.display  = 'block';
    }

    // Range to target
    if (target) {
      const dist    = player.distanceTo(target);
      const distKm  = (dist * WORLD_SCALE / 1000).toFixed(1);
      const distYd  = Math.round(dist * WORLD_SCALE * 1.094);
      this._els.range.textContent = distKm + ' km';

      const brg = ((player.bearingTo(target) * 180 / Math.PI) % 360 + 360) % 360;
      this._els.bearing.textContent = brg.toFixed(0).padStart(3, '0') + '°';

      // Gun sight range label
      this._els.sightRange.textContent = distKm + ' km · ' + distYd.toLocaleString() + ' yd';
    } else {
      this._els.range.textContent   = '—';
      this._els.bearing.textContent = '—';
      this._els.sightRange.textContent = '—';
    }
  }

  _updateTopBar(scenario, enemiesAlive, elapsed) {
    if (scenario) {
      this._els.scenarioName.textContent = scenario.name;
    }
    const m   = Math.floor(elapsed / 60);
    const s   = Math.floor(elapsed % 60);
    this._els.time.textContent = m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
    this._els.enemies.textContent = enemiesAlive + ' ENEMY';
  }

  // ── Compass ───────────────────────────────────────────────

  _drawCompass(headingDeg) {
    const ctx  = this._compassCtx;
    const cx   = 40, cy = 40, r = 34;
    ctx.clearRect(0, 0, 80, 80);

    // Background
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,14,22,0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,168,75,0.4)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Cardinal labels
    const hdgRad = headingDeg * Math.PI / 180;
    const labels = [
      { label: 'N', angle: 0 },
      { label: 'E', angle: Math.PI / 2 },
      { label: 'S', angle: Math.PI },
      { label: 'W', angle: -Math.PI / 2 },
    ];
    ctx.font      = '8px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const l of labels) {
      const a  = l.angle - hdgRad;
      const lx = cx + Math.sin(a) * 26;
      const ly = cy - Math.cos(a) * 26;
      ctx.fillStyle = l.label === 'N' ? 'rgba(229,71,61,0.9)' : 'rgba(200,168,75,0.65)';
      ctx.fillText(l.label, lx, ly);
    }

    // Tick marks every 30°
    for (let i = 0; i < 12; i++) {
      const a  = (i * 30) * Math.PI / 180 - hdgRad;
      const r1 = i % 3 === 0 ? 28 : 31;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1);
      ctx.lineTo(cx + Math.sin(a) * 34, cy - Math.cos(a) * 34);
      ctx.strokeStyle = 'rgba(200,168,75,0.4)';
      ctx.lineWidth   = i % 3 === 0 ? 1.5 : 0.8;
      ctx.stroke();
    }

    // Ship heading arrow (always points up = current heading)
    ctx.beginPath();
    ctx.moveTo(cx, cy - 24);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.lineTo(cx,     cy);
    ctx.lineTo(cx + 4, cy + 4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(200,168,75,0.9)';
    ctx.fill();
  }

  // ── View mode ─────────────────────────────────────────────

  setViewMode(mode) {
    const labels = {
      chase:    'CHASE VIEW',
      bridge:   'BRIDGE (MAST)',
      gunSight: 'GUN SIGHT  ×7',
      overhead: 'TACTICAL',
    };
    this._els.viewMode.textContent = labels[mode] || mode.toUpperCase();
  }

  // ── Hit flash ─────────────────────────────────────────────

  triggerHitFlash(damage, penetrated) {
    const flash = this._els.hitFlash;
    const ind   = this._els.hitIndicator;

    flash.classList.add('active');
    ind.textContent  = penetrated ? 'PENETRATING HIT!' : 'IMPACT!';
    ind.classList.add('active');

    setTimeout(() => {
      flash.classList.remove('active');
      ind.classList.remove('active');
    }, 400);
  }

  // ── Kill feed ─────────────────────────────────────────────

  addKillEntry(text) {
    const el = document.createElement('div');
    el.className   = 'kill-entry';
    el.textContent = text;
    this._els.killFeed.prepend(el);
    setTimeout(() => el.remove(), 5500);
  }

  // ── Ship name display ─────────────────────────────────────

  setShipName(name) {
    this._els.shipName.textContent = name;
  }
}
