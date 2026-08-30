const style = document.createElement('style');
style.textContent = `
  body.landing-open { overflow: hidden; }

  .camp-landing {
    position: fixed;
    inset: 0;
    z-index: 9999;
    width: 100%;
    height: 100dvh;
    margin: 0;
    padding: 0;
    border: 0;
    background: #070b0f;
    overflow: hidden;
    display: grid;
    place-items: center;
    appearance: none;
    -webkit-appearance: none;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    color: inherit;
  }

  .camp-landing-bg {
    position: absolute;
    inset: -32px;
    background-position: center;
    background-size: cover;
    filter: blur(24px) brightness(.40) saturate(.85);
    transform: scale(1.10);
    opacity: 0;
    transition: opacity .35s ease;
  }

  .camp-landing-bg.loaded { opacity: 1; }

  .camp-landing::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(2, 6, 9, .10), rgba(2, 6, 9, .02) 58%, rgba(2, 6, 9, .50));
    pointer-events: none;
  }

  .camp-landing-poster {
    position: relative;
    z-index: 1;
    display: block;
    width: min(100vw, 460px);
    max-width: 100%;
    max-height: 100dvh;
    height: auto;
    object-fit: contain;
    opacity: 0;
    transform: scale(.992);
    transition: opacity .35s ease, transform .45s ease;
    box-shadow: 0 18px 70px rgba(0, 0, 0, .30);
  }

  .camp-landing-poster.loaded {
    opacity: 1;
    transform: scale(1);
  }

  .camp-landing-hint {
    position: absolute;
    z-index: 2;
    left: 50%;
    bottom: max(10px, calc(env(safe-area-inset-bottom) + 2px));
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    transform: translateX(-50%);
    color: rgba(255, 241, 218, .54);
    font-size: 19px;
    font-weight: 300;
    line-height: 1;
    opacity: 0;
    transition: opacity .45s ease .3s;
    animation: landingHint 1.8s ease-in-out infinite;
    text-shadow: 0 1px 8px rgba(0, 0, 0, .35);
  }

  .camp-landing-hint.loaded { opacity: .72; }

  @keyframes landingHint {
    0%, 100% { transform: translate(-50%, 0); }
    50% { transform: translate(-50%, 3px); }
  }

  .camp-landing.is-exiting {
    opacity: 0;
    transform: scale(1.012);
    transition: opacity .30s ease, transform .30s ease;
    pointer-events: none;
  }

  @media (min-aspect-ratio: 2/3) {
    .camp-landing-poster {
      width: auto;
      height: 100dvh;
      max-width: 100vw;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .camp-landing,
    .camp-landing-bg,
    .camp-landing-poster,
    .camp-landing-hint { transition: none !important; animation: none !important; }
  }
`;
document.head.append(style);

document.body.classList.add('landing-open');

const overlay = document.createElement('button');
overlay.type = 'button';
overlay.className = 'camp-landing';
overlay.setAttribute('aria-label', '캠핑 플래너 들어가기');
overlay.innerHTML = `
  <span class="camp-landing-bg" aria-hidden="true"></span>
  <img class="camp-landing-poster" alt="두근두근 캠핑 로맨스, 리버앤캠프 9월 11일부터 13일까지" />
  <span class="camp-landing-hint" aria-hidden="true">⌄</span>
`;
document.body.prepend(overlay);

const bg = overlay.querySelector('.camp-landing-bg');
const poster = overlay.querySelector('.camp-landing-poster');
const hint = overlay.querySelector('.camp-landing-hint');

function enterPlanner() {
  if (overlay.classList.contains('is-exiting')) return;
  overlay.classList.add('is-exiting');
  document.body.classList.remove('landing-open');
  window.setTimeout(() => overlay.remove(), 320);
}

overlay.addEventListener('click', enterPlanner);

async function loadCover() {
  const urls = [
    './assets/cover-hq.part0',
    './assets/cover-hq.part1',
    './assets/cover-hq.part2'
  ];

  const parts = await Promise.all(urls.map(async url => {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`cover load failed: ${url}`);
    return response.text();
  }));

  const src = `data:image/webp;base64,${parts.join('')}`;
  poster.src = src;
  bg.style.backgroundImage = `url("${src}")`;

  await poster.decode().catch(() => {});
  requestAnimationFrame(() => {
    bg.classList.add('loaded');
    poster.classList.add('loaded');
    hint.classList.add('loaded');
  });
}

loadCover().catch(error => {
  console.warn('Landing cover failed to load.', error);
  enterPlanner();
});
