const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCdBMIYmhomv-B72pzEptpfRIoGiORZZWk',
  authDomain: 'camping-planner-4c2bd.firebaseapp.com',
  projectId: 'camping-planner-4c2bd',
  storageBucket: 'camping-planner-4c2bd.firebasestorage.app',
  messagingSenderId: '852218628033',
  appId: '1:852218628033:web:29a2e54a9c81397ae5d140',
  measurementId: 'G-HEZ3M975RX'
};

const AUTH_UID_KEY = 'camp:authUid';
const AUTH_NAME_KEY = 'camp:myName';
const AUTH_EMAIL_KEY = 'camp:authEmail';
const MEMBER_KEY = 'camp:myMemberId';
const AUTHOR_ID_KEY = 'camp:boardAuthorId';
const LEGACY_AUTHOR_ID_KEY = 'camp:legacyBoardAuthorId';
const NICKNAME_PREFIX = 'camp:nickname:';

let gate = null;
let busy = false;
let authRef = null;
let authModRef = null;
let explicitLogoutInProgress = false;
let authResumeTimer = null;

function googleProfileName(user) {
  const display = String(user?.displayName || '').trim();
  if (display) return display;
  const email = String(user?.email || '').trim();
  return email ? email.split('@')[0] : '캠핑 멤버';
}

function nicknameKey(uid) {
  return `${NICKNAME_PREFIX}${uid}`;
}

function savedNickname(uid) {
  if (!uid) return '';
  try { return String(localStorage.getItem(nicknameKey(uid)) || '').trim(); }
  catch (_) { return ''; }
}

function effectiveName(user) {
  return savedNickname(user?.uid) || googleProfileName(user);
}

function ensureAccountControls() {
  const card = document.getElementById('googleAccountCard');
  if (!card || document.getElementById('googleNicknameInput')) return;

  const accountLine = document.getElementById('googleAccountName');
  accountLine?.insertAdjacentHTML('afterend', `
    <div class="google-account-nickname">
      <label for="googleNicknameInput">앱에서 사용할 닉네임</label>
      <div class="google-nickname-row">
        <input id="googleNicknameInput" maxlength="20" autocomplete="off" placeholder="예: 민지" />
        <button id="saveGoogleNicknameBtn" type="button">저장</button>
      </div>
      <small>한줄 게시판에는 이 이름으로 표시돼.</small>
    </div>
    <button id="googleLogoutBtn" type="button" class="google-logout-button">로그아웃</button>`);
}

function renderAccountSettings(user) {
  ensureAccountControls();
  const label = document.getElementById('googleAccountName');
  const nickname = document.getElementById('googleNicknameInput');
  const save = document.getElementById('saveGoogleNicknameBtn');
  const logout = document.getElementById('googleLogoutBtn');

  if (!user || user.isAnonymous) {
    if (label) label.textContent = 'Google 로그인이 필요해.';
    if (nickname instanceof HTMLInputElement) {
      nickname.value = '';
      nickname.disabled = true;
    }
    if (save instanceof HTMLButtonElement) save.disabled = true;
    if (logout instanceof HTMLButtonElement) logout.disabled = true;
    return;
  }

  const profileName = googleProfileName(user);
  if (label) label.textContent = user.email ? `${profileName} · ${user.email}` : profileName;
  if (nickname instanceof HTMLInputElement) {
    nickname.disabled = false;
    nickname.value = effectiveName(user);
  }
  if (save instanceof HTMLButtonElement) save.disabled = false;
  if (logout instanceof HTMLButtonElement) logout.disabled = false;
}

function persistUser(user) {
  if (!user || user.isAnonymous) return false;
  const name = effectiveName(user);
  try {
    localStorage.setItem(AUTH_UID_KEY, user.uid);
    localStorage.setItem(AUTH_NAME_KEY, name);
    localStorage.setItem(AUTH_EMAIL_KEY, String(user.email || ''));
  } catch (_) {}

  const legacyInput = document.getElementById('myNameInput');
  if (legacyInput instanceof HTMLInputElement) legacyInput.value = name;
  renderAccountSettings(user);

  window.CampingGoogleUser = {
    uid:user.uid,
    name,
    email:String(user.email || ''),
    googleName:googleProfileName(user)
  };
  window.dispatchEvent(new CustomEvent('camp:auth-ready', { detail:window.CampingGoogleUser }));
  return true;
}

function clearStoredUser({ explicitLogout = false } = {}) {
  try {
    localStorage.removeItem(AUTH_UID_KEY);
    localStorage.removeItem(AUTH_NAME_KEY);
    localStorage.removeItem(AUTH_EMAIL_KEY);
    if (explicitLogout) {
      localStorage.removeItem(MEMBER_KEY);
      localStorage.removeItem(AUTHOR_ID_KEY);
      localStorage.removeItem(LEGACY_AUTHOR_ID_KEY);
      localStorage.setItem('camp:lastView', 'home');
    }
  } catch (_) {}
  window.CampingGoogleUser = null;
  renderAccountSettings(null);
}

function waitUntilLandingCloses() {
  return new Promise(resolve => {
    const done = () => {
      const landing = document.querySelector('.camp-landing');
      if (landing && !landing.classList.contains('is-exiting')) return false;
      resolve();
      return true;
    };
    if (done()) return;

    const onClosed = () => {
      window.removeEventListener('camp:landing-closed', onClosed);
      resolve();
    };
    window.addEventListener('camp:landing-closed', onClosed, { once:true });

    const observer = new MutationObserver(() => {
      if (!done()) return;
      observer.disconnect();
      window.removeEventListener('camp:landing-closed', onClosed);
    });
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  });
}

function ensureStyle() {
  if (document.getElementById('googleLoginStyle')) return;
  const style = document.createElement('style');
  style.id = 'googleLoginStyle';
  style.textContent = `
    body.google-login-open { overflow:hidden; }
    .google-login-backdrop {
      position:fixed; inset:0; z-index:10000; display:grid; place-items:center;
      padding:24px; background:rgba(7,11,15,.94); backdrop-filter:blur(14px);
    }
    .google-login-card {
      width:min(100%,360px); padding:28px 22px 22px; border:1px solid rgba(216,160,113,.18);
      border-radius:26px; background:rgba(19,23,21,.96); box-shadow:0 24px 70px rgba(0,0,0,.34);
      color:#ead9c4; text-align:center;
    }
    .google-login-kicker { color:#c9895d; font-size:10px; font-weight:900; letter-spacing:.18em; }
    .google-login-card h2 { margin:8px 0 8px; font-size:25px; letter-spacing:-.04em; }
    .google-login-card p { margin:0 0 20px; color:rgba(234,217,196,.52); font-size:12px; line-height:1.55; }
    .google-login-button {
      width:100%; min-height:50px; display:flex; align-items:center; justify-content:center; gap:10px;
      border:1px solid rgba(234,217,196,.16); border-radius:15px; background:#f6f3ef; color:#242424;
      font-size:14px; font-weight:800; box-shadow:0 8px 22px rgba(0,0,0,.16);
    }
    .google-login-button:disabled { opacity:.58; }
    .google-login-g { width:20px; height:20px; display:grid; place-items:center; border-radius:50%; font-size:18px; font-weight:900; color:#4285f4; }
    .google-login-status { min-height:18px; margin-top:12px; color:rgba(234,217,196,.58); font-size:10px; line-height:1.45; }
    .google-account-line { margin:8px 0 0 !important; overflow-wrap:anywhere; }
    .google-account-nickname { margin-top:16px; padding-top:15px; border-top:1px solid rgba(216,160,113,.10); }
    .google-account-nickname label { display:block; margin-bottom:7px; color:rgba(234,217,196,.72); font-size:11px; font-weight:750; }
    .google-nickname-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; }
    .google-nickname-row input {
      width:100%; min-width:0; box-sizing:border-box; min-height:42px; padding:0 12px;
      border:1px solid rgba(216,160,113,.16); border-radius:12px;
      background:rgba(8,12,18,.42); color:#ead9c4; font-size:16px;
    }
    .google-nickname-row button {
      min-width:64px; padding:0 13px; border:1px solid rgba(201,137,93,.24); border-radius:12px;
      background:rgba(201,137,93,.10); color:#e2b181; font-size:12px; font-weight:800;
    }
    .google-account-nickname small { display:block; margin-top:6px; color:rgba(234,217,196,.38); font-size:9px; }
    .google-logout-button {
      width:100%; min-height:40px; margin-top:14px; border:1px solid rgba(234,217,196,.12); border-radius:12px;
      background:transparent; color:rgba(234,217,196,.52); font-size:11px; font-weight:750;
    }
    .google-nickname-row button:disabled,
    .google-logout-button:disabled { opacity:.4; }
  `;
  document.head.appendChild(style);
}

function closeGate() {
  document.querySelectorAll('.google-login-backdrop').forEach(node => node.remove());
  gate = null;
  document.body.classList.remove('google-login-open');
}

function resetPendingLoginUi(message = '') {
  const activeGate = gate?.isConnected ? gate : document.querySelector('.google-login-backdrop');
  if (!(activeGate instanceof HTMLElement)) return;
  const button = activeGate.querySelector('[data-google-login]');
  const status = activeGate.querySelector('[data-google-login-status]');
  busy = false;
  if (button instanceof HTMLButtonElement) button.disabled = false;
  if (status) status.textContent = message;
}

function recoverAfterSafariReturn(delay = 450) {
  window.clearTimeout(authResumeTimer);
  authResumeTimer = window.setTimeout(() => {
    if (document.visibilityState === 'hidden' || explicitLogoutInProgress) return;
    const user = authRef?.currentUser;
    if (user && !user.isAnonymous) {
      persistUser(user);
      closeGate();
      busy = false;
      return;
    }
    const status = gate?.querySelector('[data-google-login-status]');
    if (busy || String(status?.textContent || '').includes('Google 로그인 중')) {
      resetPendingLoginUi('로그인이 완료되지 않았어. 다시 눌러줘.');
    }
  }, delay);
}

async function signInWithGoogle(event) {
  if (busy || !authRef || !authModRef) return;
  busy = true;
  const button = event?.currentTarget;
  const status = gate?.querySelector('[data-google-login-status]');
  if (button instanceof HTMLButtonElement) {
    button.disabled = true;
    button.dataset.authStarted = '1';
  }
  if (status) status.textContent = 'Google 로그인 중…';

  const provider = new authModRef.GoogleAuthProvider();
  provider.setCustomParameters({ prompt:'select_account' });

  try {
    const result = await authModRef.signInWithPopup(authRef, provider);
    if (!persistUser(result.user)) throw new Error('Google user unavailable');
    closeGate();
  } catch (error) {
    console.error('Google sign-in failed.', error);
    const code = String(error?.code || '');

    if (code.includes('popup-blocked') && typeof authModRef.signInWithRedirect === 'function') {
      if (status) status.textContent = 'Safari 로그인 화면으로 이동하는 중…';
      try {
        await authModRef.signInWithRedirect(authRef, provider);
        return;
      } catch (redirectError) {
        console.error('Google redirect sign-in failed.', redirectError);
      }
    }

    if (status) {
      if (code.includes('popup-closed') || code.includes('cancelled-popup')) status.textContent = '로그인을 취소했어. 다시 눌러줘.';
      else if (code.includes('unauthorized-domain')) status.textContent = '현재 주소가 Google 로그인 허용 도메인에 등록되지 않았어.';
      else if (code.includes('web-storage-unsupported')) status.textContent = 'Safari의 쿠키/웹사이트 데이터 설정 때문에 로그인을 시작할 수 없어.';
      else if (code.includes('popup-blocked')) status.textContent = '팝업이 차단됐어. 다시 눌러줘.';
      else status.textContent = '로그인에 실패했어. 다시 눌러줘.';
    }
  } finally {
    busy = false;
    if (button instanceof HTMLButtonElement && button.isConnected) button.disabled = false;
  }
}

function openGate() {
  const existing = document.querySelector('.google-login-backdrop');
  if (existing instanceof HTMLElement) {
    gate = existing;
    document.body.classList.add('google-login-open');
    return;
  }

  ensureStyle();
  gate = document.createElement('div');
  gate.className = 'google-login-backdrop';
  gate.innerHTML = `
    <section class="google-login-card" role="dialog" aria-modal="true" aria-labelledby="googleLoginTitle">
      <div class="google-login-kicker">WELCOME</div>
      <h2 id="googleLoginTitle">캠핑 플래너 시작하기</h2>
      <p>Google 계정으로 로그인하면 기기가 바뀌어도 같은 사용자로 알아볼 수 있어.</p>
      <button type="button" class="google-login-button" data-google-login>
        <span class="google-login-g" aria-hidden="true">G</span><span>Google로 계속하기</span>
      </button>
      <div class="google-login-status" data-google-login-status></div>
    </section>`;
  document.body.appendChild(gate);
  document.body.classList.add('google-login-open');
  gate.querySelector('[data-google-login]')?.addEventListener('click', signInWithGoogle);
}

async function showLoginGate() {
  await waitUntilLandingCloses();
  if (!authRef?.currentUser || authRef.currentUser.isAnonymous) openGate();
}

function saveNickname() {
  const user = authRef?.currentUser;
  const input = document.getElementById('googleNicknameInput');
  if (!user || user.isAnonymous || !(input instanceof HTMLInputElement)) return;

  const nickname = input.value.trim().slice(0, 20);
  if (!nickname) {
    input.focus();
    return;
  }

  try { localStorage.setItem(nicknameKey(user.uid), nickname); } catch (_) {}
  persistUser(user);

  const legacyInput = document.getElementById('myNameInput');
  if (legacyInput instanceof HTMLInputElement) legacyInput.value = nickname;
  document.getElementById('saveMyNameBtn')?.click();
}

async function logoutGoogle() {
  const user = authRef?.currentUser;
  if (!user || !authModRef || !authRef) return;
  if (!window.confirm('Google 계정에서 로그아웃할까?')) return;

  const button = document.getElementById('googleLogoutBtn');
  if (button instanceof HTMLButtonElement) button.disabled = true;
  explicitLogoutInProgress = true;
  try {
    await authModRef.signOut(authRef);
    clearStoredUser({ explicitLogout:true });
    closeGate();
    await window.CampingLandingSafe?.open?.();
  } catch (error) {
    console.error('Google sign-out failed.', error);
    if (button instanceof HTMLButtonElement) button.disabled = false;
    return;
  } finally {
    explicitLogoutInProgress = false;
  }

  showLoginGate();
}

async function boot() {
  ensureStyle();
  ensureAccountControls();

  const [appMod, authMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
  ]);
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
  const auth = authMod.getAuth(app);
  authRef = auth;
  authModRef = authMod;

  try { await authMod.setPersistence(auth, authMod.browserLocalPersistence); } catch (_) {}
  if (typeof auth.authStateReady === 'function') await auth.authStateReady();

  try {
    const redirectResult = await authMod.getRedirectResult(auth);
    if (redirectResult?.user) persistUser(redirectResult.user);
  } catch (error) {
    console.error('Google redirect result failed.', error);
  }

  if (auth.currentUser?.isAnonymous) {
    try { await authMod.signOut(auth); } catch (_) {}
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('#saveGoogleNicknameBtn')) {
      saveNickname();
      return;
    }
    if (event.target.closest('#googleLogoutBtn')) logoutGoogle();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    if (!(event.target instanceof Element) || !event.target.closest('#googleNicknameInput')) return;
    event.preventDefault();
    saveNickname();
  });

  window.addEventListener('pageshow', () => recoverAfterSafariReturn(300));
  window.addEventListener('focus', () => recoverAfterSafariReturn(800));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recoverAfterSafariReturn(500);
  });

  authMod.onAuthStateChanged(auth, user => {
    if (persistUser(user)) {
      closeGate();
      busy = false;
      return;
    }
    clearStoredUser();
    if (!explicitLogoutInProgress) showLoginGate();
  });

  window.CampingGoogleAuthReady = true;
  window.dispatchEvent(new CustomEvent('camp:google-auth-module-ready'));

  if (persistUser(auth.currentUser)) {
    closeGate();
  } else {
    clearStoredUser();
    showLoginGate();
  }
}

boot().catch(error => {
  console.error('Google login boot failed.', error);
  waitUntilLandingCloses().then(() => {
    ensureStyle();
    openGate();
    resetPendingLoginUi('로그인 모듈을 불러오지 못했어. 새로고침 후 다시 시도해줘.');
  });
});