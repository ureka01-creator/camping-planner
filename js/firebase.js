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
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(STORE_KEY) : null;

function clone(v){ return JSON.parse(JSON.stringify(v)); }

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
  async mutate(mutator){ const data=this.read(); mutator(data); data.trip.updatedAt=Date.now(); this.write(data); return clone(data); }
  async reset(){ this.write(clone(seedData)); }
}

class FirebaseAdapter {
  constructor(){ this.listeners = new Set(); this.ready = this.init(); }
  async init(){
    const [{ initializeApp }, { getAuth, signInAnonymously }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js')
    ]);
    this.fs = firestore;
    this.app = initializeApp(FIREBASE_CONFIG);
    this.auth = getAuth(this.app);
    await signInAnonymously(this.auth);
    this.db = firestore.getFirestore(this.app);
    this.tripRef = firestore.doc(this.db, 'trips', DATA_MODE.tripId);
    const snapshot = await firestore.getDoc(this.tripRef);
    if (!snapshot.exists()) await this.seed();
    this.unsubscribe = firestore.onSnapshot(this.tripRef, snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      const data = { trip: { id:DATA_MODE.tripId, ...d.trip }, members:d.members||[], meals:d.meals||[], items:d.items||[] };
      this.listeners.forEach(fn => fn(clone(data)));
    });
  }
  async seed(){
    const { setDoc, serverTimestamp } = this.fs;
    const s=clone(seedData);
    await setDoc(this.tripRef,{...s,trip:{...s.trip,updatedAt:serverTimestamp()}},{merge:true});
  }
  subscribe(fn){
    let alive=true;
    this.ready.then(async()=>{
      if(!alive) return;
      this.listeners.add(fn);
      const snap=await this.fs.getDoc(this.tripRef);
      if(snap.exists()){
        const d=snap.data(); fn({trip:{id:DATA_MODE.tripId,...d.trip},members:d.members||[],meals:d.meals||[],items:d.items||[]});
      }
    });
    return ()=>{alive=false;this.listeners.delete(fn)};
  }
  async mutate(mutator){
    await this.ready;
    const { runTransaction, serverTimestamp } = this.fs;
    return runTransaction(this.db, async tx => {
      const snap=await tx.get(this.tripRef);
      const d=snap.data();
      const data={trip:{id:DATA_MODE.tripId,...d.trip},members:d.members||[],meals:d.meals||[],items:d.items||[]};
      mutator(data);
      tx.set(this.tripRef,{trip:{...data.trip,updatedAt:serverTimestamp()},members:data.members,meals:data.meals,items:data.items},{merge:true});
      return data;
    });
  }
}

export const dataAdapter = DATA_MODE.useFirebase ? new FirebaseAdapter() : new LocalAdapter();
