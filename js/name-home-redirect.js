const NAME_KEY = 'camp:myName';

function goHomeAfterNameSave() {
  const input = document.getElementById('myNameInput');
  const name = input?.value.trim() || '';
  if (!name) return;

  queueMicrotask(() => {
    let saved = '';
    try { saved = localStorage.getItem(NAME_KEY) || ''; } catch (_) {}
    if (saved !== name) return;

    const homeButton = document.querySelector('[data-nav="home"]');
    if (homeButton instanceof HTMLElement) homeButton.click();
    requestAnimationFrame(() => window.scrollTo({ top:0, left:0, behavior:'auto' }));
  });
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('#saveMyNameBtn')) return;
  goHomeAfterNameSave();
}, true);
