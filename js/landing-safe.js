import './bgm.js?v=5';

// QA marker: final approved poster + BGM restart-from-beginning v0.9.7.
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
const DATE_PATCH = './assets/date-fix-v2.b64?v=6';

// Do not keep a large generated data URL in Safari storage anymore.
try { localStorage.removeItem(COVER_CACHE_KEY); } catch (_) {}
document.body.classList.remove('landing-open', 'landing-cover-active');

const style = document.createElement('style');
style.textContent = `
  body.landing-open { overflow:hidden; }
  body.landing-cover-active #app { visibility:hidden !important; }
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
  @media (min-aspect-ratio:2/3) {
    .camp-landing-safe-frame { height:100dvh; width:auto; max-width:100vw; }
  }
`;
document.head.appendChild(style);

let coverPromise = null;
let overlay = null;
let suppressClickUntil = 0;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function averageWarmText(imageData) {
  const data = imageData.data;
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const lum = (r + g + b) / 3;
    if (a > 220 && lum > 115 && r > g + 2 && g > b + 2 && r - b < 90) {
      rSum += r; gSum += g; bSum += b; count++;
    }
  }
  return count ? [rSum / count, gSum / count, bSum / count] : null;
}

function matchPatchToneToSecondLine(patchImage, baseCtx, scaleX, scaleY) {
  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = patchImage.naturalWidth;
  patchCanvas.height = patchImage.naturalHeight;
  const patchCtx = patchCanvas.getContext('2d', { willReadFrequently:true });
  if (!patchCtx) return patchImage;
  patchCtx.drawImage(patchImage, 0, 0);

  const patchData = patchCtx.getImageData(0, 0, patchCanvas.width, patchCanvas.height);
  const sourceTone = averageWarmText(patchData);
  const targetX = Math.round(717 * scaleX);
  const targetY = Math.round(735 * scaleY);
  const targetW = Math.max(1, Math.round(135 * scaleX));
  const targetH = Math.max(1, Math.round(31 * scaleY));
  const targetTone = averageWarmText(baseCtx.getImageData(targetX, targetY, targetW, targetH));
  if (!sourceTone || !targetTone) return patchCanvas;

  const ratio = targetTone.map((value, index) => Math.max(.88, Math.min(1.18, value / sourceTone[index])));
  const data = patchData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const lum = (r + g + b) / 3;
    const isWarmGlyph = a > 220 && lum > 105 && r > g + 3 && g > b + 2 && r - b < 105;
    if (!isWarmGlyph) continue;
    data[i] = Math.min(255, Math.round(r * ratio[0]));
    data[i + 1] = Math.min(255, Math.round(g * ratio[1]));
    data[i + 2] = Math.min(255, Math.round(b * ratio[2]));
  }
  patchCtx.putImageData(patchData, 0, 0);
  return patchCanvas;
}

async function applyVerifiedDateFix(baseSrc) {
  const response = await fetch(DATE_PATCH, { cache:'force-cache' });
  if (!response.ok) throw new Error('date patch load failed');
  const patchBase64 = (await response.text()).trim();
  const [baseImage, patchImage] = await Promise.all([
    loadImage(baseSrc),
    loadImage(`data:image/webp;base64,${patchBase64}`)
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = baseImage.naturalWidth;
  canvas.height = baseImage.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(baseImage, 0, 0);

  const scaleX = canvas.width / 1024;
  const scaleY = canvas.height / 1536;
  const toneMatchedPatch = matchPatchToneToSecondLine(patchImage, ctx, scaleX, scaleY);
  ctx.drawImage(toneMatchedPatch, 717 * scaleX, 697 * scaleY, 135 * scaleX, 33 * scaleY);
  return canvas.toDataURL('image/webp', .96);
}

function loadCoverSrc() {
  if (!coverPromise) {
    coverPromise = Promise.all(COVER_PARTS.map(async url => {
      const response = await fetch(url, { cache:'force-cache' });
      if (!response.ok) throw new Error(`cover load failed: ${url}`);
      return (await response.text()).trim();
    }))
      .then(parts => `data:image/webp;base64,${parts.join('')}`)
      .then(baseSrc => applyVerifiedDateFix(baseSrc));
  }
  return coverPromise;
}

function closeLanding() {
  if (!(overlay instanceof HTMLElement)) {
    document.body.classList.remove('landing-boot', 'landing-open', 'landing-cover-active');
    return;
  }
  const current = overlay;
  overlay = null;
  suppressClickUntil = Date.now() + 350;
  current.classList.add('is-exiting');
  document.body.classList.remove('landing-boot', 'landing-open');
  window.setTimeout(() => {
    current.remove();
    document.body.classList.remove('landing-cover-active');
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
  // Landing/poster stays silent and rewinds the BGM. The user's mute preference
  // is preserved, so the next planner entry starts from 0:00 only when enabled.
  window.CampingBgm?.pause?.();

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

  overlay.addEventListener('touchstart', closeFromInput, { passive:false });
  overlay.addEventListener('pointerdown', closeFromInput, { passive:false });
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
    const src = await Promise.race([
      loadCoverSrc(),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('cover fetch timeout')), 4500))
    ]);
    if (!(image instanceof HTMLImageElement) || !overlay?.isConnected) return;
    await waitForImage(image, src);
    if (!overlay?.isConnected) return;
    window.clearTimeout(statusTimer);
    image.classList.add('loaded');
    status?.classList.add('hidden');
    hint?.classList.add('loaded');
  } catch (error) {
    window.clearTimeout(statusTimer);
    console.warn('Safe landing cover failed.', error);
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

document.addEventListener('touchstart', event => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('.camp-landing')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  closeLanding();
}, { capture:true, passive:false });

document.addEventListener('pointerdown', event => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('.camp-landing')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  closeLanding();
}, { capture:true, passive:false });

document.addEventListener('click', event => {
  if (Date.now() >= suppressClickUntil) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

openLanding();
