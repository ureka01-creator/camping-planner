import { FIREBASE_CONFIG } from './firebase.js?v=064';

let auth = null;
let authMod = null;
let authAttemptActive = false;
let hadGoogleUser = false;
let recovering = false;

function loginGate() {
  return document.querySelector('.google-login-backdrop');
}

function loginStatus() {
  return loginGate()?.querySelector('[data-google-login-status]');
}

function isLoginPending() {
  return Boolean(loginGate() && loginStatus()?.textContent?.includes('Google 로그인 중'));
}

function scheduleReturnRecovery() {
  if (!authAttemptActive || recovering || document.visibilityState === 'hidden') return;
  recovering = true;

  window.setTimeout(async () => {
    try {
      if (!isLoginPending()) {
        authAttemptActive = false;
        return;
      }

      // iPhone Safari can return from Firebase's auth helper without settling
      // signInWithPopup in the opener. Reloading here safely rehydrates Firebase
      // auth state: a completed login enters the app, a cancelled login restores
      // an enabled Google button instead of leaving "로그인 중…" forever.
      if (auth?.currentUser && !auth.currentUser.isAnonymous) {
        location.reload();
        return;
      }

      location.reload();
    } finally {
      recovering = false;
    }
  }, 650);
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('[data-google-login]')) return;
  authAttemptActive = true;
}, true);

window.addEventListener('focus', scheduleReturnRecovery);
window.addEventListener('pageshow', event => {
  if (event.persisted || authAttemptActive) scheduleReturnRecovery();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleReturnRecovery();
});

async function boot() {
  const [appMod, loadedAuthMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js')
  ]);

  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
  authMod = loadedAuthMod;
  auth = authMod.getAuth(app);
  if (typeof auth.authStateReady === 'function') await auth.authStateReady();
  hadGoogleUser = Boolean(auth.currentUser && !auth.currentUser.isAnonymous);

  authMod.onAuthStateChanged(auth, user => {
    const hasGoogleUser = Boolean(user && !user.isAnonymous);

    if (hasGoogleUser) {
      hadGoogleUser = true;
      authAttemptActive = false;
      return;
    }

    if (!hadGoogleUser) return;
    hadGoogleUser = false;

    // Explicit logout should return to the poster/landing screen first.
    // google-login.js leaves its login gate waiting underneath; when the user
    // taps the poster, that gate becomes the next screen.
    window.setTimeout(() => window.CampingLandingSafe?.open?.(), 0);
  });
}

boot().catch(error => {
  console.warn('Google iOS auth recovery skipped.', error);
});
