const mealList = document.getElementById('mealList');

function centerFocusedInput(toggle) {
  if (!toggle || toggle.getAttribute('aria-expanded') !== 'true') return;
  const panel = toggle.nextElementSibling;
  const input = panel?.querySelector('.meal-inline-name, input[name="name"]');
  if (!input) return;

  input.focus({ preventScroll: false });
  const bringIntoView = () => input.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  requestAnimationFrame(bringIntoView);
  setTimeout(bringIntoView, 220);
}

mealList?.addEventListener('click', event => {
  const toggle = event.target.closest('.meal-inline-toggle');
  if (!toggle) return;
  requestAnimationFrame(() => centerFocusedInput(toggle));
});
