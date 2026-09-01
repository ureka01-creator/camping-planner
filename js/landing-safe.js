import './bgm.js?v=5';

// Final approved landing poster v1.0.2 — single image, full-bleed.
const COVER_SRC = './assets/cover-main-v1.webp?v=2';

document.body.classList.remove('landing-open', 'landing-cover-active');

const style = document.createElement('style');
style.textContent = `
  body.landing-open { overflow:hidden; }
  body.landing-cover-active #app { visibility:hidden !important; }
  .camp-landing {
    position:fixed; inset:0; z-index:9999; width:100vw; height:100dvh;
    margin:0; padding:0; border:0; background:#070b0f; overflow:hidden;
    display:block; appearance:none; -webkit-appearance:none;
    -webkit-tap-highlight-color:transparent; color:inherit; touch-action:manipulation;
  }
  .camp-landing-safe-frame {
    position:absolute; inset:0; width:100vw; height:100dvh;
    max-width:none; max-height:none; pointer-events:none;
  }
  .camp-landing-poster {
    display:block; width:100%; height:100%; object-fit:cover; object-position:center center;
    opacity:0; transition:opacity .16s ease; box-shadow:none; pointer-events:none;
  }
  .camp-landing-poster.loaded { opacity:1; }
  .camp-landing-safe-status {
    position:absolute; inset:0; display:grid; place-items:center;
    color:rgba(255,241,218,.58); font-size:12px; letter-spacing:.02em;
    opacity:0; transition:opacity .12s ease; pointer-events:none;
  }
  .camp-landing-safe-status.visible { opacity:1; }
  .camp-landing-safe-status.hidden { display:none; }
  .camp-landing-hint {
    position:absolute; left:50%; bottom:max(10px,calc(env(safe-area-inset-bottom) + 2px));
    transform:translateX(-50%); color:rgba(255,241,218,.62); font-size:19px;
    text-shadow:0 1px 8px rgba(0,0,0,.35); opacity:0; pointer-events:none;
  }
  .camp-landing-hint.loaded { opacity:.72; }
  .camp-landing.is-exiting { opacity:0; transition:opacity .16s ease; pointer-events:none; }
`;
document.head.appendChild(style);

let overlay = null;
let closing = false;
let suppressClickUntil = 0;

function activateHome() {
  try { localStorage.setItem('camp:lastView', 'home'); } catch (_) {}

  const homeButton = document.querySelector('[data-nav="home"]');
  if (homeButton && typeof homeButton.onclick === 'function') {
    homeButton.click();
  } else {
    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('active', view.dataset.view === 'home');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === 'home');
    });
    document.getElementById('app')?.classList.add('home-theme');
  }

  window.dispatchEvent(new CustomEvent('camp:landing-enter-home'));
}

function closeLanding() {
  if (closing) return;
  closing = true;
  activateHome();

  document.body.classList.remove('landing-boot', 'landing-open', 'landing-cover-active');

  const current = overlay instanceof HTMLElement ? overlay : document.querySelector('.camp-landing');
  overlay = null;
  suppressClickUntil = Date.now() + 350;

  if (!(current instanceof HTMLElement)) {
    closing = false;
    return;
  }

  current.classList.add('is-exiting');
  window.setTimeout(() => {
    current.remove();
    closing = false;
  }, 180);
}

function closeFromInput(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  closeLanding();
}

function releaseSuppressionForFreshInput(event) {
  if (Date.now() >= suppressClickUntil) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('.camp-landing')) return;
  suppressClickUntil = 0;
}

function waitForImage(image, src, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok, error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      ok ? resolve() : reject(error || new Error('cover decode failed'));
    };
    const timer = window.setTimeout(() => finish(false, new Error('cover decode timeout')), timeoutMs);
    image.onload = () => finish(true);
    image.onerror = () => finish(false, new Error('cover decode failed'));
    image.src = src;
    if (image.complete && image.naturalWidth) finish(true);
  });
}

async function openLanding() {
  window.CampingBgm?.pause?.();

  if (overlay instanceof HTMLElement && overlay.isConnected) return;
  closing = false;

  overlay = document.createElement('div');
  overlay.className = 'camp-landing';
  overlay.setAttribute('role', 'button');
  overlay.setAttribute('tabindex', '0');
  overlay.setAttribute('aria-label', '캠핑 플래너로 들어가기');
  overlay.innerHTML = `
    <span class="camp-landing-safe-frame">
      <img class="camp-landing-poster" alt="캠핑 메인 이미지" />
      <span class="camp-landing-safe-status">메인 이미지를 불러오는 중…</span>
    </span>
    <span class="camp-landing-hint" aria-hidden="true">⌄</span>`;

  // iPhone Safari에서 release 이벤트가 누락되는 경우가 있어 press 시점에 바로 진입한다.
  overlay.addEventListener('pointerdown', closeFromInput, { passive:false });
  overlay.addEventListener('touchstart', closeFromInput, { passive:false });
  overlay.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      return;
    }
    closeFromInput(event);
  });
  overlay.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    closeFromInput(event);
  });

  document.body.prepend(overlay);
  document.body.classList.add('landing-open', 'landing-cover-active');
  document.body.classList.remove('landing-boot');

  const image = overlay.querySelector('.camp-landing-poster');
  const status = overlay.querySelector('.camp-landing-safe-status');
  const hint = overlay.querySelector('.camp-landing-hint');
  const statusTimer = window.setTimeout(() => status?.classList.add('visible'), 650);

  try {
    if (!(image instanceof HTMLImageElement)) return;
    await waitForImage(image, COVER_SRC);
    if (!overlay?.isConnected) return;
    window.clearTimeout(statusTimer);
    image.classList.add('loaded');
    status?.classList.add('hidden');
    hint?.classList.add('loaded');
  } catch (error) {
    window.clearTimeout(statusTimer);
    console.warn('Landing cover failed.', error);
    closeLanding();
  }
}

window.CampingLandingSafe = { open:openLanding, close:closeLanding };

window.addEventListener('pointerdown', releaseSuppressionForFreshInput, true);
window.addEventListener('touchstart', releaseSuppressionForFreshInput, { capture:true, passive:true });

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('#landingShortcutBtn');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openLanding();
}, true);

document.addEventListener('click', event => {
  if (Date.now() >= suppressClickUntil) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('.camp-landing')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

openLanding();