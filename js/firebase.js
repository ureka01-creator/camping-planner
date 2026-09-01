// Firebase adapter.
// Firebase config is registered for the Camping Planner web app.
// If Firebase is disabled, the app can still run in local demo mode using localStorage + BroadcastChannel.

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCdBMIYmhomv-B72pzEptpfRIoGiORZZWk",
  authDomain: "camping-planner-4c2bd.firebaseapp.com",
  projectId: "camping-planner-4c2bd",
  storageBucket: "camping-planner-4c2bd.firebasestorage.app",
  messagingSenderId: "852218628033",
  appId: "1:852218628033:web:29a2e54a9c81397ae5d140",
  measurementId: "G-HEZ3M975RX"
};

export const DATA_MODE = {
  useFirebase: true,
  tripId: new URLSearchParams(location.search).get('trip') || 'camp-2026-09-demo'
};

const STORE_KEY = `camping-planner:${DATA_MODE.tripId}`;
const SERVER_CACHE_KEY = `${STORE_KEY}:last-server`;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(STORE_KEY) : null;

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

export const seedData = {
  trip: {
    id: DATA_MODE.tripId,
    title: '9월 가족 캠핑',
    startDate: '2026-09-11',
    endDate: '2026-09-13',
    location: '캠핑장 미정',
    updatedAt: Date.now()
  },
  members: [
    { id:'m1', name:'팀 A', type:'team', order:1 },
    { id:'m2', name:'팀 B', type:'team', order:2 },
    { id:'m3', name:'공용', type:'team', order:3 }
  ],
  meals: [
    { id:'meal1', date:'2026-09-11', mealType:'dinner', menu:'바비큐', assigneeId:'m1', note:'도착 후 바로 준비' },
    { id:'meal2', date:'2026-09-12', mealType:'breakfast', menu:'간단 조식', assigneeId:'m3', note:'' },
    { id:'meal3', date:'2026-09-12', mealType:'dinner', menu:'메인 캠핑 요리', assigneeId:'m2', note:'' },
    { id:'meal4', date:'2026-09-13', mealType:'breakfast', menu:'남은 재료 정리', assigneeId:'m3', note:'' }
  ],
  items: [
    { id:'item1', name:'버너', category:'조리', quantity:'1개', assigneeId:'m1', isDone:false, note:'' },
    { id:'item2', name:'집게 / 가위', category:'조리', quantity:'1세트', assigneeId:'m1', isDone:true, note:'' },
    { id:'item3', name:'고기', category:'식재료', quantity:'넉넉히', assigneeId:'m2', isDone:false, note:'저녁 바비큐' },
    { id:'item4', name:'담요', category:'침구', quantity:'필요 수량', assigneeId:'m3', isDone:true, note:'' },
    { id:'item5', name:'보드게임', category:'놀이', quantity:'1~2개', assigneeId:'m3', isDone:false, note:'' }
  ]
};

class LocalAdapter {
  constructor(){
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.status = { state:'local', error:null };
    if (!localStorage.getItem(STORE_KEY)) this.write(seedData, false);
    window.addEventListener('storage', e => { if (e.key === STORE_KEY) this.emit(); });
    channel?.addEventListener('message', () => this.emit());
  }
  read(){
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || clone(seedData); }
    catch { return clone(seedData); }
  }
  write(data, broadcast=true){
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    if (broadcast) channel?.postMessage({ type:'changed' });
    this.emit();
  }
  emit(){ const data=this.read(); this.listeners.forEach(fn=>fn(clone(data))); }
  subscribe(fn){ this.listeners.add(fn); fn(this.read()); return () => this.listeners.delete(fn); }
  subscribeStatus(fn){ this.statusListeners.add(fn); fn({...this.status}); return () => this.statusListeners.delete(fn); }
  async mutate(mutator){ const data=this.read(); mutator(data); data.trip.updatedAt=Date.now(); this.write(data); return clone(data); }
  async reset(){ this.write(clone(seedData)); }
}

class FirebaseAdapter {
  constructor(){
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.status = { state:'connecting', error:null };
    this.unsubscribe = null;
    this.retryTimer = null;
    this.connecting = false;
    this.authPersistence = null;
    this.cachedData = this.readServerCache();
    this.ready = this.connect();
    // Keep the rejected promise observed; subscribers/writes will trigger a reconnect.
    this.ready.catch(() => {});

    window.addEventListener('online', () => {
      if (this.status.state !== 'connected') this.reconnect();
    });
    window.addEventListener('offline', () => this.setStatus('offline'));
  }

  readServerCache(){
    try { return JSON.parse(localStorage.getItem(SERVER_CACHE_KEY)) || null; }
    catch { return null; }
  }

  writeServerCache(data){
    try { localStorage.setItem(SERVER_CACHE_KEY, JSON.stringify(data)); }
    catch (_) {}
  }

  setStatus(state, error=null){
    this.status = { state, error: error ? String(error?.code || error?.message || error) : null };
    this.statusListeners.forEach(fn => fn({...this.status}));
  }

  subscribeStatus(fn){
    this.statusListeners.add(fn);
    fn({...this.status});
    return () => this.statusListeners.delete(fn);
  }

  normalizeSnapshot(snapshot){
    if (!snapshot?.exists()) return null;
    const d = snapshot.data();
    return {
      trip: { id:DATA_MODE.tripId, ...d.trip },
      members:d.members||[],
      meals:d.meals||[],
      items:d.items||[]
    };
  }

  emitData(data, cache=true){
    if (!data) return;
    if (cache) {
      this.cachedData = clone(data);
      this.writeServerCache(this.cachedData);
    }
    this.listeners.forEach(fn => fn(clone(data)));
  }

  async connect(){
    if (this.connecting) return this.ready;
    this.connecting = true;
    this.setStatus(navigator.onLine === false ? 'offline' : 'connecting');
    let lastError = null;

    try {
      for (let attempt=0; attempt<3; attempt++) {
        try {
          await this.initOnce();
          this.setStatus('connected');
          return true;
        } catch (error) {
          lastError = error;
          console.warn(`Firebase connect attempt ${attempt + 1} failed.`, error);
          if (navigator.onLine === false) break;
          if (attempt < 2) await sleep(700 * (attempt + 1));
        }
      }
      this.setStatus(navigator.onLine === false ? 'offline' : 'error', lastError);
      this.scheduleReconnect();
      throw lastError || new Error('Firebase connection failed');
    } finally {
      this.connecting = false;
    }
  }

  async configureAuthPersistence(authMod){
    const strategies = [
      ['local', authMod.browserLocalPersistence],
      ['session', authMod.browserSessionPersistence],
      ['memory', authMod.inMemoryPersistence]
    ];
    let lastError = null;

    for (const [name, persistence] of strategies) {
      if (!persistence) continue;
      try {
        await authMod.setPersistence(this.auth, persistence);
        this.authPersistence = name;
        return name;
      } catch (error) {
        lastError = error;
        console.warn(`Firebase auth ${name} persistence unavailable.`, error);
      }
    }

    throw lastError || new Error('Firebase auth persistence unavailable');
  }

  async waitForGoogleUser(authMod){
    if (this.auth.currentUser && !this.auth.currentUser.isAnonymous) return this.auth.currentUser;

    // Old builds used anonymous auth. Clear a cached anonymous session so the
    // app now has exactly one identity path: Google sign-in.
    if (this.auth.currentUser?.isAnonymous) {
      try { await authMod.signOut(this.auth); } catch (_) {}
    }

    this.setStatus('auth-required');
    return new Promise(resolve => {
      const unsubscribe = authMod.onAuthStateChanged(this.auth, user => {
        if (!user || user.isAnonymous) return;
        unsubscribe();
        resolve(user);
      });
    });
  }

  async initOnce(){
    const [appMod, authMod, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js')
    ]);

    this.fs = firestore;
    this.app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
    this.auth = authMod.getAuth(this.app);

    // Google is the only supported Firebase identity. The data connection waits
    // here until google-login.js completes sign-in; anonymous auth is not needed.
    await this.configureAuthPersistence(authMod);
    if (typeof this.auth.authStateReady === 'function') await this.auth.authStateReady();
    await this.waitForGoogleUser(authMod);

    // Auto-detect long polling helps Safari/iOS networks where Firestore's default
    // streaming transport can be interrupted. Reconnect retries reuse this instance.
    try {
      this.db = firestore.initializeFirestore(this.app, { experimentalAutoDetectLongPolling:true });
    } catch (_) {
      this.db = firestore.getFirestore(this.app);
    }
    this.tripRef = firestore.doc(this.db, 'trips', DATA_MODE.tripId);

    const snapshot = await firestore.getDoc(this.tripRef);
    if (!snapshot.exists()) {
      await this.seed();
    } else {
      this.emitData(this.normalizeSnapshot(snapshot));
    }

    this.attachRealtime();
  }

  attachRealtime(){
    this.unsubscribe?.();
    this.unsubscribe = this.fs.onSnapshot(
      this.tripRef,
      { includeMetadataChanges:true },
      snapshot => {
        const data = this.normalizeSnapshot(snapshot);
        if (!data) return;
        this.emitData(data, !snapshot.metadata.fromCache);
        if (!snapshot.metadata.fromCache) this.setStatus('connected');
      },
      error => {
        console.error('Firestore realtime listener failed.', error);
        this.setStatus(navigator.onLine === false ? 'offline' : 'error', error);
        this.scheduleReconnect();
      }
    );
  }

  scheduleReconnect(){
    clearTimeout(this.retryTimer);
    if (navigator.onLine === false) return;
    this.retryTimer = setTimeout(() => this.reconnect(), 1800);
  }

  reconnect(){
    if (this.connecting) return this.ready;
    clearTimeout(this.retryTimer);
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.ready = this.connect();
    this.ready.catch(() => {});
    return this.ready;
  }

  async seed(){
    const { setDoc, serverTimestamp } = this.fs;
    const s=clone(seedData);
    await setDoc(this.tripRef,{...s,trip:{...s.trip,updatedAt:serverTimestamp()}},{merge:true});
  }

  subscribe(fn){
    let alive=true;
    this.listeners.add(fn);

    // Render the last known server state immediately while Firebase reconnects.
    // It is replaced by the live snapshot as soon as the server responds.
    if (this.cachedData) queueMicrotask(() => { if (alive) fn(clone(this.cachedData)); });

    this.ready.then(async()=>{
      if(!alive) return;
      // If the realtime callback has not painted yet, force one current document read.
      const snap=await this.fs.getDoc(this.tripRef);
      const data=this.normalizeSnapshot(snap);
      if(data) this.emitData(data);
    }).catch(error => {
      console.warn('Firebase subscription waiting for reconnect.', error);
    });

    return ()=>{ alive=false; this.listeners.delete(fn); };
  }

  async ensureReady(){
    try {
      await this.ready;
    } catch (_) {
      await this.reconnect();
    }
  }

  async mutate(mutator){
    await this.ensureReady();
    const { runTransaction, serverTimestamp } = this.fs;
    return runTransaction(this.db, async tx => {
      const snap=await tx.get(this.tripRef);
      const d=snap.data() || {};
      const data={trip:{id:DATA_MODE.tripId,...d.trip},members:d.members||[],meals:d.meals||[],items:d.items||[]};
      mutator(data);
      tx.set(this.tripRef,{trip:{...data.trip,updatedAt:serverTimestamp()},members:data.members,meals:data.meals,items:data.items},{merge:true});
      return data;
    });
  }
}

export const dataAdapter = DATA_MODE.useFirebase ? new FirebaseAdapter() : new LocalAdapter();