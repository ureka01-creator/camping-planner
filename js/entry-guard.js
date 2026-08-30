function activateHome() {
  try { localStorage.setItem('camp:lastView', 'home'); } catch (_) {}

  const homeButton = document.querySelector('[data-nav="home"]');
  if (homeButton && typeof homeButton.onclick === 'function') {
    homeButton.click();
    return;
  }

  document.querySelectorAll('.view').forEach(view => {
    view.classList.toggle('active', view.dataset.view === 'home');
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.nav === 'home');
  });
  document.getElementById('app')?.classList.add('home-theme');
}

function enterFromLanding(event) {
  const target = event.target instanceof Element ? event.target : null;
  const landing = target?.closest('.camp-landing');
  if (!landing || landing.classList.contains('is-exiting')) return;

  activateHome();
  document.body.classList.remove('landing-boot', 'landing-open');
  landing.classList.add('is-exiting');
  window.setTimeout(() => landing.remove(), 320);
}

document.addEventListener('pointerup', enterFromLanding, true);
document.addEventListener('touchend', enterFromLanding, { capture: true, passive: true });
document.addEventListener('click', enterFromLanding, true);
