const LOGIN_ATTEMPT_KEY = 'camp:googleLoginAttempt';

function markLoginAttempt() {
  try { sessionStorage.setItem(LOGIN_ATTEMPT_KEY, '1'); } catch (_) {}
}

function consumeLoginAttempt() {
  try {
    if (sessionStorage.getItem(LOGIN_ATTEMPT_KEY) !== '1') return false;
    sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

function goHomeAfterLogin() {
  try { localStorage.setItem('camp:lastView', 'home'); } catch (_) {}

  const activateHome = () => {
    const homeButton = document.querySelector('.nav-item[data-nav="home"]');
    if (homeButton instanceof HTMLButtonElement) {
      homeButton.click();
      window.scrollTo({ top: 0, behavior: 'instant' });
      return true;
    }
    return false;
  };

  if (activateHome()) return;
  [80, 180, 350, 650].forEach(delay => window.setTimeout(activateHome, delay));
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-google-login]')) markLoginAttempt();
}, true);

window.addEventListener('camp:auth-ready', () => {
  if (!consumeLoginAttempt()) return;
  goHomeAfterLogin();
});

const style = document.createElement('style');
style.id = 'board-action-alignment-v094';
style.textContent = `
  .admin-mode .home-memo-row {
    grid-template-columns: minmax(0, 1fr) 27px 27px !important;
    column-gap: 7px !important;
    align-items: center !important;
  }
  .admin-mode .home-memo-row-edit {
    grid-column: 2 !important;
    grid-row: 1 !important;
    align-self: center !important;
    justify-self: center !important;
    margin: 0 !important;
  }
  .admin-mode .home-memo-admin-delete {
    grid-column: 3 !important;
    grid-row: 1 !important;
    align-self: center !important;
    justify-self: center !important;
    margin: 0 !important;
  }
`;
document.head.appendChild(style);
