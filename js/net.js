// =============================================
//  合言葉オンライン（Firebase Realtime Database ＋ 直接通信 WebRTC）
//
//  データの形： hanetank/{合言葉}/
//    players/{0|1}   : { id, name, pid, look }   対戦者（先に来た2人）
//    watchers/{id}   : { name }                  観戦者
//    game            : 試合の進行（0番の人だけが書く）
//    pick/{0|1}      : { n, s, bl, ok }          スキルとブロックの選択
//    rd/{0|1}        : "次へ進む準備ができた場面"
//    st/{0|1}        : 戦車の位置（直接通信できないとき＆観戦者向け）
//    ev/{戦いの番号}/{0|1}/{自動ID} : 撃った・地雷・爆発・やられた・スタンプ
//    sig/{0|1}/{自動ID}  : 直接通信をつなぐための合図
// =============================================
(function () {
  const clean = s => String(s || '').replace(/[.#$\[\]\/\s]/g, '').slice(0, 20);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

  class Room {
    constructor(db, code, name, info, cb) {
      this.db = db; this.code = clean(code);
      this.name = (String(name || '').trim().slice(0, 8)) || 'ななし';
      this.info = info || {}; this.cb = cb || {};
      this.id = uid(); this.slot = -1;
      this.players = {}; this.watchers = {}; this.game = null; this.picks = {}; this.rd = {};
      this.subs = []; this.evSubs = []; this.offset = 0; this.left = false;
      this.root = db.ref('hanetank/' + this.code);
      this.seen = new Set(); this.evCount = 0; this.lastState = [null, null];
      this.pc = null; this.dcEv = null; this.dcSt = null; this.p2p = false; this.p2pFor = null;
      this.stRate = 0; this.lastStWrite = 0;
      this.gone = {}; this.lastSp = [null, null]; this.spN = Math.floor(Math.random() * 1e6); this.oppTimer = null;
    }
    call(n, ...a) { if (this.cb[n]) try { this.cb[n](...a); } catch (e) { console.error(e); } }
    now() { return Date.now() + this.offset; }
    on(ref, ev, fn) { ref.on(ev, fn); this.subs.push([ref, ev, fn]); }
    get opp() { return this.slot >= 0 ? this.players[1 - this.slot] : null; }

    async join() {
      if (!this.code) throw new Error('合言葉を入れてください');
      this.on(this.db.ref('.info/serverTimeOffset'), 'value', s => { this.offset = s.val() || 0; });
      if (!this.info.watch) {
        for (const s of [0, 1]) {
          const ref = this.root.child('players/' + s);
          const me = this.meObj = { id: this.id, name: this.name, pid: String(this.info.pid || '').slice(0, 24), look: String(this.info.look || '').slice(0, 20) };
          const res = await ref.transaction(cur => (cur ? undefined : me));
          if (res.committed && res.snapshot.val() && res.snapshot.val().id === this.id) { this.slot = s; break; }
        }
      }
      if (this.slot >= 0) {
        const s = this.slot;
        this.armDisconnect();
        await this.root.child('pick/' + s).remove();
        await this.root.child('rd/' + s).remove();
      } else {
        const w = this.root.child('watchers/' + this.id);
        await w.set({ name: this.name });
        w.onDisconnect().remove();
      }
      this.on(this.root.child('players'), 'value', snap => {
        const prev = this.players;
        this.players = snap.val() || {};
        // 自分の席が消えた＝通信が一瞬切れた。空いていれば同じ席に戻る
        if (this.slot >= 0 && prev[this.slot] && !this.players[this.slot] && !this.left) this.reclaim();
        if (this.slot >= 0) {
          const o = 1 - this.slot, cur = this.players[o];
          if (prev[o] && !cur) {
            // 相手が消えた：自分で抜けたならすぐ、通信切れなら少し待つ
            if (this.gone[o] === prev[o].id) this.oppGone();
            else if (!this.oppTimer) {
              this.oppMissingId = prev[o].id; this.call('onOppWait', true);
              this.oppTimer = setTimeout(() => { this.oppTimer = null; this.call('onOppWait', false); this.oppGone(); }, Room.GRACE);
            }
          } else if (cur) {
            if (this.oppTimer) {
              clearTimeout(this.oppTimer); this.oppTimer = null; this.call('onOppWait', false);
              if (cur.id !== this.oppMissingId) this.oppGone();
            } else if (prev[o] && prev[o].id !== cur.id) this.oppGone();
          }
          if (cur && this.p2pFor !== cur.id) this.startP2P();
        }
        this.call('onPeople', this.people());
      });
      this.on(this.root.child('gone'), 'value', snap => {
        this.gone = snap.val() || {};
        const o = 1 - this.slot;
        if (this.slot >= 0 && this.oppTimer && this.gone[o] === this.oppMissingId) { clearTimeout(this.oppTimer); this.oppTimer = null; this.call('onOppWait', false); this.oppGone(); }
      });
      this.on(this.root.child('sp'), 'value', snap => {
        const v = snap.val() || {};
        for (const s of [0, 1]) {
          const x = v[s]; if (!x || s === this.slot || this.lastSp[s] === x.n) continue;
          this.lastSp[s] = x.n;
          if (Math.abs(this.now() - x.t) < 6000) this.call('onStamp', s, x.k);
        }
      });
      this.on(this.root.child('watchers'), 'value', snap => { this.watchers = snap.val() || {}; this.call('onPeople', this.people()); });
      this.on(this.root.child('game'), 'value', snap => { this.game = snap.val(); this.call('onGame', this.game); });
      this.on(this.root.child('pick'), 'value', snap => { this.picks = snap.val() || {}; this.call('onPick', this.picks); });
      this.on(this.root.child('rd'), 'value', snap => { this.rd = snap.val() || {}; this.call('onReady', this.rd); });
      this.on(this.root.child('st'), 'value', snap => {
        const v = snap.val() || {};
        for (const s of [0, 1]) if (v[s] && s !== this.slot) this.gotState(s, v[s]);
      });
      if (this.slot >= 0) {
        const inbox = this.root.child('sig/' + this.slot);
        this.on(inbox, 'child_added', snap => { const m = snap.val(); snap.ref.remove(); this.gotSignal(m); });
      }
      return { slot: this.slot, code: this.code };
    }
    armDisconnect() {
      for (const p of ['players/', 'pick/', 'rd/', 'st/', 'sp/']) this.root.child(p + this.slot).onDisconnect().remove();
    }
    async reclaim() {
      if (this.reclaiming || this.left) return;
      this.reclaiming = true;
      try {
        const res = await this.root.child('players/' + this.slot).transaction(cur => (cur ? undefined : this.meObj));
        if (res.committed && res.snapshot.val() && res.snapshot.val().id === this.id) { this.armDisconnect(); this.call('onRejoined'); }
        else this.call('onKicked');
      } catch (e) { this.call('onKicked'); }
      finally { this.reclaiming = false; }
    }
    oppGone() { this.closeP2P(); this.call('onOppLeft'); }
    sendStamp(k) { if (this.slot >= 0) this.root.child('sp/' + this.slot).set({ k, n: ++this.spN, t: this.now() }); }
    people() {
      const p = [0, 1].map(s => this.players[s] || null);
      return { players: p, names: p.map(x => (x ? x.name : null)), watchers: Object.keys(this.watchers).length, slot: this.slot, p2p: this.p2p };
    }

    // ---------- 進行（0番だけが書く） ----------
    setGame(g) { if (this.slot === 0) return this.root.child('game').set(g); }
    setPick(p) { if (this.slot >= 0) return this.root.child('pick/' + this.slot).set(p); }
    setReady(key) { if (this.slot >= 0) return this.root.child('rd/' + this.slot).set(key); }
    clearEvents(key) { if (this.slot === 0 && key) this.root.child('ev/' + key).remove(); }

    // ---------- 戦いの中のやりとり ----------
    listenBattle(key) {
      if (this.evKey === key) return;
      for (const [ref, ev, fn] of this.evSubs) ref.off(ev, fn);
      this.evSubs = []; this.evKey = key; this.seen.clear();
      this.lastState = [null, null];
      for (const s of [0, 1]) {
        if (s === this.slot) continue;
        const ref = this.root.child('ev/' + key + '/' + s);
        const fn = snap => this.gotEvent(s, snap.val(), key);
        ref.on('child_added', fn); this.evSubs.push([ref, 'child_added', fn]);
      }
    }
    sendEvent(e) {
      if (this.slot < 0 || !this.evKey) return;
      e.id = this.slot + '.' + (++this.evCount) + '.' + this.id.slice(0, 4);
      e.k = this.evKey;
      const msg = JSON.stringify({ c: 'e', e });
      if (this.dcEv && this.dcEv.readyState === 'open') { try { this.dcEv.send(msg); } catch (err) {} }
      this.root.child('ev/' + this.evKey + '/' + this.slot).push(e);
    }
    gotEvent(s, e, key) {
      if (!e || e.k !== this.evKey || this.seen.has(e.id)) return;
      this.seen.add(e.id);
      this.call('onEvent', s, e);
    }
    // 位置：直接通信なら毎フレーム、つながっていなければ1秒に10回ほど Firebase へ
    sendState(st) {
      if (this.slot < 0) return;
      st.k = this.evKey;
      const open = this.dcSt && this.dcSt.readyState === 'open';
      if (open) { try { this.dcSt.send(JSON.stringify({ c: 's', s: st })); } catch (err) {} }
      const watchers = Object.keys(this.watchers).length;
      const rate = open ? (watchers ? 6 : 1) : 10;
      const t = performance.now();
      if (t - this.lastStWrite > 1000 / rate) { this.lastStWrite = t; this.root.child('st/' + this.slot).set(st); }
    }
    gotState(s, st) {
      if (!st || st.k !== this.evKey) return;
      const last = this.lastState[s];
      if (last && last.T >= st.T) return;
      this.lastState[s] = st;
      this.call('onState', s, st);
    }

    // ---------- 直接通信（WebRTC）。つながらなくても Firebase で遊べる ----------
    startP2P() {
      this.closeP2P();
      const opp = this.opp; if (!opp || typeof RTCPeerConnection === 'undefined') return;
      this.p2pFor = opp.id;
      let pc;
      try { pc = new RTCPeerConnection({ iceServers: ICE }); } catch (e) { return; }
      this.pc = pc;
      const send = (y, d) => this.root.child('sig/' + (1 - this.slot)).push({ f: this.id, to: opp.id, y, d: JSON.stringify(d) });
      pc.onicecandidate = e => { if (e.candidate) send('c', e.candidate.toJSON ? e.candidate.toJSON() : e.candidate); };
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) this.setP2P(false);
      };
      const setup = ch => {
        ch.onopen = () => this.setP2P(!!(this.dcEv && this.dcEv.readyState === 'open' && this.dcSt && this.dcSt.readyState === 'open'));
        ch.onclose = () => this.setP2P(false);
        ch.onmessage = ev => {
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          const s = 1 - this.slot;
          if (m.c === 'e') this.gotEvent(s, m.e);
          else if (m.c === 's') this.gotState(s, m.s);
        };
      };
      if (this.slot === 0) {
        this.dcEv = pc.createDataChannel('ev', { ordered: true });
        this.dcSt = pc.createDataChannel('st', { ordered: false, maxRetransmits: 0 });
        setup(this.dcEv); setup(this.dcSt);
        pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => send('o', pc.localDescription)).catch(() => {});
      } else {
        pc.ondatachannel = e => {
          if (e.channel.label === 'ev') this.dcEv = e.channel; else this.dcSt = e.channel;
          setup(e.channel);
        };
      }
      this.pendingCand = [];
    }
    async gotSignal(m) {
      if (!m || m.to !== this.id) return;
      const opp = this.opp;
      if (!opp || m.f !== opp.id) return;
      if (!this.pc || this.p2pFor !== opp.id) this.startP2P();
      const pc = this.pc; if (!pc) return;
      let d; try { d = JSON.parse(m.d); } catch (e) { return; }
      try {
        if (m.y === 'o') {
          await pc.setRemoteDescription(d);
          const a = await pc.createAnswer(); await pc.setLocalDescription(a);
          this.root.child('sig/' + (1 - this.slot)).push({ f: this.id, to: opp.id, y: 'a', d: JSON.stringify(pc.localDescription) });
          for (const c of this.pendingCand) await pc.addIceCandidate(c).catch(() => {});
          this.pendingCand = [];
        } else if (m.y === 'a') {
          await pc.setRemoteDescription(d);
          for (const c of this.pendingCand) await pc.addIceCandidate(c).catch(() => {});
          this.pendingCand = [];
        } else if (m.y === 'c') {
          if (pc.remoteDescription) await pc.addIceCandidate(d).catch(() => {});
          else this.pendingCand.push(d);
        }
      } catch (e) { /* つながらなければ Firebase だけで続ける */ }
    }
    setP2P(v) { if (this.p2p !== v) { this.p2p = v; this.call('onPeople', this.people()); } }
    closeP2P() {
      if (this.pc) { try { this.pc.close(); } catch (e) {} }
      this.pc = null; this.dcEv = null; this.dcSt = null; this.p2pFor = null; this.setP2P(false);
    }

    leave() {
      if (this.left) return;
      this.left = true;
      this.closeP2P(); clearTimeout(this.oppTimer);
      for (const [ref, ev, fn] of this.subs.concat(this.evSubs)) ref.off(ev, fn);
      this.subs = []; this.evSubs = [];
      if (this.slot >= 0) {
        this.root.child('gone/' + this.slot).set(this.id); // 自分で抜けたことを相手に知らせる
        for (const p of ['players/', 'pick/', 'rd/', 'st/', 'sp/']) this.root.child(p + this.slot).remove();
      }
      else this.root.child('watchers/' + this.id).remove();
    }
  }
  Room.GRACE = 8000; // 相手の通信が切れたとき、戻ってくるのを待つ時間
  HT.Room = Room;
  HT.cleanCode = clean;
})();
