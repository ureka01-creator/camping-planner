const COVER_CACHE_KEY = 'camp:landingCover:v9';
const COVER_PARTS = [
  './assets/cover-v2.part0?v=2',
  './assets/cover-v2.part1?v=2',
  './assets/cover-v2.part2?v=2',
  './assets/cover-v2.part3?v=2',
  './assets/cover-v2.part4?v=2',
  './assets/cover-v2.part5?v=2',
  './assets/cover-v2.part6?v=2'
];

// Do not keep a large generated data URL in Safari storage anymore.
try { localStorage.removeItem(COVER_CACHE_KEY); } catch (_) {}
document.body.classList.remove('landing-boot', 'landing-open');

const style = document.createElement('style');
style.textContent = `
  body.landing-open { overflow:hidden; }
  .camp-landing {
    position:fixed; inset:0; z-index:9999; width:100%; height:100dvh;
    margin:0; padding:0; border:0; background:#070b0f; overflow:hidden;
    display:grid; place-items:center; appearance:none; -webkit-appearance:none;
    -webkit-tap-highlight-color:transparent; color:inherit; touch-action:manipulation;
  }
  .camp-landing-safe-frame {
    position:relative; width:min(100vw,460px); max-width:100%; max-height:100dvh;
    aspect-ratio:2 / 3; display:grid; place-items:center; pointer-events:none;
  }
  .camp-landing-poster {
    display:block; width:100%; height:100%; object-fit:contain;
    opacity:0; transition:opacity .16s ease;
    box-shadow:0 18px 70px rgba(0,0,0,.30); pointer-events:none;
  }
  .camp-landing-poster.loaded { opacity:1; }
  .camp-landing-safe-status {
    position:absolute; inset:0; display:grid; place-items:center;
    color:rgba(255,241,218,.58); font-size:12px; letter-spacing:.02em;
    pointer-events:none;
  }
  .camp-landing-safe-status.hidden { display:none; }
  .camp-landing-hint {
    position:absolute; left:50%; bottom:max(10px,calc(env(safe-area-inset-bottom) + 2px));
    transform:translateX(-50%); color:rgba(255,241,218,.62); font-size:19px;
    text-shadow:0 1px 8px rgba(0,0,0,.35); opacity:0; pointer-events:none;
  }
  .camp-landing-hint.loaded { opacity:.72; }
  .camp-landing.is-exiting { opacity:0; transition:opacity .20s ease; pointer-events:none; }
  @media (min-aspect-ratio:2/3) {
    .camp-landing-safe-frame { height:100dvh; width:auto; max-width:100vw; }
  }
`;
document.head.appendChild(style);

let coverPromise = null;
let overlay = null;
let lastPointerCloseAt = 0;

function loadCoverSrc() {
  if (!coverPromise) {
    coverPromise = Promise.all(COVER_PARTS.map(async url => {
      const response = await fetch(url, { cache:'force-cache' });
      if (!response.ok) throw new Error(`cover load failed: ${url}`);
      return (await response.text()).trim();
    })).then(parts => `data:image/webp;base64,${parts.join('')}`);
  }
  return coverPromise;
}

function closeLanding() {
  if (!(overlay instanceof HTMLElement)) return;
  const current = overlay;
  overlay = null;
  current.classList.add('is-exiting');
  document.body.classList.remove('landing-open');
  window.setTimeout(() => current.remove(), 220);
}

function waitForImage(image, src, timeoutMs = 2500) {
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
  if (overlay instanceof HTMLElement && overlay.isConnected) return;

  overlay = document.createElement('div');
  overlay.className = 'camp-landing';
  overlay.setAttribute('role', 'button');
  overlay.setAttribute('tabindex', '0');
  overlay.setAttribute('aria-label', '캠핑 플래너로 돌아가기');
  overlay.innerHTML = `
    <span class="camp-landing-safe-frame">
      <img class="camp-landing-poster" alt="캠핑 메인 이미지" />
      <span class="camp-landing-safe-status">메인 이미지를 불러오는 중…</span>
    </span>
    <span class="camp-landing-hint" aria-hidden="true">⌄</span>`;

  overlay.addEventListener('pointerup', event => {
    event.preventDefault();
    lastPointerCloseAt = Date.now();
    closeLanding();
  });
  overlay.addEventListener('click', event => {
    event.preventDefault();
    if (Date.now() - lastPointerCloseAt < 500) return;
    closeLanding();
  });
  overlay.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    closeLanding();
  });

  document.body.prepend(overlay);
  document.body.classList.add('landing-open');

  const image = overlay.querySelector('.camp-landing-poster');
  const status = overlay.querySelector('.camp-landing-safe-status');
  const hint = overlay.querySelector('.camp-landing-hint');

  try {
    const src = await Promise.race([
      loadCoverSrc(),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('cover fetch timeout')), 3500))
    ]);
    if (!(image instanceof HTMLImageElement) || !overlay?.isConnected) return;
    await waitForImage(image, src);
    if (!overlay?.isConnected) return;
    image.classList.add('loaded');
    status?.classList.add('hidden');
    hint?.classList.add('loaded');
  } catch (error) {
    console.warn('Safe landing cover failed.', error);
    closeLanding();
  }
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

// Capture the landing tap before any other app-level click handler can interfere.
document.addEventListener('pointerup', event => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('.camp-landing')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  lastPointerCloseAt = Date.now();
  closeLanding();
}, true);
