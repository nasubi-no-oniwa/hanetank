// =============================================
//  なすびのお庭  ランダム対戦（だれかと対戦）共通部品  QM
//
//  しくみ：待っている人どうしに、同じ「あいことば」を自動で配るだけ。
//  部屋に入ってからの対戦は、各ゲームのあいことば対戦をそのまま使う。
//
//  データの形（Firebase Realtime Database）
//    qm/{ゲーム}/{版}/{id} : { t, n, cpu, by, code, ok, no }   待ち合わせ
//      t    … 待ち始めた時刻（サーバーの時刻）
//      n    … なまえ
//      cpu  … CPUと遊びながら待っている（自分からは声をかけない）
//      by   … 声をかけた人のid（声をかけられたら入る）
//      code … 2人で使うあいことば
//      ok   … 声をかけられた人の「OK」／ no … 「見送り」
//    pres/{id} : { g, s }   いまの人数（s: w=待っている c=CPUで待っている p=対戦中）
//
//  各ゲームは QM.setup({...}) で、入り方などを教える。
// =============================================
(function () {
  const QM = window.QM = window.QM || {};
  const DBURL = 'https://sakasama-drop-default-rtdb.asia-southeast1.firebasedatabase.app';
  const T = (k, v) => (window.I18N ? I18N.t(k, v) : k);
  const WAIT_CPU_SEC = 20;      // これだけ待っても相手がいなければ「CPUで待つ」を出す
  const ACCEPT_SEC = 30;        // 相手が見つかったときに「対戦する」を押せる時間
  const SCAN_MS = 3500;         // 待っている間、ほかの人をさがし直す間隔
  const OK_WAIT_MS = 9000;      // 声をかけて「OK」を待つ時間（ふつう）
  const OK_WAIT_CPU_MS = (ACCEPT_SEC + 6) * 1000;
  const JOIN_TIMEOUT_MS = 25000;// あいことばで入ってから試合の画面になるまでの上限
  const STALE_MS = 10 * 60 * 1000;
  const COUNT_MS = 30000;
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);
  const rcode = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = 'q'; for (let i = 0; i < 9; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
  const TS = { '.sv': 'timestamp' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  // ---------------------------------------------
  //  なまえの言葉チェック
  // ---------------------------------------------
  const NG = [
    // 性的なことば
    'ちんこ', 'ちんぽ', 'ちんちん', 'まんこ', 'まんまん', 'おめこ', 'せっくす', 'えっち', 'ふぇら', 'くんに', 'おなに', 'ぼっき', 'しゃせい', 'ぱいぱん', 'おっぱい', 'ちくび', 'きんたま', 'こうび', 'やりまん', 'やりちん', 'ぶっかけ', 'なかだし', 'れいぷ', 'ごうかん', 'えんこう', 'ばいしゅん', 'うりせん', 'あだると', 'えろ',
    '性交', '強姦', '援交', '売春', '射精', '勃起', '自慰', '陰茎', '膣',
    // 人を傷つけることば
    'しね', 'ころす', 'ころしてやる', 'きえろ', 'ころすぞ', 'きちがい', 'きちげぇ', 'がいじ', 'しょうがいじ', 'かたわ', 'めくら', 'つんぼ', 'おし', 'ちょん', 'しなじん', 'じゃっぷ', 'ほもやろう', 'れずやろう', 'ぶす', 'でぶす', 'くず', 'かす',
    '死ね', '氏ね', '殺す', '殺害', '気違い', '基地外', '池沼', '支那',
    // 英字
    'sex', 'fuck', 'shit', 'bitch', 'nigger', 'nigga', 'dick', 'cock', 'pussy', 'porn', 'penis', 'vagina', 'rape', 'kill', 'tinko', 'tinpo', 'chinko', 'manko', 'ecchi', 'onani', 'shine', 'korosu',
  ];
  // 「おし」「かす」「くず」「ぶす」などは、ほかの言葉の一部にもなるので、名前ぜんぶがその言葉のときだけ
  const NG_WHOLE = new Set(['おし', 'かす', 'くず', 'ぶす', 'えろ', 'えっち', 'ちょん', 'kill', 'shine', 'shit', 'rape', 'ecchi']);
  // 「しね」は、名前のはじめか終わりにあるとき（「しねしね」「おまえしね」）
  const NG_EDGE = new Set(['しね', '氏ね']);
  function norm(s) {
    s = String(s || '').normalize('NFKC').toLowerCase();
    s = s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
    return s.replace(/[\s　・ー〜~_\-.。、,!！?？*＊@#&^'"`()（）「」\[\]{}<>／/\\|:;0-9]/g, '');
  }
  const NGN = NG.map(w => [norm(w), NG_WHOLE.has(w) ? 'whole' : NG_EDGE.has(w) ? 'edge' : 'any']);
  QM.isBad = function (name) {
    const n = norm(name); if (!n) return false;
    for (const [w, how] of NGN) {
      if (!w) continue;
      if (how === 'whole' ? n === w : how === 'edge' ? (n.startsWith(w) || n.endsWith(w)) : n.includes(w)) return true;
    }
    return false;
  };
  // 悪い言葉が入っていたら、名前を「＊＊」にする（長さはそのまま、8文字まで）
  QM.ng = function (name) {
    const s = String(name == null ? '' : name).trim().slice(0, 8);
    if (!QM.isBad(s)) return s;
    return '＊'.repeat(Math.max(2, Math.min(8, [...s].length)));
  };

  // ---------------------------------------------
  //  対戦タイム（毎晩21時〜22時・日本時間）
  // ---------------------------------------------
  QM.jstHour = () => new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
  QM.isPrime = () => QM.jstHour() === 21;
  QM.primeText = () => T(QM.isPrime() ? 'qm_prime_hot' : 'qm_prime');

  // ---------------------------------------------
  //  人数（30秒に1回だけ見に行く。つながりっぱなしにしないので、上限を使わない）
  // ---------------------------------------------
  QM.restGet = async function (path) {
    const r = await fetch(DBURL + '/' + path + '.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  };
  QM.countAll = async function () {
    const v = (await QM.restGet('pres')) || {};
    const out = {};
    for (const k in v) {
      const e = v[k]; if (!e || !e.g) continue;
      const o = out[e.g] = out[e.g] || { wait: 0, play: 0 };
      if (e.s === 'p') o.play++; else o.wait++;
    }
    for (const g in out) out[g].pairs = Math.ceil(out[g].play / 2);
    return out;
  };

  // ---------------------------------------------
  //  見た目（どのゲームでも同じ部品。色だけゲームに合わせる）
  // ---------------------------------------------
  const CSS = `
.qm-ov{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:rgba(10,12,20,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);padding:16px;font-family:inherit}
.qm-ov.on{display:flex}
.qm-card{width:min(400px,100%);max-height:calc(100% - 8px);overflow:auto;background:var(--qm-bg,#fffaf0);color:var(--qm-fg,#2a2320);border-radius:22px;padding:22px 20px 18px;box-shadow:0 20px 60px rgba(0,0,0,.35);text-align:center;font-family:inherit}
.qm-card h3{margin:0 0 6px;font-size:22px;font-weight:900;letter-spacing:.02em}
.qm-card p{margin:6px 0;font-size:14px;line-height:1.55}
.qm-sub{opacity:.75;font-size:13px!important}
.qm-fld{display:flex;align-items:center;gap:8px;margin:12px 0 4px;font-weight:800;font-size:14px;justify-content:center}
.qm-fld input{flex:1;max-width:220px;font:inherit;font-size:17px;padding:9px 12px;border-radius:12px;border:2px solid rgba(0,0,0,.18);background:#fff;color:#222}
.qm-b{display:block;width:100%;margin:9px 0 0;padding:12px 14px;border:0;border-radius:14px;font:inherit;font-size:17px;font-weight:900;cursor:pointer;background:var(--qm-main,#e2553f);color:#fff;box-shadow:0 4px 0 rgba(0,0,0,.2)}
.qm-b:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.2)}
.qm-b.sub{background:rgba(127,127,127,.2);color:inherit;box-shadow:none;font-size:15px}
.qm-b.alt{background:var(--qm-alt,#3d6fd8)}
.qm-b[hidden]{display:none}
.qm-b:disabled{opacity:.5}
.qm-dots{display:inline-flex;gap:6px;margin:12px 0 4px}
.qm-dots i{width:11px;height:11px;border-radius:50%;background:var(--qm-main,#e2553f);animation:qmdot 1.1s infinite ease-in-out}
.qm-dots i:nth-child(2){animation-delay:.15s}.qm-dots i:nth-child(3){animation-delay:.3s}
@keyframes qmdot{0%,80%,100%{transform:scale(.55);opacity:.4}40%{transform:scale(1);opacity:1}}
.qm-big{font-size:30px!important;font-weight:900;margin:2px 0!important;font-variant-numeric:tabular-nums}
.qm-err{color:var(--qm-err,#c0281c);font-weight:800;min-height:1em}
.qm-prime{display:inline-block;margin-top:8px;font-size:12.5px!important;font-weight:800;padding:3px 12px;border-radius:999px;background:rgba(127,127,127,.18)}
.qm-prime.hot{background:#ffcf3a;color:#3a2a00}
.qm-bar{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147482999;display:none;align-items:center;gap:10px;max-width:calc(100% - 20px);padding:8px 10px 8px 16px;border-radius:999px;background:rgba(20,22,30,.9);color:#fff;font-family:inherit;font-size:14px;font-weight:800;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.qm-bar.on{display:flex}
.qm-bar.found{background:#e2553f;animation:qmpulse 1s infinite}
@keyframes qmpulse{50%{box-shadow:0 0 0 6px rgba(226,85,63,.35),0 8px 24px rgba(0,0,0,.35)}}
.qm-bar button{border:0;border-radius:999px;padding:7px 14px;font:inherit;font-size:14px;font-weight:900;cursor:pointer;background:#fff;color:#222;white-space:nowrap}
.qm-bar button.x{background:rgba(255,255,255,.18);color:#fff}
.qm-bar span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qm-cnt{display:block;margin:6px auto 0;font-size:12.5px;font-weight:800;opacity:.85;text-align:center;line-height:1.5}
.qm-cnt b{font-size:14px}
.qm-cnt .qm-prime{margin-top:3px}
.qm-next{margin-top:8px}
`;
  let ui = null;
  function buildUI() {
    if (ui) return ui;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const ov = document.createElement('div'); ov.className = 'qm-ov'; ov.innerHTML = '<div class="qm-card" role="dialog" aria-modal="true"></div>';
    const bar = document.createElement('div'); bar.className = 'qm-bar';
    document.body.appendChild(ov); document.body.appendChild(bar);
    ui = { ov, card: ov.firstChild, bar };
    return ui;
  }
  function card(html) { buildUI(); ui.card.innerHTML = html; ui.ov.classList.add('on'); return ui.card; }
  function closeCard() { if (ui) ui.ov.classList.remove('on'); }
  function bar(html, cls) { buildUI(); ui.bar.className = 'qm-bar on' + (cls ? ' ' + cls : ''); ui.bar.innerHTML = html; return ui.bar; }
  function closeBar() { if (ui) ui.bar.className = 'qm-bar'; }
  const $c = sel => ui.card.querySelector(sel);
  const $b = sel => ui.bar.querySelector(sel);

  // ---------------------------------------------
  //  状態
  // ---------------------------------------------
  let A = null;                 // ゲームから教えてもらったこと
  let db = null;
  const S = {
    phase: 'idle',              // idle / search / cpu / found / joining / playing
    id: null, name: '', t0: 0, myT: 0, reg: false, entRef: null, entFn: null, scanT: null, tickT: null,
    busy: false, claimTry: null, foundT: null, joinT: null, code: null, random: false, slot: -1,
    presRef: null, presS: null, tries: 0,
  };
  QM.state = () => S.phase;
  QM.isRandom = () => !!S.random && (S.phase === 'playing' || S.phase === 'joining');
  QM.code = () => S.code;

  function ent() { return db.ref('qm/' + A.game + '/' + A.ver + '/' + S.id); }
  function listRef() { return db.ref('qm/' + A.game + '/' + A.ver); }
  function setPres(s) {
    if (!db) return;
    if (!S.presRef) { S.presRef = db.ref('pres/' + (S.pid || (S.pid = uid()))); S.presRef.onDisconnect().remove(); }
    if (S.presS === s) return; S.presS = s;
    if (s) S.presRef.set({ g: A.game, s }); else { S.presRef.remove(); S.presS = null; }
  }

  // ---------------------------------------------
  //  ゲームに組みこむ
  // ---------------------------------------------
  //  a = {
  //    game: 'daruma', ver: '1', name: '4つ目のダルマ',
  //    getDb: async () => db,
  //    anchor: '#btn-online',            … この下に「だれかと対戦」ボタンと人数を出す
  //    btnClass: 'btn wide',             … ボタンの見た目（ゲームのボタンと同じ）
  //    nameKey: 'daruma-name',           … なまえを覚えておく場所（ゲームと同じにする）
  //    join: (code, name) => {},         … そのあいことばで部屋に入る
  //    prep: () => {},                   … ランダム対戦の標準ルールにそろえる
  //    cpu: () => {},  cpuLabel: 'CPUと遊びながら待つ'  … 待っている間に遊ぶ
  //    quit: () => {},                   … いまのゲームをやめてタイトルへ（部屋も出る）
  //    colors: { main, alt, bg, fg },
  //  }
  QM.setup = function (a) {
    A = a; buildUI();
    const c = a.colors || {};
    if (c.main) document.documentElement.style.setProperty('--qm-main', c.main);
    if (c.alt) document.documentElement.style.setProperty('--qm-alt', c.alt);
    if (c.bg) document.documentElement.style.setProperty('--qm-bg', c.bg);
    if (c.fg) document.documentElement.style.setProperty('--qm-fg', c.fg);
    if (c.err) document.documentElement.style.setProperty('--qm-err', c.err);
    let anc = document.querySelector(a.anchor);
    if (anc && !document.getElementById('qm-btn')) {
      const b = document.createElement('button'); b.type = 'button'; b.id = 'qm-btn'; b.className = (a.btnClass || anc.className) + ' qm-start';
      b.textContent = T('qm_btn'); b.setAttribute('data-i', 'qm_btn'); b.onclick = () => QM.open();
      // ボタンを横ならびの行に入れたいゲーム用：a.wrapClass の箱に入れる
      let node = b; if (a.wrapClass) { node = document.createElement('div'); node.className = a.wrapClass; node.appendChild(b); }
      if (a.anchorUp) for (let i = 0; i < a.anchorUp; i++) anc = anc.parentElement;
      const cnt = document.createElement('div'); cnt.className = 'qm-cnt'; cnt.id = 'qm-cnt';
      cnt.innerHTML = '<span class="qm-prime">' + esc(QM.primeText()) + '</span>';
      if (a.anchorWhere === 'before') { anc.parentNode.insertBefore(node, anc); anc.parentNode.insertBefore(cnt, anc); }
      else { anc.parentNode.insertBefore(cnt, anc.nextSibling); anc.parentNode.insertBefore(node, anc.nextSibling); }
    }
    startCounts();
    window.addEventListener('pagehide', () => { try { if (S.reg) ent().remove(); } catch (e) {} });
  };

  // 人数の表示（タイトルの「だれかと対戦」の下）
  let countTimer = null, lastCounts = null;
  QM.lastCounts = () => lastCounts;
  async function refreshCounts() {
    const el = document.getElementById('qm-cnt');
    if (document.hidden) return;
    try {
      const all = await QM.countAll(); lastCounts = all;
      const m = all[A.game] || { wait: 0, pairs: 0 };
      if (el) el.innerHTML = T('qm_stat', { w: m.wait, p: m.pairs }) + '<br><span class="qm-prime' + (QM.isPrime() ? ' hot' : '') + '">' + esc(QM.primeText()) + '</span>';
      const w = $cc('#qm-w'); if (w) w.textContent = Math.max(0, m.wait - (S.reg ? 1 : 0));
    } catch (e) {
      if (el) el.innerHTML = '<span class="qm-prime' + (QM.isPrime() ? ' hot' : '') + '">' + esc(QM.primeText()) + '</span>';
    }
  }
  const $cc = sel => (ui ? ui.card.querySelector(sel) || ui.bar.querySelector(sel) : null);
  function startCounts() {
    clearInterval(countTimer); refreshCounts();
    countTimer = setInterval(refreshCounts, COUNT_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshCounts(); });
  }
  QM.refreshCounts = refreshCounts;
  document.addEventListener('langchange', () => { if (A) refreshCounts(); });

  // ---------------------------------------------
  //  入口：なまえを入れて「さがす」
  // ---------------------------------------------
  QM.open = function () {
    if (S.phase !== 'idle') return;
    const nm = ls.get(A.nameKey, '') || '';
    card(`<h3>${T('qm_btn')}</h3>
      <p class="qm-sub">${T('qm_sub')}</p>
      <label class="qm-fld">${T('name')}<input id="qm-name" maxlength="8" autocomplete="off" placeholder="${esc(T('noname'))}" value="${esc(nm)}"></label>
      <p class="qm-err" id="qm-err"></p>
      <button class="qm-b" id="qm-go">${T('qm_go')}</button>
      <button class="qm-b sub" id="qm-close">${T('back')}</button>
      <span class="qm-prime${QM.isPrime() ? ' hot' : ''}">${esc(QM.primeText())}</span>`);
    $c('#qm-go').onclick = () => {
      const n = $c('#qm-name').value.trim().slice(0, 8);
      if (n && QM.isBad(n)) { $c('#qm-err').textContent = T('qm_badname'); return; }
      ls.set(A.nameKey, n);
      QM.search(n || T('noname'));
    };
    $c('#qm-name').addEventListener('keydown', e => { if (e.key === 'Enter') $c('#qm-go').click(); });
    $c('#qm-close').onclick = () => closeCard();
  };

  // ---------------------------------------------
  //  さがす
  // ---------------------------------------------
  QM.search = async function (name) {
    if (name != null) S.name = QM.ng(name) || T('noname');
    if (!S.name) S.name = QM.ng(ls.get(A.nameKey, '')) || T('noname');
    cleanup(true);
    await unregister();
    S.phase = 'search'; S.random = false; S.code = null; S.t0 = Date.now(); S.tries = 0; S.ignoreUntil = 0;
    showSearching();
    try { db = db || await A.getDb(); }
    catch (e) { S.phase = 'idle'; showError(e.message || T('err_conn')); return; }
    if (S.phase !== 'search') return;
    S.id = uid();
    setPres('w');
    S.tickT = setInterval(tick, 500);
    scan();
  };

  function showSearching() {
    card(`<h3>${T('qm_searching')}</h3>
      <div class="qm-dots"><i></i><i></i><i></i></div>
      <p class="qm-big" id="qm-time">0:00</p>
      <p class="qm-sub">${T('qm_wait_pre')}<b id="qm-w">-</b>${T('qm_wait_post')}</p>
      <p class="qm-err" id="qm-err"></p>
      ${A.cpu ? `<button class="qm-b alt" id="qm-cpu" hidden>${esc((typeof A.cpuLabel === 'function' ? A.cpuLabel() : A.cpuLabel) || T('qm_cpu'))}</button>` : ''}
      <button class="qm-b sub" id="qm-cancel">${T('qm_cancel')}</button>
      <span class="qm-prime${QM.isPrime() ? ' hot' : ''}">${esc(QM.primeText())}</span>`);
    $c('#qm-cancel').onclick = () => QM.cancel();
    const cb = $c('#qm-cpu'); if (cb) cb.onclick = () => goCpu();
    refreshCounts();
  }
  function showError(msg) {
    card(`<h3>${T('qm_btn')}</h3><p class="qm-err">${esc(msg)}</p>
      <button class="qm-b" id="qm-retry">${T('qm_retry')}</button><button class="qm-b sub" id="qm-close">${T('back')}</button>`);
    $c('#qm-retry').onclick = () => QM.search();
    $c('#qm-close').onclick = () => closeCard();
  }
  const mmss = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function tick() {
    const el = $cc('#qm-time'); if (el) el.textContent = mmss(Date.now() - S.t0);
    if (S.phase === 'search' && Date.now() - S.t0 > WAIT_CPU_SEC * 1000) { const b = $c('#qm-cpu'); if (b && b.hidden) { b.hidden = false; const e = $c('#qm-err'); if (e && !e.textContent) e.textContent = ''; } }
    if (S.phase === 'cpu') { const t = $b('#qm-bt'); if (t) t.textContent = T('qm_searching_t', { t: mmss(Date.now() - S.t0) }); }
    if (S.phase === 'found' && S.foundUntil) {
      const left = Math.max(0, Math.ceil((S.foundUntil - Date.now()) / 1000)); const t = $b('#qm-fl'); if (t) t.textContent = left;
      if (left <= 0) declineFound();
    }
  }

  // 自分の待ち合わせの札を出す
  async function register(cpu) {
    if (S.reg) { await ent().update({ cpu: !!cpu }); return; }
    S.reg = true;
    const r = ent();
    await r.onDisconnect().remove();
    await r.set({ t: TS, n: S.name, cpu: !!cpu });
    const snap = await r.once('value'); const v = snap.val(); S.myT = v && typeof v.t === 'number' ? v.t : Date.now();
    S.entFn = r.on('value', s => onMyEntry(s.val()));
  }
  // 札を片づける。delay は、相手が「OK」を読みとる時間をあげるため
  async function unregister(delay) {
    if (!S.reg) return; S.reg = false;
    const r = ent(), fn = S.entFn; S.entFn = null;
    if (fn) r.off('value', fn);
    const rm = async () => { try { await r.remove(); } catch (e) {} };
    if (delay) setTimeout(rm, delay); else await rm();
  }

  // 待っている人の一覧を見て、声をかける
  async function scan() {
    if (!(S.phase === 'search' || S.phase === 'cpu') || S.busy) { schedule(); return; }
    S.busy = true;
    try {
      const all = (await listRef().once('value')).val() || {};
      const now = Date.now();
      let cands = Object.keys(all).filter(k => k !== S.id && all[k] && !all[k].by && typeof all[k].t === 'number' && now - all[k].t < STALE_MS)
        .map(k => Object.assign({ id: k }, all[k]));
      // 自分も札を出しているときは、自分より先に待っていた人にだけ声をかける（同時に声をかけ合わないため）
      if (S.reg) cands = cands.filter(c => c.t < S.myT || (c.t === S.myT && c.id < S.id));
      cands.sort((a, b) => (a.cpu ? 1 : 0) - (b.cpu ? 1 : 0) || a.t - b.t || (a.id < b.id ? -1 : 1));
      const w = $cc('#qm-w'); if (w) w.textContent = Object.keys(all).filter(k => k !== S.id).length;
      if (S.phase === 'cpu') {
        // CPUで遊んでいる人は、自分から声をかけずに「相手がいます」とだけ知らせる
        if (cands.length && !S.offer && !(S.ignoreUntil > Date.now())) offerFound(cands[0]);
      } else {
        for (const c of cands.slice(0, 3)) {
          if (S.phase !== 'search') break;
          const ok = await claim(c);
          if (ok) { S.busy = false; return; }
        }
        if (S.phase === 'search' && !S.reg) await register(false);
      }
    } catch (e) { console.warn('qm scan', e); }
    S.busy = false;
    schedule();
  }
  function schedule() { clearTimeout(S.scanT); if (S.phase === 'search' || S.phase === 'cpu') S.scanT = setTimeout(scan, SCAN_MS); }

  // 相手の札に「声をかける」（ほかの人に先をこされないよう、トランザクションで）
  async function claim(c) {
    const code = rcode();
    // 自分の札があるときは、先に自分を「話し中」にしておく（ほかの人から同時に声をかけられないように）
    if (S.reg) {
      const lk = await ent().transaction(cur => { if (!cur) return cur; if (cur.by) return; cur.by = S.id; return cur; });
      if (!lk.committed || !lk.snapshot.val() || lk.snapshot.val().by !== S.id) return false;   // 先に声をかけられた → onMyEntry が進める
    }
    const cref = db.ref('qm/' + A.game + '/' + A.ver + '/' + c.id);
    // ※最初は手元に値がなく null で呼ばれることがある。そのときは null を返して、サーバーの値でやり直してもらう
    const res = await cref.transaction(cur => { if (!cur) return cur; if (cur.by) return; cur.by = S.id; cur.code = code; cur.bn = S.name; return cur; });
    const got = res.committed && res.snapshot.val() && res.snapshot.val().by === S.id;
    if (!got) { await unlockSelf(); return false; }
    // 相手の「OK」を待つ
    S.phase = 'claim';
    const wait = c.cpu ? OK_WAIT_CPU_MS : OK_WAIT_MS;
    if (c.cpu) { const e = $c('#qm-err'); if (e) e.textContent = T('qm_calling'); }
    const ans = await new Promise(resolve => {
      let done = false;
      const fin = v => { if (done) return; done = true; cref.off('value', fn); clearTimeout(tm); resolve(v); };
      const fn = cref.on('value', s => { const v = s.val(); if (!v || v.by !== S.id) return fin('gone'); if (v.ok) return fin('ok'); if (v.no) return fin('no'); });
      const tm = setTimeout(() => fin('timeout'), wait);
    });
    if (ans === 'ok') {
      await unregister();
      go(code, true);
      return true;
    }
    // 返事がない札は、もう使われていないので片づける
    if (ans === 'timeout' && !c.cpu) { try { await cref.transaction(cur => { if (!cur) return cur; if (cur.by === S.id && !cur.ok) return null; return; }); } catch (e) {} }
    S.phase = 'search';
    const e = $c('#qm-err'); if (e) e.textContent = ans === 'no' ? T('qm_declined') : '';
    await unlockSelf();
    return false;
  }
  async function unlockSelf() {
    if (!S.reg) return;
    try { await ent().transaction(cur => { if (!cur) return cur; if (cur.by === S.id) { delete cur.by; return cur; } return; }); } catch (e) {}
  }

  // 自分の札に、だれかが声をかけてきた
  function onMyEntry(v) {
    if (!S.reg) return;
    if (!v) {
      // 札が消えた（通信が切れた・片づけられた）→ まだ待っているなら出し直す
      if (S.phase === 'search' || S.phase === 'cpu') { S.reg = false; if (S.entFn) { ent().off('value', S.entFn); S.entFn = null; } S.id = uid(); register(S.phase === 'cpu').catch(() => {}); }
      return;
    }
    if (!v.by || v.by === S.id || !v.code || v.ok || v.no) return;
    if (S.phase === 'search' || S.phase === 'claim') { ent().update({ ok: true }); const code = v.code; unregister(3000); go(code, false); }
    else if (S.phase === 'cpu' || (S.phase === 'found' && S.offer)) { S.offer = null; askFound(v); }
  }

  // ---------------------------------------------
  //  CPUと遊びながら待つ
  // ---------------------------------------------
  async function goCpu() {
    if (S.phase !== 'search') return;
    S.phase = 'cpu'; setPres('c');
    closeCard();
    try { await register(true); } catch (e) {}
    showCpuBar();
    try { A.cpu(); } catch (e) { console.error(e); }
  }
  function showCpuBar() {
    bar(`<span id="qm-bt">${T('qm_searching_t', { t: mmss(Date.now() - S.t0) })}</span><button class="x" id="qm-bx">${T('qm_cancel')}</button>`);
    $b('#qm-bx').onclick = () => QM.cancel(true);
  }
  // だれかから声をかけられた（自分はCPU中）
  function askFound(v) {
    if (S.phase === 'found' && S.foundFrom && S.foundFrom.by === v.by && S.foundFrom.code === v.code) return;   // 同じ知らせが2回来た
    S.phase = 'found'; S.foundFrom = v; S.foundUntil = Date.now() + ACCEPT_SEC * 1000;
    bar(`<span>${T('qm_found')}</span><button id="qm-ok">${T('qm_play')} <b id="qm-fl">${ACCEPT_SEC}</b></button><button class="x" id="qm-no">${T('qm_pass')}</button>`, 'found');
    $b('#qm-ok').onclick = () => { const code = v.code; S.foundUntil = 0; ent().update({ ok: true }); unregister(3000); quitThen(() => go(code, false)); };
    $b('#qm-no').onclick = () => declineFound();
  }
  // CPU中に、待っている人を見つけた（自分から声をかけるか聞く）
  function offerFound(c) {
    S.phase = 'found'; S.offer = c; S.foundUntil = Date.now() + ACCEPT_SEC * 1000;
    bar(`<span>${T('qm_avail')}</span><button id="qm-ok">${T('qm_play')} <b id="qm-fl">${ACCEPT_SEC}</b></button><button class="x" id="qm-no">${T('qm_pass')}</button>`, 'found');
    $b('#qm-ok').onclick = async () => {
      const off = S.offer; S.offer = null; S.foundUntil = 0;
      bar('<span>' + T('connecting') + '</span>');
      quitThen(async () => {
        S.phase = 'search'; setPres('w'); showSearching();
        await unregister();
        const ok = await claim(Object.assign({}, off, { cpu: false }));
        if (!ok && S.phase === 'search') { const e = $c('#qm-err'); if (e) e.textContent = T('qm_taken'); schedule(); }
      });
    };
    $b('#qm-no').onclick = () => declineFound();
  }
  async function declineFound() {
    if (S.phase !== 'found') return;
    S.foundUntil = 0;
    if (S.offer) { S.offer = null; S.ignoreUntil = Date.now() + 60000; }
    else if (S.foundFrom) {
      S.foundFrom = null;
      try { await ent().update({ no: true }); } catch (e) {}
      await sleep(600);
      // 札を新しく出し直して、CPUのまま待ちつづける
      await unregister(); S.id = uid();
      try { await register(true); } catch (e) {}
    }
    S.phase = 'cpu'; showCpuBar(); schedule();
  }
  // いまのゲーム（CPU戦）をやめてから進む
  function quitThen(fn) {
    closeBar();
    try { if (A.quit) A.quit(); } catch (e) { console.error(e); }
    setTimeout(fn, 250);
  }

  // ---------------------------------------------
  //  つながった → あいことばで部屋に入る
  // ---------------------------------------------
  function go(code, claimer) {
    clearTimeout(S.scanT); S.offer = null; S.foundFrom = null; S.foundUntil = 0;
    S.phase = 'joining'; S.code = code; S.random = true;
    setPres('p');
    closeBar();
    card(`<h3>${T('qm_found')}</h3><div class="qm-dots"><i></i><i></i><i></i></div><p>${T('connecting')}</p>`);
    clearTimeout(S.joinT);
    S.joinT = setTimeout(() => {
      if (S.phase !== 'joining') return;
      const c = S.code; S.phase = 'idle'; S.random = false;
      try { if (A.quit) A.quit(); } catch (e) {}
      setPres(null);
      showError(T('qm_fail', { c: c.slice(-3) }));
    }, JOIN_TIMEOUT_MS);
    const run = () => {
      try { if (A.prep) A.prep(); } catch (e) { console.error(e); }
      try { A.join(code, S.name); } catch (e) { console.error(e); showError(T('qm_nojoin')); }
    };
    // 声をかけられた側は、少しだけ待ってから入る（声をかけた側が先に部屋を作る）
    setTimeout(run, claimer ? 0 : 400);
  }

  // ---------------------------------------------
  //  ゲームから教えてもらう合図
  // ---------------------------------------------
  // 部屋の中で試合（またはえらぶ画面）が始まった。あいことば対戦でも呼ぶ（人数を数えるため）
  QM.started = function (o) {
    o = o || {};
    if (S.phase === 'joining' && o.code && o.code === S.code) { clearTimeout(S.joinT); S.phase = 'playing'; S.random = true; closeCard(); }
    else if (S.phase === 'playing' && o.code && o.code === S.code && S.random) { /* 同じ相手ともう一戦 */ }
    else {
      // あいことば対戦（またはランダムで待っている途中に、自分であいことば対戦に入った）
      if (S.phase !== 'idle' && S.phase !== 'playing') { QM.cancel(); }
      S.phase = 'playing'; S.random = false; S.code = o.code || null;
    }
    if (o.watch) { setPresLater(null); hideNext(); return; }
    setPresLater('p');
    showNext();
  };
  // 部屋を出た（タイトルにもどった など）。ランダムで入る途中（joining）は、ゲームが前の部屋を片づけるだけなので気にしない
  QM.ended = function () {
    if (S.phase === 'playing') { S.phase = 'idle'; S.random = false; S.code = null; setPres(null); }
    hideNext();
  };
  // 人数のための「対戦中」の札（あいことば対戦のときは db がまだないことがある）
  async function setPresLater(s) { try { db = db || await A.getDb(); setPres(s); } catch (e) {} }

  // 試合が終わった画面に「次の相手をさがす」を出す
  //  container の中の before の前に入れる（ゲームの結果画面のボタン）
  QM.resultSlot = function (container, before) { S.resBox = container; S.resBefore = before; showNext(); };
  function showNext() {
    let b = document.getElementById('qm-next');
    const box = typeof S.resBox === 'string' ? document.querySelector(S.resBox) : S.resBox;
    if (!box) return;
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'qm-next';
      b.className = (A.nextClass || A.btnClass || 'btn') + ' qm-next'; b.textContent = T('qm_next'); b.setAttribute('data-i', 'qm_next');
      b.onclick = () => QM.next();
      const bf = S.resBefore ? box.querySelector(S.resBefore) : null;
      if (bf) bf.parentNode.insertBefore(b, bf); else box.appendChild(b);
    }
    b.hidden = !S.random; b.style.display = S.random ? '' : 'none';
  }
  // 試合の途中の結果（ラウンドの区切りなど）では出さないゲーム用
  QM.syncNext = function (show) { showNext(); const b = document.getElementById('qm-next'); if (b) { const v = S.random && show !== false; b.hidden = !v; b.style.display = v ? '' : 'none'; } };
  function hideNext() { const b = document.getElementById('qm-next'); if (b) { b.hidden = true; b.style.display = 'none'; } }
  QM.next = function () {
    S.random = false; S.phase = 'idle'; hideNext(); setPres(null);
    try { if (A.quit) A.quit(); } catch (e) {}
    setTimeout(() => QM.search(), 300);
  };
  // 相手が試合の途中で抜けた（ランダム対戦のとき、ゲームのかわりに知らせる用）
  QM.notice = function (title, text, buttons) {
    card(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div id="qm-nb"></div>`);
    const box = $c('#qm-nb');
    for (const b of buttons || []) { const el = document.createElement('button'); el.className = 'qm-b' + (b.sub ? ' sub' : ''); el.textContent = b.label; el.onclick = () => { closeCard(); b.fn && b.fn(); }; box.appendChild(el); }
  };
  QM.close = closeCard;
  // ゲームが自分の小さな画面を出したいとき用（中身のHTMLを入れて、カードの要素を返す）
  QM.dialog = html => card(html);
  QM.esc = esc;

  // やめる
  QM.cancel = async function (fromBar) {
    const was = S.phase;
    cleanup(false);
    S.phase = 'idle'; S.random = false; S.code = null;
    setPres(null);
    closeCard(); closeBar();
    if (fromBar && was === 'found' && S.foundFrom) { try { await ent().update({ no: true }); } catch (e) {} }
    await unregister();
  };
  function cleanup(keepUi) {
    clearTimeout(S.scanT); clearInterval(S.tickT); clearTimeout(S.joinT);
    S.busy = false; S.offer = null; S.foundUntil = 0;
    if (!keepUi) { closeBar(); }
  }

  // テスト用
  QM._S = S;
  QM._setDb = d => { db = d; };
})();
