const mealList = document.getElementById('mealList');

function bringIntoView(input) {
  if (!input?.isConnected) return;
  try { input.focus({ preventScroll:true }); }
  catch (_) { input.focus(); }
  input.scrollIntoView({ behavior:'smooth', block:'center', inline:'nearest' });
}

function focusEditor(key) {
  const selector = `.meal-inline-edit[data-meal-item-edit="${CSS.escape(key)}"] input[name="name"]`;
  const attempt = () => {
    const input = mealList?.querySelector(selector);
    if (!input) return false;
    bringIntoView(input);

    // iOS resizes the visual viewport after the keyboard animation starts.
    // Re-center once more after that resize so the field does not remain hidden.
    const viewport = window.visualViewport;
    if (viewport) {
      const onResize = () => {
        bringIntoView(input);
        viewport.removeEventListener('resize', onResize);
      };
      viewport.addEventListener('resize', onResize, { once:true });
      setTimeout(() => viewport.removeEventListener('resize', onResize), 900);
    }
    return true;
  };

  if (attempt()) return;
  requestAnimationFrame(attempt);
  setTimeout(attempt, 80);
  setTimeout(attempt, 260);
  setTimeout(attempt, 520);
}

mealList?.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('[data-edit-meal-item]') : null;
  if (!button) return;
  const key = button.dataset.editMealItem;
  if (!key) return;
  queueMicrotask(() => focusEditor(key));
}, true);
