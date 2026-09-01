const backdrop = document.getElementById('modalBackdrop');
const viewport = window.visualViewport;
let activeField = null;
let settleTimers = [];
let lockedScrollY = null;

function isModalField(element) {
  return element instanceof HTMLElement &&
    element.matches('input, textarea, select') &&
    Boolean(element.closest('.modal-sheet'));
}

function clearTimers() {
  settleTimers.forEach(timer => window.clearTimeout(timer));
  settleTimers = [];
}

function lockBackgroundScroll() {
  if (lockedScrollY !== null) return;
  lockedScrollY = window.scrollY || window.pageYOffset || 0;
  const body = document.body;
  body.style.position = 'fixed';
  body.style.top = `-${lockedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  document.documentElement.classList.add('modal-page-locked');
}

function unlockBackgroundScroll() {
  if (lockedScrollY === null) return;
  const y = lockedScrollY;
  lockedScrollY = null;
  const body = document.body;
  body.style.removeProperty('position');
  body.style.removeProperty('top');
  body.style.removeProperty('left');
  body.style.removeProperty('right');
  body.style.removeProperty('width');
  body.style.removeProperty('overflow');
  document.documentElement.classList.remove('modal-page-locked');
  window.scrollTo({ top:y, left:0, behavior:'auto' });
}

function syncBackgroundLock() {
  if (!backdrop) return;
  const open = !backdrop.classList.contains('hidden') || document.body.classList.contains('modal-open');
  if (open) lockBackgroundScroll();
  else unlockBackgroundScroll();
}

function resetViewportFit() {
  if (!backdrop) return;
  backdrop.style.removeProperty('top');
  backdrop.style.removeProperty('bottom');
  backdrop.style.removeProperty('height');
  backdrop.style.removeProperty('padding-top');
  const sheet = backdrop.querySelector('.modal-sheet');
  sheet?.style.removeProperty('max-height');
  document.documentElement.classList.remove('modal-keyboard-open');
}

function fitModalToVisualViewport() {
  if (!backdrop || backdrop.classList.contains('hidden') || !activeField) return;
  const sheet = activeField.closest('.modal-sheet');
  if (!(sheet instanceof HTMLElement)) return;

  const top = viewport?.offsetTop ?? 0;
  const height = viewport?.height ?? window.innerHeight;
  if (!Number.isFinite(height) || height < 180) return;

  backdrop.style.top = `${Math.max(0, top)}px`;
  backdrop.style.bottom = 'auto';
  backdrop.style.height = `${height}px`;
  backdrop.style.paddingTop = '8px';
  sheet.style.maxHeight = `${Math.max(180, height - 8)}px`;
  document.documentElement.classList.add('modal-keyboard-open');

  requestAnimationFrame(() => {
    if (!activeField || !activeField.isConnected) return;
    const fieldRect = activeField.getBoundingClientRect();
    const safeTop = top + 12;
    const safeBottom = top + height - 18;

    if (fieldRect.top >= safeTop && fieldRect.bottom <= safeBottom) return;

    const desiredTop = top + Math.max(18, Math.min(90, height * 0.16));
    const delta = fieldRect.top - desiredTop;
    const nextTop = Math.max(0, sheet.scrollTop + delta);
    try {
      sheet.scrollTo({ top: nextTop, behavior: 'smooth' });
    } catch (_) {
      sheet.scrollTop = nextTop;
    }
  });
}

function settleKeyboard() {
  clearTimers();
  fitModalToVisualViewport();
  [60, 160, 300, 520, 760].forEach(delay => {
    settleTimers.push(window.setTimeout(fitModalToVisualViewport, delay));
  });
}

document.addEventListener('focusin', event => {
  const target = event.target;
  if (!isModalField(target)) return;
  activeField = target;
  lockBackgroundScroll();
  settleKeyboard();
}, true);

document.addEventListener('focusout', () => {
  window.setTimeout(() => {
    const focused = document.activeElement;
    if (isModalField(focused)) {
      activeField = focused;
      settleKeyboard();
      return;
    }
    activeField = null;
    clearTimers();
    resetViewportFit();
    syncBackgroundLock();
  }, 120);
}, true);

viewport?.addEventListener('resize', fitModalToVisualViewport);
viewport?.addEventListener('scroll', fitModalToVisualViewport);

if (backdrop) {
  new MutationObserver(() => {
    syncBackgroundLock();
    if (!backdrop.classList.contains('hidden')) return;
    activeField = null;
    clearTimers();
    resetViewportFit();
  }).observe(backdrop, { attributes: true, attributeFilter: ['class'] });
}

new MutationObserver(syncBackgroundLock).observe(document.body, { attributes:true, attributeFilter:['class'] });
syncBackgroundLock();
