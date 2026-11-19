import { STRINGS, SPEEDS, PLANETS, SUN } from './data.js';
import { MAPS } from './textures.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function load(key, def) { try { const v = localStorage.getItem('solaris.' + key); return v === null ? def : JSON.parse(v); } catch { return def; } }
function save(key, v) { try { localStorage.setItem('solaris.' + key, JSON.stringify(v)); } catch { /* storage unavailable */ } }

export class UI {
  constructor(app) {
    this.app = app;
    this.lang = load('lang', 'th');
    this.labelsOn = load('labels', true);
    this.panelOn = load('panel', true);
    this.labels = new Map();
    this.current = null;
    this.sheetOpen = false;
    this.res = {};
    this.venusRadar = false;
    this.venusFalse = false;
    this.bind();
    this.applyLang();
  }

  get t() { return STRINGS[this.lang]; }
  name(o) { return o.name[this.lang]; }

  // ---------------------------------------------------------------- setup
  bind() {
    const a = this.app;
    $('#btnLabels').addEventListener('click', () => { this.labelsOn = !this.labelsOn; save('labels', this.labelsOn); this.syncToggles(); });
    $('#btnInfo').addEventListener('click', () => this.setPanel(!this.panelOn));
    $('#btnLang').addEventListener('click', () => { this.lang = this.lang === 'th' ? 'en' : 'th'; save('lang', this.lang); this.applyLang(); });
    $('#btnHelp').addEventListener('click', () => this.toggleHelp(true));
    $('#helpClose').addEventListener('click', () => this.toggleHelp(false));
    $('#help').addEventListener('click', (e) => { if (e.target.id === 'help') this.toggleHelp(false); });
    $('#btnFull').addEventListener('click', () => {
      const d = document;
      try {
        if (d.fullscreenElement) d.exitFullscreen();
        else (d.documentElement.requestFullscreen?.() || Promise.reject()).catch(() => this.toast('—'));
      } catch { /* not supported */ }
    });
    $('#btnPlay').addEventListener('click', () => a.togglePause());
    $('#btnSlower').addEventListener('click', () => a.setSpeed(a.speedIdx - 1));
    $('#btnFaster').addEventListener('click', () => a.setSpeed(a.speedIdx + 1));
    $('#btnToday').addEventListener('click', () => a.resetDate());
    $('#panelClose').addEventListener('click', () => this.setPanel(false));
    $('#panelGrip').addEventListener('click', () => { this.sheetOpen = !this.sheetOpen; $('#panel').classList.toggle('open', this.sheetOpen); a.layoutChanged(); });
    $('#reopen').addEventListener('click', () => this.setPanel(true));
    this.buildDock();
    this.syncToggles();
  }

  buildDock() {
    const dock = $('#dock');
    const items = [{ id: 'overview' }, { id: 'sun', data: SUN }, ...PLANETS.map((p) => ({ id: p.id, data: p }))];
    dock.innerHTML = '';
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'chip' + (it.id === 'overview' ? ' chip-over' : '');
      b.dataset.id = it.id;
      if (it.data) {
        const [c1, c2] = it.data.dot;
        b.innerHTML = `<span class="sw" style="--c1:${c1};--c2:${c2}"${it.id === 'saturn' ? ' data-ring' : ''}></span><span class="nm"></span>`;
        b.title = '';
      } else {
        b.innerHTML = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.4"/><ellipse cx="12" cy="12" rx="9.5" ry="4.2"/><ellipse cx="12" cy="12" rx="5.6" ry="2.4"/></svg><span class="nm"></span>`;
      }
      b.addEventListener('click', () => (it.id === 'overview' ? this.app.goOverview() : this.app.selectById(it.id)));
      dock.appendChild(b);
    });
  }

  applyLang() {
    const t = this.t;
    document.documentElement.lang = this.lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t[el.dataset.i18n]; });
    document.querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t[el.dataset.i18nLabel]); el.title = t[el.dataset.i18nLabel]; });
    $('#btnLang .lbl').textContent = t.lang;
    document.querySelectorAll('#dock .chip').forEach((b) => {
      const id = b.dataset.id;
      const nm = id === 'overview' ? t.overview : this.name(id === 'sun' ? SUN : PLANETS.find((p) => p.id === id));
      b.querySelector('.nm').textContent = nm;
      b.setAttribute('aria-label', nm);
    });
    const h = $('#helpBody');
    h.innerHTML = `
      <section><h3>${esc(t.desktop)}</h3><dl>${t.hDesk.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
      <section><h3>${esc(t.mobile)}</h3><dl>${t.hMob.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`;
    for (const [id, el] of this.labels) el.querySelector('span').textContent = this.name(el._body.data);
    this.updateSpeed();
    if (this.current) this.renderPanel(this.current);
    this.syncToggles();
  }

  syncToggles() {
    $('#btnLabels').setAttribute('aria-pressed', String(this.labelsOn));
    $('#btnInfo').setAttribute('aria-pressed', String(this.panelOn));
    const hasTarget = !!this.current;
    $('#panel').hidden = !(hasTarget && this.panelOn);
    $('#reopen').hidden = !(hasTarget && !this.panelOn);
    $('#reopen .lbl').textContent = this.current ? this.name(this.current.data) : '';
  }

  setPanel(on) { this.panelOn = on; save('panel', on); this.syncToggles(); this.app.layoutChanged(); }

  toggleHelp(on) {
    $('#help').hidden = !on;
    if (on) $('#helpClose').focus();
  }

  // ---------------------------------------------------------------- loader
  progress(frac, msg) {
    $('#loadBar').style.transform = `scaleX(${Math.max(0.02, frac)})`;
    if (msg) $('#loadMsg').textContent = msg;
  }
  hideLoader() {
    const l = $('#loader');
    l.classList.add('done');
    setTimeout(() => { l.hidden = true; }, 1400);
  }
  fail(msg) { $('#loadMsg').textContent = msg; $('#loader').classList.add('error'); }

  toast(msg, ms = 3800) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('on');
    clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('on'), ms);
  }

  // ---------------------------------------------------------------- time
  updateSpeed() {
    const a = this.app; if (a.speedIdx === undefined) return;
    const s = SPEEDS[a.speedIdx];
    $('#speedLbl').textContent = a.paused ? this.t.paused : s[this.lang];
    const play = $('#btnPlay');
    play.classList.toggle('paused', a.paused);
    play.setAttribute('aria-label', a.paused ? this.t.play : this.t.pause);
    play.title = play.getAttribute('aria-label');
    $('#btnSlower').disabled = a.speedIdx <= 0;
    $('#btnFaster').disabled = a.speedIdx >= SPEEDS.length - 1;
  }
  updateDate(ms) {
    const key = Math.floor(ms / 86400000) + this.lang;
    if (key === this._dk) return; this._dk = key;
    const d = new Date(ms);
    let s;
    try { s = d.toLocaleDateString(this.lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { s = d.toISOString().slice(0, 10); }
    $('#date').textContent = s;
  }

  // ---------------------------------------------------------------- dock / panel
  setCurrent(body) {
    this.current = body;
    document.querySelectorAll('#dock .chip').forEach((b) => {
      const active = body ? (b.dataset.id === body.id || (body.kind === 'moon' && b.dataset.id === body.parent.id)) : b.dataset.id === 'overview';
      b.classList.toggle('on', active);
      if (active) b.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
    if (body) this.renderPanel(body);
    this.sheetOpen = false; $('#panel').classList.remove('open');
    this.syncToggles();
  }

  fmtNum(n, d = 0) { return Number(n).toLocaleString(this.lang === 'th' ? 'th-TH' : 'en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); }
  fmtDuration(hours) {
    const t = this.t;
    if (hours >= 72) { const days = hours / 24; return days >= 1000 ? `${this.fmtNum(days / 365.25, 2)} ${t.years}` : `${this.fmtNum(days, days < 100 ? 1 : 0)} ${t.days}`; }
    const h = Math.floor(hours), m = Math.round((hours - h) * 60);
    return `${h} ${t.h} ${m} ${t.m}`;
  }
  fmtOrbit(days) {
    const t = this.t;
    return days > 800 ? `${this.fmtNum(days / 365.25, 2)} ${t.years}` : `${this.fmtNum(days, days < 100 ? 1 : 0)} ${t.days}`;
  }

  renderPanel(body) {
    const t = this.t, d = body.data;
    let rows = [], facts = [], moons = '', eyebrow, sub;
    const other = this.lang === 'th' ? 'en' : 'th';
    if (body.kind === 'sun') {
      const s = d.stats;
      eyebrow = d.type[this.lang];
      rows = [
        [t.diameter, `${this.fmtNum(s.diameter)} ${t.km}`],
        [t.surfaceTemp, `${this.fmtNum(s.surfaceC)} °C`],
        [t.coreTemp, `${s.coreMC} ${t.mc}`],
        [t.sunRotation, `${s.rotEq}–${s.rotPole} ${t.days}`],
        [t.age, `${this.fmtNum(s.ageGyr, 1)} ${t.gyr}`],
        [t.galactic, `~${s.galacticMyr} ${t.myr}`],
        [t.planets, `${s.planets}`],
      ];
      facts = d.facts[this.lang];
      moons = this.moonChips(this.app.world.planets.map((p) => p), t.planets);
    } else if (body.kind === 'planet') {
      const s = d.stats;
      eyebrow = d.type[this.lang];
      rows = [
        [t.diameter, `${this.fmtNum(s.diameter)} ${t.km}`],
        [t.distance, `${this.fmtNum(s.distMkm, 1)} ${t.mkm}<small>${this.fmtNum(s.distAU, s.distAU < 2 ? 3 : 2)} AU</small>`],
        [t.orbit, this.fmtOrbit(s.orbitDays)],
        [t.rotation, `${this.fmtDuration(s.rotHours)}${s.retro ? `<small>${t.retro}</small>` : ''}`],
        [t.temp, `${this.fmtNum(s.tempC)} °C${s.tempRange ? `<small>${t.range} ${s.tempRange[0]} … ${s.tempRange[1]} °C</small>` : ''}`],
        [t.moons, `${this.fmtNum(s.moons)}`],
        [t.tilt, `${this.fmtNum(s.tilt, s.tilt < 1 ? 2 : 1)}°`],
        [t.gravity, `${this.fmtNum(s.gravity, 1)} ${t.ms2}`],
      ];
      facts = d.facts[this.lang];
      if (body.moons.length) moons = this.moonChips(body.moons, t.majorMoons);
    } else {
      const p = body.parent.data;
      eyebrow = `${t.moonOf}${this.lang === 'th' ? '' : ' '}${this.name(p)}`;
      rows = [
        [t.diameter, `${this.fmtNum(d.km, d.km < 100 ? 1 : 0)} ${t.km}`],
        [t.orbit, `${this.fmtNum(Math.abs(d.periodDays), 2)} ${t.days}${d.incl > 90 ? `<small>${t.retro}</small>` : ''}`],
        [t.orbits, this.name(p)],
      ];
      facts = [d.fact[this.lang]];
      const sib = body.parent.moons;
      moons = this.moonChips(sib, t.majorMoons, body.parent);
    }
    sub = d.name[other];
    $('#panelBody').innerHTML = `
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h2 class="pname">${esc(this.name(d))}</h2>
      <p class="psub">${esc(sub)}</p>
      ${this.texIdOf(body) ? '<p class="reschip" id="resChip"></p>' : ''}
      ${body.id === 'venus' ? this.venusControls() : ''}
      <dl class="stats">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${moons}
      <h3 class="sect">${esc(t.facts)}</h3>
      <ul class="facts">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <p class="note">${esc(t.scaleNote)}</p>
      <p class="note credit">${esc(t.credits)}</p>`;
    $('#panelBody').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => this.app.selectById(b.dataset.go)));
    const vr = document.getElementById('venusRadar');
    if (vr) {
      vr.addEventListener('click', () => { this.venusRadar = !this.venusRadar; if (!this.venusRadar) this.venusFalse = false; this.app.setVenusMode(this.venusRadar, this.venusFalse); this.renderPanel(this.current); });
      document.getElementById('venusFalse').addEventListener('click', () => { this.venusFalse = !this.venusFalse; this.app.setVenusMode(this.venusRadar, this.venusFalse); this.renderPanel(this.current); });
    }
    this.paintRes();
    $('#panelBody').scrollTop = 0;
    $('#sheetName').textContent = this.name(d);
  }

  moonChips(list, title, parent) {
    const cur = this.current;
    const items = list.map((m) => `<button class="mchip${cur && cur.id === m.id ? ' on' : ''}" data-go="${m.id}">${esc(this.name(m.data))}</button>`);
    if (parent) items.unshift(`<button class="mchip back" data-go="${parent.id}">← ${esc(this.t.backTo)} ${esc(this.name(parent.data))}</button>`);
    return `<h3 class="sect">${esc(title)}</h3><div class="mchips">${items.join('')}</div>`;
  }

  texIdOf(body) { return !body ? null : body.id === 'moon' ? 'moon' : body.kind === 'moon' ? null : (MAPS[body.id] ? body.id : null); }

  setRes(id, level, state) {
    this.res[id] = { level, state };
    if (this.texIdOf(this.current) === id) this.paintRes();
  }
  paintRes() {
    const el = document.getElementById('resChip');
    if (!el) return;
    const id = this.texIdOf(this.current);
    const r = this.res[id] || { level: '2k', state: 'ready' };
    el.classList.toggle('busy', r.state === 'loading');
    el.innerHTML = `<i></i>${esc(this.t.surface)} <b>${r.level.toUpperCase()}</b>${r.state === 'loading' ? ` <span>${esc(this.t.loadingRes)}…</span>` : ''}`;
  }

  venusControls() {
    const t = this.t;
    return `<div class="modes">
      <button class="mode${this.venusRadar ? ' on' : ''}" id="venusRadar" aria-pressed="${this.venusRadar}"><b>${esc(t.radar)}</b><small>${esc(t.radarSub)}</small></button>
      <button class="mode slim${this.venusFalse ? ' on' : ''}" id="venusFalse" aria-pressed="${this.venusFalse}"${this.venusRadar ? '' : ' disabled'}>${esc(t.falseColor)}</button>
    </div>`;
  }

  // ---------------------------------------------------------------- labels
  ensureLabels(bodies) {
    const root = $('#labels');
    for (const b of bodies) {
      if (this.labels.has(b.id)) continue;
      const el = document.createElement('button');
      el.className = 'lbl ' + b.kind;
      el.innerHTML = '<i></i><span></span>';
      el.querySelector('span').textContent = this.name(b.data);
      el._body = b;
      el.tabIndex = -1;
      el.addEventListener('click', () => this.app.select(b));
      el.addEventListener('pointerenter', () => { this.app.hover = b; });
      el.addEventListener('pointerleave', () => { if (this.app.hover === b) this.app.hover = null; });
      root.appendChild(el);
      this.labels.set(b.id, el);
    }
  }

  // items: [{ body, x, y, r, visible, z }]
  placeLabels(items, focus, hover) {
    for (const it of items) {
      const el = this.labels.get(it.body.id);
      if (!el) continue;
      const b = it.body;
      let show = it.visible;
      if (b.kind === 'moon') show = show && !!focus && (focus === b.parent || (focus.kind === 'moon' && focus.parent === b.parent)) && focus !== b;
      if (focus === b) show = false;
      if (!this.labelsOn && hover !== b) show = false;
      if (show) {
        el.style.transform = `translate3d(${it.x.toFixed(1)}px, ${(it.y + it.r + 6).toFixed(1)}px, 0) translateX(-50%)`;
        el.classList.toggle('hot', hover === b);
        el.classList.toggle('dim', !!focus && b.kind === 'planet' && focus !== b);
      }
      if (el._shown !== show) { el._shown = show; el.classList.toggle('on', show); }
    }
  }

  placeReticle(it) {
    const el = $('#reticle');
    if (!it || !it.visible) { el.classList.remove('on'); return; }
    const s = Math.max(22, it.r * 1.18 + 14);
    el.style.transform = `translate3d(${(it.x - s).toFixed(1)}px, ${(it.y - s).toFixed(1)}px, 0)`;
    el.style.width = el.style.height = `${(s * 2).toFixed(1)}px`;
    el.classList.add('on');
  }

  panelInset() {
    const p = $('#panel');
    if (p.hidden) return { right: 0, bottom: 0 };
    const r = p.getBoundingClientRect();
    if (window.innerWidth >= 860) return { right: window.innerWidth - r.left, bottom: 0 };
    return { right: 0, bottom: window.innerHeight - r.top };
  }
}
