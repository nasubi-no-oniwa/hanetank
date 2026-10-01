// =============================================
//  CPU（よわい / ふつう / つよい）
// =============================================
(function () {
  const C = HT.CONFIG, T = HT.TILE, W = C.W, H = C.H;
  const LEVELS = {
    easy:   { think: 0.4,  angles: 0,  bounceShots: false, aimErr: 0.22, turn: 3.5, dodge: 0.35, dodgeLook: 0.45, mines: 0,    lead: 0,   fireChance: 0.55, want: 5 },
    normal: { think: 0.2,  angles: 40, bounceShots: true,  aimErr: 0.06, turn: 6,   dodge: 0.8,  dodgeLook: 0.7,  mines: 0.25, lead: 0.6, fireChance: 0.8,  want: 6 },
    hard:   { think: 0.09, angles: 96, bounceShots: true,  aimErr: 0.01, turn: 11,  dodge: 1,    dodgeLook: 0.95, mines: 0.6,  lead: 1,   fireChance: 1,    want: 6.5 }
  };
  HT.CPU_LEVELS = LEVELS;

  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  function segDist(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
    let t = L ? ((px - x0) * dx + (py - y0) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
    return { d: Math.hypot(px - x0 - dx * t, py - y0 - dy * t), t };
  }

  // ---------- スキルの振り方 ----------
  const STYLES = [
    { name: 'はやうち', w: { speedUp: 4, bounce: 2, sizeBig: 1, bsizeUp: 0.5 } },
    { name: 'はねかえり', w: { speedUp: 1, bounce: 5, sizeBig: 1, bsizeUp: 1 } },
    { name: 'ずっしり', w: { speedUp: 2, bounce: 2, sizeBig: 4, bsizeUp: 2 } },
    { name: 'でかだま', w: { speedUp: 1, bounce: 2, sizeBig: 1, bsizeUp: 4 } },
    { name: 'こがた', w: { speedUp: 2, bounce: 2, sizeSmall: 3, bsizeUp: 1 } }
  ];
  HT.cpuSkills = function (points, level, rnd = Math.random) {
    const s = HT.defaultSkills();
    const style = STYLES[Math.floor(rnd() * STYLES.length)];
    const ops = {
      speedUp: () => { s.speed++; }, bounce: () => { s.bounce++; }, sizeBig: () => { s.size++; },
      sizeSmall: () => { s.size--; }, bsizeUp: () => { s.bsize++; }
    };
    const okRange = () => s.speed >= 1 && s.speed <= 7 && s.bounce >= 1 && s.bounce <= 7 && s.size >= 1 && s.size <= 7 && s.bsize >= 1 && s.bsize <= 7;
    const w = level === 'easy' ? { speedUp: 1, bounce: 1, sizeBig: 1, sizeSmall: 1, bsizeUp: 1 } : style.w;
    for (let guard = 0; guard < 200; guard++) {
      if (HT.skillCost(s) >= points) break;
      const keys = Object.keys(w), tot = keys.reduce((a, k) => a + w[k], 0);
      let r = rnd() * tot, pick = keys[0];
      for (const k of keys) { r -= w[k]; if (r <= 0) { pick = k; break; } }
      const before = { ...s };
      ops[pick]();
      if (!okRange() || HT.skillCost(s) > points) Object.assign(s, before);
    }
    return s;
  };

  // ---------- ブロックの置き方 ----------
  HT.cpuBlocks = function (sim, slot, rnd = Math.random) {
    const list = [];
    const kinds = [];
    for (let i = 0; i < C.BLOCKS_HARD; i++) kinds.push(T.HARD);
    for (let i = 0; i < C.BLOCKS_SOFT; i++) kinds.push(T.SOFT);
    for (const k of kinds) {
      for (let tries = 0; tries < 80; tries++) {
        // 自分の陣地の、真ん中寄りに置きたがる
        const fx = 0.35 + rnd() * 0.6;
        let x = slot === 0 ? Math.floor(1 + fx * (W / 2 - 1)) : Math.floor(W - 2 - fx * (W / 2 - 2));
        const y = 2 + Math.floor(rnd() * (H - 4));
        if (sim.canPlace(slot, x, y)) { sim.setTile(x, y, k); list.push({ x, y, k }); break; }
      }
    }
    for (const b of list) sim.setTile(b.x, b.y, T.EMPTY);
    return list;
  };

  class CPU {
    constructor(sim, slot, level) {
      this.sim = sim; this.slot = slot; this.L = LEVELS[level] || LEVELS.normal; this.level = level;
      this.thinkT = Math.random() * 0.2; this.aim = null; this.wantAim = null; this.shootWhenAimed = false;
      this.moveDir = { x: 0, y: 0 }; this.dodge = null; this.flee = 0; this.stuckT = 0; this.lastPos = null;
      this.wander = { x: 0, y: 0, t: 0 }; this.prevOpp = null; this.oppVel = { x: 0, y: 0 };
      this.mineCool = 2 + Math.random() * 3;
      this.startDelay = 0.3 + Math.random() * 0.4;
    }
    get me() { return this.sim.tanks[this.slot]; }
    get opp() { return this.sim.tanks[1 - this.slot]; }

    update(dt) {
      const me = this.me, opp = this.opp, inp = { mx: 0, my: 0, aim: me ? me.aim : 0, fire: false, mine: false };
      if (!me || !me.alive) return inp;
      if (this.aim == null) this.aim = me.aim;
      this.startDelay -= dt;
      // 相手の速さを測る（先読み用）
      if (opp) {
        if (this.prevOpp && dt > 0) {
          const vx = (opp.x - this.prevOpp.x) / dt, vy = (opp.y - this.prevOpp.y) / dt;
          this.oppVel.x += (vx - this.oppVel.x) * Math.min(1, dt * 8); this.oppVel.y += (vy - this.oppVel.y) * Math.min(1, dt * 8);
        }
        this.prevOpp = { x: opp.x, y: opp.y };
      }
      this.thinkT -= dt; this.mineCool -= dt; this.flee -= dt;
      if (this.thinkT <= 0) { this.thinkT = this.L.think * (0.8 + Math.random() * 0.4); this.think(); }

      // 砲台をなめらかに回す
      if (this.wantAim != null) {
        const d = angDiff(this.wantAim, this.aim), mx = this.L.turn * dt;
        this.aim += Math.max(-mx, Math.min(mx, d));
        if (this.shootWhenAimed && Math.abs(angDiff(this.wantAim, this.aim)) < 0.03 && this.startDelay <= 0) {
          // 撃つ直前にもう一度、自分に当たらないか確かめる
          if (this.safeShot(this.aim)) inp.fire = true;
          this.shootWhenAimed = false;
        }
      }
      inp.aim = this.aim;

      // 動く
      let mv = this.dodge && this.dodge.t > 0 ? this.dodge : null;
      if (mv) { mv.t -= dt; inp.mx = mv.x; inp.my = mv.y; }
      else { inp.mx = this.moveDir.x; inp.my = this.moveDir.y; }
      // ひっかかったら少しランダムに
      if (this.lastPos && Math.hypot(me.x - this.lastPos.x, me.y - this.lastPos.y) < 0.002 && Math.hypot(inp.mx, inp.my) > 0.3) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
      this.lastPos = { x: me.x, y: me.y };
      if (this.stuckT > 0.5) {
        const a = Math.random() * Math.PI * 2;
        this.dodge = { x: Math.cos(a), y: Math.sin(a), t: 0.4 }; this.stuckT = 0;
      }
      if (this.layNow) { inp.mine = true; this.layNow = false; }
      return inp;
    }

    // ---------- 考える ----------
    think() {
      const sim = this.sim, me = this.me, opp = this.opp, L = this.L;
      // 1) 弾をよける
      this.dodge = null;
      if (Math.random() < L.dodge) {
        const danger = this.findDanger();
        if (danger) this.dodge = danger;
      }
      // 2) 地雷から逃げる
      const mineEsc = this.mineEscape();
      if (mineEsc && !this.dodge) this.dodge = mineEsc;

      // 3) ねらう
      if (opp && opp.alive && me.cool <= 0.05 && sim.activeBullets(this.slot) < C.MAX_BULLETS && Math.random() < L.fireChance) {
        const shot = this.findShot();
        if (shot != null) { this.wantAim = shot + (Math.random() - 0.5) * 2 * L.aimErr; this.shootWhenAimed = true; }
        else if (!this.shootWhenAimed) this.wantAim = Math.atan2(opp.y - me.y, opp.x - me.x);
      } else if (opp && opp.alive && !this.shootWhenAimed) this.wantAim = Math.atan2(opp.y - me.y, opp.x - me.x);

      // 4) 移動先
      this.moveDir = this.chooseMove();

      // 5) 地雷
      if (L.mines > 0 && this.mineCool <= 0 && opp && opp.alive) {
        const d = Math.hypot(opp.x - me.x, opp.y - me.y);
        const softNear = this.softAdjacent();
        if ((d < 3.4 || (softNear && this.blockedBySoft)) && Math.random() < L.mines * 0.5) {
          this.layNow = true; this.mineCool = 4 + Math.random() * 3; this.flee = 2.2;
        }
      }
    }

    // 自分に向かってくる弾をさがして、よける向きを返す
    findDanger() {
      const sim = this.sim, me = this.me, L = this.L;
      let best = null;
      for (const b of sim.bullets) {
        const sp = Math.hypot(b.vx, b.vy); if (sp < 0.01) continue;
        if (b.owner === this.slot && b.age < 0.25) continue;
        const tr = sim.trace(b.x, b.y, Math.atan2(b.vy, b.vx), sp, b.r, b.left, L.dodgeLook, -1);
        const pts = tr.pts;
        const margin = me.radius + b.r + 0.3;
        let acc = 0;
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          const sd = segDist(me.x, me.y, x0, y0, x1, y1);
          const seg = Math.hypot(x1 - x0, y1 - y0);
          if (sd.d < margin || tr.hit === this.slot) {
            const tHit = (acc + seg * sd.t) / sp;
            if (!best || tHit < best.tHit) {
              // 弾の進む向きに対して横へ逃げる
              const ux = (x1 - x0) / (seg || 1), uy = (y1 - y0) / (seg || 1);
              let nx = -uy, ny = ux;
              const side = (me.x - x0) * nx + (me.y - y0) * ny;
              if (side < 0) { nx = -nx; ny = -ny; }
              // 逃げ先が壁ならもう片方
              if (sim.circleHits(me.x + nx * 0.6, me.y + ny * 0.6, me.radius, false)) { nx = -nx; ny = -ny; }
              if (sim.circleHits(me.x + nx * 0.6, me.y + ny * 0.6, me.radius, false)) { nx = -ux; ny = -uy; }
              best = { x: nx, y: ny, t: 0.35, tHit };
            }
            break;
          }
          acc += seg;
        }
      }
      return best;
    }
    mineEscape() {
      const me = this.me;
      let best = null, bd = 1e9;
      for (const m of this.sim.mines) {
        const d = Math.hypot(me.x - m.x, me.y - m.y);
        const danger = C.BLAST_RADIUS + me.radius + 0.5;
        const left = C.MINE_FUSE - (this.sim.time - m.t0);
        if (d < danger && (m.owner === this.slot ? this.flee > 0 || left < 3 : true) && d < bd) {
          bd = d;
          let dx = me.x - m.x, dy = me.y - m.y; const l = Math.hypot(dx, dy) || 1;
          best = { x: dx / l, y: dy / l, t: 0.3 };
          // 逃げ道が壁なら、行ける向きをさがす
          if (this.sim.circleHits(me.x + best.x * 0.5, me.y + best.y * 0.5, me.radius, false)) {
            for (let k = 0; k < 8; k++) {
              const a = Math.atan2(dy, dx) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.6;
              if (!this.sim.circleHits(me.x + Math.cos(a) * 0.5, me.y + Math.sin(a) * 0.5, me.radius, false)) { best = { x: Math.cos(a), y: Math.sin(a), t: 0.3 }; break; }
            }
          }
        }
      }
      return best;
    }

    // 撃つと当たる角度をさがす
    findShot() {
      const sim = this.sim, me = this.me, opp = this.opp, L = this.L;
      // 相手が動いている先をねらう
      const saved = { x: opp.x, y: opp.y };
      const dist = Math.hypot(opp.x - me.x, opp.y - me.y);
      const lead = L.lead * dist / me.speed;
      const px = opp.x + this.oppVel.x * lead, py = opp.y + this.oppVel.y * lead;
      if (!sim.circleHits(px, py, opp.radius * 0.8, false)) { opp.x = px; opp.y = py; }
      let found = null;
      try {
        const direct = Math.atan2(opp.y - me.y, opp.x - me.x);
        if (this.tryAngle(direct, false)) found = direct;
        if (found == null && L.angles > 0 && me.bounces > 0) {
          const n = L.angles, off = Math.random() * Math.PI * 2 / n;
          let bestT = 1e9;
          for (let i = 0; i < n; i++) {
            const a = off + i * Math.PI * 2 / n;
            const r = this.tryAngle(a, true);
            if (r && r.time < bestT) { bestT = r.time; found = a; }
          }
          // 見つかった角度の近くを細かくさがす
          if (found != null) {
            for (let k = -3; k <= 3; k++) {
              const a = found + k * (Math.PI * 2 / n) / 4;
              const r = this.tryAngle(a, true);
              if (r && r.time < bestT) { bestT = r.time; found = a; }
            }
          }
        }
      } finally { opp.x = saved.x; opp.y = saved.y; }
      return found;
    }
    tryAngle(a, bounce) {
      const sim = this.sim, me = this.me;
      const off = me.radius + me.bradius + 0.06;
      const sx = me.x + Math.cos(a) * off, sy = me.y + Math.sin(a) * off;
      const tr = sim.trace(sx, sy, a, me.speed, me.bradius, bounce ? me.bounces : 0, 4, this.slot);
      if (tr.hit === 1 - this.slot && (!bounce || this.L.bounceShots)) {
        // はね返った弾が自分のそばを通る撃ち方はしない（動いたら当たるかもしれない）
        if (bounce && this.passesNearMe(tr.pts)) return null;
        return tr;
      }
      return null;
    }
    passesNearMe(pts) {
      const me = this.me, lim = me.radius + me.bradius + 0.7;
      for (let i = 2; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        if (segDist(me.x, me.y, x0, y0, x1, y1).d < lim) return true;
      }
      return false;
    }
    safeShot(a) {
      const me = this.me, sim = this.sim;
      const off = me.radius + me.bradius + 0.06;
      const sx = me.x + Math.cos(a) * off, sy = me.y + Math.sin(a) * off;
      if (sim.circleHits(sx, sy, me.bradius * 0.9, true)) return false;
      const tr = sim.trace(sx, sy, a, me.speed, me.bradius, me.bounces, 3, this.slot);
      if (tr.hit === this.slot) return false;
      return !(this.L.bounceShots && this.passesNearMe(tr.pts));
    }

    // ---------- 移動先を決める ----------
    chooseMove() {
      const sim = this.sim, me = this.me, opp = this.opp, L = this.L;
      const cx = Math.floor(me.x), cy = Math.floor(me.y);
      // サドンデスが近いときは真ん中へ
      const info = sim.suddenInfo();
      const ringOf = (x, y) => Math.min(x, y, W - 1 - x, H - 1 - y);
      const danger = sim.time > C.SUDDEN_TIME - 4 ? Math.max(sim.suddenRing || 0, info.ring) + 1 : 0;
      if (danger && ringOf(cx, cy) <= danger + 1) {
        const field = this.bfs(null, danger + 1);
        return this.descend(field, cx, cy, me);
      }
      if (!opp || !opp.alive) return { x: 0, y: 0 };
      if (this.flee > 0) {
        const field = this.bfs([[Math.floor(opp.x), Math.floor(opp.y)]], 0);
        return this.ascend(field, cx, cy, me);
      }
      if (this.level === 'easy') {
        this.wander.t -= this.L.think;
        if (this.wander.t <= 0) {
          const a = Math.random() * Math.PI * 2, go = Math.random() < 0.7;
          this.wander = { x: go ? Math.cos(a) : 0, y: go ? Math.sin(a) : 0, t: 0.8 + Math.random() * 1.2 };
          if (Math.random() < 0.4) {
            const d = Math.hypot(opp.x - me.x, opp.y - me.y) || 1;
            this.wander.x = (opp.x - me.x) / d * 0.7; this.wander.y = (opp.y - me.y) / d * 0.7;
          }
        }
        return { x: this.wander.x, y: this.wander.y };
      }
      const field = this.bfs([[Math.floor(opp.x), Math.floor(opp.y)]], 0);
      const d = field.dist[cy * W + cx];
      this.blockedBySoft = d === Infinity || field.soft;
      if (d === Infinity) return this.towardSoft(field, cx, cy, me);
      // 近すぎたら離れる、遠すぎたら近づく、ちょうどよければ横に動く
      if (d > L.want + 1) return this.descend(field, cx, cy, me);
      if (d < L.want - 2) return this.ascend(field, cx, cy, me);
      this.wander.t -= this.L.think;
      if (this.wander.t <= 0) { const a = Math.random() * Math.PI * 2; this.wander = { x: Math.cos(a) * 0.6, y: Math.sin(a) * 0.6, t: 0.6 + Math.random() }; }
      return { x: this.wander.x, y: this.wander.y };
    }
    // マスごとの距離（壁・穴・やわらかいブロックは通れない）
    bfs(sources, safeRing) {
      // sources が null のときは「safeRing より内側のマス」すべてを出発点にする（サドンデスの逃げ道）
      const sim = this.sim, dist = new Float32Array(W * H).fill(Infinity), q = [];
      const ringOf = (x, y) => Math.min(x, y, W - 1 - x, H - 1 - y);
      const pass = (x, y) => sim.tile(x, y) === T.EMPTY;
      if (sources) for (const [x, y] of sources) { dist[y * W + x] = 0; q.push(y * W + x); }
      else for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (pass(x, y) && ringOf(x, y) > safeRing) { dist[y * W + x] = 0; q.push(y * W + x); }
      let head = 0;
      while (head < q.length) {
        const i = q[head++], x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, j = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || dist[j] !== Infinity || !pass(nx, ny)) continue;
          dist[j] = dist[i] + 1; q.push(j);
        }
      }
      return { dist };
    }
    steerTo(tx, ty, me) {
      const dx = tx + 0.5 - me.x, dy = ty + 0.5 - me.y, d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
    descend(field, cx, cy, me) {
      let best = null, bd = field.dist[cy * W + cx];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const v = field.dist[(cy + dy) * W + cx + dx];
        if (v < bd) { bd = v; best = [cx + dx, cy + dy]; }
      }
      if (!best) return this.steerTo(cx, cy, me);
      return this.steerTo(best[0], best[1], me);
    }
    ascend(field, cx, cy, me) {
      let best = null, bd = field.dist[cy * W + cx];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const v = field.dist[(cy + dy) * W + cx + dx];
        if (v !== Infinity && v > bd) { bd = v; best = [cx + dx, cy + dy]; }
      }
      if (!best) return this.steerTo(cx, cy, me);
      return this.steerTo(best[0], best[1], me);
    }
    // 道がやわらかいブロックでふさがっているとき：そのブロックに近づく
    towardSoft(field, cx, cy, me) {
      const sim = this.sim;
      let best = null, bd = 1e9;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (sim.tile(x, y) !== T.SOFT) continue;
        const d = Math.hypot(x + 0.5 - me.x, y + 0.5 - me.y);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      if (!best || bd < 1.3) return { x: 0, y: 0 };
      return this.steerTo(best[0], best[1], me);
    }
    softAdjacent() {
      const me = this.me, cx = Math.floor(me.x), cy = Math.floor(me.y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.sim.tile(cx + dx, cy + dy) === T.SOFT) return true;
      return false;
    }
  }
  HT.CPU = CPU;
})();
