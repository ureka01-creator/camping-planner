const DARK = '#071018';

function applyUnifiedNightTheme() {
  const app = document.getElementById('app');
  if (app) app.classList.add('unified-night-theme');

  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.content = DARK;

  document.documentElement.style.backgroundColor = DARK;
  document.body.style.backgroundColor = DARK;
}

applyUnifiedNightTheme();
queueMicrotask(applyUnifiedNightTheme);
window.addEventListener('pageshow', applyUnifiedNightTheme);

// app.js may still switch the legacy home-theme class by page.
// Keep browser chrome/background dark after those interactions without observing class mutations.
document.addEventListener('click', event => {
  if (event.target.closest('[data-nav], [data-go]')) {
    queueMicrotask(applyUnifiedNightTheme);
  }
});
