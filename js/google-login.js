import { FIREBASE_CONFIG } from './firebase.js?v=064';

const AUTH_UID_KEY = 'camp:authUid';
const AUTH_NAME_KEY = 'camp:myName';
const AUTH_EMAIL_KEY = 'camp:authEmail';
let gate = null;
let busy = false;

function authName(user) {
  const display = String(user?.displayName || '').trim();
  if (display) return display;
  const email = String(user?.email || '').trim();
  return email ? email.split('@')[0] : '캠핑 멤버';
}

function persistUser(user) {
  if (!user || user.isAnonymous) return false;
  const name = authName(user);
  try {
    localStorage.setItem(AUTH_UID_KEY, user.uid);
    localStorage.setItem(AUTH_NAME_KEY, name);
    localStorage.setItem(AUTH_EMAIL_KEY, String(user.email || ''));
  } catch (_) {}

  const label = document.getElementById('googleAccountName');
  if (label) label.textContent = user.email ? `${name} · ${user.email}` : name;
  window.CampingGoogleUser = { uid:user.uid, name, email:String(user.email || '') };
  window.dispatchEvent(new CustomEvent('camp:auth-ready', { detail:window.CampingGoogleUser }));
  return true;
}

function clearStoredUser() {
  try {
    localStorage.removeItem(AUTH_UID_KEY);
    localStorage.removeItem(AUTH_EMAIL_KEY);
  } catch (_) {}
  window.CampingGoogleUser = null;
}

function waitUntilLandingCloses() {
  return new Promise(resolve => {
    const done = () => {
      if (document.querySelector('.camp-landing')) return false;
      resolve();
      return true;
    };
    if (done()) return;
    const observer = new MutationObserver(() => {
      if (done()) observer.disconnect();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  });
}

function ensureStyle() {
  if (document.getElementById('googleLoginStyle')) return;
  const style = document.createElement('style');
  style.id = 'googleLoginStyle';
  style.textContent = `
    body.google-login-open { overflow:hidden; }
    .google-login-backdrop {
      position:fixed; inset:0; z-index:9998; display:grid; place-items:center;
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
    .google-login-status { min-height:18px; margin-top:12px; color:rgba(234,217,196,.48); font-size:10px; }
    .google-account-line { margin-top:8px !important; overflow-wrap:anywhere; }
  `;
  document.head.appendChild(style);
}

function closeGate() {
  gate?.remove();
  gate = null;
  document.body.classList.remove('google-login-open');
}

function openGate(onLogin) {
  if (gate?.isConnected) return;
  ensureStyle();
  gate = document.createElement('div');
  gate.className = 'google-login-backdrop';
  gate.innerHTML = `
    <section class="google-login-card" role="dialog" aria-modal="true" aria-labelledby="googleLoginTitle">
      <div class="google-login-kicker">WELCOME</div>
      <h2 id="googleLoginTitle">캠핑 플래너 시작하기</h2>
      <p>Google 계정으로 로그인하면 이름과 게시글 작성자를 자동으로 기억해.</p>
      <button type="button" class="google-login-button" data-google-login>
        <span class="google-login-g" aria-hidden="true">G</span><span>Google로 계속하기</span>
      </button>
      <div class="google-login-status" data-google-login-status></div>
    </section>`;
  document.body.appendChild(gate);
  document.body.classList.add('google-login-open');
  gate.querySelector('[data-google-login]')?.addEventListener('click', onLogin);
}

async function boot() {
  const [appMod, authMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
  ]);
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
  const auth = authMod.getAuth(app);
  try { await authMod.setPersistence(auth, authMod.browserLocalPersistence); } catch (_) {}
  try { await authMod.getRedirectResult(auth); } catch (error) { console.warn('Google redirect result skipped.', error); }
  if (typeof auth.authStateReady === 'function') await auth.authStateReady();

  if (persistUser(auth.currentUser)) {
    closeGate();
    return;
  }

  clearStoredUser();
  await waitUntilLandingCloses();
  openGate(async event => {
    if (busy) return;
    busy = true;
    const button = event.currentTarget;
    const status = gate?.querySelector('[data-google-login-status]');
    if (button instanceof HTMLButtonElement) button.disabled = true;
    if (status) status.textContent = 'Google 로그인 중…';
    try {
      const provider = new authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt:'select_account' });
      const result = await authMod.signInWithPopup(auth, provider);
      if (!persistUser(result.user)) throw new Error('Google user unavailable');
      closeGate();
    } catch (error) {
      console.error('Google sign-in failed.', error);
      const code = String(error?.code || '');
      if (code.includes('popup-blocked') || code.includes('operation-not-supported')) {
        try {
          const provider = new authMod.GoogleAuthProvider();
          await authMod.signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          console.error('Google redirect sign-in failed.', redirectError);
        }
      }
      if (status) status.textContent = code.includes('popup-closed') ? '로그인을 취소했어. 다시 눌러줘.' : '로그인에 실패했어. Firebase의 Google 로그인을 확인해줘.';
    } finally {
      busy = false;
      if (button instanceof HTMLButtonElement && button.isConnected) button.disabled = false;
    }
  });

  authMod.onAuthStateChanged(auth, user => {
    if (!persistUser(user)) return;
    closeGate();
  });
}

boot().catch(error => {
  console.error('Google login boot failed.', error);
  waitUntilLandingCloses().then(() => {
    ensureStyle();
    openGate(() => location.reload());
    const status = gate?.querySelector('[data-google-login-status]');
    if (status) status.textContent = '로그인 모듈을 불러오지 못했어. 잠시 후 다시 시도해줘.';
    const label = gate?.querySelector('.google-login-button span:last-child');
    if (label) label.textContent = '다시 시도';
  });
});
