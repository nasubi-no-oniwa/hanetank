// =============================================
//  効果音（すべてその場で合成。音声ファイルなし）
// =============================================
(function () {
  let ctx = null, master = null, noiseBuf = null, on = true, quiet = false;
  try { on = localStorage.getItem('ht_sound') !== '0'; } catch (e) {}
  const last = {};

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  // 同じ音が一瞬に重なりすぎないように
  function gate(name, gap) {
    if (!on || !ctx || quiet) return false;
    const t = ctx.currentTime;
    if (last[name] && t - last[name] < gap) return false;
    last[name] = t; return true;
  }
  function tone(type, f0, f1, dur, vol, delay = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, f0, f1, q = 1, type = 'lowpass', delay = 0) {
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  HT.Sound = {
    init,
    setQuiet(v) { quiet = !!v; },
    get on() { return on; },
    toggle() { on = !on; try { localStorage.setItem('ht_sound', on ? '1' : '0'); } catch (e) {} if (on) init(); return on; },
    fire() { if (!gate('fire', 0.03)) return; noise(0.12, 0.5, 3000, 300, 1); tone('square', 420, 120, 0.09, 0.12); },
    bounce() { if (!gate('bounce', 0.04)) return; tone('triangle', 1300 + Math.random() * 300, 600, 0.08, 0.18); },
    pop() { if (!gate('pop', 0.04)) return; noise(0.08, 0.3, 2400, 600, 2, 'bandpass'); },
    clash() { if (!gate('clash', 0.05)) return; tone('sine', 1800, 900, 0.15, 0.2); noise(0.12, 0.3, 5000, 1000, 1, 'highpass'); },
    mine() { if (!gate('mine', 0.1)) return; tone('square', 300, 300, 0.05, 0.08); tone('square', 450, 450, 0.05, 0.08, 0.07); },
    blast() { if (!gate('blast', 0.06)) return; noise(0.9, 0.9, 1200, 60, 0.7); tone('sine', 120, 30, 0.6, 0.6); },
    die() { if (!gate('die', 0.06)) return; noise(1.3, 1.0, 1800, 50, 0.6); tone('sine', 160, 25, 0.9, 0.7); tone('sawtooth', 300, 40, 0.5, 0.12, 0.02); },
    crunch() { if (!gate('crunch', 0.05)) return; noise(0.25, 0.45, 900, 200, 3, 'bandpass'); tone('square', 180, 70, 0.12, 0.1); },
    wall() { if (!gate('wall', 0.2)) return; noise(0.35, 0.5, 400, 60, 1); tone('sine', 90, 50, 0.3, 0.3); },
    click() { if (!gate('click', 0.03)) return; tone('triangle', 900, 700, 0.05, 0.12); },
    place() { if (!gate('place', 0.03)) return; tone('triangle', 500, 900, 0.08, 0.16); noise(0.05, 0.15, 3000, 1500, 1); },
    bad() { if (!gate('bad', 0.1)) return; tone('square', 200, 150, 0.12, 0.1); },
    count() { if (!gate('count', 0.2)) return; tone('square', 660, 660, 0.12, 0.12); },
    go() { if (!gate('go', 0.2)) return; tone('square', 990, 990, 0.25, 0.14); tone('triangle', 1320, 1320, 0.3, 0.1, 0.05); },
    warn() { if (!gate('warn', 0.5)) return; tone('sawtooth', 520, 520, 0.15, 0.08); tone('sawtooth', 520, 520, 0.15, 0.08, 0.22); },
    stamp() { if (!gate('stamp', 0.1)) return; tone('sine', 700, 1100, 0.12, 0.14); },
    win() { if (!on || !ctx || quiet) return; [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.22, 0.16, i * 0.11)); },
    lose() { if (!on || !ctx || quiet) return; [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.97, 0.3, 0.14, i * 0.16)); },
    draw() { if (!on || !ctx || quiet) return; [440, 440].forEach((f, i) => tone('triangle', f, f, 0.18, 0.12, i * 0.2)); }
  };
})();
