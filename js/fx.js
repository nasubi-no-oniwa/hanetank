// =============================================
//  3D描画とエフェクト（three.js）
//  シミュレーションの (x, y) を 3D の (x, 0, y) に置く
// =============================================
(function () {
  const C = HT.CONFIG, T = HT.TILE, W = C.W, H = C.H;
  const V3 = THREE.Vector3;

  // ---------- 画質 ----------
  const QUALITY = {
    high: { dpr: 2, shadows: true, particles: 2200, debris: 160, light: true, aa: true },
    mid:  { dpr: 1.5, shadows: false, particles: 1300, debris: 90, light: true, aa: true },
    low:  { dpr: 1, shadows: false, particles: 700, debris: 50, light: false, aa: false }
  };
  HT.QUALITY = QUALITY;

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  // ---------- 粒（火花・炎・煙）を大量に描くしくみ ----------
  class Particles {
    constructor(scene, max, additive) {
      this.max = max; this.n = 0;
      this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
      this.size = new Float32Array(max); this.alpha = new Float32Array(max);
      this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
      this.grow = new Float32Array(max); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
      this.s0 = new Float32Array(max);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
      this.geo = g;
      const mat = new THREE.ShaderMaterial({
        uniforms: { scale: { value: 600 } },
        vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale;
          void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 p=gl_PointCoord-0.5; float d=length(p)*2.0; if(d>1.0) discard; float a=${additive ? 'pow(1.0-d,1.6)' : 'smoothstep(1.0,0.35,d)'}*vA; gl_FragColor=vec4(vC*${additive ? '1.0' : '1.0'},a); }`,
        transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      this.mat = mat;
      this.points = new THREE.Points(g, mat);
      this.points.frustumCulled = false;
      this.points.renderOrder = additive ? 3 : 2;
      scene.add(this.points);
    }
    emit(x, y, z, vx, vy, vz, size, life, r, g, b, opt = {}) {
      if (this.n >= this.max) return;
      const i = this.n++;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
      this.size[i] = this.s0[i] = size; this.life[i] = this.maxLife[i] = life;
      this.grow[i] = opt.grow || 0; this.drag[i] = opt.drag == null ? 2 : opt.drag; this.grav[i] = opt.grav || 0;
      this.alpha[i] = 1;
    }
    update(dt) {
      let i = 0;
      while (i < this.n) {
        this.life[i] -= dt;
        if (this.life[i] <= 0) { this.kill(i); continue; }
        const k = Math.exp(-this.drag[i] * dt);
        this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
        this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        if (this.pos[i * 3 + 1] < 0.02) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.3; }
        const t = this.life[i] / this.maxLife[i];
        this.alpha[i] = Math.min(1, t * 1.6);
        this.size[i] = this.s0[i] * (1 + this.grow[i] * (1 - t));
        i++;
      }
      for (const a of ['position', 'color', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
      this.geo.setDrawRange(0, this.n);
    }
    kill(i) {
      const j = --this.n;
      if (i === j) return;
      for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[j * 3 + k]; this.vel[i * 3 + k] = this.vel[j * 3 + k]; this.col[i * 3 + k] = this.col[j * 3 + k]; }
      this.size[i] = this.size[j]; this.s0[i] = this.s0[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
      this.grow[i] = this.grow[j]; this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j]; this.alpha[i] = this.alpha[j];
    }
    clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
  }

  const hexToRgb = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

  class Renderer {
    constructor(canvas, qualityName) {
      this.canvas = canvas;
      this.qName = qualityName || 'high';
      this.q = QUALITY[this.qName];
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q.aa, alpha: true, powerPreference: 'high-performance' });
      this.renderer.setClearColor(0x000000, 0);
      if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.shadowMap.enabled = this.q.shadows;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 200);
      this.shake = 0; this.shakeT = 0; this.zoom = null;
      this.buildLights();
      this.buildFloor();
      this.add = new Particles(this.scene, this.q.particles, true);
      this.smoke = new Particles(this.scene, Math.floor(this.q.particles * 0.5), false);
      this.buildPools();
      this.blocks = new Map(); this.tankObjs = []; this.bulletObjs = new Map(); this.mineObjs = new Map();
      this.tracks = []; this.trackIdx = 0;
      this.time = 0;
      this.resize();
    }

    setQuality(name) {
      if (name === this.qName) return;
      this.qName = name; this.q = QUALITY[name];
      this.renderer.shadowMap.enabled = this.q.shadows;
      this.sun.castShadow = this.q.shadows;
      this.resize();
    }

    buildLights() {
      const hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a7a68, 1.05);
      this.scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffffff, 1.5);
      sun.position.set(W * 0.25, 22, H * 0.1);
      sun.target.position.set(W / 2, 0, H / 2);
      sun.castShadow = this.q.shadows;
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50;
      sun.shadow.bias = -0.0008;
      this.scene.add(sun); this.scene.add(sun.target);
      this.sun = sun;
      this.flashLight = new THREE.PointLight(0xffaa55, 0, 9, 2);
      this.flashLight.position.set(0, 1.2, 0);
      this.scene.add(this.flashLight);
    }

    buildFloor() {
      // 方眼紙のような床（おもちゃの机の上）
      const tex = canvasTex(1024, 768, (g, w, h) => {
        // 遊び用のマット（暗めにして、光る弾や爆発が映えるように）
        const gr = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
        gr.addColorStop(0, '#3a4a6b'); gr.addColorStop(1, '#27324a');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
        const cw = w / W, ch = h / H;
        g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 2;
        for (let x = 0; x <= W; x++) { g.beginPath(); g.moveTo(x * cw, 0); g.lineTo(x * cw, h); g.stroke(); }
        for (let y = 0; y <= H; y++) { g.beginPath(); g.moveTo(0, y * ch); g.lineTo(w, y * ch); g.stroke(); }
        // 真ん中の線（陣地の境目）
        g.strokeStyle = 'rgba(255,255,255,.22)'; g.setLineDash([12, 10]); g.lineWidth = 3;
        g.beginPath(); g.moveTo(w / 2, ch); g.lineTo(w / 2, h - ch); g.stroke();
      });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, H / 2);
      floor.receiveShadow = true;
      this.scene.add(floor);
      this.floor = floor;
      // 机（ステージの外）
      const table = new THREE.Mesh(new THREE.PlaneGeometry(W * 4, H * 4), new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 1 }));
      table.rotation.x = -Math.PI / 2; table.position.set(W / 2, -0.02, H / 2); table.receiveShadow = true;
      this.scene.add(table);
      // 陣地の色（ブロックを置くときだけ）
      const half = (color) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(W / 2 - 1, H - 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.renderOrder = 1; this.scene.add(m); return m;
      };
      this.zoneA = half(0x3b82f6); this.zoneA.position.set(W / 4 + 0.5, 0.01, H / 2);
      this.zoneB = half(0xef4444); this.zoneB.position.set(W * 3 / 4 - 0.5, 0.01, H / 2);
    }

    buildPools() {
      // 材質
      const woodTop = canvasTex(64, 64, (g, w, h) => {
        g.fillStyle = '#d9a066'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 9; i++) { g.strokeStyle = `rgba(120,70,30,${0.12 + Math.random() * 0.1})`; g.beginPath(); g.moveTo(0, i * 7 + Math.random() * 4); g.bezierCurveTo(20, i * 7 + 4, 40, i * 7 - 3, 64, i * 7 + 2); g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
      });
      const cork = canvasTex(64, 64, (g, w, h) => {
        g.fillStyle = '#f6a8bd'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '190,80,110'},${0.25 + Math.random() * 0.3})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 1.6, 0, 7); g.fill(); }
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
      });
      this.mat = {
        hardTop: new THREE.MeshStandardMaterial({ map: woodTop, roughness: 0.8 }),
        hardSide: new THREE.MeshStandardMaterial({ color: 0xb87d45, roughness: 0.85 }),
        softTop: new THREE.MeshStandardMaterial({ map: cork, roughness: 0.9 }),
        softSide: new THREE.MeshStandardMaterial({ color: 0xe8879f, roughness: 0.9 }),
        border: new THREE.MeshStandardMaterial({ color: 0x9c6a3c, roughness: 0.85 }),
        close: new THREE.MeshStandardMaterial({ color: 0xc8402a, emissive: 0xff3b1a, emissiveIntensity: 0.28, roughness: 0.6 }),
        hole: new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 4, 32, 32, 34); gr.addColorStop(0, '#05070c'); gr.addColorStop(0.7, '#0d1220'); gr.addColorStop(0.9, '#56607a'); gr.addColorStop(1, '#8a96b4'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) }),
        warn: new THREE.MeshBasicMaterial({ color: 0xff3b1a, transparent: true, opacity: 0.4, depthWrite: false }),
        glow: new THREE.SpriteMaterial({ map: canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
        scorch: canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(30,18,10,.75)'); gr.addColorStop(0.6, 'rgba(40,25,12,.35)'); gr.addColorStop(1, 'rgba(40,25,12,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); })
      };
      this.geo = {
        box: new THREE.BoxGeometry(1, 1, 1),
        sphere: new THREE.SphereGeometry(1, 14, 10),
        plane: new THREE.PlaneGeometry(1, 1),
        ring: new THREE.RingGeometry(0.8, 1, 48)
      };
      // 衝撃波の輪
      this.rings = [];
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(this.geo.ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 4; this.scene.add(m);
        this.rings.push({ m, t: 0, dur: 1, max: 1 });
      }
      // 光（フラッシュ）
      this.flashes = [];
      for (let i = 0; i < 16; i++) {
        const s = new THREE.Sprite(this.mat.glow.clone()); s.visible = false; s.renderOrder = 5; this.scene.add(s);
        this.flashes.push({ s, t: 0, dur: 1, size: 1 });
      }
      // こげ跡
      this.scorches = [];
      for (let i = 0; i < 30; i++) {
        const m = new THREE.Mesh(this.geo.plane, new THREE.MeshBasicMaterial({ map: this.mat.scorch, transparent: true, depthWrite: false, opacity: 0 }));
        m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.visible = false; m.renderOrder = 1; this.scene.add(m);
        this.scorches.push({ m, t: 0 });
      }
      this.scorchIdx = 0;
      // 破片（箱）
      this.debris = [];
      const dmat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
      for (let i = 0; i < this.q.debris; i++) {
        const m = new THREE.Mesh(this.geo.box, dmat.clone()); m.visible = false; m.castShadow = false; this.scene.add(m);
        this.debris.push({ m, v: new V3(), w: new V3(), life: 0 });
      }
      this.debrisIdx = 0;
      // キャタピラ跡
      this.trackMat = new THREE.MeshBasicMaterial({ color: 0x0a0e18, transparent: true, opacity: 0, depthWrite: false });
      // 照準ガイド
      const gpos = new Float32Array(400 * 3);
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3).setUsage(THREE.DynamicDrawUsage));
      this.guidePts = new THREE.Points(gg, new THREE.PointsMaterial({ size: 0.11, color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
      this.guidePts.frustumCulled = false; this.guidePts.renderOrder = 6;
      this.scene.add(this.guidePts);
      this.guides = [];
      // 置く場所のカーソル
      this.cursor = new THREE.Mesh(this.geo.box, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
      this.cursor.scale.set(0.96, 0.9, 0.96); this.cursor.visible = false; this.scene.add(this.cursor);
    }

    // ---------- 画面サイズ ----------
    resize() {
      const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.dpr));
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.add.mat.uniforms.scale.value = h * Math.min(window.devicePixelRatio || 1, this.q.dpr) * 0.9;
      this.smoke.mat.uniforms.scale.value = this.add.mat.uniforms.scale.value;
      this.fitCamera();
    }
    fitCamera() {
      // 元のゲームと同じく、少し斜め上から見下ろす。ステージ全体が入る距離に調整
      const cam = this.camera, tilt = 0.95; // 地面からの角度（ラジアン）
      cam.fov = 32; cam.updateProjectionMatrix();
      const vfov = cam.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect);
      const needW = W + 0.6, needH = H * Math.sin(tilt) + 1.4 + 1.2;
      const d = Math.max((needW / 2) / Math.tan(hfov / 2), (needH / 2) / Math.tan(vfov / 2));
      this.camBase = new V3(W / 2, Math.sin(tilt) * d, H / 2 + Math.cos(tilt) * d + 0.3);
      this.camLook = new V3(W / 2, 0, H / 2 + 0.3);
      cam.position.copy(this.camBase); cam.lookAt(this.camLook);
    }

    // ---------- ステージ ----------
    buildStage(sim) {
      for (const m of this.blocks.values()) this.scene.remove(m);
      this.blocks.clear();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.syncTile(sim, x, y, false);
      this.clearDynamic();
    }
    tileMesh(k, x, y) {
      if (k === T.HOLE) {
        const m = new THREE.Mesh(this.geo.plane, this.mat.hole);
        m.rotation.x = -Math.PI / 2; m.position.set(x + 0.5, 0.008, y + 0.5); m.scale.set(0.98, 0.98, 1); return m;
      }
      const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      const top = k === T.SOFT ? this.mat.softTop : k === T.CLOSE ? this.mat.close : border ? this.mat.border : this.mat.hardTop;
      const side = k === T.SOFT ? this.mat.softSide : k === T.CLOSE ? this.mat.close : border ? this.mat.border : this.mat.hardSide;
      const hgt = k === T.SOFT ? 0.82 : border ? 0.7 : 0.9;
      const m = new THREE.Mesh(this.geo.box, [side, side, top, side, side, side]);
      m.scale.set(0.98, hgt, 0.98); m.position.set(x + 0.5, hgt / 2, y + 0.5);
      m.castShadow = this.q.shadows; m.receiveShadow = true;
      m.userData.h = hgt;
      return m;
    }
    syncTile(sim, x, y, animate = true) {
      const key = y * W + x, k = sim.tile(x, y), old = this.blocks.get(key);
      if (old && old.userData.k === k) return;
      if (old) { this.scene.remove(old); this.blocks.delete(key); }
      if (k === T.EMPTY) return;
      const m = this.tileMesh(k, x, y); m.userData.k = k;
      if (animate) { m.userData.pop = 0; m.scale.y = 0.01; }
      this.scene.add(m); this.blocks.set(key, m);
    }
    // ブロックを置くとき：自分の陣地は色つき、相手の陣地は暗くする
    showZones(on, mySlot) {
      for (const [z, s, col] of [[this.zoneA, 0, 0x3b82f6], [this.zoneB, 1, 0xef4444]]) {
        if (!on) { z.material.opacity = 0; continue; }
        const mine = mySlot === s;
        z.material.color.set(mine ? col : 0x000000);
        z.material.opacity = mine ? 0.14 : 0.55;
      }
    }
    setCursor(x, y, k, ok) {
      if (x == null) { this.cursor.visible = false; return; }
      this.cursor.visible = true;
      this.cursor.position.set(x + 0.5, 0.45, y + 0.5);
      this.cursor.material.color.set(!ok ? 0xff3b3b : k === T.SOFT ? 0xff8fb0 : 0xffc27a);
    }

    // ---------- 戦車 ----------
    makeTank(slot, radius, look) {
      const g = new THREE.Group();
      const r = radius, color = new THREE.Color(look.color);
      const dark = color.clone().multiplyScalar(0.55);
      const bodyTex = canvasTex(128, 128, (c, w, h) => {
        c.fillStyle = look.color; c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(255,255,255,.85)';
        if (look.pattern === 'stripe') { for (let i = -2; i < 6; i++) { c.save(); c.translate(i * 32, 0); c.rotate(0.6); c.fillRect(0, -20, 12, 220); c.restore(); } }
        else if (look.pattern === 'dot') { for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(20 + (i % 3) * 44, 20 + Math.floor(i / 3) * 44, 9, 0, 7); c.fill(); } }
        else if (look.pattern === 'star') { c.translate(64, 64); c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 18 : 42; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); }
        else if (look.pattern === 'zigzag') { c.lineWidth = 10; c.strokeStyle = 'rgba(255,255,255,.85)'; c.beginPath(); for (let i = 0; i <= 8; i++) c.lineTo(i * 16, i % 2 ? 48 : 80); c.stroke(); }
        c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
      });
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: bodyTex, roughness: 0.5, metalness: 0.05 });
      const sideMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
      const treadMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9 });
      const body = new THREE.Mesh(this.geo.box, [sideMat, sideMat, bodyMat, sideMat, sideMat, sideMat]);
      body.scale.set(r * 1.9, r * 0.62, r * 1.5); body.position.y = r * 0.55;
      const tl = new THREE.Mesh(this.geo.box, treadMat); tl.scale.set(r * 2.05, r * 0.5, r * 0.42); tl.position.set(0, r * 0.28, r * 0.78);
      const tr = tl.clone(); tr.position.z = -r * 0.78;
      // 砲台：1Pは丸、2Pは六角（色が見分けにくくても形でわかる）
      const turretGeo = new THREE.CylinderGeometry(r * 0.55, r * 0.62, r * 0.42, slot === 1 ? 6 : 24);
      const turretMat = new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color(0xffffff), 0.25), roughness: 0.45 });
      const turret = new THREE.Group();
      const tmesh = new THREE.Mesh(turretGeo, turretMat); tmesh.position.y = 0;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.15, r * 0.17, r * 1.35, 12), new THREE.MeshStandardMaterial({ color: dark, roughness: 0.4 }));
      barrel.rotation.z = -Math.PI / 2; barrel.position.x = r * 0.75;
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, r * 0.18, 12), new THREE.MeshStandardMaterial({ color: dark }));
      tip.rotation.z = -Math.PI / 2; tip.position.x = r * 1.4;
      turret.add(tmesh, barrel, tip);
      turret.position.y = r * 1.05;
      // 足元の光る輪（自分の色）
      const ring = new THREE.Mesh(this.geo.ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.015; ring.scale.setScalar(r * 1.55); ring.renderOrder = 1;
      const hull = new THREE.Group(); hull.add(body, tl, tr);
      g.add(hull, turret, ring);
      for (const m of [body, tl, tr, tmesh, barrel, tip]) { m.castShadow = this.q.shadows; m.receiveShadow = true; }
      // 残りの弾（足元の点）
      const ammo = new THREE.Group(); ammo.visible = false;
      const n = HT.CONFIG.MAX_BULLETS;
      for (let i = 0; i < n; i++) {
        const d = new THREE.Mesh(this.geo.sphere, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
        d.scale.setScalar(0.075); d.position.set((i - (n - 1) / 2) * 0.22, 0.08, r * 1.55 + 0.14);
        ammo.add(d);
      }
      g.add(ammo);
      g.userData = { hull, turret, ring, r, rgb: hexToRgb(look.color), lastX: 0, lastY: 0, trackAcc: 0, recoil: 0, ammo, ammoLeft: -1 };
      return g;
    }
    // 使い終わった3Dの部品をメモリから片づける（共有の形や材質は残す）
    dispose(obj) {
      const shared = new Set(Object.values(this.geo));
      const sharedMat = new Set(Object.values(this.mat));
      obj.traverse(o => {
        if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          if (sharedMat.has(m)) continue;
          if (m.map && m.map !== this.mat.glow.map && m.map !== this.mat.scorch) m.map.dispose();
          m.dispose();
        }
      });
    }
    setTanks(list) {
      for (const o of this.tankObjs) if (o) { this.scene.remove(o); this.dispose(o); }
      this.tankObjs = [];
      for (const t of list) {
        if (!t) continue;
        const g = this.makeTank(t.slot, t.radius, t.look);
        g.position.set(t.x, 0, t.y);
        g.userData.lastX = t.x; g.userData.lastY = t.y;
        this.scene.add(g); this.tankObjs[t.slot] = g;
      }
    }

    // ---------- 毎フレーム：シミュレーションの状態を絵に写す ----------
    sync(sim, dt, opt = {}) {
      this.time += dt;
      // 戦車
      for (const t of sim.tanks) {
        if (!t) continue;
        const g = this.tankObjs[t.slot]; if (!g) continue;
        g.visible = t.alive;
        if (!t.alive) continue;
        const u = g.userData;
        g.position.set(t.x, 0, t.y);
        u.hull.rotation.y = -t.a;
        u.turret.rotation.y = -t.aim;
        u.recoil = Math.max(0, u.recoil - dt * 6);
        u.turret.children[1].position.x = u.r * (0.75 - u.recoil * 0.25);
        u.ring.material.opacity = 0.35 + 0.2 * Math.sin(this.time * 4 + t.slot);
        // キャタピラ跡
        const moved = Math.hypot(t.x - u.lastX, t.y - u.lastY);
        u.trackAcc += moved; u.lastX = t.x; u.lastY = t.y;
        if (u.trackAcc > 0.22 && moved < 1) { u.trackAcc = 0; this.trackMark(t.x, t.y, t.a, u.r); }
        if (moved > 0.001 && Math.random() < 0.25) this.smoke.emit(t.x - Math.cos(t.a) * u.r, 0.1, t.y - Math.sin(t.a) * u.r, 0, 0.3, 0, 0.18, 0.5, 0.7, 0.72, 0.8, { grow: 1.5, drag: 3 });
      }
      // 弾
      const seen = new Set();
      for (const b of sim.bullets) {
        seen.add(b.id);
        let o = this.bulletObjs.get(b.id);
        if (!o) o = this.makeBullet(b);
        o.core.position.set(b.x, 0.38, b.y);
        o.glow.position.set(b.x, 0.38, b.y);
        const pulse = 1 + 0.12 * Math.sin(this.time * 30 + o.seed);
        o.glow.scale.setScalar(b.r * 9 * pulse);
        // 尾（反射が残っているほど明るく、速いほど長く）
        const sp = Math.hypot(b.vx, b.vy), n = this.qName === 'low' ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const k = i / n;
          this.add.emit(b.x - b.vx * dt * k, 0.38, b.y - b.vy * dt * k, -b.vx * 0.05, 0, -b.vy * 0.05, b.r * 2.2, 0.16 + sp * 0.012, o.rgb[0], o.rgb[1], o.rgb[2], { drag: 4 });
        }
      }
      for (const [id, o] of this.bulletObjs) if (!seen.has(id)) { this.removeBullet(o); this.bulletObjs.delete(id); }
      // 地雷
      const mseen = new Set();
      for (const m of sim.mines) {
        mseen.add(m.id);
        let o = this.mineObjs.get(m.id);
        if (!o) o = this.makeMine(m);
        const left = C.MINE_FUSE - (sim.time - m.t0);
        const rate = left < 2 ? 14 : left < 5 ? 6 : 2.5;
        const on = Math.sin(this.time * rate) > 0;
        o.lamp.material.emissiveIntensity = on ? 2.2 : 0.2;
        o.glow.visible = on; o.glow.scale.setScalar(on ? 0.9 + (left < 2 ? 0.4 : 0) : 0.5);
      }
      for (const [id, o] of this.mineObjs) if (!mseen.has(id)) { this.removeMine(o); this.mineObjs.delete(id); }
      // サドンデスの予告
      this.updateWarn(sim);
      // ブロックの出現アニメ
      for (const m of this.blocks.values()) {
        if (m.userData.pop == null) continue;
        m.userData.pop = Math.min(1, m.userData.pop + dt * 4);
        const p = m.userData.pop, e = 1 + 0.25 * Math.sin(p * Math.PI);
        if (m.userData.h) { m.scale.y = Math.max(0.01, m.userData.h * p * e); m.position.y = m.scale.y / 2; }
        if (p >= 1) { delete m.userData.pop; if (m.userData.h) { m.scale.y = m.userData.h; m.position.y = m.userData.h / 2; } }
      }
      this.updateEffects(dt);
    }
    removeBullet(o) { this.scene.remove(o.core); this.scene.remove(o.glow); o.core.material.dispose(); o.glow.material.dispose(); }
    removeMine(o) { this.scene.remove(o.g); this.scene.remove(o.glow); this.dispose(o.g); o.glow.material.dispose(); }
    setAmmo(slot, left, show) {
      const g = this.tankObjs[slot]; if (!g) return;
      const u = g.userData;
      u.ammo.visible = !!show;
      if (!show || u.ammoLeft === left) return;
      u.ammoLeft = left;
      u.ammo.children.forEach((d, i) => {
        const on = i < left;
        d.material.color.set(on ? 0xfff3b0 : 0x3a4560); d.material.opacity = on ? 1 : 0.7;
        d.scale.setScalar(on ? 0.085 : 0.06);
      });
    }
    makeBullet(b) {
      const owner = this.tankObjs[b.owner];
      const rgb = owner ? owner.userData.rgb.map(v => Math.min(1, v * 0.6 + 0.45)) : [1, 0.9, 0.6];
      const core = new THREE.Mesh(this.geo.sphere, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      core.scale.setScalar(b.r);
      const glow = new THREE.Sprite(this.mat.glow.clone());
      glow.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
      glow.renderOrder = 5;
      this.scene.add(core); this.scene.add(glow);
      const o = { core, glow, rgb, seed: Math.random() * 10 };
      this.bulletObjs.set(b.id, o);
      return o;
    }
    makeMine(m) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(C.MINE_RADIUS, C.MINE_RADIUS * 1.1, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.5 }));
      base.position.y = 0.06;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(C.MINE_RADIUS * 1.02, C.MINE_RADIUS * 1.02, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      band.position.y = 0.08;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1 }));
      lamp.position.y = 0.15;
      g.add(base, band, lamp);
      g.position.set(m.x, 0, m.y);
      for (const c of [base, band]) c.castShadow = this.q.shadows;
      const glow = new THREE.Sprite(this.mat.glow.clone()); glow.material.color.set(0xff3030); glow.position.set(m.x, 0.18, m.y); glow.renderOrder = 5;
      this.scene.add(g); this.scene.add(glow);
      const o = { g, lamp, glow };
      this.mineObjs.set(m.id, o);
      return o;
    }
    trackMark(x, y, a, r) {
      for (const side of [-1, 1]) {
        let m = this.tracks[this.trackIdx];
        if (!m) { m = new THREE.Mesh(this.geo.plane, this.trackMat.clone()); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; this.scene.add(m); this.tracks[this.trackIdx] = m; }
        this.trackIdx = (this.trackIdx + 1) % 260;
        const ox = -Math.sin(a) * r * 0.78 * side, oy = Math.cos(a) * r * 0.78 * side;
        m.position.set(x + ox, 0.011, y + oy);
        m.rotation.z = -a;
        m.scale.set(r * 0.25, r * 0.36, 1);
        m.material.opacity = 0.45; m.userData.t = 7;
        m.visible = true;
      }
    }
    updateWarn(sim) {
      if (!this.warnMeshes) this.warnMeshes = [];
      const ring = sim.warnRing || 0;
      if (ring !== this.warnShown) {
        for (const m of this.warnMeshes) this.scene.remove(m);
        this.warnMeshes = [];
        if (ring) for (const [x, y] of sim.ringTiles(ring)) {
          if (sim.tile(x, y) !== T.EMPTY && sim.tile(x, y) !== T.HOLE) continue;
          const m = new THREE.Mesh(this.geo.plane, this.mat.warn); m.rotation.x = -Math.PI / 2; m.position.set(x + 0.5, 0.013, y + 0.5); m.renderOrder = 1;
          this.scene.add(m); this.warnMeshes.push(m);
        }
        this.warnShown = ring;
      }
      this.mat.warn.opacity = 0.25 + 0.25 * Math.sin(this.time * 12);
    }

    // ---------- 出来事に合わせたエフェクト ----------
    handle(ev, sim) {
      switch (ev.type) {
        case 'fire': {
          const o = this.tankObjs[ev.slot]; if (o) o.userData.recoil = 1;
          const rgb = o ? o.userData.rgb : [1, 1, 1];
          const cx = ev.x, cy = ev.y, ca = Math.cos(ev.a), sa = Math.sin(ev.a);
          this.flash(cx, 0.4, cy, 0.9, 0.12, 0xfff0c0);
          for (let i = 0; i < 10; i++) {
            const s = 2 + Math.random() * 3, sp = (Math.random() - 0.5) * 1.2;
            this.add.emit(cx, 0.4, cy, (ca + sp * -sa) * s, Math.random() * 0.8, (sa + sp * ca) * s, 0.12, 0.18, 1, 0.85, 0.5, { drag: 6 });
          }
          for (let i = 0; i < 4; i++) this.smoke.emit(cx, 0.4, cy, ca * 0.8 + (Math.random() - 0.5) * 0.4, 0.4, sa * 0.8 + (Math.random() - 0.5) * 0.4, 0.22, 0.6, 0.9, 0.9, 0.92, { grow: 2.5, drag: 2.5 });
          HT.Sound.fire();
          break;
        }
        case 'bounce': {
          const o = this.tankObjs[ev.owner], rgb = o ? o.userData.rgb : [1, 1, 1];
          this.sparks(ev.x, 0.38, ev.y, 14, [1, 0.95, 0.7], 4);
          this.sparks(ev.x, 0.38, ev.y, 6, rgb, 3);
          this.flash(ev.x, 0.38, ev.y, 0.7, 0.1, 0xffffff);
          HT.Sound.bounce();
          break;
        }
        case 'bulletDie': case 'pop':
          this.sparks(ev.x, 0.38, ev.y, 12, [1, 0.8, 0.45], 3);
          this.puff(ev.x, ev.y, 4, 0.25);
          this.flash(ev.x, 0.38, ev.y, 0.9, 0.12, 0xffd080);
          HT.Sound.pop();
          break;
        case 'clash':
          this.sparks(ev.x, 0.38, ev.y, 26, [1, 1, 0.8], 5);
          this.ringFx(ev.x, ev.y, 0.9, 0.3, 0xffffff);
          this.flash(ev.x, 0.4, ev.y, 1.6, 0.18, 0xffffff);
          HT.Sound.clash();
          break;
        case 'remoteHit':
          this.sparks(ev.x, 0.4, ev.y, 10, [1, 0.9, 0.6], 3);
          break;
        case 'mine': HT.Sound.mine(); break;
        case 'blast': this.explosion(ev.x, ev.y, 1.25, [1, 0.6, 0.2]); HT.Sound.blast(); break;
        case 'break': {
          this.syncTile(sim, ev.x, ev.y);
          for (let i = 0; i < 10; i++) this.debrisPiece(ev.x + 0.5, 0.5, ev.y + 0.5, 0xf6a8bd, 0.12 + Math.random() * 0.12, 4);
          this.puff(ev.x + 0.5, ev.y + 0.5, 6, 0.5, [0.98, 0.8, 0.85]);
          HT.Sound.crunch();
          break;
        }
        case 'wall': {
          this.syncTile(sim, ev.x, ev.y);
          if (Math.random() < 0.4) this.puff(ev.x + 0.5, ev.y + 0.5, 2, 0.3, [0.9, 0.5, 0.4]);
          if (!this._wallSound || this.time - this._wallSound > 0.3) { this._wallSound = this.time; HT.Sound.wall(); this.addShake(0.15); }
          break;
        }
        case 'die': {
          const o = this.tankObjs[ev.slot];
          const rgb = o ? o.userData.rgb : [1, 0.5, 0.2];
          this.explosion(ev.x, ev.y, 1.5, [1, 0.55, 0.15], rgb);
          if (o) {
            // 砲台が吹き飛ぶ
            const u = o.userData;
            for (let i = 0; i < 6; i++) this.debrisPiece(ev.x, 0.5, ev.y, new THREE.Color(rgb[0], rgb[1], rgb[2]).getHex(), u.r * (0.25 + Math.random() * 0.35), 7);
            this.debrisPiece(ev.x, 0.8, ev.y, 0x333333, u.r * 0.5, 9);
          }
          HT.Sound.die();
          break;
        }
      }
    }
    sparks(x, y, z, n, rgb, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random()), up = Math.random() * speed * 0.8;
        this.add.emit(x, y, z, Math.cos(a) * s, up, Math.sin(a) * s, 0.07 + Math.random() * 0.06, 0.25 + Math.random() * 0.3, rgb[0], rgb[1], rgb[2], { drag: 3, grav: 9 });
      }
    }
    puff(x, z, n, size, rgb = [0.75, 0.75, 0.8]) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 0.3 + Math.random() * 0.8;
        this.smoke.emit(x, 0.3, z, Math.cos(a) * s, 0.5 + Math.random() * 0.6, Math.sin(a) * s, size * (0.6 + Math.random() * 0.6), 0.8 + Math.random() * 0.6, rgb[0], rgb[1], rgb[2], { grow: 2, drag: 1.8 });
      }
    }
    explosion(x, z, scale, fire, extra) {
      const q = this.qName === 'low' ? 0.5 : 1;
      this.flash(x, 0.6, z, 4.5 * scale, 0.35, 0xffe0a0);
      this.flash(x, 0.4, z, 2.2 * scale, 0.6, 0xff7020);
      this.ringFx(x, z, 2.6 * scale, 0.45, 0xffd28a);
      this.ringFx(x, z, 1.6 * scale, 0.3, 0xffffff);
      // 火の玉
      for (let i = 0; i < 46 * q; i++) {
        const a = Math.random() * Math.PI * 2, s = (1.2 + Math.random() * 3.2) * scale, up = 1 + Math.random() * 3.5;
        const c = Math.random();
        this.add.emit(x, 0.4, z, Math.cos(a) * s, up, Math.sin(a) * s, (0.35 + Math.random() * 0.45) * scale, 0.35 + Math.random() * 0.45, fire[0], fire[1] * (0.6 + c * 0.6), fire[2] * c, { grow: 1.6, drag: 3.5, grav: -1 });
      }
      // 火花
      for (let i = 0; i < 40 * q; i++) {
        const a = Math.random() * Math.PI * 2, s = (4 + Math.random() * 6) * scale;
        this.add.emit(x, 0.4, z, Math.cos(a) * s, 2 + Math.random() * 5, Math.sin(a) * s, 0.08, 0.5 + Math.random() * 0.5, 1, 0.9, 0.55, { drag: 1.5, grav: 12 });
      }
      if (extra) for (let i = 0; i < 18 * q; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
        this.add.emit(x, 0.5, z, Math.cos(a) * s, 1 + Math.random() * 3, Math.sin(a) * s, 0.16, 0.5 + Math.random() * 0.4, extra[0], extra[1], extra[2], { drag: 2, grav: 6 });
      }
      // 煙
      for (let i = 0; i < 20 * q; i++) {
        const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random() * 1.4) * scale;
        this.smoke.emit(x + Math.cos(a) * 0.3, 0.5, z + Math.sin(a) * 0.3, Math.cos(a) * s, 0.8 + Math.random() * 1.2, Math.sin(a) * s, (0.5 + Math.random() * 0.5) * scale, 1.4 + Math.random() * 1.2, 0.55, 0.55, 0.6, { grow: 2.4, drag: 1.2 });
      }
      // 破片
      for (let i = 0; i < 8 * q; i++) this.debrisPiece(x, 0.4, z, 0x3a3430, 0.06 + Math.random() * 0.1, 6);
      this.scorch(x, z, 1.4 * scale);
      this.addShake(0.55 * scale);
      if (this.q.light) { this.flashLight.position.set(x, 1.4, z); this.flashLight.intensity = 30; this.flashLightT = 0.35; }
    }
    flash(x, y, z, size, dur, color) {
      const f = this.flashes.find(f => f.t <= 0) || this.flashes[0];
      f.s.visible = true; f.s.position.set(x, y, z); f.s.material.color.set(color); f.t = f.dur = dur; f.size = size;
      f.s.scale.setScalar(size);
    }
    ringFx(x, z, max, dur, color) {
      const r = this.rings.find(r => r.t <= 0) || this.rings[0];
      r.m.visible = true; r.m.position.set(x, 0.05, z); r.m.material.color.set(color); r.t = r.dur = dur; r.max = max;
    }
    scorch(x, z, size) {
      const s = this.scorches[this.scorchIdx]; this.scorchIdx = (this.scorchIdx + 1) % this.scorches.length;
      s.m.visible = true; s.m.position.set(x, 0.012 + this.scorchIdx * 0.0001, z); s.m.scale.set(size, size, 1); s.m.material.opacity = 0.9; s.t = 14;
    }
    debrisPiece(x, y, z, color, size, speed) {
      const d = this.debris[this.debrisIdx]; this.debrisIdx = (this.debrisIdx + 1) % this.debris.length;
      d.m.visible = true; d.m.position.set(x, y, z); d.m.scale.setScalar(size); d.m.material.color.set(color);
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      d.v.set(Math.cos(a) * s, 2 + Math.random() * speed, Math.sin(a) * s);
      d.w.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      d.life = 2.5 + Math.random();
    }
    addShake(v) { this.shake = Math.min(1.2, this.shake + v); }

    updateEffects(dt) {
      this.add.update(dt); this.smoke.update(dt);
      for (const f of this.flashes) {
        if (f.t <= 0) continue;
        f.t -= dt; const k = Math.max(0, f.t / f.dur);
        f.s.material.opacity = k; f.s.scale.setScalar(f.size * (1.2 - 0.2 * k));
        if (f.t <= 0) f.s.visible = false;
      }
      for (const r of this.rings) {
        if (r.t <= 0) continue;
        r.t -= dt; const k = 1 - Math.max(0, r.t / r.dur);
        r.m.scale.setScalar(0.2 + r.max * (1 - Math.pow(1 - k, 3)));
        r.m.material.opacity = (1 - k) * 0.9;
        if (r.t <= 0) r.m.visible = false;
      }
      for (const s of this.scorches) {
        if (s.t <= 0) continue;
        s.t -= dt; s.m.material.opacity = Math.min(0.9, s.t / 4);
        if (s.t <= 0) s.m.visible = false;
      }
      for (const d of this.debris) {
        if (d.life <= 0) continue;
        d.life -= dt;
        d.v.y -= 14 * dt;
        d.m.position.addScaledVector(d.v, dt);
        if (d.m.position.y < d.m.scale.y / 2) { d.m.position.y = d.m.scale.y / 2; d.v.y *= -0.35; d.v.x *= 0.7; d.v.z *= 0.7; d.w.multiplyScalar(0.7); }
        d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
        if (d.life < 0.6) d.m.scale.multiplyScalar(0.92);
        if (d.life <= 0) d.m.visible = false;
      }
      for (const m of this.tracks) {
        if (!m || !m.visible) continue;
        m.userData.t -= dt; m.material.opacity = Math.min(0.45, m.userData.t / 7 * 0.45);
        if (m.userData.t <= 0) m.visible = false;
      }
      if (this.flashLightT > 0) { this.flashLightT -= dt; this.flashLight.intensity = Math.max(0, this.flashLightT / 0.35) * 30; }
      // カメラ（揺れと寄り）
      this.shake = Math.max(0, this.shake - dt * 2.2);
      const cam = this.camera;
      let base = this.camBase, look = this.camLook;
      if (this.zoom) {
        const z = this.zoom; z.t = Math.min(1, z.t + dt * 2.5);
        const e = z.t * z.t * (3 - 2 * z.t);
        const target = new V3(z.x, 0, z.y);
        look = this.camLook.clone().lerp(target, e * 0.85);
        base = this.camBase.clone().lerp(new V3(z.x, this.camBase.y * 0.45, z.y + (this.camBase.z - this.camLook.z) * 0.45), e);
      }
      const s = this.shake * this.shake * 0.45;
      cam.position.set(base.x + (Math.random() - 0.5) * s, base.y + (Math.random() - 0.5) * s, base.z + (Math.random() - 0.5) * s);
      cam.lookAt(look);
    }
    setZoom(x, y) { this.zoom = x == null ? null : { x, y, t: 0 }; }

    // 照準ガイド（最初の反射＋少しまで、点線で）
    setGuides(list) {
      const pos = this.guidePts.geometry.attributes.position.array;
      let n = 0;
      for (const g of list) {
        const pts = g.pts;
        let dist = 0, limit = Infinity;
        for (let i = 1; i < pts.length && n < 395; i++) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          const seg = Math.hypot(x1 - x0, y1 - y0);
          for (let d = (0.35 - (dist % 0.35)); d < seg && n < 395; d += 0.35) {
            if (dist + d > limit) break;
            const k = d / seg;
            pos[n * 3] = x0 + (x1 - x0) * k; pos[n * 3 + 1] = 0.36; pos[n * 3 + 2] = y0 + (y1 - y0) * k; n++;
          }
          dist += seg;
          if (i === 1) limit = dist + 1.6; // 最初の反射のあと1.6マスまで
          if (dist > limit) break;
        }
        if (g.color) this.guidePts.material.color.set(g.color);
      }
      this.guidePts.geometry.attributes.position.needsUpdate = true;
      this.guidePts.geometry.setDrawRange(0, n);
    }

    clearDynamic() {
      for (const o of this.bulletObjs.values()) this.removeBullet(o);
      this.bulletObjs.clear();
      for (const o of this.mineObjs.values()) this.removeMine(o);
      this.mineObjs.clear();
      this.add.clear(); this.smoke.clear();
      for (const m of this.tracks) if (m) m.visible = false;
      for (const s of this.scorches) { s.t = 0; s.m.visible = false; }
      for (const d of this.debris) { d.life = 0; d.m.visible = false; }
      for (const f of this.flashes) { f.t = 0; f.s.visible = false; }
      for (const r of this.rings) { r.t = 0; r.m.visible = false; }
      if (this.warnMeshes) for (const m of this.warnMeshes) this.scene.remove(m);
      this.warnMeshes = []; this.warnShown = 0;
      this.zoom = null; this.shake = 0;
      this.setGuides([]);
    }

    render() { this.renderer.render(this.scene, this.camera); }

    // 画面の点 → ステージの座標
    screenToGround(px, py) {
      const r = this.canvas.getBoundingClientRect();
      const v = new V3(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1, 0.5);
      v.unproject(this.camera);
      const dir = v.sub(this.camera.position).normalize();
      const t = -this.camera.position.y / dir.y;
      return { x: this.camera.position.x + dir.x * t, y: this.camera.position.z + dir.z * t };
    }
    worldToScreen(x, y, h = 1.2) {
      const v = new V3(x, h, y).project(this.camera);
      const r = this.canvas.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    }
  }

  HT.Renderer = Renderer;
})();
