const SOURCE = './assets/midnight-dreaming-lofi.mp3';
const MUTED_KEY = 'camp:bgmMuted:v1';
const VOLUME = 0.12;

let audio = null;
let button = null;
let available = false;
let activated = false;

function readMuted() {
  try { return localStorage.getItem(MUTED_KEY) === '1'; }
  catch (_) { return false; }
}

function writeMuted(value) {
  try { localStorage.setItem(MUTED_KEY, value ? '1' : '0'); }
  catch (_) {}
}

function speakerSvg(muted) {
  return muted
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h4l5 4V5.5l-5 4H4Z"></path><path d="m17 9 4 4m0-4-4 4"></path></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h4l5 4V5.5l-5 4H4Z"></path><path d="M16.5 9a4.5 4.5 0 0 1 0 6"></path><path d="M18.8 6.8a8 8 0 0 1 0 10.4"></path></svg>`;
}

function syncButton() {
  if (!button || !audio) return;
  const muted = readMuted();
  button.hidden = !available;
  button.classList.toggle('muted', muted);
  button.setAttribute('aria-pressed', String(!muted));
  button.setAttribute('aria-label', muted ? '배경음악 켜기' : '배경음악 끄기');
  button.innerHTML = speakerSvg(muted);
}

async function startPlayback() {
  activated = true;
  if (!audio || !available || readMuted()) return;
  audio.muted = false;
  audio.volume = VOLUME;
  try {
    await audio.play();
  } catch (_) {
    // iOS may reject a resume that is no longer inside a user gesture.
    // The next user interaction will try again.
  }
}

function ensureButton() {
  const actions = document.querySelector('.topbar-actions');
  if (!actions) return null;

  button = document.getElementById('bgmToggleBtn');
  if (button) return button;

  button = document.createElement('button');
  button.id = 'bgmToggleBtn';
  button.type = 'button';
  button.className = 'icon-btn bgm-toggle-btn';
  button.hidden = true;

  const settings = document.getElementById('settingsShortcut');
  actions.insertBefore(button, settings || null);

  button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (!audio || !available) return;

    const nextMuted = !readMuted();
    writeMuted(nextMuted);
    audio.muted = nextMuted;
    syncButton();

    if (nextMuted) {
      audio.pause();
      return;
    }

    await startPlayback();
  });

  syncButton();
  return button;
}

function tryFromGesture() {
  if (!activated || audio?.paused) startPlayback();
}

const style = document.createElement('style');
style.textContent = `
  .bgm-toggle-btn { flex:none; }
  .bgm-toggle-btn svg {
    width:19px; height:19px; fill:none; stroke:currentColor;
    stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round;
  }
  .bgm-toggle-btn.muted { opacity:.58; }
`;
document.head.appendChild(style);

audio = new Audio(SOURCE);
audio.loop = true;
audio.preload = 'auto';
audio.volume = VOLUME;
audio.muted = readMuted();
audio.setAttribute('playsinline', '');

audio.addEventListener('canplay', () => {
  available = true;
  ensureButton();
  syncButton();
});

audio.addEventListener('error', () => {
  available = false;
  syncButton();
  console.warn('Camping BGM asset is not available yet.');
});

ensureButton();

// Capture the very first real user gesture at window level. This happens
// before the landing cover consumes its tap and satisfies iOS autoplay rules.
window.addEventListener('pointerdown', tryFromGesture, { capture:true });
window.addEventListener('touchstart', tryFromGesture, { capture:true, passive:true });
window.addEventListener('keydown', tryFromGesture, { capture:true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden || !activated || readMuted() || !available) return;
  startPlayback();
});

window.CampingBgm = {
  play: startPlayback,
  mute() {
    writeMuted(true);
    if (audio) { audio.muted = true; audio.pause(); }
    syncButton();
  },
  unmute() {
    writeMuted(false);
    if (audio) audio.muted = false;
    syncButton();
    return startPlayback();
  }
};
