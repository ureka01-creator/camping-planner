import './bgm.js?v=5';

// v1.0.5: the first poster is rendered by index.html itself so the entry screen
// does not depend on Firebase/module startup. This module only owns interaction
// and later re-opening from the home shortcut.
const COVER_SRC = './assets/cover-main-v1.webp?v=3';

const style = document.createElement('style');
style.textContent = `
  body.landing-open { overflow:hidden; }
  body.landing-cover-active #app { visibility:hidden !important; }
  body.home-hydrating #view-home { visibility:hidden !important; }
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
    opacity:1; box-shadow:none; pointer-events:none;
  }
  .camp-landing-safe-status { display:none; }
  .camp-landing-hint {
    position:absolute; left:50%; bottom:max(10px,calc(env(safe-area-inset-bottom) + 2px));
    transform:translateX(-50%); color:rgba(255,241,218,.62); font-size:19px;
    text-shadow:0 1px 8px rgba(0,0,0,.35); opacity:.72; pointer-events:none;
  }
  .camp-landing.is-exiting { opacity:0; transition:opacity .16s ease; pointer-events:none; }
`;
document.head.appendChild(style);

document.body.classList.add('home-hydrating');

let overlay = null;
let closing = false;

function activateHome() {
  try { localStorage.setItem('camp:lastView', 'home'); } catch (_) {}

  const homeButton = document.querySelector('[data-nav="home"]');
  if (homeButton && typeof homeButton.onclick === 'function') {
    homeButton.click();
    return;
  }

  document.querySelectorAll('.view').forEach(view => {
    view.classList.toggle('active', view.dataset.view === 'home');
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.nav === 'home');
  });
  document.getElementById('app')?.classList.add('home-theme');
}

function closeLanding() {
  if (closing) return;
  closing = true;

  activateHome();
  document.body.classList.remove('landing-boot', 'landing-open', 'landing-cover-active');

  const current = overlay instanceof HTMLElement ? overlay : document.querySelector('.camp-landing');
  overlay = null;

  if (!(current instanceof HTMLElement)) {
    closing = false;
    window.dispatchEvent(new CustomEvent('camp:landing-closed'));
    return;
  }

  current.classList.add('is-exiting');
  window.setTimeout(() => {
    current.remove();
    closing = false;
    window.dispatchEvent(new CustomEvent('camp:landing-closed'));
  }, 180);
}

function closeFromInput(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  closeLanding();
}

function bindLanding(node) {
  if (!(node instanceof HTMLElement) || node.dataset.landingBound === '1') return;
  node.dataset.landingBound = '1';
  node.addEventListener('pointerup', closeFromInput, { passive:false });
  node.addEventListener('click', closeFromInput);
  node.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    closeFromInput(event);
  });
}

function makeLanding() {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'camp-landing';
  node.setAttribute('aria-label', '캠핑 플래너로 들어가기');
  node.innerHTML = `
    <span class="camp-landing-safe-frame">
      <img class="camp-landing-poster" src="${COVER_SRC}" alt="캠핑 메인 이미지" />
    </span>
    <span class="camp-landing-hint" aria-hidden="true">⌄</span>`;
  return node;
}

async function openLanding() {
  window.CampingBgm?.pause?.();
  closing = false;

  const existing = document.querySelector('.camp-landing');
  if (existing instanceof HTMLElement && existing.isConnected) {
    overlay = existing;
    bindLanding(overlay);
    document.body.classList.add('landing-open', 'landing-cover-active');
    document.body.classList.remove('landing-boot');
    return;
  }

  overlay = makeLanding();
  bindLanding(overlay);
  document.body.prepend(overlay);
  document.body.classList.add('landing-open', 'landing-cover-active');
  document.body.classList.remove('landing-boot');
}

window.CampingLandingSafe = { open:openLanding, close:closeLanding };

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('#landingShortcutBtn');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openLanding();
}, true);

// Bind the poster already present in index.html. If an old cached index did not
// include it, create one here as a compatibility fallback.
openLanding();