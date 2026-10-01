// =============================================
//  ハネタンクのルール本体（画面とは切り離し）
//  座標は「マス」単位。x は右、y は下（手前）方向
//  タイル： 0=床 1=壊せないブロック 2=壊せるブロック 3=穴 4=サドンデスの壁
// =============================================
(function () {
  const C = HT.CONFIG;
  const W = C.W, H = C.H;
  const EMPTY = 0, HARD = 1, SOFT = 2, HOLE = 3, CLOSE = 4;
  HT.TILE = { EMPTY, HARD, SOFT, HOLE, CLOSE };

  // ---------- ステージ（点対称に作る：左上を書けば右下に自動で写る） ----------
  const SPAWN = [{ x: 2.5, y: 7.5, a: 0 }, { x: W - 2.5, y: H - 7.5, a: Math.PI }];
  function sym(list, x, y, t) { list.push([x, y, t], [W - 1 - x, H - 1 - y, t]); }
  const STAGES = [
    {
      name: 'ひろば', desc: 'ブロック少なめ。まっすぐの撃ち合い',
      build(add) {
        add(6, 3, HARD); add(7, 3, HARD); add(6, 4, HARD);
        add(10, 7, HARD); add(10, 8, HARD);
        add(4, 11, SOFT); add(5, 11, SOFT);
        add(14, 4, SOFT); add(15, 4, SOFT);
      }
    },
    {
      name: 'めいろ', desc: '壁が多い。反射が活きる',
      build(add) {
        for (let y = 1; y <= 5; y++) add(5, y, HARD);
        for (let x = 8; x <= 12; x++) add(x, 4, HARD);
        add(8, 5, HARD); add(8, 6, HARD);
        add(5, 10, SOFT); add(5, 11, SOFT); add(5, 12, HARD); add(5, 13, HARD);
        add(10, 7, SOFT); add(10, 8, SOFT);
        add(13, 9, HARD); add(14, 9, HARD); add(15, 9, HARD);
        add(2, 10, HARD); add(3, 10, HARD);
      }
    },
    {
      name: 'あなぼこ', desc: '穴だらけ。弾は通るけど戦車は回り道',
      build(add) {
        for (const [x, y] of [[5, 3], [6, 3], [5, 4], [6, 4]]) add(x, y, HOLE);
        for (const [x, y] of [[9, 6], [10, 6], [9, 7], [10, 7]]) add(x, y, HOLE);
        for (const [x, y] of [[4, 10], [4, 11], [5, 11]]) add(x, y, HOLE);
        add(13, 3, HOLE); add(14, 3, HOLE); add(15, 3, HOLE);
        add(8, 11, HARD); add(8, 12, HARD);
        add(12, 6, SOFT);
      }
    }
  ];
  HT.STAGES = STAGES;
  HT.SPAWN = SPAWN;

  // ---------- スキル ----------
  HT.skillCost = function (s) {
    let c = 0;
    c += Math.abs(s.speed - 4);
    c += s.bounce - 1;
    c += s.size < 4 ? 4 - s.size : -(s.size - 4); // 大きくするとポイントがもらえる
    c += Math.abs(s.bsize - 4);
    return c;
  };
  HT.defaultSkills = () => ({ speed: 4, bounce: 1, size: 4, bsize: 4 });
  HT.statsFrom = function (s) {
    return {
      speed: C.BULLET_SPEED * C.SPEED_LV[s.speed - 1],
      bounces: C.BOUNCE_LV[s.bounce - 1],
      radius: C.TANK_RADIUS * C.SIZE_LV[s.size - 1],
      bradius: C.BULLET_RADIUS * C.BSIZE_LV[s.bsize - 1]
    };
  };

  class Sim {
    constructor(stageIndex) {
      this.stageIndex = stageIndex;
      this.tiles = new Uint8Array(W * H);
      this.reset();
    }
    reset() {
      const t = this.tiles; t.fill(EMPTY);
      for (let x = 0; x < W; x++) { t[x] = HARD; t[(H - 1) * W + x] = HARD; }
      for (let y = 0; y < H; y++) { t[y * W] = HARD; t[y * W + W - 1] = HARD; }
      const list = [];
      STAGES[this.stageIndex].build((x, y, k) => sym(list, x, y, k));
      for (const [x, y, k] of list) t[y * W + x] = k;
      this.tanks = []; this.bullets = []; this.mines = [];
      this.events = []; this.time = 0; this.nextId = 1;
      this.suddenRing = 0; this.warn = []; this.over = false;
    }
    tile(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? HARD : this.tiles[y * W + x]; }
    setTile(x, y, k) { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) this.tiles[y * W + x] = k; }
    solidForTank(k) { return k === HARD || k === SOFT || k === HOLE || k === CLOSE; }
    solidForBullet(k) { return k === HARD || k === SOFT || k === CLOSE; }
    emit(e) { this.events.push(e); }

    // 円がブロックに重なっているか
    circleHits(x, y, r, forBullet) {
      const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const k = this.tile(tx, ty);
        if (!(forBullet ? this.solidForBullet(k) : this.solidForTank(k))) continue;
        const cx = Math.max(tx, Math.min(x, tx + 1)), cy = Math.max(ty, Math.min(y, ty + 1));
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < r * r) return true;
      }
      return false;
    }

    // ---------- ブロックを置けるか ----------
    canPlace(slot, x, y) {
      if (x < 1 || y < 1 || x > W - 2 || y > H - 2) return false;
      if (this.tile(x, y) !== EMPTY) return false;
      // 自分の陣地（ステージの半分）だけ
      if (slot === 0 ? x >= W / 2 : x < W / 2) return false;
      // 自分のスタート地点のまわり（囲めないように）と、相手のスタート付近は不可
      for (const s of SPAWN) if (Math.abs(x + 0.5 - s.x) <= 1.6 && Math.abs(y + 0.5 - s.y) <= 1.6) return false;
      // 置いたことで、2人の間の道がなくなるのは不可（壊せるブロックは地雷で壊せるので道とみなす）
      this.tiles[y * W + x] = HARD;
      const ok = this.connected();
      this.tiles[y * W + x] = EMPTY;
      return ok;
    }
    connected() {
      const sx = Math.floor(SPAWN[0].x), sy = Math.floor(SPAWN[0].y), gx = Math.floor(SPAWN[1].x), gy = Math.floor(SPAWN[1].y);
      const seen = new Uint8Array(W * H), q = [sy * W + sx]; seen[q[0]] = 1;
      while (q.length) {
        const i = q.shift(); const x = i % W, y = (i / W) | 0;
        if (x === gx && y === gy) return true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = this.tile(nx, ny), j = ny * W + nx;
          if (seen[j] || k === HARD || k === HOLE || k === CLOSE) continue;
          seen[j] = 1; q.push(j);
        }
      }
      return false;
    }
    placeBlocks(list) { for (const b of list) if (this.tile(b.x, b.y) === EMPTY) this.setTile(b.x, b.y, b.k); }

    // ---------- 戦車 ----------
    addTank(slot, skills, opts = {}) {
      const st = HT.statsFrom(skills), sp = SPAWN[slot] || SPAWN[1];
      const t = {
        slot, skills, ...st, x: sp.x, y: sp.y, a: sp.a, aim: sp.a, alive: true,
        local: opts.local !== false, cool: 0, input: { mx: 0, my: 0, aim: sp.a, fire: false, mine: false },
        moving: 0, deadAt: -1
      };
      this.tanks[slot] = t;
      return t;
    }

    // ---------- 1コマ進める ----------
    step(dt) {
      if (this.over) return;
      this.t0 = this.time;
      this.time += dt;
      for (const t of this.tanks) if (t && t.alive && t.local) this.controlTank(t, dt);
      this.pushApart();
      this.stepBullets(dt);
      this.stepMines();
      this.stepSudden();
    }

    controlTank(t, dt) {
      const inp = t.input;
      t.aim = inp.aim;
      let mx = inp.mx, my = inp.my;
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      t.moving = Math.min(1, len);
      if (len > 0.08) {
        const want = Math.atan2(my, mx);
        let d = want - t.a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        // 車体は前後どちらにも走れる（向きの近いほうへ回る）
        if (Math.abs(d) > Math.PI / 2) { d += d > 0 ? -Math.PI : Math.PI; }
        t.a += Math.max(-C.TANK_TURN * dt, Math.min(C.TANK_TURN * dt, d));
        const sp = C.TANK_SPEED * Math.min(1, len) * dt;
        this.moveTank(t, mx * sp, my * sp);
      }
      t.cool -= dt;
      if (inp.fire) { inp.fire = false; this.fire(t); }
      if (inp.mine) { inp.mine = false; this.layMine(t); }
    }
    moveTank(t, dx, dy) {
      // 軸ごとに動かして、ぶつかったら押し戻す（穴には入れない＝落ちない）
      const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.1) || 1;
      for (let i = 0; i < steps; i++) {
        const nx = t.x + dx / steps;
        if (!this.circleHits(nx, t.y, t.radius, false)) t.x = nx;
        const ny = t.y + dy / steps;
        if (!this.circleHits(t.x, ny, t.radius, false)) t.y = ny;
      }
    }
    pushApart() {
      const [a, b] = this.tanks;
      if (!a || !b || !a.alive || !b.alive) return;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.radius + b.radius;
      if (d > 0 && d < min) {
        const p = (min - d) / 2, ux = dx / d, uy = dy / d;
        if (a.local) this.moveTank(a, -ux * p, -uy * p);
        if (b.local) this.moveTank(b, ux * p, uy * p);
      }
    }

    activeBullets(slot) { let n = 0; for (const b of this.bullets) if (b.owner === slot) n++; return n; }
    fire(t) {
      if (t.cool > 0 || this.activeBullets(t.slot) >= C.MAX_BULLETS) return null;
      t.cool = C.FIRE_COOLDOWN;
      const ca = Math.cos(t.aim), sa = Math.sin(t.aim), off = t.radius + t.bradius + 0.06;
      const b = this.spawnBullet({ id: t.slot + ':' + (this.nextId++), owner: t.slot, x: t.x + ca * off, y: t.y + sa * off, vx: ca * t.speed, vy: sa * t.speed, r: t.bradius, b: t.bounces });
      this.emit({ type: 'fire', slot: t.slot, bullet: b, x: b.x, y: b.y, a: t.aim, T: this.t0 == null ? this.time : this.t0 });
      return b;
    }
    spawnBullet(p, advance = 0) {
      const b = { id: p.id, owner: p.owner, x: p.x, y: p.y, vx: p.vx, vy: p.vy, r: p.r, left: p.b, age: 0 };
      // 撃ち出し口が壁の中なら、その場で消える
      if (this.circleHits(b.x, b.y, b.r * 0.9, true)) { this.emit({ type: 'pop', x: b.x, y: b.y, owner: b.owner }); return b; }
      this.bullets.push(b);
      if (advance > 0) this.advanceBullet(b, advance);
      return b;
    }
    advanceBullet(b, dt) {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / Math.min(0.08, b.r * 0.8)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        if (b.dead) return;
        const dx = b.vx * h, dy = b.vy * h;
        let hx = this.circleHits(b.x + dx, b.y, b.r, true), hy = this.circleHits(b.x, b.y + dy, b.r, true);
        if (!hx && !hy && this.circleHits(b.x + dx, b.y + dy, b.r, true)) { hx = hy = true; }
        if (hx || hy) {
          if (b.left <= 0) { b.dead = true; this.emit({ type: 'bulletDie', x: b.x, y: b.y, owner: b.owner }); return; }
          b.left--;
          if (hx) b.vx = -b.vx;
          if (hy) b.vy = -b.vy;
          this.emit({ type: 'bounce', x: b.x + (hx ? Math.sign(dx) * b.r : 0), y: b.y + (hy ? Math.sign(dy) * b.r : 0), owner: b.owner, left: b.left });
          continue;
        }
        b.x += dx; b.y += dy;
        b.age += h;
        if (this.bulletContacts(b)) return;
      }
    }
    bulletContacts(b) {
      // 戦車
      for (const t of this.tanks) {
        if (!t || !t.alive) continue;
        if (t.slot === b.owner && b.age < C.OWN_HIT_GRACE) continue;
        const d = Math.hypot(t.x - b.x, t.y - b.y);
        if (d < t.radius + b.r) {
          b.dead = true;
          if (t.local) this.killTank(t, 'bullet', b.owner);
          else this.emit({ type: 'remoteHit', slot: t.slot, x: b.x, y: b.y });
          return true;
        }
      }
      // 地雷
      for (const m of this.mines) {
        if (m.dead) continue;
        if (Math.hypot(m.x - b.x, m.y - b.y) < C.MINE_RADIUS + b.r) {
          b.dead = true;
          this.emit({ type: 'bulletDie', x: b.x, y: b.y, owner: b.owner });
          if (this.mineAuthority(m)) this.explodeMine(m);
          return true;
        }
      }
      return false;
    }
    stepBullets(dt) {
      for (const b of this.bullets) {
        if (b.dead) continue;
        this.advanceBullet(b, dt);
        if (b.age > C.BULLET_LIFE) b.dead = true;
      }
      // 弾どうしの相殺
      const bs = this.bullets;
      for (let i = 0; i < bs.length; i++) {
        const a = bs[i]; if (a.dead) continue;
        for (let j = i + 1; j < bs.length; j++) {
          const c = bs[j]; if (c.dead) continue;
          const dx = a.x - c.x, dy = a.y - c.y, r = a.r + c.r;
          if (dx * dx + dy * dy < r * r) {
            a.dead = c.dead = true;
            this.emit({ type: 'clash', x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
            break;
          }
        }
      }
      this.bullets = bs.filter(b => !b.dead);
    }

    // ---------- 地雷（置いた人の端末が爆発を決める） ----------
    mineAuthority(m) { const t = this.tanks[m.owner]; return !t || t.local; }
    layMine(t) {
      if (this.mines.filter(m => m.owner === t.slot && !m.dead).length >= C.MAX_MINES) return null;
      for (const m of this.mines) if (!m.dead && Math.hypot(m.x - t.x, m.y - t.y) < 0.7) return null;
      return this.addMine({ id: t.slot + ':m' + (this.nextId++), owner: t.slot, x: t.x, y: t.y, t0: this.time });
    }
    addMine(p) {
      if (this.mines.some(m => m.id === p.id)) return null;
      const m = { ...p, dead: false };
      this.mines.push(m);
      this.emit({ type: 'mine', mine: m });
      return m;
    }
    stepMines() {
      for (const m of this.mines) if (!m.dead && this.mineAuthority(m) && this.time - m.t0 >= C.MINE_FUSE) this.explodeMine(m);
      this.mines = this.mines.filter(m => !m.dead);
    }
    explodeMine(m) {
      if (m.dead) return;
      m.dead = true;
      this.emit({ type: 'blast', id: m.id, x: m.x, y: m.y, owner: m.owner });
      this.applyBlast(m.x, m.y);
    }
    // 爆発の効果（どの端末でも同じように起きる）
    applyBlast(x, y) {
      const R = C.BLAST_RADIUS;
      for (let ty = Math.floor(y - R); ty <= Math.floor(y + R); ty++) for (let tx = Math.floor(x - R); tx <= Math.floor(x + R); tx++) {
        if (this.tile(tx, ty) !== SOFT) continue;
        if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) < R + 0.35) { this.setTile(tx, ty, EMPTY); this.emit({ type: 'break', x: tx, y: ty }); }
      }
      for (const b of this.bullets) if (!b.dead && Math.hypot(b.x - x, b.y - y) < R) { b.dead = true; this.emit({ type: 'bulletDie', x: b.x, y: b.y, owner: b.owner }); }
      for (const t of this.tanks) if (t && t.alive && t.local && Math.hypot(t.x - x, t.y - y) < R + t.radius * 0.4) this.killTank(t, 'blast');
      for (const m of this.mines) if (!m.dead && Math.hypot(m.x - x, m.y - y) < R && this.mineAuthority(m)) this.explodeMine(m);
    }
    remoteBlast(id) {
      const m = this.mines.find(mm => mm.id === id);
      if (m) this.explodeMine(m);
    }

    killTank(t, why, by) {
      if (!t.alive) return;
      t.alive = false; t.deadAt = this.time;
      this.emit({ type: 'die', slot: t.slot, x: t.x, y: t.y, why, by, T: this.time });
    }

    // ---------- サドンデス：外側から壁がせまる ----------
    suddenInfo() {
      const s = this.time - C.SUDDEN_TIME;
      if (s < -C.SUDDEN_WARN) return { ring: 0, warnRing: 0, left: -s };
      const ring = s < 0 ? 0 : Math.floor(s / C.SUDDEN_STEP) + 1;
      const into = s < 0 ? C.SUDDEN_STEP + s : s - (ring - 1) * C.SUDDEN_STEP;
      const warnRing = into >= C.SUDDEN_STEP - C.SUDDEN_WARN ? ring + 1 : 0;
      return { ring: Math.min(ring, 7), warnRing: warnRing > 7 ? 0 : warnRing, left: Math.max(0, -s) };
    }
    ringTiles(k) {
      const out = [];
      for (let y = k; y <= H - 1 - k; y++) for (let x = k; x <= W - 1 - k; x++) {
        if (x === k || y === k || x === W - 1 - k || y === H - 1 - k) out.push([x, y]);
      }
      return out;
    }
    stepSudden() {
      const info = this.suddenInfo();
      this.warnRing = info.warnRing;
      while (this.suddenRing < info.ring) {
        this.suddenRing++;
        const k = this.suddenRing;
        for (const [x, y] of this.ringTiles(k)) {
          if (this.tile(x, y) === CLOSE || this.tile(x, y) === HARD) continue;
          this.setTile(x, y, CLOSE);
          this.emit({ type: 'wall', x, y });
        }
        for (const b of this.bullets) if (this.circleHits(b.x, b.y, b.r * 0.5, true)) b.dead = true;
        for (const m of this.mines) if (this.tile(Math.floor(m.x), Math.floor(m.y)) === CLOSE) m.dead = true;
        for (const t of this.tanks) if (t && t.alive && t.local && this.circleHits(t.x, t.y, t.radius * 0.5, false)) this.killTank(t, 'wall');
      }
    }

    // ---------- 弾の通り道を計算（照準ガイドとCPU用） ----------
    trace(x, y, ang, speed, r, bounces, maxTime, ignoreSlot) {
      const pts = [[x, y]];
      let vx = Math.cos(ang) * speed, vy = Math.sin(ang) * speed, left = bounces, t = 0;
      if (this.circleHits(x, y, r * 0.9, true)) return { pts, hit: null, blocked: true };
      const h = Math.min(0.08, r * 0.8) / speed;
      while (t < maxTime) {
        const dx = vx * h, dy = vy * h;
        let hx = this.circleHits(x + dx, y, r, true), hy = this.circleHits(x, y + dy, r, true);
        if (!hx && !hy && this.circleHits(x + dx, y + dy, r, true)) hx = hy = true;
        if (hx || hy) {
          pts.push([x, y]);
          if (left <= 0) return { pts, hit: null, end: 'wall' };
          left--; if (hx) vx = -vx; if (hy) vy = -vy;
          continue;
        }
        x += dx; y += dy; t += h;
        for (const tk of this.tanks) {
          if (!tk || !tk.alive) continue;
          if (tk.slot === ignoreSlot && t < C.OWN_HIT_GRACE) continue;
          if (Math.hypot(tk.x - x, tk.y - y) < tk.radius + r) { pts.push([x, y]); return { pts, hit: tk.slot, time: t, bouncesUsed: bounces - left }; }
        }
      }
      pts.push([x, y]);
      return { pts, hit: null, end: 'time' };
    }
  }

  HT.Sim = Sim;
})();
