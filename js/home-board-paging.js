const PAGE_SIZE = 5;
let currentPage = 0;
let lastFirstPostId = '';
let applying = false;

function ensurePager() {
  const card = document.getElementById('homeMemoCard');
  const list = document.getElementById('homeMemoList');
  if (!card || !list) return null;

  let pager = document.getElementById('homeMemoPager');
  if (pager) return pager;

  pager = document.createElement('div');
  pager.id = 'homeMemoPager';
  pager.className = 'home-memo-pager';
  pager.hidden = true;
  pager.innerHTML = `
    <button type="button" data-home-memo-page="prev" aria-label="이전 게시글 페이지">‹</button>
    <span id="homeMemoPageText">1 / 1</span>
    <button type="button" data-home-memo-page="next" aria-label="다음 게시글 페이지">›</button>`;
  list.insertAdjacentElement('afterend', pager);
  return pager;
}

function posts() {
  return [...document.querySelectorAll('#homeMemoList > [data-home-board-post]')];
}

function applyPaging({ resetForNewPost = false } = {}) {
  if (applying) return;
  const pager = ensurePager();
  if (!pager) return;

  const rows = posts();
  const firstPostId = rows[0]?.getAttribute('data-home-board-post') || '';
  if (resetForNewPost && lastFirstPostId && firstPostId && firstPostId !== lastFirstPostId) currentPage = 0;
  lastFirstPostId = firstPostId;

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  currentPage = Math.max(0, Math.min(currentPage, pages - 1));
  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  applying = true;
  try {
    rows.forEach((row, index) => { row.hidden = index < start || index >= end; });
    pager.hidden = rows.length <= PAGE_SIZE;
    const pageText = pager.querySelector('#homeMemoPageText');
    if (pageText) pageText.textContent = `${currentPage + 1} / ${pages}`;

    const prev = pager.querySelector('[data-home-memo-page="prev"]');
    const next = pager.querySelector('[data-home-memo-page="next"]');
    if (prev) prev.disabled = currentPage <= 0;
    if (next) next.disabled = currentPage >= pages - 1;
  } finally {
    applying = false;
  }
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('[data-home-memo-page]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();

  currentPage += button.dataset.homeMemoPage === 'next' ? 1 : -1;
  applyPaging();
}, true);

const observer = new MutationObserver(() => queueMicrotask(() => applyPaging({ resetForNewPost:true })));
const observeList = () => {
  const list = document.getElementById('homeMemoList');
  if (!list) return false;
  observer.observe(list, { childList:true });
  applyPaging();
  return true;
};
if (!observeList()) {
  const home = document.getElementById('view-home');
  if (home) {
    const bootObserver = new MutationObserver(() => {
      if (observeList()) bootObserver.disconnect();
    });
    bootObserver.observe(home, { childList:true, subtree:true });
  }
}

const style = document.createElement('style');
style.textContent = `
  .home-memo-card { padding-bottom:11px !important; }
  .home-memo-head { margin-bottom:3px !important; }
  .home-memo-row {
    gap:6px !important;
    padding:6px 0 !important;
    min-height:31px;
    align-items:center !important;
  }
  .home-memo-row:first-child { padding-top:4px !important; }
  .home-memo-row:last-child { padding-bottom:4px !important; }
  .home-memo-copy { line-height:1.35 !important; align-items:center !important; }
  .home-memo-row-edit { width:24px !important; height:24px !important; }
  .home-memo-pager {
    display:flex;
    align-items:center;
    justify-content:center;
    gap:10px;
    margin-top:6px;
    padding-top:7px;
    border-top:1px solid rgba(216,160,113,.08);
    color:rgba(234,217,196,.48);
    font-size:10px;
  }
  .home-memo-pager[hidden] { display:none !important; }
  .home-memo-pager button {
    width:26px;
    height:24px;
    display:grid;
    place-items:center;
    padding:0 0 2px;
    border:0;
    border-radius:8px;
    background:transparent;
    color:rgba(216,160,113,.76);
    font-size:20px;
    line-height:1;
  }
  .home-memo-pager button:disabled { opacity:.22; }
  .home-memo-pager span { min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }
`;
document.head.appendChild(style);
