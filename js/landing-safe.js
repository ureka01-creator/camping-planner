import './bgm.js?v=5';

// v1.0.6: cover-main-v1.webp is stored as base64 TEXT in GitHub because the
// connector cannot write binary files. Browsers must decode that text into a
// data URL; pointing <img src> directly at the text file produces the broken
// image shown on iPhone Safari.
const COVER_TEXT_SRC = './assets/cover-main-v1.webp?v=4';

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
    opacity:0; transition:opacity .12s ease; box-shadow:none; pointer-events:none;
  }
  .camp-landing-poster.loaded { opacity:1; }
  .camp-landing-loading {
    position:absolute; inset:0; display:grid; place-items:center;
    color:rgba(255,241,218,.45); font-size:11px; letter-spacing:.02em;
    pointer-events:none;
  }
  .camp-landing-loading.hidden { display:none; }
  .camp-landing-hint {
    position:absolute; left:50%; bottom:max(10px,calc(env(safe-area-inset-bottom) + 2px));
    transform:translateX(-50%); color:rgba(255,241,218,.62); font-size:19px;
    text-shadow:0 1px 8px rgba(0,0,0,.35); opacity:0; pointer-events:none;
  }
  .camp-landing-hint.loaded { opacity:.72; }
  .camp-landing.is-exiting { opacity:0; transition:opacity .16s ease; pointer-events:none; }
`;
document.head.appendChild(style);

document.body.classList.add('home-hydrating');

let overlay = null;
let closing = false;
let coverDataUrlPromise = window.CampingCoverDataUrlPromise || null;

function coverDataUrl() {
  if (window.CampingCoverDataUrl) return Promise.resolve(window.CampingCoverDataUrl);
  if (coverDataUrlPromise) return coverDataUrlPromise;

  coverDataUrlPromise = fetch(COVER_TEXT_SRC, { cache:'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`cover fetch ${response.status}`);
      return response.text();
    })
    .then(text => {
      const base64 = text.replace(/\s+/g, '');
      if (!base64.startsWith('UklG')) throw new Error('cover base64 is invalid');
      const src = `data:image/webp;base64,${base64}`;
      window.CampingCoverDataUrl = src;
      return src;
    });

  window.CampingCoverDataUrlPromise = coverDataUrlPromise;
  return coverDataUrlPromise;
}

async function hydratePoster(root) {
  const image = root?.querySelector?.('.camp-landing-poster');
  const loading = root?.querySelector?.('.camp-landing-loading');
  const hint = root?.querySelector?.('.camp-landing-hint');
  if (!(image instanceof HTMLImageElement)) return;

  // Remove the invalid direct URL immediately so Safari never keeps showing the
  // broken-image icon while the base64 text is being decoded.
  image.removeAttribute('src');
  image.classList.remove('loaded');
  hint?.classList.remove('loaded');
  loading?.classList.remove('hidden');

  try {
    image.src = await coverDataUrl();
    if (typeof image.decode === 'function') await image.decode().catch(() => {});
    if (!image.naturalWidth) {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('cover decode failed'));
      });
    }
    image.classList.add('loaded');
    loading?.classList.add('hidden');
    hint?.classList.add('loaded');
  } catch (error) {
    console.error('Landing cover failed.', error);
    if (loading) loading.textContent = '메인 이미지를 다시 불러오는 중…';
    window.setTimeout(() => {
      coverDataUrlPromise = null;
      window.CampingCoverDataUrlPromise = null;
      if (root?.isConnected) hydratePoster(root);
    }, 1200);
  }
}

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
      <img class="camp-landing-poster" alt="캠핑 메인 이미지" />
      <span class="camp-landing-loading">메인 이미지를 불러오는 중…</span>
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
    hydratePoster(overlay);
    return;
  }

  overlay = makeLanding();
  bindLanding(overlay);
  document.body.prepend(overlay);
  document.body.classList.add('landing-open', 'landing-cover-active');
  document.body.classList.remove('landing-boot');
  hydratePoster(overlay);
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

openLanding();