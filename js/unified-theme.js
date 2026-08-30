const DARK = '#071018';

function applyUnifiedNightTheme() {
  const app = document.getElementById('app');
  if (app) app.classList.add('home-theme', 'unified-night-theme');

  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.content = DARK;

  document.documentElement.style.backgroundColor = DARK;
  document.body.style.backgroundColor = DARK;
}

applyUnifiedNightTheme();
queueMicrotask(applyUnifiedNightTheme);
window.addEventListener('pageshow', applyUnifiedNightTheme);

const main = document.querySelector('main');
if (main) {
  new MutationObserver(() => queueMicrotask(applyUnifiedNightTheme))
    .observe(main, { attributes: true, subtree: true, attributeFilter: ['class'] });
}
