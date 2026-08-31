import { dataAdapter } from './firebase.js?v=064';
import { toast } from './ui.js';

let latestData = null;
let queued = false;

function isAdminMode() {
  return document.documentElement.classList.contains('admin-mode');
}

function boardEntries(data = latestData) {
  const posts = Array.isArray(data?.trip?.homeMemos) ? data.trip.homeMemos : [];
  return posts.map((post, index) => ({
    post,
    index,
    boardId: post?.id || `legacy:${post?.key || post?.memberId || post?.name || index}`
  }));
}

function trashSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="m6 7 1 13h10l1-13"></path><path d="M10 11v5M14 11v5"></path></svg>`;
}

function applyControls() {
  queued = false;
  const list = document.getElementById('homeMemoList');
  if (!list) return;

  list.querySelectorAll('[data-admin-delete-home-memo]').forEach(button => button.remove());
  if (!isAdminMode()) return;

  list.querySelectorAll('[data-home-board-post]').forEach(row => {
    const boardId = row.getAttribute('data-home-board-post') || '';
    if (!boardId) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'home-memo-admin-delete';
    button.dataset.adminDeleteHomeMemo = boardId;
    button.setAttribute('aria-label', '관리자 게시글 삭제');
    button.innerHTML = trashSvg();
    row.appendChild(button);
  });
}

function queueApply() {
  if (queued) return;
  queued = true;
  queueMicrotask(applyControls);
}

async function deletePost(boardId) {
  if (!isAdminMode()) {
    toast('관리자 모드에서만 삭제할 수 있어.');
    return;
  }
  const entry = boardEntries().find(item => item.boardId === boardId);
  if (!entry) {
    toast('게시글을 찾지 못했어.');
    return;
  }
  const author = String(entry.post?.name || '이름 없음').trim();
  const text = String(entry.post?.text || '').trim();
  if (!window.confirm(`${author} : ${text}\n\n이 게시글을 관리자 권한으로 삭제할까?`)) return;

  try {
    await dataAdapter.mutate(data => {
      if (!data.trip) return;
      const posts = Array.isArray(data.trip.homeMemos) ? data.trip.homeMemos : [];
      const target = posts.findIndex((post, index) =>
        (post?.id || `legacy:${post?.key || post?.memberId || post?.name || index}`) === boardId
      );
      if (target >= 0) posts.splice(target, 1);
      data.trip.homeMemos = posts;
    });
    toast('게시글을 삭제했어.');
  } catch (error) {
    console.error(error);
    toast('게시글 삭제에 실패했어.');
  }
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('[data-admin-delete-home-memo]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  deletePost(button.dataset.adminDeleteHomeMemo || '');
}, true);

dataAdapter.subscribe(data => {
  latestData = data;
  queueApply();
});

const rootObserver = new MutationObserver(queueApply);
rootObserver.observe(document.documentElement, { attributes:true, attributeFilter:['class'] });

const listObserver = new MutationObserver(queueApply);
const observeList = () => {
  const list = document.getElementById('homeMemoList');
  if (!list) return false;
  listObserver.observe(list, { childList:true });
  return true;
};
if (!observeList()) {
  const bodyObserver = new MutationObserver(() => {
    if (!observeList()) return;
    bodyObserver.disconnect();
    queueApply();
  });
  bodyObserver.observe(document.body, { childList:true, subtree:true });
}

const style = document.createElement('style');
style.textContent = `
  .admin-mode .home-memo-row { grid-template-columns:minmax(0,1fr) auto auto; }
  .home-memo-admin-delete {
    width:27px;
    height:27px;
    display:grid;
    place-items:center;
    padding:0;
    border:0;
    border-radius:8px;
    background:transparent;
    color:rgba(216,120,105,.66);
  }
  .home-memo-admin-delete svg {
    width:14px;
    height:14px;
    fill:none;
    stroke:currentColor;
    stroke-width:1.8;
    stroke-linecap:round;
    stroke-linejoin:round;
  }
`;
document.head.appendChild(style);

queueApply();
