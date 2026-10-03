// =============================================
//  ハネタンク  画面と試合の進行
// =============================================
(function () {
  'use strict';
  const C = HT.CONFIG, T = HT.TILE, W = C.W, H = C.H;
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ht_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ht_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  if (isTouch) document.body.classList.add('touch');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerpAng = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
  const shuffle = (arr, rnd = Math.random) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  // ---------- 見た目（色ともよう） ----------
  const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#f97316', '#ec4899', '#06b6d4', '#64748b', '#84cc16'];
  const PATTERNS = ['none', 'stripe', 'dot', 'star', 'zigzag'];
  const PAT_ICON = ['□', '▧', '⁘', '★', '〰'];
  let look1 = store.get('look', { c: 0, p: 0 });
  let look2 = store.get('look2', { c: 1, p: 0 });
  const lookStr = l => l.c + ',' + l.p;
  const parseLook = s => { const [c, p] = String(s || '').split(',').map(Number); return { c: (c >= 0 && c < COLORS.length) ? c : 1, p: (p >= 0 && p < PATTERNS.length) ? p : 0 }; };
  const toLook = l => ({ color: COLORS[l.c] || COLORS[0], pattern: PATTERNS[l.p] || 'none' });
  function pairLooks(a, b) { a = { ...a }; b = { ...b }; if (a.c === b.c) b.c = a.c === 1 ? 0 : 1; return [a, b]; }
  function setSideColors(looks) {
    document.documentElement.style.setProperty('--c0', COLORS[looks[0].c]);
    document.documentElement.style.setProperty('--c1', COLORS[looks[1].c]);
  }
  let pid = store.get('pid', null);
  if (!pid) { pid = Math.random().toString(36).slice(2, 12); store.set('pid', pid); }

  // ---------- 描画と操作 ----------
  let qSetting = store.get('q', 'auto');
  function autoQuality() {
    if (qSetting !== 'auto') return qSetting;
    const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
    if (isTouch && (mem <= 3 || cores <= 4)) return 'low';
    if (isTouch) return 'mid';
    return 'high';
  }
  let R;
  try { R = new HT.Renderer($('view'), autoQuality()); }
  catch (e) {
    document.body.innerHTML = '<div style="color:#fff;padding:30px;font-size:18px">この端末では3D表示ができませんでした。別のブラウザ（Chrome / Safari）でためしてください。</div>';
    throw e;
  }
  const input = new HT.Input(R, $('layer'));
  window.addEventListener('resize', () => R.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => R.resize(), 300));

  // ---------- 画面の切りかえ ----------
  let current = null;
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    current = id;
    document.body.classList.toggle('dimmed', ['title', 'online', 'wait', 'howto', 'menu', 'curtain'].includes(id));
  }
  function toast(msg, ms = 2200) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove('show'), ms);
  }
  function hud(on) { $('hud').classList.toggle('hidden', !on); if (!on) { $('stamp-pal').classList.add('hidden'); clearBubbles(); } }
  function banner(text, cls = '', ms = 1400) {
    const b = $('banner'); b.textContent = text; b.className = 'banner show ' + cls;
    clearTimeout(banner.tm); if (ms) banner.tm = setTimeout(() => b.classList.remove('show'), ms);
  }
  function hideBanner() { $('banner').classList.remove('show'); }
  function setPips(wins) {
    for (const s of [0, 1]) {
      const el = $('pips' + s); const want = C.WINS_NEEDED;
      if (el.children.length !== want) { el.innerHTML = ''; for (let i = 0; i < want; i++) el.appendChild(document.createElement('i')); }
      [...el.children].forEach((p, i) => p.classList.toggle('on', i < wins[s]));
    }
  }
  let flipped = false;
  function setFlip(f) { flipped = !!f; R.setFlip(flipped); input.flip = flipped; document.body.classList.toggle('flip', flipped); }
  function setNames(a, b) { $('hud-name0').textContent = a; $('hud-name1').textContent = b; }

  // ---------- 自分の性能・地雷の残り（画面の上） ----------
  function setSkillInfo(s, sk) {
    const el = $('hud-info' + s); if (!el) return;
    if (!sk) { el.innerHTML = ''; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<span>速さ<b>${sk.speed}</b></span><span>はね<b>${C.BOUNCE_LV[sk.bounce - 1]}回</b></span><span>大きさ<b>${sk.size}</b></span><span>弾<b>${sk.bsize}</b></span><span class="mi" id="hud-mine${s}"></span>`;
  }
  function setMineInfo(s, n, withButton) {
    const el = $('hud-mine' + s); if (el) el.innerHTML = '地雷<b>' + '●'.repeat(n) + '<i>' + '●'.repeat(C.MAX_MINES - n) + '</i></b>';
    if (withButton) { const b = $('btn-mine'); b.querySelector('span').innerHTML = '地雷<small>×' + n + '</small>'; b.classList.toggle('empty', n <= 0); }
  }
  let vibOn = store.get('vib', true);
  const canVibrate = typeof navigator.vibrate === 'function';
  function vibrate(p) { if (vibOn && canVibrate) try { navigator.vibrate(p); } catch (e) {} }

  // ---------- スタンプ ----------
  const STAMPS = ['👍', '😆', '😱', '😤', '🙏', '🎉'];
  const bubbles = [];
  function stampBubble(slot, k) {
    const el = document.createElement('div'); el.className = 'bubble'; el.textContent = STAMPS[k] || '👍';
    $('bubbles').appendChild(el);
    const b = { el, slot, t: 2.2 }; bubbles.push(b);
    HT.Sound.stamp();
    setTimeout(() => { el.remove(); const i = bubbles.indexOf(b); if (i >= 0) bubbles.splice(i, 1); }, 2200);
  }
  function clearBubbles() { for (const b of bubbles) b.el.remove(); bubbles.length = 0; }
  function updateBubbles(sim) {
    for (const b of bubbles) {
      const t = sim && sim.tanks[b.slot];
      // 戦いの外（スキル・ブロックの時間）は、その人の側の上に出す
      const pos = t ? R.worldToScreen(t.x, t.y, 1.3) : { x: innerWidth * ((b.slot === 0) !== flipped ? 0.2 : 0.8), y: Math.max(90, innerHeight * 0.2) };
      b.el.style.left = pos.x + 'px'; b.el.style.top = pos.y + 'px';
    }
  }
  (function buildStamps() {
    const pal = $('stamp-pal');
    STAMPS.forEach((s, i) => {
      const b = document.createElement('button'); b.textContent = s;
      b.addEventListener('click', e => { e.stopPropagation(); pal.classList.add('hidden'); if (game && game.stamp) game.stamp(i); });
      pal.appendChild(b);
    });
    $('btn-stamp').addEventListener('click', e => { e.stopPropagation(); pal.classList.toggle('hidden'); });
  })();

  // ---------- ボタンを押した感じ（スマホでも確実に） ----------
  document.addEventListener('click', e => { if (e.target.closest('button')) HT.Sound.click(); }, true);
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => HT.Sound.init(), { passive: true, capture: true });
  const mineBtn = $('btn-mine');
  mineBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); mineBtn.classList.add('press'); input.tapMine(); });
  mineBtn.addEventListener('pointerup', () => mineBtn.classList.remove('press'));
  mineBtn.addEventListener('pointercancel', () => mineBtn.classList.remove('press'));

  // =============================================
  //  リプレイ用の記録
  // =============================================
  const FX_TYPES = new Set(['fire', 'bounce', 'bulletDie', 'pop', 'clash', 'mine', 'blast', 'break', 'die', 'wall', 'remoteHit']);
  class Recorder {
    constructor(sim) { this.sim = sim; this.frames = []; this.base = sim.tiles.slice(); this.keep = 6; }
    push(events) {
      const s = this.sim;
      const ev = [];
      let tilesChanged = false;
      for (const e of events) {
        if (!FX_TYPES.has(e.type)) continue;
        if (e.type === 'break' || e.type === 'wall') tilesChanged = true;
        const c = { ...e }; delete c.bullet; delete c.mine; ev.push(c);
      }
      this.frames.push({
        t: s.time,
        tk: s.tanks.map(t => t && [t.x, t.y, t.a, t.aim, t.alive ? 1 : 0]),
        b: s.bullets.map(b => [b.id, b.owner, b.x, b.y, b.r, b.vx, b.vy]),
        m: s.mines.map(m => [m.id, m.owner, m.x, m.y, m.t0]),
        ev, tiles: tilesChanged ? s.tiles.slice() : null, wr: s.warnRing || 0
      });
      while (this.frames.length > 2 && this.frames[0].t < s.time - this.keep) {
        const f = this.frames.shift();
        if (f.tiles) this.base = f.tiles;
      }
    }
    // 決定的な瞬間の前後を切り出す
    clip(center) {
      let base = this.base; const out = [];
      for (const f of this.frames) {
        if (f.t < center - 1.8) { if (f.tiles) base = f.tiles; continue; }
        if (f.t > center + 0.9) break;
        out.push(f);
      }
      return { base: base.slice(), frames: out, center };
    }
  }

  class ReplayPlayer {
    constructor(clip, tankInfo, stageIndex, onDone) {
      this.clip = clip; this.onDone = onDone; this.i = 0; this.t = clip.frames.length ? clip.frames[0].t : 0;
      const self = this;
      this.view = {
        tanks: [], bullets: [], mines: [], time: this.t, warnRing: 0, suddenRing: 0, tiles: clip.base.slice(),
        tile(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? T.HARD : this.tiles[y * W + x]; },
        ringTiles(k) { return HT.Sim.prototype.ringTiles.call(null, k); }
      };
      this.tankInfo = tankInfo;
      R.clearDynamic();
      R.buildStage(this.view);
      R.setTanks(tankInfo.map((t, s) => t && { slot: s, radius: t.radius, look: t.look, x: t.x, y: t.y }));
      this.done = false;
      banner(isTouch ? 'リプレイ（タップでとばす）' : 'リプレイ（クリックでとばす）', 'small', 0);
      $('banner').style.top = '12%';
    }
    update(dt) {
      if (this.done) return;
      const c = this.clip, fr = c.frames;
      if (!fr.length) return this.finish();
      const near = Math.abs(this.t - c.center) < 0.5;
      const speed = near ? 0.22 : 0.6;
      this.t += dt * speed;
      const wantZoom = near || this.t > c.center;
      if (wantZoom !== this.zoomed) { this.zoomed = wantZoom; if (wantZoom) { this.focus(); R.setZoom(this.fx, this.focusY); } else R.setZoom(null); }
      while (this.i < fr.length && fr[this.i].t <= this.t) {
        const f = fr[this.i++];
        this.apply(f);
        for (const e of f.ev) R.handle(e, this.view);
      }
      R.sync(this.view, dt * speed);
      if (this.i >= fr.length && this.t > fr[fr.length - 1].t + 0.6) this.finish();
    }
    focus() {
      if (this.fx == null) {
        this.fx = W / 2; this.focusY = H / 2;
        for (const f of this.clip.frames) for (const e of f.ev) if (e.type === 'die') { this.fx = e.x; this.focusY = e.y; return this.fx; }
      }
      return this.fx;
    }
    apply(f) {
      const v = this.view;
      v.time = f.t; v.warnRing = f.wr;
      if (f.tiles) v.tiles = f.tiles.slice();
      v.tanks = f.tk.map((a, s) => a && { slot: s, x: a[0], y: a[1], a: a[2], aim: a[3], alive: !!a[4], radius: this.tankInfo[s].radius });
      v.bullets = f.b.map(a => ({ id: a[0], owner: a[1], x: a[2], y: a[3], r: a[4], vx: a[5], vy: a[6] }));
      v.mines = f.m.map(a => ({ id: a[0], owner: a[1], x: a[2], y: a[3], t0: a[4] }));
    }
    finish() {
      if (this.done) return;
      this.done = true; R.setZoom(null); hideBanner(); $('banner').style.top = '';
      if (this.onDone) this.onDone();
    }
  }

  // =============================================
  //  1回の戦い（どのモードでも共通）
  // =============================================
  //  o.ctrl[s] : 'human' | 'human2' | 'cpu' | 'remote' | 'dummy'
  class Battle {
    constructor(o) {
      this.o = o;
      const sim = this.sim = new HT.Sim(o.stage);
      this.placed = [];
      for (const s of [0, 1]) for (const b of (o.blocks && o.blocks[s]) || []) {
        if (sim.canPlace(s, b.x, b.y)) { sim.setTile(b.x, b.y, b.k); this.placed.push(b); }
      }
      R.clearDynamic();
      R.buildStage(new HT.Sim(o.stage));
      this.popQ = this.placed.map((b, i) => ({ b, at: 0.35 + i * 0.12 }));
      for (const s of [0, 1]) sim.addTank(s, o.skills[s], { local: o.ctrl[s] !== 'remote' });
      R.setTanks([0, 1].map(s => ({ slot: s, radius: sim.tanks[s].radius, look: o.looks[s], x: sim.tanks[s].x, y: sim.tanks[s].y })));
      this.cpus = [0, 1].map(s => (o.ctrl[s] === 'cpu' ? new HT.CPU(sim, s, o.levels ? o.levels[s] : 'normal') : null));
      this.t = 0; this.deaths = {}; this.result = null; this.ending = 0; this.scale = 1;
      this.lastCount = null; this.started = false;
      this.rec = new Recorder(sim);
      this.minesShown = [null, null];
      // 戦い中は自分の性能だけ表示（相手のは隠す）
      for (const s of [0, 1]) setSkillInfo(s, o.ctrl[s] === 'human' || o.ctrl[s] === 'human2' ? o.skills[s] : null);
      this.remoteBuf = [[], []];
      this.suddenShown = false;
      for (const s of [0, 1]) if (o.ctrl[s] === 'human') input.setAim(0, sim.tanks[s].aim);
      for (const s of [0, 1]) if (o.ctrl[s] === 'human2') input.setAim(1, sim.tanks[s].aim);
    }
    startsIn() { return this.o.goAt ? (this.o.goAt - this.o.clock()) / 1000 : (this.o.goIn || 3) - this.t; }
    tankInfo() { return this.sim.tanks.map(t => t && { radius: t.radius, look: this.o.looks[t.slot], x: t.x, y: t.y }); }

    update(dt) {
      const sim = this.sim, o = this.o;
      this.t += dt;
      // 置いたブロックが順番に出てくる
      while (this.popQ.length && this.t >= this.popQ[0].at) { const p = this.popQ.shift(); R.syncTile(sim, p.b.x, p.b.y, true); HT.Sound.place(); R.sparks(p.b.x + 0.5, 0.8, p.b.y + 0.5, 8, [1, 0.95, 0.7], 2.5); }
      // カウントダウン
      const si = this.startsIn();
      const cEl = $('count');
      if (si > 0) {
        const n = Math.ceil(si);
        if (n <= 3 && n !== this.lastCount) { this.lastCount = n; cEl.textContent = n; cEl.className = 'count'; void cEl.offsetWidth; cEl.className = 'count tick'; HT.Sound.count(); }
      } else if (!this.started) {
        this.started = true; this.lastCount = 0;
        cEl.textContent = 'GO!'; cEl.className = 'count'; void cEl.offsetWidth; cEl.className = 'count tick go'; HT.Sound.go();
        if (this.o.onStart) this.o.onStart();
      }
      const live = this.started && !this.result;
      input.enabled = live && !this.paused && o.inputOn !== false;
      const showMine = input.enabled && o.ctrl.includes('human');
      if (showMine !== document.body.classList.contains('live')) document.body.classList.toggle('live', showMine);

      // 操作
      const guides = [];
      const scaleDt = dt * this.scale;
      for (const s of [0, 1]) {
        const t = sim.tanks[s]; if (!t) continue;
        const kind = o.ctrl[s];
        if (kind === 'human' || kind === 'human2') {
          const c = input.control(kind === 'human2' ? 1 : 0, t, dt);
          t.aim = c.aim;
          t.input = live ? { mx: c.mx, my: c.my, aim: c.aim, fire: c.fire, mine: c.mine } : { mx: 0, my: 0, aim: c.aim, fire: false, mine: false };
          if (t.alive && !this.result && (c.guide || !isTouch || kind === 'human2')) guides.push(this.guide(t));
        } else if (kind === 'cpu') {
          if (live && t.alive) t.input = this.cpus[s].update(scaleDt);
          else t.input = { mx: 0, my: 0, aim: t.aim, fire: false, mine: false };
        } else if (kind === 'remote') this.applyRemote(s);
      }
      R.setGuides(guides);

      // 進める
      if (this.started) {
        if (o.goAt) {
          const target = Math.max(0, (o.clock() - o.goAt) / 1000);
          let guard = 0;
          while (sim.time < target - 1e-4 && guard++ < 40) sim.step(Math.min(1 / 60, target - sim.time));
        } else {
          let left = scaleDt;
          while (left > 1e-6) { const h = Math.min(1 / 60, left); sim.step(h); left -= h; }
        }
      }
      // 出来事
      const evs = sim.events; sim.events = [];
      const isHuman = s => o.ctrl[s] === 'human' || o.ctrl[s] === 'human2';
      for (const e of evs) {
        R.handle(e, sim);
        if (e.type === 'die') this.onDie(e.slot, this.started ? (e.T != null ? e.T : sim.time) : 0, e);
        if (o.onLocalEvent) o.onLocalEvent(e, sim);
        // 振動（対応している端末だけ）
        if (e.type === 'die' && isHuman(e.slot)) vibrate([90, 50, 180]);
        else if (e.type === 'die') vibrate(60);
        else if (e.type === 'blast') vibrate(40);
        else if (e.type === 'fire' && isHuman(e.slot)) vibrate(8);
      }
      if (this.started) this.rec.push(evs);
      // 残りの弾と地雷
      for (const s of [0, 1]) {
        const t = sim.tanks[s]; if (!t) continue;
        const human = isHuman(s);
        R.setAmmo(s, C.MAX_BULLETS - sim.activeBullets(s), human && t.alive && !this.result);
        if (human) {
          const mines = C.MAX_MINES - sim.mines.filter(m => m.owner === s && !m.dead).length;
          if (this.minesShown[s] !== mines) { this.minesShown[s] = mines; setMineInfo(s, mines, o.ctrl[s] === 'human'); }
        }
      }

      // サドンデスの知らせ
      const info = sim.suddenInfo();
      if (this.started && !this.result) {
        if (info.left > 0 && info.left <= 3 && !this.warned) { this.warned = true; banner('サドンデスまで あと少し', 'warn', 1500); HT.Sound.warn(); }
        if (sim.time >= C.SUDDEN_TIME && !this.suddenShown) { this.suddenShown = true; banner('サドンデス！', 'warn', 1800); HT.Sound.warn(); R.addShake(0.4); }
      }
      this.updateTimer(info);

      // 勝ち負け（オンライン以外）
      if (!o.goAt && !this.result && this.firstDeath != null && sim.time >= this.firstDeath + C.DRAW_WINDOW) this.decideLocal();
      // 終わったあとの演出
      if (this.result) {
        this.ending += dt;
        if (!o.goAt) this.scale = this.ending < 1.1 ? 0.28 : Math.min(1, this.scale + dt * 2);
        if (this.ending > 2.1 && !this.endCalled) { this.endCalled = true; R.setZoom(null); if (o.onEnd) o.onEnd(this.result); }
      }
      R.sync(sim, dt * (this.result && !o.goAt ? this.scale : 1));
    }
    guide(t) {
      const off = t.radius + t.bradius + 0.06;
      const sx = t.x + Math.cos(t.aim) * off, sy = t.y + Math.sin(t.aim) * off;
      const tr = this.sim.trace(sx, sy, t.aim, t.speed, t.bradius, Math.max(1, t.bounces), 40 / t.speed, t.slot);
      return { pts: tr.pts, color: 0xffffff };
    }
    updateTimer(info) {
      const el = $('hud-timer'), sub = $('hud-sub');
      if (!this.started) { el.textContent = '1:30'; el.classList.remove('sudden'); sub.textContent = ''; return; }
      if (info.left > 0) {
        const s = Math.ceil(info.left); el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        el.classList.remove('sudden'); sub.textContent = '';
      } else { el.textContent = 'サドンデス'; el.classList.add('sudden'); sub.textContent = '壁がせまってくる！'; }
    }
    onDie(slot, T) {
      if (this.deaths[slot] != null) return;
      this.deaths[slot] = T;
      if (this.firstDeath == null) { this.firstDeath = T; this.deathPos = { x: this.sim.tanks[slot].x, y: this.sim.tanks[slot].y }; }
      if (this.o.onDeath) this.o.onDeath(slot, T);
    }
    decideLocal() {
      const d = this.deaths;
      let r;
      if (d[0] != null && d[1] != null && Math.abs(d[0] - d[1]) <= C.DRAW_WINDOW) r = { winner: -1 };
      else if (d[0] != null && (d[1] == null || d[0] < d[1])) r = { winner: 1 };
      else r = { winner: 0 };
      this.finish(r);
    }
    finish(r) {
      if (this.result) return;
      this.result = r; this.ending = 0;
      input.enabled = false;
      if (this.deathPos) R.setZoom(this.deathPos.x, this.deathPos.y);
      this.clip = this.rec.clip(this.firstDeath != null ? this.firstDeath : this.sim.time);
    }

    // ---------- オンライン：相手の戦車をなめらかに ----------
    pushRemote(s, st) {
      const buf = this.remoteBuf[s];
      buf.push(st);
      if (buf.length > 40) buf.splice(0, buf.length - 40);
    }
    applyRemote(s) {
      const t = this.sim.tanks[s], buf = this.remoteBuf[s];
      if (!t || !t.alive || !buf.length) return;
      const delay = this.o.remoteDelay ? this.o.remoteDelay() : 0.12;
      const rt = this.sim.time - delay;
      let a = buf[0], b = null;
      for (let i = 0; i < buf.length; i++) { if (buf[i].T <= rt) a = buf[i]; else { b = buf[i]; break; } }
      if (a && b && b.T > a.T && a.T <= rt) {
        const k = clamp((rt - a.T) / (b.T - a.T), 0, 1);
        t.x = a.x + (b.x - a.x) * k; t.y = a.y + (b.y - a.y) * k; t.a = lerpAng(a.a, b.a, k); t.aim = lerpAng(a.m, b.m, k);
      } else {
        const l = (a && a.T <= rt) ? a : buf[0];
        t.x = l.x; t.y = l.y; t.a = l.a; t.aim = l.m;
      }
    }
    restoreView() {
      R.clearDynamic(); R.buildStage(this.sim);
      R.setTanks(this.sim.tanks.map((t, s) => t && { slot: s, radius: t.radius, look: this.o.looks[s], x: t.x, y: t.y }));
    }
    stateOf(s) { const t = this.sim.tanks[s]; return { T: +this.sim.time.toFixed(3), x: +t.x.toFixed(3), y: +t.y.toFixed(3), a: +t.a.toFixed(3), m: +t.aim.toFixed(3) }; }
  }

  // =============================================
  //  スキルの画面
  // =============================================
  const SKILL_ROWS = [
    { key: 'speed', name: 'たまの速さ', hint: '上げても下げてもポイントを使う', val: lv => ['とてもおそい', 'おそい', 'ややおそい', 'ふつう', 'ややはやい', 'はやい', 'とてもはやい'][lv - 1], color: '#f59e0b' },
    { key: 'bounce', name: 'はねかえり', hint: '上げるだけ。1〜2で1回、7で4回', val: lv => C.BOUNCE_LV[lv - 1] + '回', color: '#22c55e' },
    { key: 'size', name: '戦車の大きさ', hint: '大きくするとポイントがもらえる', val: lv => ['とても小さい', '小さい', 'やや小さい', 'ふつう', 'やや大きい', '大きい', 'とても大きい'][lv - 1], color: '#3b82f6' },
    { key: 'bsize', name: 'たまの大きさ', hint: '上げても下げてもポイントを使う', val: lv => ['とても小さい', '小さい', 'やや小さい', 'ふつう', 'やや大きい', '大きい', 'とても大きい'][lv - 1], color: '#ef4444' }
  ];
  function rowCost(key, lv) {
    if (key === 'speed' || key === 'bsize') return Math.abs(lv - 4);
    if (key === 'bounce') return lv - 1;
    return lv < 4 ? 4 - lv : -(lv - 4);
  }
  function pipbar(lv, base, color) {
    let h = '<div class="pipbar" style="--c:' + color + '">';
    for (let i = 1; i <= 7; i++) h += '<i class="' + (i <= lv ? 'on ' : '') + (i === base ? 'base' : '') + '"></i>';
    return h + '</div>';
  }
  const SkillUI = {
    open(o) {
      // o: { points, title, sub, skills, deadline(), oppText(), onChange(s), onReady(s), readonly }
      this.o = o; this.s = { ...(o.skills || HT.defaultSkills()) }; this.ready = false;
      $('sp-who').textContent = o.title; $('sp-battle').textContent = o.sub;
      const rows = $('sp-rows'); rows.innerHTML = '';
      for (const r of SKILL_ROWS) {
        const d = document.createElement('div'); d.className = 'sk-row'; d.dataset.key = r.key;
        d.innerHTML = `<div class="sk-name"><b>${r.name}</b><small>${r.hint}</small></div><button class="sk-btn" data-d="-1">−</button><div class="sk-bar"></div><button class="sk-btn" data-d="1">＋</button><div class="sk-val"></div>`;
        d.querySelectorAll('.sk-btn').forEach(b => b.addEventListener('click', () => this.change(r.key, +b.dataset.d)));
        rows.appendChild(d);
      }
      $('sp-ok').onclick = () => this.setReady(!this.ready);
      // おまかせ：よくある振り方のどれかを入れる（押すたびに変わる）
      $('sp-auto').onclick = () => {
        if (this.ready) return;
        let ns, guard = 0;
        do { ns = HT.cpuSkills(this.o.points, 'normal'); } while (guard++ < 10 && JSON.stringify(ns) === JSON.stringify(this.s));
        this.s = ns; this.draw(); this.o.onChange && this.o.onChange({ ...this.s });
      };
      $('sp-reset').onclick = () => { if (this.ready) return; this.s = HT.defaultSkills(); this.draw(); this.o.onChange && this.o.onChange({ ...this.s }); };
      this.draw();
      show('skill');
    },
    change(key, d) {
      if (this.ready) return;
      const nv = this.s[key] + d;
      if (nv < 1 || nv > 7 || (key === 'bounce' && nv < 1)) return HT.Sound.bad();
      const ns = { ...this.s, [key]: nv };
      if (HT.skillCost(ns) > this.o.points) { HT.Sound.bad(); this.flashPoints(); return; }
      this.s = ns; this.draw(key);
      if (this.o.onChange) this.o.onChange({ ...this.s });
    },
    flashPoints() { const p = document.querySelector('.sp-points'); p.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 250 }); },
    left() { return this.o.points - HT.skillCost(this.s); },
    draw(bumpKey) {
      const left = this.left();
      $('sp-left').textContent = left; document.querySelector('.sp-points').classList.toggle('zero', left <= 0);
      for (const r of SKILL_ROWS) {
        const row = document.querySelector('.sk-row[data-key="' + r.key + '"]');
        const lv = this.s[r.key];
        row.querySelector('.sk-bar').innerHTML = pipbar(lv, r.key === 'bounce' ? 1 : 4, r.color);
        if (bumpKey === r.key) { const pips = row.querySelectorAll('.pipbar i'); const p = pips[lv - 1]; if (p) { p.classList.add('bump'); setTimeout(() => p.classList.remove('bump'), 150); } }
        const c = rowCost(r.key, lv);
        row.querySelector('.sk-val').innerHTML = r.val(lv) + '<small class="' + (c < 0 ? 'gain' : c > 0 ? 'cost' : '') + '">' + (c < 0 ? '+' + (-c) + 'pt' : c > 0 ? '−' + c + 'pt' : '±0') + '</small>';
        const [mi, pl] = row.querySelectorAll('.sk-btn');
        const can = dd => { const nv = lv + dd; if (nv < 1 || nv > 7) return false; return HT.skillCost({ ...this.s, [r.key]: nv }) <= this.o.points; };
        mi.disabled = this.ready || !can(-1); pl.disabled = this.ready || !can(1);
      }
      const ok = $('sp-ok'); ok.textContent = this.ready ? '準備OK！（取り消す）' : '準備OK'; ok.classList.toggle('done', this.ready);
      $('sp-reset').disabled = this.ready; $('sp-auto').disabled = this.ready;
    },
    setReady(v) { this.ready = v; this.draw(); if (this.o.onReady) this.o.onReady(v, { ...this.s }); },
    tick() {
      if (current !== 'skill' || !this.o) return;
      const left = Math.max(0, this.o.deadline());
      const ring = $('sp-timer'); ring.querySelector('span').textContent = Math.ceil(left);
      ring.querySelector('.fg').style.strokeDashoffset = 106.8 * (1 - left / C.SKILL_TIME);
      ring.classList.toggle('hurry', left <= 5);
      const ot = this.o.oppText ? this.o.oppText() : '';
      const os = $('sp-opp'); os.textContent = ot; os.classList.toggle('ok', /OK/.test(ot));
    }
  };

  // =============================================
  //  ブロックを置く画面
  // =============================================
  const PlaceUI = {
    open(o) {
      // o: { stage, slot, title, deadline(), oppText(), onChange(list), onReady(v, list), look, radius, blocks }
      this.o = o; this.list = (o.blocks || []).slice(); this.ready = false; this.kind = T.HARD;
      this.sim = new HT.Sim(o.stage);
      R.clearDynamic(); R.buildStage(this.sim);
      for (const b of this.list) { this.sim.setTile(b.x, b.y, b.k); R.syncTile(this.sim, b.x, b.y, false); }
      const sp = HT.SPAWN[o.slot];
      R.setTanks([{ slot: o.slot, radius: o.radius, look: o.look, x: sp.x, y: sp.y }]);
      this.fakeSim = { tanks: [], bullets: [], mines: [], time: 0, warnRing: 0, ringTiles: k => this.sim.ringTiles(k), tile: (x, y) => this.sim.tile(x, y) };
      const t = { slot: o.slot, x: sp.x, y: sp.y, a: sp.a, aim: sp.a, alive: true };
      this.fakeSim.tanks[o.slot] = t;
      R.showZones(true, o.slot);
      $('pl-who').textContent = o.title;
      document.querySelectorAll('.btn.kind').forEach(b => { b.onclick = () => { this.kind = +b.dataset.kind; this.draw(); }; });
      $('pl-ok').onclick = () => this.setReady(!this.ready);
      input.onPlaceClick = (x, y, btn) => this.click(x, y, btn);
      input.onHover = (x, y) => this.hover(x, y);
      this.draw();
      show('place');
    },
    close() { input.onPlaceClick = null; input.onHover = null; R.setCursor(null); R.showZones(false); },
    count(k) { return this.list.filter(b => b.k === k).length; },
    max(k) { return k === T.HARD ? C.BLOCKS_HARD : C.BLOCKS_SOFT; },
    tileAt(px, py) { const g = R.screenToGround(px, py); return { x: Math.floor(g.x), y: Math.floor(g.y) }; },
    click(px, py, btn) {
      if (this.ready) return;
      const { x, y } = this.tileAt(px, py);
      const i = this.list.findIndex(b => b.x === x && b.y === y);
      if (i >= 0) {
        this.list.splice(i, 1); this.sim.setTile(x, y, T.EMPTY); R.syncTile(this.sim, x, y, false); HT.Sound.pop();
      } else {
        if (btn === 2) return;
        let k = this.kind;
        if (this.count(k) >= this.max(k)) { const other = k === T.HARD ? T.SOFT : T.HARD; if (this.count(other) < this.max(other)) k = other; else { HT.Sound.bad(); toast('もう置けません（さわると取り消し）'); return; } }
        if (!this.sim.canPlace(this.o.slot, x, y)) { HT.Sound.bad(); this.whyNot(x, y); return; }
        this.list.push({ x, y, k }); this.sim.setTile(x, y, k); R.syncTile(this.sim, x, y, true); HT.Sound.place();
        R.sparks(x + 0.5, 0.8, y + 0.5, 10, [1, 0.95, 0.7], 2.5);
        if (this.count(k) >= this.max(k)) { const other = k === T.HARD ? T.SOFT : T.HARD; if (this.count(other) < this.max(other)) this.kind = other; }
      }
      this.draw();
      if (this.o.onChange) this.o.onChange(this.list.slice());
    },
    whyNot(x, y) {
      if (x < 1 || y < 1 || x > W - 2 || y > H - 2) return;
      if (this.o.slot === 0 ? x >= W / 2 : x < W / 2) return toast('自分の陣地（色のついた側）にだけ置けます');
      if (this.sim.tile(x, y) !== T.EMPTY) return toast('そこには置けません');
      for (const s of HT.SPAWN) if (Math.abs(x + 0.5 - s.x) <= 1.6 && Math.abs(y + 0.5 - s.y) <= 1.6) return toast('スタート地点のそばには置けません');
      toast('道がふさがるので置けません');
    },
    hover(px, py) {
      if (this.ready) { R.setCursor(null); return; }
      const { x, y } = this.tileAt(px, py);
      const mine = this.list.some(b => b.x === x && b.y === y);
      if (x < 1 || y < 1 || x > W - 2 || y > H - 2) { R.setCursor(null); return; }
      R.setCursor(x, y, this.kind, mine || this.sim.canPlace(this.o.slot, x, y));
    },
    draw() {
      for (const k of [T.HARD, T.SOFT]) {
        const n = this.max(k) - this.count(k);
        $('pl-n' + k).textContent = n;
        const b = document.querySelector('.btn.kind[data-kind="' + k + '"]');
        b.classList.toggle('sel', this.kind === k); b.classList.toggle('empty', n <= 0);
      }
      const ok = $('pl-ok'); ok.textContent = this.ready ? '準備OK！' : '準備OK'; ok.classList.toggle('done', this.ready);
    },
    setReady(v) { this.ready = v; if (v) R.setCursor(null); this.draw(); if (this.o.onReady) this.o.onReady(v, this.list.slice()); },
    tick(dt) {
      if (current !== 'place' || !this.o) return;
      const left = Math.max(0, this.o.deadline());
      const ring = $('pl-timer'); ring.querySelector('span').textContent = Math.ceil(left);
      ring.querySelector('.fg').style.strokeDashoffset = 106.8 * (1 - left / C.PLACE_TIME);
      ring.classList.toggle('hurry', left <= 5);
      const ot = this.o.oppText ? this.o.oppText() : '';
      const os = $('pl-opp'); os.textContent = ot; os.classList.toggle('ok', /OK/.test(ot));
      R.sync(this.fakeSim, dt);
    }
  };

  // =============================================
  //  結果の画面
  // =============================================
  function statCard(title, color, skills) {
    let h = `<h4><i style="background:${color}"></i>${title}</h4>`;
    for (const r of SKILL_ROWS) {
      const lv = skills[r.key];
      h += `<div class="st-line"><span>${r.name}</span>${pipbar(lv, r.key === 'bounce' ? 1 : 4, r.color)}<span>${r.key === 'bounce' ? C.BOUNCE_LV[lv - 1] + '回' : 'Lv' + lv}</span></div>`;
    }
    return h;
  }
  const ResultUI = {
    show(o) {
      // o: { title, cls, wins, looks, cards:[{title, color, skills, opp}], record, next:{text,fn}, replay:fn, toTitle:fn, note }
      const t = $('res-title'); t.textContent = o.title; t.className = 'res-title ' + (o.cls || '');
      $('res-score').innerHTML = o.wins ? `<span class="s0">${o.wins[0]}</span> - <span class="s1">${o.wins[1]}</span>` : '';
      $('res-opp').innerHTML = o.cards[0] ? statCard(o.cards[0].title, o.cards[0].color, o.cards[0].skills) : '';
      $('res-me').innerHTML = o.cards[1] ? statCard(o.cards[1].title, o.cards[1].color, o.cards[1].skills) : '';
      $('res-opp').style.display = o.cards[0] ? '' : 'none';
      $('res-me').style.display = o.cards[1] ? '' : 'none';
      $('res-record').textContent = o.record || '';
      $('res-note').textContent = o.note || '';
      const nx = $('res-next');
      nx.classList.toggle('hidden', !o.next); nx.classList.remove('waiting');
      if (o.next) { nx.textContent = o.next.text; nx.onclick = () => o.next.fn(nx); }
      const rp = $('res-replay'); rp.classList.toggle('hidden', !o.replay); rp.onclick = () => o.replay && o.replay();
      const tt = $('res-title-btn'); tt.classList.toggle('hidden', !o.toTitle); tt.onclick = () => o.toTitle && o.toTitle();
      show('result');
    }
  };

  // =============================================
  //  モード：タイトルの後ろで流れるデモ
  // =============================================
  class Demo {
    constructor() { this.next(); this.wait = 0; }
    next() {
      HT.Sound.setQuiet(true);
      const stage = Math.floor(Math.random() * 3), n = Math.floor(Math.random() * 3);
      const sim = new HT.Sim(stage);
      const blocks = [HT.cpuBlocks(sim, 0), HT.cpuBlocks(sim, 1)];
      const looks = pairLooks(look1, { c: (look1.c + 1 + Math.floor(Math.random() * 3)) % COLORS.length, p: Math.floor(Math.random() * 5) });
      this.b = new Battle({
        stage, skills: [HT.cpuSkills(C.SKILL_POINTS[n], 'normal'), HT.cpuSkills(C.SKILL_POINTS[n], 'normal')], blocks,
        looks: looks.map(toLook), ctrl: ['cpu', 'cpu'], levels: ['normal', 'normal'], goIn: 0.8, inputOn: false,
        onEnd: () => { this.wait = 1.2; }
      });
      $('count').textContent = '';
    }
    update(dt) {
      this.b.update(dt);
      $('count').className = 'count'; $('count').textContent = '';
      if (this.wait > 0) { this.wait -= dt; if (this.wait <= 0) this.next(); }
      if (this.b.sim.time > 60) this.b.finish({ winner: -1 });
    }
    destroy() { HT.Sound.setQuiet(false); hideBanner(); }
  }

  // =============================================
  //  モード：CPU / 同じPCで2人
  // =============================================
  class LocalMatch {
    constructor(mode, level) {
      this.mode = mode; this.level = level;
      this.wins = [0, 0]; this.n = 0;
      this.order = shuffle([0, 1, 2]);
      this.looks = mode === 'cpu' ? pairLooks(look1, { c: look1.c === 1 ? 0 : 1, p: 0 }) : pairLooks(look1, look2);
      setSideColors(this.looks);
      this.names = mode === 'cpu' ? ['あなた', 'CPU（' + { easy: 'よわい', normal: 'ふつう', hard: 'つよい' }[level] + '）'] : ['1P', '2P'];
      setNames(...this.names);
      input.setMode(mode === 'local2' ? 'local2' : 'single');
      document.body.classList.toggle('can-stamp', mode === 'cpu');
      this.nextBattle();
    }
    get points() { return C.SKILL_POINTS[Math.min(this.n - 1, C.SKILL_POINTS.length - 1)]; }
    get stage() { return this.order[(this.n - 1) % 3]; }
    nextBattle() {
      this.n++;
      this.b = null;
      this.skills = [HT.defaultSkills(), HT.defaultSkills()];
      this.blocks = [[], []];
      hud(false);
      this.phase = 'skill'; this.turn = 0;
      if (this.mode === 'cpu') {
        this.skills[1] = HT.cpuSkills(this.points, this.level);
        this.openSkill(0);
      } else this.curtain(0, 'skill');
    }
    curtain(turn, next) {
      this.phase = 'curtain';
      R.clearDynamic(); R.buildStage(new HT.Sim(this.stage)); R.setTanks([]);
      $('cu-title').textContent = (turn === 0 ? '1P' : '2P') + 'の番です';
      $('cu-note').textContent = next === 'skill'
        ? (turn === 0 ? '2Pは画面を見ないでね（スキルをふります）' : '1Pは画面を見ないでね（スキルをふります）')
        : (turn === 0 ? '2Pは画面を見ないでね（ブロックを置きます）' : '1Pは画面を見ないでね（ブロックを置きます）');
      $('cu-ok').onclick = () => { if (next === 'skill') this.openSkill(turn); else this.openPlace(turn); };
      show('curtain');
    }
    stageTitle() { return this.n + '戦目・ステージ：' + HT.STAGES[this.stage].name + '（' + this.points + 'pt）'; }
    openSkill(turn) {
      this.phase = 'skill'; this.turn = turn;
      this.deadline = performance.now() + C.SKILL_TIME * 1000;
      R.clearDynamic(); R.buildStage(new HT.Sim(this.stage)); R.setTanks([]);
      SkillUI.open({
        points: this.points, skills: this.skills[turn],
        title: this.mode === 'local2' ? (turn === 0 ? '1P' : '2P') + 'のスキル' : 'スキルをふろう',
        sub: this.stageTitle(),
        deadline: () => (this.deadline - performance.now()) / 1000,
        oppText: () => (this.mode === 'cpu' ? 'CPU：準備OK' : ''),
        onChange: s => { this.skills[turn] = s; },
        onReady: (v, s) => { this.skills[turn] = s; if (v) this.skillDone(); }
      });
    }
    skillDone() {
      if (this.phase !== 'skill') return;
      this.skills[this.turn] = { ...SkillUI.s };
      if (this.mode === 'local2' && this.turn === 0) return this.curtain(1, 'skill');
      if (this.mode === 'cpu') this.blocks[1] = HT.cpuBlocks(new HT.Sim(this.stage), 1);
      if (this.mode === 'local2') this.curtain(0, 'place'); else this.openPlace(0);
    }
    openPlace(turn) {
      this.phase = 'place'; this.turn = turn;
      this.deadline = performance.now() + C.PLACE_TIME * 1000;
      const st = HT.statsFrom(this.skills[turn]);
      PlaceUI.open({
        stage: this.stage, slot: turn, look: toLook(this.looks[turn]), radius: st.radius, blocks: this.blocks[turn],
        title: this.mode === 'local2' ? (turn === 0 ? '1P' : '2P') + 'のブロック' : 'ブロックを置こう',
        deadline: () => (this.deadline - performance.now()) / 1000,
        oppText: () => (this.mode === 'cpu' ? 'CPU：準備OK' : ''),
        onChange: l => { this.blocks[turn] = l; },
        onReady: (v, l) => { this.blocks[turn] = l; if (v) this.placeDone(); }
      });
    }
    placeDone() {
      if (this.phase !== 'place') return;
      this.blocks[this.turn] = PlaceUI.list.slice();
      PlaceUI.close();
      if (this.mode === 'local2' && this.turn === 0) return this.curtain(1, 'place');
      this.startBattle();
    }
    startBattle(again) {
      this.phase = 'battle';
      show(null); hud(true); setPips(this.wins);
      const ctrl = this.mode === 'cpu' ? ['human', 'cpu'] : ['human', 'human2'];
      this.b = new Battle({
        stage: this.stage, skills: this.skills, blocks: this.blocks, looks: this.looks.map(toLook), ctrl,
        levels: [this.level, this.level], goIn: again ? 2.6 : 3.4,
        onEnd: r => this.battleEnd(r)
      });
      if (again) banner('ひきわけ！ もう一回', '', 1600);
    }
    battleEnd(r) {
      const b = this.b;
      if (r.winner === -1) { HT.Sound.draw(); this.startBattle(true); return; }
      this.wins[r.winner]++;
      setPips(this.wins);
      const over = this.wins[r.winner] >= C.WINS_NEEDED;
      const cpu = this.mode === 'cpu';
      const youWin = r.winner === 0;
      if (cpu) { (youWin ? HT.Sound.win : HT.Sound.lose)(); if (!youWin && Math.random() < 0.6) setTimeout(() => stampBubble(1, 1), 300); }
      else HT.Sound.win();
      let record = '';
      if (over && cpu) {
        const rec = store.get('rec_cpu', {}); const k = this.level; rec[k] = rec[k] || { w: 0, l: 0 };
        rec[k][youWin ? 'w' : 'l']++; store.set('rec_cpu', rec);
        record = this.names[1] + 'との通算：' + rec[k].w + '勝 ' + rec[k].l + '敗';
      }
      const title = cpu ? (over ? (youWin ? 'あなたの勝ち！' : 'CPUの勝ち…') : (youWin ? 'かち！' : 'まけ…')) : (over ? (r.winner === 0 ? '1P' : '2P') + 'の勝ち！' : (r.winner === 0 ? '1P' : '2P') + 'のかち！');
      const cards = cpu
        ? [{ title: 'あいて（CPU）の戦車', color: COLORS[this.looks[1].c], skills: this.skills[1] }, { title: 'あなたの戦車', color: COLORS[this.looks[0].c], skills: this.skills[0] }]
        : [{ title: '1Pの戦車', color: COLORS[this.looks[0].c], skills: this.skills[0] }, { title: '2Pの戦車', color: COLORS[this.looks[1].c], skills: this.skills[1] }];
      const showIt = () => ResultUI.show({
        title, cls: cpu ? (youWin ? 'win' : 'lose') : 'win', wins: this.wins, cards, record,
        replay: () => this.replay(),
        next: over ? { text: 'もう一回', fn: () => setGame(new LocalMatch(this.mode, this.level)) } : { text: 'つぎへ（' + (this.n + 1) + '戦目）', fn: () => this.nextBattle() },
        toTitle: over ? () => goTitle() : null
      });
      this.showResult = showIt;
      // 決着の場面を自動で1回リプレイ → 結果
      if (this.b && this.b.clip && this.b.clip.frames.length > 5) this.replay(); else showIt();
    }
    replay() {
      const b = this.b;
      if (!b || !b.clip) return;
      show(null); hud(false);
      this.phase = 'replay';
      this.rp = new ReplayPlayer(b.clip, b.tankInfo(), this.stage, () => { this.phase = 'result'; this.rp = null; b.restoreView(); hud(true); this.showResult(); });
    }
    update(dt) {
      if (this.paused) { R.sync(this.b ? this.b.sim : PlaceUI.fakeSim || { tanks: [], bullets: [], mines: [] }, 0); return; }
      if (this.phase === 'skill') {
        SkillUI.tick();
        if (this.deadline - performance.now() <= 0) this.skillDone();
        R.sync({ tanks: [], bullets: [], mines: [], time: 0, warnRing: 0 }, dt);
      } else if (this.phase === 'place') {
        PlaceUI.tick(dt);
        if (this.deadline - performance.now() <= 0) this.placeDone();
      } else if (this.phase === 'replay' && this.rp) {
        this.rp.update(dt);
      } else if (this.b) this.b.update(dt);
      else R.sync({ tanks: [], bullets: [], mines: [], time: 0, warnRing: 0 }, dt);
    }
    stamp(k) { stampBubble(0, k); }
    pause(v) {
      if (v && !this.paused) this.pauseAt = performance.now();
      if (!v && this.paused && this.deadline) this.deadline += performance.now() - this.pauseAt;
      this.paused = v; if (this.b) this.b.paused = v; input.enabled = false;
    }
    destroy() { PlaceUI.close(); input.reset(); }
  }

  // =============================================
  //  モード：れんしゅう
  // =============================================
  class Practice {
    constructor() {
      this.stage = 0; this.skills = HT.defaultSkills();
      input.setMode('single');
      document.body.classList.remove('can-stamp');
      this.build();
      this.buildPanel();
      show('practice'); hud(true); document.body.classList.add('prac');
      setNames('あなた', 'まと'); setPips([0, 0]);
      $('pips0').innerHTML = ''; $('pips1').innerHTML = '';
      $('hud-timer').textContent = 'れんしゅう'; $('hud-sub').textContent = '';
      this.hits = 0;
    }
    build() {
      const sim = this.sim = new HT.Sim(this.stage);
      sim.stepSudden = () => {}; // 練習ではサドンデスなし
      R.clearDynamic(); R.buildStage(sim);
      sim.addTank(0, this.skills);
      this.targets = [];
      const spots = [[W - 2.5, H - 7.5], [W - 5.5, 3.5], [W - 7.5, H - 3.5], [W / 2 + 0.5, H / 2 - 2.5]];
      for (let i = 0; i < 3; i++) {
        const t = sim.addTank(i + 1, HT.defaultSkills(), { local: false });
        const p = this.freeSpot(spots[i][0], spots[i][1]);
        t.x = p.x; t.y = p.y; t.a = Math.PI; t.aim = Math.PI;
        this.targets.push({ slot: i + 1, respawn: 0, home: p, phase: Math.random() * 6, moving: i === 2 });
      }
      const looks = [toLook(look1), toLook({ c: 8, p: 2 }), toLook({ c: 8, p: 1 }), toLook({ c: 8, p: 3 })];
      this.looks = looks;
      R.setTanks(sim.tanks.map((t, s) => ({ slot: s, radius: t.radius, look: looks[s], x: t.x, y: t.y })));
      input.setAim(0, 0); input.enabled = true;
      this.myRespawn = 0;
    }
    freeSpot(x, y) {
      const sim = this.sim;
      for (let r = 0; r < 8; r += 0.5) for (let a = 0; a < 6.28; a += 0.5) {
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (px > 1.5 && py > 1.5 && px < W - 1.5 && py < H - 1.5 && !sim.circleHits(px, py, 0.5, false)) return { x: px, y: py };
      }
      return { x, y };
    }
    buildPanel() {
      const rows = $('pr-rows'); rows.innerHTML = '';
      for (const r of SKILL_ROWS) {
        const d = document.createElement('div'); d.className = 'sk-row';
        d.innerHTML = `<div class="sk-name"><b>${r.name}</b><small></small></div><button class="sk-btn" data-d="-1">−</button><button class="sk-btn" data-d="1">＋</button>`;
        d.querySelectorAll('.sk-btn').forEach(b => b.addEventListener('click', () => {
          this.skills[r.key] = clamp(this.skills[r.key] + +b.dataset.d, 1, 7); this.drawPanel(); this.applySkills();
        }));
        d.dataset.key = r.key; rows.appendChild(d);
      }
      const st = $('pr-stages'); st.innerHTML = '';
      HT.STAGES.forEach((s, i) => {
        const b = document.createElement('button'); b.className = 'btn mini ghost'; b.textContent = s.name;
        b.onclick = () => { this.stage = i; this.build(); this.drawPanel(); };
        st.appendChild(b);
      });
      $('pr-quit').onclick = () => goTitle();
      $('pr-fold').onclick = () => { const body = $('pr-body'); body.classList.toggle('hidden'); $('pr-fold').textContent = body.classList.contains('hidden') ? 'ひらく' : 'たたむ'; };
      if (isTouch) { $('pr-body').classList.add('hidden'); $('pr-fold').textContent = 'ひらく'; }
      this.drawPanel();
    }
    drawPanel() {
      document.querySelectorAll('#pr-rows .sk-row').forEach(row => {
        const r = SKILL_ROWS.find(x => x.key === row.dataset.key);
        row.querySelector('small').textContent = 'Lv' + this.skills[r.key] + '：' + r.val(this.skills[r.key]);
      });
      [...$('pr-stages').children].forEach((b, i) => b.classList.toggle('sel', i === this.stage));
    }
    applySkills() {
      const t = this.sim.tanks[0];
      Object.assign(t, HT.statsFrom(this.skills)); t.skills = { ...this.skills };
      if (this.sim.circleHits(t.x, t.y, t.radius, false)) { const p = this.freeSpot(t.x, t.y); t.x = p.x; t.y = p.y; }
      R.setTanks(this.sim.tanks.map((tk, s) => ({ slot: s, radius: tk.radius, look: this.looks[s], x: tk.x, y: tk.y })));
    }
    update(dt) {
      const sim = this.sim, me = sim.tanks[0];
      input.enabled = me.alive && !this.paused;
      if (this.paused) { R.sync(sim, 0); return; }
      const c = input.control(0, me, dt);
      me.aim = c.aim; me.input = { mx: c.mx, my: c.my, aim: c.aim, fire: c.fire, mine: c.mine };
      // 動くまと
      for (const tg of this.targets) {
        const t = sim.tanks[tg.slot];
        if (t.alive && tg.moving) {
          tg.phase += dt * 0.6;
          const nx = tg.home.x + Math.sin(tg.phase) * 2.5;
          if (!sim.circleHits(nx, t.y, t.radius, false)) { t.a = Math.cos(tg.phase) > 0 ? 0 : Math.PI; t.x = nx; }
        }
        if (!t.alive) { tg.respawn -= dt; if (tg.respawn <= 0) { t.alive = true; t.x = tg.home.x; t.y = tg.home.y; R.sparks(t.x, 0.5, t.y, 20, [1, 1, 0.7], 3); } }
      }
      let left = dt;
      while (left > 1e-6) { const h = Math.min(1 / 60, left); sim.step(h); left -= h; }
      const evs = sim.events; sim.events = [];
      for (const e of evs) {
        if (e.type === 'remoteHit') {
          const t = sim.tanks[e.slot];
          if (t && t.alive) { sim.killTank(t, 'bullet'); const tg = this.targets.find(x => x.slot === e.slot); if (tg) tg.respawn = 2; this.hits++; }
        }
      }
      for (const e of evs.concat(sim.events)) R.handle(e, sim);
      sim.events = [];
      // まとは爆発でもこわれる
      for (const e of evs) if (e.type === 'blast') for (const tg of this.targets) { const t = sim.tanks[tg.slot]; if (t.alive && Math.hypot(t.x - e.x, t.y - e.y) < C.BLAST_RADIUS + t.radius * 0.4) { sim.killTank(t, 'blast'); tg.respawn = 2; this.hits++; } }
      for (const e of sim.events) R.handle(e, sim);
      sim.events = [];
      if (!me.alive) {
        this.myRespawn += dt;
        if (this.myRespawn > 1.5) { this.myRespawn = 0; const sp = HT.SPAWN[0]; me.x = sp.x; me.y = sp.y; me.alive = true; R.setTanks(sim.tanks.map((tk, s) => ({ slot: s, radius: tk.radius, look: this.looks[s], x: tk.x, y: tk.y }))); }
      }
      $('hud-sub').textContent = 'あてた数 ' + this.hits;
      // 練習ではサドンデスなし
      const guides = []; if (me.alive) {
        const off = me.radius + me.bradius + 0.06;
        guides.push({ pts: sim.trace(me.x + Math.cos(me.aim) * off, me.y + Math.sin(me.aim) * off, me.aim, me.speed, me.bradius, Math.max(1, me.bounces), 40 / me.speed, 0).pts, color: 0xffffff });
      }
      R.setGuides(guides);
      R.sync(sim, dt);
    }
    pause(v) { this.paused = v; }
    destroy() { input.reset(); document.body.classList.remove('prac'); }
  }

  // =============================================
  //  モード：せんしゃの見た目
  // =============================================
  class Showcase {
    constructor() {
      const sim = this.sim = new HT.Sim(0);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) sim.setTile(x, y, T.EMPTY);
      R.clearDynamic(); R.buildStage(sim);
      this.t = 0;
      sim.addTank(0, HT.defaultSkills());
      const tk = sim.tanks[0]; tk.x = W / 2 + 1.6; tk.y = H / 2;
      this.draw(); this.buildUI();
      show('custom');
      R.setZoom(W / 2 + 0.2, H / 2 - 0.4);
    }
    get look() { return this.who === 1 ? look2 : look1; }
    setLook(l) { if (this.who === 1) { look2 = l; store.set('look2', l); } else { look1 = l; store.set('look', l); } this.draw(); this.buildUI(); }
    draw() {
      const tk = this.sim.tanks[0];
      tk.slot = this.who || 0;
      // 2Pの砲台は六角形（1Pは丸）
      R.setTanks([{ slot: this.who || 0, radius: tk.radius * 1.5, look: toLook(this.look), x: tk.x, y: tk.y }]);
    }
    buildUI() {
      document.querySelectorAll('#cu-tabs button').forEach(b => {
        b.classList.toggle('sel', +b.dataset.p === (this.who || 0));
        b.onclick = () => { this.who = +b.dataset.p; this.draw(); this.buildUI(); };
      });
      const L = this.look;
      const cs = $('cu-colors'); cs.innerHTML = '';
      COLORS.forEach((c, i) => {
        const b = document.createElement('button'); b.style.background = c; b.classList.toggle('sel', L.c === i);
        b.onclick = () => this.setLook({ ...L, c: i });
        cs.appendChild(b);
      });
      const ps = $('cu-patterns'); ps.innerHTML = '';
      PATTERNS.forEach((p, i) => {
        const b = document.createElement('button'); b.textContent = PAT_ICON[i]; b.classList.toggle('sel', L.p === i);
        b.onclick = () => this.setLook({ ...L, p: i });
        ps.appendChild(b);
      });
      $('cu-note2').textContent = this.who === 1 ? '同じPCで2人で遊ぶときの2Pの戦車です。1Pと同じ色にすると、2Pは別の色になります。' : '';
    }
    update(dt) {
      this.t += dt;
      const tk = this.sim.tanks[0];
      tk.a = this.t * 0.6; tk.aim = this.t * 0.6 + Math.sin(this.t * 1.3) * 0.8;
      if (Math.random() < dt * 0.7) { const e = { type: 'fire', slot: this.who || 0, x: tk.x + Math.cos(tk.aim) * 0.9, y: tk.y + Math.sin(tk.aim) * 0.9, a: tk.aim }; HT.Sound.setQuiet(true); R.handle(e, this.sim); HT.Sound.setQuiet(false); }
      R.sync(this.sim, dt);
    }
    destroy() { R.setZoom(null); }
  }

  // =============================================
  //  モード：あいことばオンライン
  // =============================================
  let fbPromise = null;
  function loadScript(src) {
    return new Promise((ok, ng) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ng(new Error('load')); document.head.appendChild(s); });
  }
  function getDB() {
    if (window.HT_TEST_DB) return Promise.resolve(window.HT_TEST_DB); // 自動テスト用
    if (!fbPromise) fbPromise = (async () => {
      const v = '10.12.2';
      await loadScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-database-compat.js');
      if (!firebase.apps.length) firebase.initializeApp(HT.FIREBASE_CONFIG);
      return firebase.database();
    })().catch(e => { fbPromise = null; throw e; });
    return fbPromise;
  }
  const skStr = s => '' + s.speed + s.bounce + s.size + s.bsize;
  const skParse = str => { const a = String(str || '').split('').map(Number); const ok = a.length === 4 && a.every(v => v >= 1 && v <= 7); return ok ? { speed: a[0], bounce: a[1], size: a[2], bsize: a[3] } : HT.defaultSkills(); };
  const blStr = l => l.map(b => b.x + '.' + b.y + '.' + b.k).join('|');
  const blParse = str => String(str || '').split('|').filter(Boolean).map(p => { const [x, y, k] = p.split('.').map(Number); return { x, y, k }; }).filter(b => b.x > 0 && b.y > 0 && b.x < W - 1 && b.y < H - 1 && (b.k === T.HARD || b.k === T.SOFT)).slice(0, C.BLOCKS_HARD + C.BLOCKS_SOFT);

  class OnlineMatch {
    constructor(room) {
      this.room = room; this.me = room.slot; this.watch = room.slot < 0;
      this.g = null; this.key = null; this.phase = 'wait';
      this.skills = HT.defaultSkills(); this.blocks = [];
      this.pickTimer = null;
      input.setMode('single');
      document.body.classList.toggle('can-stamp', !this.watch);
      room.cb = {
        onPeople: p => this.onPeople(p),
        onGame: g => this.onGame(g),
        onPick: () => this.refreshOpp(),
        onReady: () => {},
        onState: (s, st) => { if (this.b && st.k === this.key) this.b.pushRemote(s, st); },
        onEvent: (s, e) => this.onEvent(s, e),
        onStamp: (s, k) => stampBubble(s, k),
        onOppWait: v => { if (v) banner('相手の通信を待っています…', 'warn small', 0); else hideBanner(); },
        onRejoined: () => this.rejoined(),
        onOppLeft: () => this.oppLeft(),
        onKicked: () => this.kicked()
      };
      this.onPeople(room.people());
      if (this.me === 0) {
        const old = room.game;
        room.setGame({ ph: 'lobby', m: ((old && old.m) || 0) + 1 });
      }
      this.onGame(room.game);
      this.dirTimer = setInterval(() => this.direct(), 250);
    }
    clock() { return this.room.now(); }
    oppSlot() { return this.me === 0 ? 1 : 0; }
    people() { return this.room.people(); }
    nameOf(s) { const p = this.room.players[s]; return p ? p.name : '…'; }
    looksNow() {
      const p = this.room.players;
      const l = [p[0] ? parseLook(p[0].look) : { c: 0, p: 0 }, p[1] ? parseLook(p[1].look) : { c: 1, p: 0 }];
      // 自分の色は、自分でえらんだ色のまま。かぶったら相手の色を変えて見せる
      if (this.me === 1) { const r = pairLooks(l[1], l[0]); return [r[1], r[0]]; }
      return pairLooks(l[0], l[1]);
    }
    onPeople(p) {
      const both = p.players[0] && p.players[1];
      if (this.phase === 'wait' || this.phase === 'lobby') {
        if (!both) {
          $('wait-code').textContent = this.room.code;
          hideBanner();
          $('wait-note').textContent = this.watch ? '対戦する2人がそろうのを待っています（観戦）' : '招待リンクを送るか、相手に同じあいことばを入れてもらってね';
          show('wait');
        }
      }
      const looks = this.looksNow(); setSideColors(looks);
      const meName = s => (s === this.me ? this.nameOf(s) + '（あなた）' : this.nameOf(s));
      setNames(meName(0), meName(1));
      const nb = $('net-badge');
      nb.classList.toggle('hidden', false);
      nb.textContent = (this.watch ? '観戦中・' : '') + (p.p2p ? '直接つながっています' : 'サーバー経由') + (p.watchers ? '・観戦 ' + p.watchers + '人' : '');
    }
    myPick() { return this.room.picks[this.me]; }
    oppPick() { return this.room.picks[this.oppSlot()]; }
    pickKey(g) { return g.m + '_' + g.n; }
    refreshOpp() {}
    oppText(kind) {
      if (this.watch) return '';
      const g = this.g; if (!g) return '';
      const op = this.oppPick();
      const ok = op && op.mk === this.pickKey(g) && (kind === 'skill' ? op.ok : op.ok2);
      return '相手：' + (ok ? '準備OK' : 'えらんでいます…');
    }
    writePick(extra) {
      if (this.watch || !this.g) return;
      const g = this.g;
      const cur = this.myPick() && this.myPick().mk === this.pickKey(g) ? this.myPick() : {};
      const p = { mk: this.pickKey(g), s: skStr(this.skills), bl: blStr(this.blocks), ok: cur.ok || 0, ok2: cur.ok2 || 0, ...extra };
      this.room.setPick(p);
    }

    // ---------- 進行（0番の人が書く） ----------
    direct() {
      if (this.me !== 0 || this.room.left) return;
      const r = this.room, g = r.game, now = r.now();
      const both = r.players[0] && r.players[1];
      if (!g) return;
      const picks = r.picks, pk = this.pickKey(g);
      const pickOk = (s, f) => picks[s] && picks[s].mk === pk && picks[s][f];
      if (g.ph === 'lobby') {
        if (both) r.setGame({ ph: 'skill', m: g.m, n: 1, w: [0, 0], st: Math.floor(Math.random() * 3), ord: shuffle([0, 1, 2]).join(''), end: now + C.SKILL_TIME * 1000 + 600 });
        return;
      }
      if (!both) return;
      if (g.ph === 'skill') {
        if ((pickOk(0, 'ok') && pickOk(1, 'ok')) || now > g.end + 800) r.setGame({ ...g, ph: 'place', end: now + C.PLACE_TIME * 1000 + 600 });
      } else if (g.ph === 'place') {
        if ((pickOk(0, 'ok2') && pickOk(1, 'ok2')) || now > g.end + 800) {
          const pts = C.SKILL_POINTS[Math.min(g.n - 1, 2)];
          const pkObj = {};
          for (const s of [0, 1]) {
            let sk = picks[s] && picks[s].mk === pk ? skParse(picks[s].s) : HT.defaultSkills();
            if (HT.skillCost(sk) > pts) sk = HT.defaultSkills();
            pkObj[s] = { s: skStr(sk), bl: picks[s] && picks[s].mk === pk ? picks[s].bl || '' : '' };
          }
          r.setGame({ ...g, ph: 'battle', tr: 0, go: now + 3600, pk: pkObj, res: null });
        }
      } else if (g.ph === 'battle') {
        // 勝ち負けの判定は、最初にやられてから少し待ってから
        const dd = this.b && this.b.deaths;
        const bothKnown = dd && dd[0] != null && dd[1] != null;
        if (this.b && this.b.key === this.key && this.firstDeathAt && !this.decided && (performance.now() - this.firstDeathAt > 1400 || (bothKnown && performance.now() - this.firstDeathAt > 300))) {
          this.decided = true;
          const d = this.b.deaths;
          let win;
          if (d[0] != null && d[1] != null && Math.abs(d[0] - d[1]) <= C.DRAW_WINDOW) win = -1;
          else if (d[0] != null && (d[1] == null || d[0] < d[1])) win = 1;
          else win = 0;
          if (win === -1) r.setGame({ ...g, tr: (g.tr || 0) + 1, go: now + 3000, draw: 1 });
          else {
            const w = [g.w[0], g.w[1]]; w[win]++;
            r.setGame({ ...g, ph: 'result', res: win, w, at: now });
          }
        }
        // 長すぎる戦い（通常はサドンデスで終わる）
        if (now - g.go > (C.SUDDEN_TIME + 40) * 1000 && !this.decided) { this.decided = true; r.setGame({ ...g, tr: (g.tr || 0) + 1, go: now + 3000, draw: 1 }); }
      } else if (g.ph === 'result') {
        const key = 'nx' + pk, rd = r.rd;
        if ((rd[0] === key && rd[1] === key) || now > g.at + 20000) {
          if (Math.max(g.w[0], g.w[1]) >= C.WINS_NEEDED) r.setGame({ ...g, ph: 'final', at: now });
          else {
            const n = g.n + 1, ord = String(g.ord || '012');
            r.clearEvents(this.key);
            r.setGame({ ph: 'skill', m: g.m, n, w: g.w, st: +ord[(n - 1) % 3], ord, end: now + C.SKILL_TIME * 1000 + 600 });
          }
        }
      } else if (g.ph === 'final') {
        const key = 'ag' + g.m, rd = r.rd;
        if (rd[0] === key && rd[1] === key) {
          r.clearEvents(this.key);
          const ord = shuffle([0, 1, 2]).join('');
          r.setGame({ ph: 'skill', m: g.m + 1, n: 1, w: [0, 0], st: +ord[0], ord, end: now + C.SKILL_TIME * 1000 + 600 });
        }
      }
    }

    // ---------- 進行に合わせて画面を変える ----------
    onGame(g) {
      if (!g || this.room.left || this.phase === 'kicked') return;
      const prev = this.g; this.g = g;
      const sameMatch = prev && prev.m === g.m && prev.n === g.n;
      if (g.ph === 'lobby') { if (this.phase !== 'left') this.phase = 'lobby'; this.onPeople(this.room.people()); return; }
      if (g.ph === 'skill') {
        if (this.phase === 'skill' && sameMatch) return;
        this.enterSkill(g);
      } else if (g.ph === 'place') {
        if (this.phase === 'place' && sameMatch) return;
        if (this.phase !== 'skill' || !sameMatch) this.skills = this.myPick() ? skParse(this.myPick().s) : this.skills;
        this.enterPlace(g);
      } else if (g.ph === 'battle') {
        const key = g.m + '_' + g.n + '_' + (g.tr || 0);
        if (this.key === key && this.b) return;
        this.enterBattle(g, key);
      } else if (g.ph === 'result') {
        if (this.phase === 'result' && sameMatch) return;
        this.enterResult(g, false);
      } else if (g.ph === 'final') {
        if (this.phase === 'final' && prev && prev.m === g.m) return;
        this.enterResult(g, true);
      }
    }
    titleSub(g) { return g.n + '戦目・ステージ：' + HT.STAGES[g.st].name + '（' + C.SKILL_POINTS[Math.min(g.n - 1, 2)] + 'pt）'; }
    enterSkill(g) {
      this.stopReplay();
      this.phase = 'skill'; this.b = null; hud(false);
      this.skills = HT.defaultSkills(); this.blocks = [];
      R.clearDynamic(); R.buildStage(new HT.Sim(g.st)); R.setTanks([]);
      if (this.watch) { this.watchScreen('スキルをえらんでいます…', g); return; }
      this.writePick({ ok: 0, ok2: 0 });
      SkillUI.open({
        points: C.SKILL_POINTS[Math.min(g.n - 1, 2)], skills: this.skills, title: 'スキルをふろう', sub: this.titleSub(g),
        deadline: () => (g.end - 600 - this.clock()) / 1000,
        oppText: () => this.oppText('skill'),
        onChange: s => { this.skills = s; this.debouncePick(); },
        onReady: (v, s) => { this.skills = s; this.writePick({ ok: v ? 1 : 0 }); }
      });
    }
    debouncePick() { clearTimeout(this.pickTimer); this.pickTimer = setTimeout(() => this.writePick({}), 150); }
    enterPlace(g) {
      this.stopReplay();
      this.phase = 'place'; hud(false);
      if (this.watch) { this.watchScreen('ブロックを置いています…', g); return; }
      if (current === 'skill') this.skills = { ...SkillUI.s };
      this.writePick({ ok: 1 });
      const st = HT.statsFrom(this.skills);
      PlaceUI.open({
        stage: g.st, slot: this.me, look: toLook(this.looksNow()[this.me]), radius: st.radius, blocks: [],
        title: 'ブロックを置こう', deadline: () => (g.end - 600 - this.clock()) / 1000,
        oppText: () => this.oppText('place'),
        onChange: l => { this.blocks = l; this.debouncePick(); },
        onReady: (v, l) => { this.blocks = l; this.writePick({ ok2: v ? 1 : 0 }); }
      });
    }
    watchScreen(text, g) {
      show(null); hud(true); setPips(g.w || [0, 0]);
      $('hud-timer').textContent = g.n + '戦目'; $('hud-sub').textContent = HT.STAGES[g.st].name;
      banner(text, '', 0);
    }
    enterBattle(g, key) {
      this.stopReplay();
      PlaceUI.close(); hideBanner();
      this.phase = 'battle'; this.key = key; this.decided = false; this.firstDeathAt = null;
      this.room.listenBattle(key);
      show(null); hud(true); setPips(g.w);
      const skills = [skParse(g.pk[0].s), skParse(g.pk[1].s)];
      const blocks = [blParse(g.pk[0].bl), blParse(g.pk[1].bl)];
      this.battleSkills = skills;
      const ctrl = [0, 1].map(s => (s === this.me ? 'human' : 'remote'));
      const looks = this.looksNow();
      this.b = new Battle({
        stage: g.st, skills, blocks, looks: looks.map(toLook), ctrl, goAt: g.go, clock: () => this.clock(),
        remoteDelay: () => (this.room.p2p ? 0.1 : 0.22),
        onLocalEvent: (e, sim) => this.localEvent(e, sim),
        onDeath: () => { if (!this.firstDeathAt) this.firstDeathAt = performance.now(); },
        onEnd: () => {}
      });
      this.b.key = key;
      if (g.draw && g.tr) banner('ひきわけ！ もう一回', '', 1800);
      this.lastSend = 0;
    }
    localEvent(e, sim) {
      if (this.watch) return;
      const t = sim.tanks[this.me];
      if (e.type === 'fire' && e.slot === this.me && e.bullet) {
        const b = e.bullet;
        this.room.sendEvent({ t: 'f', i: b.id, x: +e.x.toFixed(3), y: +e.y.toFixed(3), vx: +b.vx.toFixed(3), vy: +b.vy.toFixed(3), r: b.r, b: b.left, T: +e.T.toFixed(3), a: +e.a.toFixed(3) });
      } else if (e.type === 'mine' && e.mine.owner === this.me) {
        const m = e.mine; this.room.sendEvent({ t: 'm', i: m.id, x: +m.x.toFixed(3), y: +m.y.toFixed(3), t0: +m.t0.toFixed(3) });
      } else if (e.type === 'blast' && e.owner === this.me) {
        this.room.sendEvent({ t: 'x', i: e.id, x: +e.x.toFixed(3), y: +e.y.toFixed(3) });
      } else if (e.type === 'die' && e.slot === this.me && t && t.local) {
        this.room.sendEvent({ t: 'd', T: +(e.T != null ? e.T : sim.time).toFixed(3), x: +e.x.toFixed(3), y: +e.y.toFixed(3), w: e.why || '' });
      }
    }
    onEvent(s, e) {
      const b = this.b; if (!b || e.k !== this.key) return;
      const sim = b.sim;
      if (e.t === 'f') {
        const adv = clamp(sim.time - e.T, 0, 0.4);
        const bl = sim.spawnBullet({ id: e.i, owner: s, x: e.x, y: e.y, vx: e.vx, vy: e.vy, r: e.r, b: e.b }, adv);
        sim.emit({ type: 'fire', slot: s, x: e.x, y: e.y, a: e.a != null ? e.a : Math.atan2(e.vy, e.vx), bullet: bl, remote: true });
      } else if (e.t === 'm') {
        sim.addMine({ id: e.i, owner: s, x: e.x, y: e.y, t0: e.t0 });
      } else if (e.t === 'x') {
        if (sim.mines.some(m => m.id === e.i)) sim.remoteBlast(e.i);
        else { sim.emit({ type: 'blast', id: e.i, x: e.x, y: e.y, owner: s }); sim.applyBlast(e.x, e.y); }
      } else if (e.t === 'd') {
        const t = sim.tanks[s];
        if (t && t.alive) { t.x = e.x; t.y = e.y; sim.killTank(t, e.w); }
        b.deaths[s] = e.T; // やられた本人の時刻を使う
        if (b.firstDeath == null || e.T < b.firstDeath) { b.firstDeath = e.T; b.deathPos = { x: e.x, y: e.y }; }
        if (!this.firstDeathAt) this.firstDeathAt = performance.now();
      } else if (e.t === 's') {
        stampBubble(s, e.s);
      }
    }
    stamp(k) {
      if (this.watch) return;
      stampBubble(this.me, k);
      this.room.sendStamp(k);
    }
    rejoined() {
      toast('通信が戻りました');
      if (this.phase === 'skill') this.writePick({ ok: SkillUI.ready ? 1 : 0, ok2: 0 });
      else if (this.phase === 'place') this.writePick({ ok: 1, ok2: PlaceUI.ready ? 1 : 0 });
      else if (this.pressed) this.room.setReady(this.pressed);
    }
    stopReplay() { if (this.rp) { const r = this.rp; this.rp = null; r.onDone = null; r.finish(); } }
    enterResult(g, final) {
      const b = this.b;
      if (b && !b.result) b.finish({ winner: g.res });
      this.phase = final ? 'final' : 'result';
      const delay = b && b.ending < 2 ? (2.1 - b.ending) * 1000 : 0;
      clearTimeout(this.resTimer);
      this.resTimer = setTimeout(() => this.showResult(g, final), delay);
    }
    showResult(g, final) {
      if (this.g !== g && !(this.g && this.g.ph === g.ph && this.g.m === g.m && this.g.n === g.n)) return;
      // 決着の場面を1回だけ自動でリプレイしてから結果を出す
      const rk = g.m + '_' + g.n;
      if (this.b && this.b.clip && this.b.clip.frames.length > 5 && this.autoRp !== rk) { this.autoRp = rk; this.replay(g, final, true); return; }
      R.setZoom(null);
      const me = this.me, op = this.oppSlot(), looks = this.looksNow();
      const won = g.res === me;
      const sk = this.battleSkills || [HT.defaultSkills(), HT.defaultSkills()];
      let title, cls, cards, record = '';
      if (this.watch) {
        title = (final ? this.nameOf(g.res) + ' の勝ち！' : this.nameOf(g.res) + ' のかち'); cls = 'win';
        cards = [{ title: this.nameOf(0), color: COLORS[looks[0].c], skills: sk[0] }, { title: this.nameOf(1), color: COLORS[looks[1].c], skills: sk[1] }];
      } else {
        title = final ? (won ? 'あなたの勝ち！' : 'あいての勝ち…') : (won ? 'かち！' : 'まけ…'); cls = won ? 'win' : 'lose';
        cards = [{ title: 'あいて（' + this.nameOf(op) + '）の戦車', color: COLORS[looks[op].c], skills: sk[op] }, { title: 'あなたの戦車', color: COLORS[looks[me].c], skills: sk[me] }];
        if (!this.soundDone || this.soundDone !== g.m + '_' + g.n) { this.soundDone = g.m + '_' + g.n; (won ? HT.Sound.win : HT.Sound.lose)(); }
        if (final) record = this.record(won, g);
      }
      setPips(g.w);
      const wins = this.watch ? g.w : [g.w[0], g.w[1]];
      const nextBtn = this.watch ? null : final
        ? { text: 'もう一回', fn: btn => { this.pressed = 'ag' + g.m; this.room.setReady(this.pressed); btn.classList.add('waiting'); btn.textContent = '相手を待っています…'; } }
        : { text: 'つぎへ（' + (g.n + 1) + '戦目）', fn: btn => { this.pressed = 'nx' + this.pickKey(g); this.room.setReady(this.pressed); btn.classList.add('waiting'); btn.textContent = '相手を待っています…'; } };
      ResultUI.show({
        title, cls, wins, cards, record, next: nextBtn,
        replay: b => this.replay(g, final),
        toTitle: final || this.watch ? () => goTitle() : null,
        note: final ? '' : (this.watch ? '' : '20秒たつと自動で次へ進みます')
      });
      $('res-score').innerHTML = `<span class="s0">${g.w[0]}</span> - <span class="s1">${g.w[1]}</span>`;
      const want = final ? 'ag' + g.m : 'nx' + this.pickKey(g);
      if (this.pressed === want) { const nx = $('res-next'); nx.classList.add('waiting'); nx.textContent = '相手を待っています…'; }
    }
    record(won, g) {
      const op = this.room.players[this.oppSlot()];
      if (!op) return '';
      const rec = store.get('rec', {}); const k = op.pid || 'x';
      rec[k] = rec[k] || { w: 0, l: 0 };
      if (this.recorded !== g.m) { this.recorded = g.m; rec[k][won ? 'w' : 'l']++; rec[k].n = op.name; store.set('rec', rec); }
      return op.name + ' との通算：' + rec[k].w + '勝 ' + rec[k].l + '敗';
    }
    replay(g, final, auto) {
      const b = this.b; if (!b || !b.clip) return;
      show(null); hud(false);
      this.rp = new ReplayPlayer(b.clip, b.tankInfo(), g.st, () => { this.rp = null; b.restoreView(); hud(true); if (this.g && (this.g.ph === 'result' || this.g.ph === 'final')) this.showResult(this.g, this.g.ph === 'final'); });
    }
    oppLeft() {
      if (this.watch || this.room.left) return;
      if (!this.g || this.g.ph === 'lobby' || this.phase === 'wait' || this.phase === 'lobby') return;
      if (this.phase === 'final') { toast('相手が抜けました'); return; }
      PlaceUI.close(); this.stopReplay(); hideBanner();
      this.phase = 'left'; this.b && !this.b.result && (this.b.result = { winner: this.me });
      const op = this.room.players[this.oppSlot()];
      HT.Sound.win();
      ResultUI.show({ title: 'あなたの勝ち！', cls: 'win', wins: null, cards: [], record: '', note: '相手がいなくなったので、あなたの勝ちです。このまま待つと、同じあいことばで入ってきた人と対戦できます。', next: null, replay: null, toTitle: () => goTitle() });
      if (this.me === 0) this.room.setGame({ ph: 'lobby', m: ((this.g && this.g.m) || 0) + 1 });
    }
    kicked() {
      if (this.phase === 'kicked') return;
      this.phase = 'kicked'; PlaceUI.close(); this.stopReplay(); hud(false); this.room.leave();
      ResultUI.show({ title: '通信が切れました', cls: 'draw', wins: null, cards: [], record: '', note: '通信が切れたため、対戦から外れました。もう一度あいことばを入れて入り直してください。', next: null, replay: null, toTitle: () => goTitle() });
    }
    update(dt) {
      if (this.phase === 'kicked') { R.sync({ tanks: [], bullets: [], mines: [], time: 0, warnRing: 0 }, dt); return; }
      if (this.rp) { this.rp.update(dt); return; }
      if (this.phase === 'skill') { SkillUI.tick(); R.sync({ tanks: [], bullets: [], mines: [], time: 0, warnRing: 0 }, dt); }
      else if (this.phase === 'place') {
        PlaceUI.tick(dt);
        if (this.g && this.clock() > this.g.end - 600 && !PlaceUI.ready) { PlaceUI.ready = true; PlaceUI.draw(); this.writePick({ ok2: 1 }); }
      }
      else if (this.b) {
        this.b.update(dt);
        if (!this.watch && this.b.started && !this.b.result) {
          const t = performance.now();
          if (t - this.lastSend > (this.room.p2p ? 33 : 50)) { this.lastSend = t; const tk = this.b.sim.tanks[this.me]; if (tk.alive) this.room.sendState(this.b.stateOf(this.me)); }
        }
      } else R.sync({ tanks: [], bullets: [], mines: [], time: 0, warnRing: 0 }, dt);
      // スキルの時間切れ：自動で準備OK
      if (this.phase === 'skill' && this.g && !this.watch && this.clock() > this.g.end - 600 && !SkillUI.ready) { SkillUI.ready = true; SkillUI.draw(); this.writePick({ ok: 1 }); }
    }
    destroy() { clearInterval(this.dirTimer); clearTimeout(this.resTimer); clearTimeout(this.pickTimer); PlaceUI.close(); this.room.leave(); $('net-badge').classList.add('hidden'); document.body.classList.remove('can-stamp'); }
  }

  // =============================================
  //  全体の流れ
  // =============================================
  let game = null;
  function setGame(g) { if (game && game.destroy) game.destroy(); game = g; setFlip(g instanceof OnlineMatch && g.me === 1); document.body.classList.remove('live'); document.body.classList.toggle('in-game', !(g instanceof Demo) && !(g instanceof Showcase)); }
  function goTitle() {
    hud(false); input.reset(); input.enabled = false; hideBanner(); $('count').textContent = '';
    document.body.classList.remove('can-stamp');
    setGame(new Demo());
    show('title');
  }
  function startLocal(mode, level) {
    if (mode === 'local2' && isTouch && !(navigator.getGamepads && Array.from(navigator.getGamepads()).filter(Boolean).length)) toast('ふたりで遊ぶにはキーボードかコントローラーが必要です', 3200);
    hud(false);
    setGame(new LocalMatch(mode, level));
    tryFullscreen();
  }
  function tryFullscreen() {
    if (!isTouch) return;
    const el = document.documentElement;
    try { if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {}); } catch (e) {}
  }

  document.querySelectorAll('.btn.lv').forEach(b => b.addEventListener('click', () => startLocal('cpu', b.dataset.level)));
  $('btn-local').onclick = () => startLocal('local2', 'normal');
  $('btn-practice').onclick = () => { setGame(new Practice()); tryFullscreen(); };
  $('btn-custom').onclick = () => setGame(new Showcase());
  $('btn-howto').onclick = () => show('howto');
  $('btn-online').onclick = () => { $('in-name').value = store.get('name', ''); $('in-code').value = store.get('code', ''); $('online-err').textContent = ''; show('online'); };
  document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { if (game instanceof Showcase) goTitle(); else show('title'); }));
  $('btn-dice').onclick = () => { $('in-code').value = String(1000 + Math.floor(Math.random() * 9000)); };

  async function joinOnline(watch) {
    const name = $('in-name').value.trim(), code = HT.cleanCode($('in-code').value);
    const err = $('online-err');
    if (!code) { err.textContent = 'あいことばを入れてください'; return; }
    store.set('name', name); store.set('code', code);
    err.textContent = 'つないでいます…';
    $('btn-join').disabled = $('btn-watch').disabled = true;
    try {
      const db = await Promise.race([getDB(), new Promise((_, ng) => setTimeout(() => ng(new Error('timeout')), 12000))]);
      const room = new HT.Room(db, code, name, { pid, look: lookStr(look1), watch }, {});
      await Promise.race([room.join(), new Promise((_, ng) => setTimeout(() => ng(new Error('timeout')), 12000))]);
      err.textContent = '';
      if (room.slot < 0 && !watch) toast('2人そろっているので観戦します');
      setGame(new OnlineMatch(room));
      tryFullscreen();
    } catch (e) {
      console.error(e);
      err.textContent = 'つながりませんでした。通信を確認して、もう一度ためしてください。';
    } finally { $('btn-join').disabled = $('btn-watch').disabled = false; }
  }
  $('btn-join').onclick = () => joinOnline(false);
  $('btn-watch').onclick = () => joinOnline(true);
  $('btn-wait-leave').onclick = () => goTitle();
  // 招待リンク：押すだけで同じ部屋に入れるURLを送る
  function inviteUrl(code) {
    const base = location.protocol.startsWith('http') ? location.origin + location.pathname : 'https://nasubi-no-oniwa.github.io/hanetank/';
    return base + '?room=' + encodeURIComponent(code);
  }
  $('btn-copy').onclick = () => {
    const code = $('wait-code').textContent, url = inviteUrl(code);
    const text = 'ハネタンクで対戦しよう！ あいことば：' + code;
    if (navigator.share) { navigator.share({ title: 'ハネタンク', text, url }).catch(() => {}); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(text + '\n' + url) : Promise.reject()).then(() => toast('招待リンクをコピーしました。LINEなどに貼って送ってね')).catch(() => toast(url, 5000));
  };

  // メニュー
  const QNAMES = { auto: 'じどう', high: '高', mid: '中', low: '低' };
  function drawMenu() {
    $('mn-sound').textContent = '音：' + (HT.Sound.on ? 'オン' : 'オフ');
    $('mn-quality').textContent = '画質：' + QNAMES[qSetting];
    $('mn-vib').textContent = '振動：' + (vibOn ? 'オン' : 'オフ');
    $('mn-vib').classList.toggle('hidden', !canVibrate);
    $('mn-quit').textContent = game instanceof OnlineMatch ? '対戦をぬける' : 'タイトルへ';
  }
  let menuReturn = null;
  $('btn-menu').onclick = () => {
    menuReturn = current;
    if (game && game.pause) game.pause(true);
    drawMenu(); show('menu');
  };
  $('mn-resume').onclick = () => { show(menuReturn); if (game && game.pause) game.pause(false); };
  $('mn-sound').onclick = () => { HT.Sound.toggle(); drawMenu(); };
  $('mn-vib').onclick = () => { vibOn = !vibOn; store.set('vib', vibOn); drawMenu(); vibrate(40); };
  $('mn-quality').onclick = () => {
    const order = ['auto', 'high', 'mid', 'low']; qSetting = order[(order.indexOf(qSetting) + 1) % 4]; store.set('q', qSetting);
    R.setQuality(autoQuality()); drawMenu();
  };
  $('mn-quit').onclick = () => goTitle();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game && game.pause && !(game instanceof OnlineMatch) && current !== 'menu' && (game instanceof LocalMatch || game instanceof Practice)) {
      menuReturn = current; game.pause(true); drawMenu(); show('menu');
    }
  });
  $('layer').addEventListener('pointerdown', () => { $('stamp-pal').classList.add('hidden'); if (game && game.rp) game.rp.finish(); });
  window.addEventListener('keydown', e => { if (game && game.rp && ['Space', 'Enter', 'Escape'].includes(e.code)) game.rp.finish(); });

  // ---------- 毎フレーム ----------
  let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = 0, lowStreak = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000; last = now;
    const dt = Math.min(0.05, Math.max(0, raw));
    try { if (game) game.update(dt); } catch (e) { console.error(e); }
    if (bubbles.length) updateBubbles(game && game.b && !game.rp ? game.b.sim : null);
    R.render();
    // 重い端末は自動で画質を下げる
    if (qSetting === 'auto' && raw < 0.5 && !document.hidden) {
      fpsAcc += raw; fpsN++; fpsT += raw;
      if (fpsT > 3) {
        const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; fpsT = 0;
        if (fps < 40) lowStreak++; else lowStreak = 0;
        if (lowStreak >= 1 && R.qName !== 'low') { R.setQuality(R.qName === 'high' ? 'mid' : 'low'); lowStreak = 0; toast('なめらかに動くよう画質を下げました'); }
      }
    }
  }
  goTitle();
  requestAnimationFrame(frame);
  // 招待リンクから来たとき：あいことばを入れた状態で対戦の画面を開く
  try {
    const room = new URLSearchParams(location.search).get('room');
    if (room && HT.cleanCode(room)) {
      $('btn-online').onclick();
      $('in-code').value = HT.cleanCode(room);
      toast('招待されました！なまえを入れて「対戦する」を押してね', 4000);
    }
  } catch (e) {}

  // テスト用の入口
  HT._debug = { get game() { return game; }, R, input, LocalMatch, OnlineMatch, Practice, Demo, Showcase, startLocal, goTitle, setGame, show, getDB, joinOnline, store };
})();
