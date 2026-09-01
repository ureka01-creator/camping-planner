import { dataAdapter } from './firebase.js?v=064';

// Board order is based on when a post was created, not when it was edited.
// This keeps an edited post in its original position while genuinely new posts
// still appear at the top of page 1.
let latestData = null;
let listObserver = null;
let bootObserver = null;
let scheduled = false;

function storedPosts() {
  const source = latestData?.trip?.homeMemos;
  return Array.isArray(source) ? source : [];
}

function boardId(post, index) {
  return post?.id || `legacy:${post?.key || post?.memberId || post?.name || index}`;
}

function orderMap() {
  const map = new Map();
  storedPosts().forEach((post, index) => {
    map.set(boardId(post, index), {
      createdAt: Number(post?.createdAt || post?.updatedAt || 0),
      index
    });
  });
  return map;
}

function reorderBoard() {
  scheduled = false;
  const list = document.getElementById('homeMemoList');
  if (!list) return;

  const rows = [...list.children].filter(row => row instanceof HTMLElement && row.hasAttribute('data-home-board-post'));
  if (rows.length < 2) return;

  const meta = orderMap();
  const sorted = [...rows].sort((a, b) => {
    const aInfo = meta.get(a.getAttribute('data-home-board-post')) || { createdAt: 0, index: -1 };
    const bInfo = meta.get(b.getAttribute('data-home-board-post')) || { createdAt: 0, index: -1 };
    return bInfo.createdAt - aInfo.createdAt || bInfo.index - aInfo.index;
  });

  const changed = sorted.some((row, index) => row !== rows[index]);
  if (!changed) return;

  const fragment = document.createDocumentFragment();
  sorted.forEach(row => fragment.appendChild(row));
  list.appendChild(fragment);
}

function scheduleReorder() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(reorderBoard);
}

function bindList() {
  const list = document.getElementById('homeMemoList');
  if (!list || listObserver) return Boolean(list);

  // Register before the pager module so paging always sees the final stable
  // creation-time order after home-memo.js rebuilds the list.
  listObserver = new MutationObserver(() => reorderBoard());
  listObserver.observe(list, { childList: true });
  scheduleReorder();
  return true;
}

dataAdapter.subscribe(data => {
  latestData = data;
  if (!bindList()) scheduleReorder();
  else scheduleReorder();
});

if (!bindList()) {
  const home = document.getElementById('view-home');
  if (home) {
    bootObserver = new MutationObserver(() => {
      if (!bindList()) return;
      bootObserver?.disconnect();
      bootObserver = null;
    });
    bootObserver.observe(home, { childList: true, subtree: true });
  }
}
