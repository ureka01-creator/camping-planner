const DARK = '#071018';

function applyUnifiedNightTheme() {
  const app = document.getElementById('app');
  if (app) {
    // Keep the exact Home header geometry/colors on every page.
    // app.js still toggles this legacy class by view, so restore it immediately.
    app.classList.add('unified-night-theme', 'home-theme');
  }

  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.content = DARK;

  document.documentElement.style.backgroundColor = DARK;
  document.body.style.backgroundColor = DARK;
}

applyUnifiedNightTheme();
queueMicrotask(applyUnifiedNightTheme);
window.addEventListener('pageshow', applyUnifiedNightTheme);

// app.js may remove home-theme while changing views. Restore the common theme
// after navigation without a MutationObserver loop.
document.addEventListener('click', event => {
  if (event.target.closest('[data-nav], [data-go]')) {
    queueMicrotask(applyUnifiedNightTheme);
    requestAnimationFrame(applyUnifiedNightTheme);
  }
});
