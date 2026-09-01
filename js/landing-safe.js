import './bgm.js?v=5';

// v1.0.7 Safari repair: hydrate the verified full JPEG base64 asset.
// Asset revision v3 forces clients away from the previously truncated payload.
const COVER_TEXT_SRC = './assets/cover-approved-mobile.jpg.b64?v=3';

let overlay = null;
let closing = false;
let coverDataUrlPromise = null;

function coverDataUrl() {
  if (window.CampingCoverDataUrl?.startsWith('data:image/jpeg')) {
    return Promise.resolve(window.CampingCoverDataUrl);
  }
  if (coverDataUrlPromise) return coverDataUrlPromise;

  coverDataUrlPromise = fetch(COVER_TEXT_SRC, { cache:'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`cover fetch ${response.status}`);
      return response.text();
    })
    .then(text => {
      const base64 = text.replace(/\s+/g, '');
      if (!base64.startsWith('/9j/') || base64.length < 20000) {
        throw new Error('approved JPEG base64 is invalid');
      }
      const src = `data:image/jpeg;base64,${base64}`;
      window.CampingCoverDataUrl = src;
      return src;
    });

  return coverDataUrlPromise;
}

async function hydratePoster(root) {
  const image = root?.querySelector?.('.camp-landing-poster');
  const loading = root?.querySelector?.('.camp-landing-loading');
  const hint = root?.querySelector?.('.camp-landing-hint');
  if (!(image instanceof HTMLImageElement)) return;

  image.removeAttribute('src');
  image.classList.remove('loaded');
  hint?.classList.remove('loaded');
  loading?.classList.remove('hidden');
  if (loading) loading.textContent = '메인 이미지를 불러오는 중…';

  try {
    const src = await coverDataUrl();
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('approved JPEG decode failed'));
      image.src = src;
      if (image.complete && image.naturalWidth > 0) resolve();
    });
    if (!root?.isConnected) return;
    image.classList.add('loaded');
    loading?.classList.add('hidden');
    hint?.classList.add('loaded');
  } catch (error) {
    console.error('Landing cover failed.', error);
    if (loading) loading.textContent = '메인 이미지 로딩 실패 · 새로고침해줘.';
    coverDataUrlPromise = null;
    window.CampingCoverDataUrl = null;
  }
}

function activateHome() {
  try { localStorage.setItem('camp:lastView', 'home'); } catch (_) {}

  const homeButton = document.querySelector('[data-nav="home"]');
  if (homeButton instanceof HTMLElement) {
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

function openLanding() {
  window.CampingBgm?.pause?.();
  closing = false;

  const existing = document.querySelector('.camp-landing');
  if (existing instanceof HTMLElement && existing.isConnected) {
    overlay = existing;
  } else {
    overlay = makeLanding();
    document.body.prepend(overlay);
  }

  bindLanding(overlay);
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