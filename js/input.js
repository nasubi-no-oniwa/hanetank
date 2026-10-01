// =============================================
//  操作（タッチ・マウス・キーボード・コントローラー）
//  移動は mx,my（-1〜1）、砲台は aim（ラジアン。0=右、π/2=手前）
// =============================================
(function () {
  const KEYMAP = {
    single: {
      up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
      tl: ['KeyQ'], tr: ['KeyE'], fire: ['KeyF', 'Enter'], mine: ['Space', 'KeyG']
    },
    p1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], tl: ['KeyQ'], tr: ['KeyE'], fire: ['KeyF'], mine: ['KeyG'] },
    p2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], tl: ['Comma'], tr: ['Period'], fire: ['Slash'], mine: ['ShiftRight'] }
  };
  const TURRET_TURN = 3.2; // キーでの砲台の回る速さ
  const DEAD = 0.22;       // スティックの遊び

  class Input {
    constructor(renderer, layer) {
      this.r = renderer; this.layer = layer;
      this.keys = new Set(); this.pressed = new Set();
      this.mode = 'single';
      this.enabled = false;
      this.mouse = null; this.mouseDown = false; this.lastDevice = 'mouse';
      this.touchMove = null; this.touchAim = null;
      this.pending = [{ fire: false, mine: false }, { fire: false, mine: false }];
      this.aim = [0, Math.PI];
      this.padPrev = [{}, {}];
      this.guideOn = [false, false];
      this.onPlaceClick = null; this.onHover = null;
      this.bind();
    }
    setMode(mode) { this.mode = mode; this.reset(); }
    reset() {
      this.keys.clear(); this.pending = [{ fire: false, mine: false }, { fire: false, mine: false }];
      this.touchMove = null; this.touchAim = null; this.mouseDown = false;
      this.updateStickUI();
    }
    setAim(i, a) { this.aim[i] = a; }

    bind() {
      window.addEventListener('keydown', e => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (!this.keys.has(e.code)) this.pressed.add(e.code);
        this.keys.add(e.code);
        if (this.enabled && (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Slash')) e.preventDefault();
        this.lastDevice = this.lastDevice === 'touch' ? 'touch' : this.lastDevice;
        const m = this.mode === 'local2' ? null : KEYMAP.single;
        if (this.enabled) {
          if (this.mode === 'local2') {
            if (KEYMAP.p1.fire.includes(e.code) && !e.repeat) this.pending[0].fire = true;
            if (KEYMAP.p1.mine.includes(e.code) && !e.repeat) this.pending[0].mine = true;
            if (KEYMAP.p2.fire.includes(e.code) && !e.repeat) this.pending[1].fire = true;
            if (KEYMAP.p2.mine.includes(e.code) && !e.repeat) this.pending[1].mine = true;
          } else {
            if (m.fire.includes(e.code) && !e.repeat) this.pending[0].fire = true;
            if (m.mine.includes(e.code) && !e.repeat) this.pending[0].mine = true;
          }
        }
      });
      window.addEventListener('keyup', e => this.keys.delete(e.code));
      window.addEventListener('blur', () => this.keys.clear());

      const L = this.layer;
      L.addEventListener('contextmenu', e => e.preventDefault());
      L.addEventListener('pointerdown', e => this.down(e));
      window.addEventListener('pointermove', e => this.move(e));
      window.addEventListener('pointerup', e => this.up(e));
      window.addEventListener('pointercancel', e => this.up(e, true));
      // スマホの指はタッチイベントで受け取る（iPhoneで指を離したのが届かず、スティックが固まるのを防ぐ）
      const opt = { passive: false };
      L.addEventListener('touchstart', e => this.tStart(e), opt);
      window.addEventListener('touchmove', e => this.tMove(e), opt);
      window.addEventListener('touchend', e => this.tEnd(e, false), opt);
      window.addEventListener('touchcancel', e => this.tEnd(e, true), opt);
    }

    // ---------- マウス / タッチ ----------
    down(e) {
      HT.Sound.init();
      if (e.pointerType === 'mouse') {
        this.lastDevice = 'mouse';
        this.mouse = { x: e.clientX, y: e.clientY };
        if (this.onPlaceClick && e.button === 0) { this.onPlaceClick(e.clientX, e.clientY, e.button); return; }
        if (this.onPlaceClick && e.button === 2) { this.onPlaceClick(e.clientX, e.clientY, 2); return; }
        if (!this.enabled) return;
        if (e.button === 0) { this.pending[0].fire = true; this.mouseDown = true; }
        if (e.button === 2) this.pending[0].mine = true;
        return;
      }
      // 指・ペンはタッチイベントのほうで扱う
    }
    // 今も画面に触れている指の一覧と照らし合わせて、離れたはずの指を片づける
    prune(e, cancel) {
      const alive = new Set(Array.from(e.touches || []).map(t => t.identifier));
      if (this.touchMove && !alive.has(this.touchMove.id)) this.touchMove = null;
      if (this.touchAim && !alive.has(this.touchAim.id)) {
        if (this.enabled && !cancel) this.pending[0].fire = true;
        this.touchAim = null;
      }
    }
    tStart(e) {
      HT.Sound.init();
      e.preventDefault();
      this.lastDevice = 'touch';
      this.prune(e, true);
      for (const t of Array.from(e.changedTouches)) {
        const x = t.clientX, y = t.clientY, id = t.identifier;
        if (this.onPlaceClick) { this.onPlaceClick(x, y, 0); continue; }
        if (!this.enabled) continue;
        const leftSide = x < window.innerWidth * 0.45;
        if (leftSide && !this.touchMove) this.touchMove = { id, ox: x, oy: y, x, y };
        else if (!leftSide && !this.touchAim) this.touchAim = { id, ox: x, oy: y, x, y, t: performance.now(), dragging: false };
      }
      this.updateStickUI();
    }
    tMove(e) {
      if (!this.touchMove && !this.touchAim) return;
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const tm = this.touchMove, ta = this.touchAim;
        if (tm && tm.id === t.identifier) {
          tm.x = t.clientX; tm.y = t.clientY;
          // 指が遠くへ行ったらスティックの中心もついてくる
          const R = this.stickR(), dx = tm.x - tm.ox, dy = tm.y - tm.oy, d = Math.hypot(dx, dy);
          if (d > R * 1.6) { tm.ox = tm.x - dx / d * R * 1.6; tm.oy = tm.y - dy / d * R * 1.6; }
        }
        if (ta && ta.id === t.identifier) {
          ta.x = t.clientX; ta.y = t.clientY;
          if (!ta.dragging && Math.hypot(ta.x - ta.ox, ta.y - ta.oy) > 14) ta.dragging = true;
        }
      }
      this.updateStickUI();
    }
    tEnd(e, cancel) {
      for (const t of Array.from(e.changedTouches)) {
        const tm = this.touchMove, ta = this.touchAim;
        if (tm && tm.id === t.identifier) this.touchMove = null;
        if (ta && ta.id === t.identifier) {
          // ドラッグして離したら発射。ちょんと触っただけでも、今の向きに発射
          if (this.enabled && !cancel) this.pending[0].fire = true;
          this.touchAim = null;
        }
      }
      this.prune(e, cancel);
      this.updateStickUI();
    }
    move(e) {
      if (e.pointerType === 'mouse') {
        this.mouse = { x: e.clientX, y: e.clientY };
        if (this.lastDevice !== 'mouse' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) this.lastDevice = 'mouse';
        if (this.onHover) this.onHover(e.clientX, e.clientY);
        return;
      }
    }
    up(e, cancel) {
      if (e.pointerType === 'mouse' && e.button === 0) this.mouseDown = false;
    }
    stickR() { return Math.max(44, Math.min(70, window.innerHeight * 0.13)); }
    updateStickUI() {
      const s = document.getElementById('stick'), a = document.getElementById('aimring');
      if (!s) return;
      const tm = this.touchMove;
      if (tm) {
        const R = this.stickR();
        let dx = tm.x - tm.ox, dy = tm.y - tm.oy; const d = Math.hypot(dx, dy);
        if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        s.style.display = 'block'; s.style.left = tm.ox + 'px'; s.style.top = tm.oy + 'px'; s.style.width = s.style.height = R * 2 + 'px';
        s.firstElementChild.style.transform = `translate(${dx}px,${dy}px)`;
      } else s.style.display = 'none';
      const ta = this.touchAim;
      if (ta && a) {
        a.style.display = 'block'; a.style.left = ta.ox + 'px'; a.style.top = ta.oy + 'px';
        const dx = ta.x - ta.ox, dy = ta.y - ta.oy, d = Math.min(60, Math.hypot(dx, dy)), ang = Math.atan2(dy, dx);
        a.firstElementChild.style.transform = `translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px)`;
        a.classList.toggle('drag', ta.dragging);
      } else if (a) a.style.display = 'none';
    }
    tapMine() { HT.Sound.init(); if (this.enabled) this.pending[0].mine = true; }

    // ---------- コントローラー ----------
    pads() {
      const list = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(p => p && p.connected) : [];
      return list;
    }
    padState(i) {
      const p = this.pads()[i];
      if (!p) return null;
      const ax = p.axes, b = p.buttons;
      const dz = v => (Math.abs(v) < DEAD ? 0 : v);
      const btn = k => !!(b[k] && (b[k].pressed || b[k].value > 0.5));
      const st = {
        mx: dz(ax[0] || 0), my: dz(ax[1] || 0), ax: dz(ax[2] || 0), ay: dz(ax[3] || 0),
        fire: btn(7) || btn(5) || btn(0), mine: btn(6) || btn(4) || btn(1)
      };
      if (btn(12)) st.my = -1; if (btn(13)) st.my = 1; if (btn(14)) st.mx = -1; if (btn(15)) st.mx = 1;
      const prev = this.padPrev[i] || {};
      st.fireEdge = st.fire && !prev.fire; st.mineEdge = st.mine && !prev.mine;
      this.padPrev[i] = { fire: st.fire, mine: st.mine };
      return st;
    }

    // ---------- 1人分の操作をまとめて返す ----------
    // i：0か1（同じPCの2人用で、2P は 1）  tank：その戦車（照準の基準）
    control(i, tank, dt) {
      const out = { mx: 0, my: 0, aim: this.aim[i], fire: false, mine: false, guide: false };
      if (!this.enabled) return out;
      const km = this.mode === 'local2' ? (i === 0 ? KEYMAP.p1 : KEYMAP.p2) : KEYMAP.single;
      const has = list => list.some(k => this.keys.has(k));
      if (has(km.left)) out.mx -= 1; if (has(km.right)) out.mx += 1;
      if (has(km.up)) out.my -= 1; if (has(km.down)) out.my += 1;
      let keyTurn = 0;
      if (has(km.tl)) keyTurn -= 1; if (has(km.tr)) keyTurn += 1;
      if (keyTurn) { this.aim[i] += keyTurn * TURRET_TURN * dt; if (this.mode !== 'local2') this.lastDevice = 'keys'; }

      // コントローラー（1人用は1台目、2人用は 1P=1台目 2P=2台目）
      const pad = this.padState(i);
      if (pad) {
        if (pad.mx || pad.my) { out.mx = pad.mx; out.my = pad.my; }
        if (Math.hypot(pad.ax, pad.ay) > 0.45) { this.aim[i] = Math.atan2(pad.ay, pad.ax); if (i === 0 && this.mode !== 'local2') this.lastDevice = 'pad'; }
        if (pad.fireEdge) out.fire = true;
        if (pad.mineEdge) out.mine = true;
      }

      if (i === 0 && this.mode !== 'local2') {
        // タッチ
        const tm = this.touchMove;
        if (tm) {
          const R = this.stickR();
          let dx = (tm.x - tm.ox) / R, dy = (tm.y - tm.oy) / R; const d = Math.hypot(dx, dy);
          if (d > 1) { dx /= d; dy /= d; }
          if (d > 0.15) { out.mx = dx; out.my = dy; }
        }
        const ta = this.touchAim;
        if (ta && ta.dragging) {
          // 画面上のドラッグの向きを、床の上の向きに直す
          const g0 = this.r.screenToGround(ta.ox, ta.oy), g1 = this.r.screenToGround(ta.x, ta.y);
          this.aim[0] = Math.atan2(g1.y - g0.y, g1.x - g0.x);
          out.guide = true;
        }
        // マウス：カーソルの場所をねらう
        if (this.lastDevice === 'mouse' && this.mouse && tank) {
          const g = this.r.screenToGround(this.mouse.x, this.mouse.y);
          if (Math.hypot(g.x - tank.x, g.y - tank.y) > 0.05) this.aim[0] = Math.atan2(g.y - tank.y, g.x - tank.x);
          out.guide = true;
        }
        if (this.lastDevice === 'pad' || this.lastDevice === 'keys') out.guide = true;
      } else if (this.mode === 'local2') out.guide = true;

      out.aim = this.aim[i];
      const p = this.pending[i];
      if (p.fire) { out.fire = true; p.fire = false; }
      if (p.mine) { out.mine = true; p.mine = false; }
      return out;
    }
  }
  HT.Input = Input;
})();
