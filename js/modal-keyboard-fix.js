const backdrop = document.getElementById('modalBackdrop');
const viewport = window.visualViewport;
let activeField = null;
let settleTimers = [];

function isModalField(element) {
  return element instanceof HTMLElement &&
    element.matches('input, textarea, select') &&
    Boolean(element.closest('.modal-sheet'));
}

function clearTimers() {
  settleTimers.forEach(timer => window.clearTimeout(timer));
  settleTimers = [];
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
    const sheetRect = sheet.getBoundingClientRect();
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
  }, 120);
}, true);

viewport?.addEventListener('resize', fitModalToVisualViewport);
viewport?.addEventListener('scroll', fitModalToVisualViewport);

if (backdrop) {
  new MutationObserver(() => {
    if (!backdrop.classList.contains('hidden')) return;
    activeField = null;
    clearTimers();
    resetViewportFit();
  }).observe(backdrop, { attributes: true, attributeFilter: ['class'] });
}
