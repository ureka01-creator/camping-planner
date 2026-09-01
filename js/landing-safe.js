import './bgm.js?v=5';

// v1.0.8: HQ poster, full composition, iPhone Safari scroll lock.
const COVER_SRC = './assets/cover-main-approved.jpg?v=8';

let overlay = null;
let closing = false;
let lockedScrollY = 0;

function lockViewport() {
  lockedScrollY = window.scrollY || window.pageYOffset || 0;
  document.documentElement.classList.add('landing-open');
  document.body.classList.add('landing-open');
  document.body.style.setProperty('--landing-scroll-y', `-${lockedScrollY}px`);
}

function unlockViewport() {
  document.documentElement.classList.remove('landing-open');
  document.body.classList.remove('landing-open');
  document.body.style.removeProperty('--landing-scroll-y');
  window.scrollTo(0, lockedScrollY);
}

async function hydratePoster(root) {
  const image = root?.querySelector?.('.camp-landing-poster');
  const backdrop = root?.querySelector?.('.camp-landing-backdrop');
  const loading = root?.querySelector?.('.camp-landing-loading');
  const hint = root?.querySelector?.('.camp-landing-hint');
  if (!(image instanceof HTMLImageElement)) return;

  image.removeAttribute('src');
  if (backdrop instanceof HTMLImageElement) backdrop.removeAttribute('src');
  image.classList.remove('loaded');
  backdrop?.classList.remove('loaded');
  hint?.classList.remove('loaded');
  loading?.classList.remove('hidden');
  if (loading) loading.textContent = '메인 이미지를 불러오는 중…';

  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      const done = ok => {
        if (settled) return;
        settled = true;
        image.onload = null;
        image.onerror = null;
        ok ? resolve() : reject(new Error('HQ JPEG decode failed'));
      };
      image.onload = () => done(true);
      image.onerror = () => done(false);
      image.src = COVER_SRC;
      if (backdrop instanceof HTMLImageElement) backdrop.src = COVER_SRC;
      if (image.complete && image.naturalWidth > 0) done(true);
    });

    if (!root?.isConnected) return;
    image.classList.add('loaded');
    backdrop?.classList.add('loaded');
    loading?.classList.add('hidden');
    hint?.classList.add('loaded');
    root.dataset.coverWidth = String(image.naturalWidth || 0);
    root.dataset.coverHeight = String(image.naturalHeight || 0);
  } catch (error) {
    console.error('Landing cover failed.', error);
    if (loading) loading.textContent = '메인 이미지 로딩 실패 · 새로고침해줘.';
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
  document.body.classList.remove('landing-boot', 'landing-cover-active');
  unlockViewport();

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
      <img class="camp-landing-backdrop" alt="" aria-hidden="true" />
      <img class="camp-landing-poster" alt="캠핑 메인 이미지" />
      <span class="camp-landing-loading">메인 이미지를 불러오는 중…</span>
    </span>
    <span class="camp-landing-hint" aria-hidden="true">⌄</span>`;
  return node;
}

function openLanding() {
  window.CampingBgm?.pause?.();
  closing = false;
  lockViewport();

  const existing = document.querySelector('.camp-landing');
  if (existing instanceof HTMLElement && existing.isConnected) {
    overlay = existing;
    if (!overlay.querySelector('.camp-landing-backdrop')) {
      const backdrop = document.createElement('img');
      backdrop.className = 'camp-landing-backdrop';
      backdrop.alt = '';
      backdrop.setAttribute('aria-hidden', 'true');
      overlay.querySelector('.camp-landing-safe-frame')?.prepend(backdrop);
    }
  } else {
    overlay = makeLanding();
    document.body.prepend(overlay);
  }

  bindLanding(overlay);
  document.body.classList.add('landing-cover-active');
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