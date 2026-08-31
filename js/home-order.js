import { DATA_MODE } from './firebase.js?v=064';
import { toast } from './ui.js';

const DEFAULT_ORDER = ['prep', 'mine', 'members', 'meals'];
const LABELS = {
  prep: '준비 현황',
  mine: '내 준비',
  members: '담당자별 준비율',
  meals: '식사 일정'
};
const STORAGE_KEY = `camp:homeOrder:${DATA_MODE.tripId}`;
let applying = false;
let locked = true;
let dragState = null;

function normalizeOrder(value) {
  const source = Array.isArray(value) ? value : [];
  const valid = source.filter((key, index) => DEFAULT_ORDER.includes(key) && source.indexOf(key) === index);
  DEFAULT_ORDER.forEach(key => { if (!valid.includes(key)) valid.push(key); });
  return valid;
}

function readOrder() {
  try {
    return normalizeOrder(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
  } catch (_) {
    return [...DEFAULT_ORDER];
  }
}

function saveOrder(order) {
  const normalized = normalizeOrder(order);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch (_) {}
  return normalized;
}

function nodes() {
  return {
    prep: document.querySelector('#view-home > .hero-card'),
    mine: document.getElementById('myPrepQuickCard'),
    members: document.getElementById('memberProgress')?.closest('.home-section') || null,
    meals: document.getElementById('nextMealCard')?.closest('.home-section') || null
  };
}

function keyForNode(node, map = nodes()) {
  return DEFAULT_ORDER.find(key => map[key] === node) || '';
}

function orderedKeysFromDom() {
  const home = document.getElementById('view-home');
  const map = nodes();
  return [...(home?.children || [])]
    .map(node => keyForNode(node, map))
    .filter(Boolean);
}

function decorateCards() {
  const map = nodes();
  DEFAULT_ORDER.forEach(key => {
    const node = map[key];
    if (!node) return;
    node.dataset.homeOrderCard = key;
    node.setAttribute('aria-label', LABELS[key]);
  });
}

export function applyHomeOrder() {
  if (applying || dragState) return;
  const home = document.getElementById('view-home');
  if (!home) return;

  decorateCards();
  const map = nodes();
  const order = readOrder();
  const desiredKeys = order.filter(key => Boolean(map[key]));
  if (!desiredKeys.length) return;

  const currentKeys = [...home.children]
    .map(node => keyForNode(node, map))
    .filter(Boolean);

  if (currentKeys.join(',') === desiredKeys.join(',')) {
    home.dataset.homeOrder = order.join(',');
    return;
  }

  applying = true;
  try {
    const todoSection = document.getElementById('homeTodo')?.closest('.home-section') || null;
    desiredKeys.forEach(key => home.insertBefore(map[key], todoSection));
    home.dataset.homeOrder = order.join(',');
  } finally {
    applying = false;
  }
}

function lockSvg(isLocked) {
  return isLocked
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="10" width="13" height="10" rx="2.5"></rect><path d="M8.5 10V7.4A3.5 3.5 0 0 1 12 4a3.5 3.5 0 0 1 3.5 3.4V10"></path></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="10" width="13" height="10" rx="2.5"></rect><path d="M15.5 10V7.4A3.5 3.5 0 0 0 12 4a3.5 3.5 0 0 0-3.5 3.4"></path></svg>`;
}

function ensureLockButton() {
  const actions = document.querySelector('.topbar-actions');
  if (!actions) return null;
  let button = document.getElementById('homeOrderLockBtn');
  if (!button) {
    button = document.createElement('button');
    button.id = 'homeOrderLockBtn';
    button.type = 'button';
    button.className = 'icon-btn home-order-lock-btn';
    actions.insertBefore(button, document.getElementById('settingsShortcut') || actions.firstChild);
    button.addEventListener('click', () => setLocked(!locked, { announce:true }));
  }
  return button;
}

function syncLockUi() {
  const home = document.getElementById('view-home');
  const button = ensureLockButton();
  if (!home || !button) return;

  const homeActive = home.classList.contains('active');
  button.hidden = !homeActive;
  button.classList.toggle('unlocked', !locked);
  button.setAttribute('aria-pressed', String(!locked));
  button.setAttribute('aria-label', locked ? '홈 카드 순서 잠금 해제' : '홈 카드 순서 잠그기');
  button.innerHTML = lockSvg(locked);
  home.classList.toggle('home-order-editing', !locked);
  home.classList.toggle('home-order-locked', locked);
}

function setLocked(next, { announce = false } = {}) {
  locked = Boolean(next);
  if (locked && dragState) finishDrag(null, true);
  syncLockUi();
  if (!announce) return;
  toast(locked ? '홈 카드 순서를 잠갔어.' : '카드를 손가락으로 드래그해서 순서를 바꿔.');
}

function sortableCards() {
  const map = nodes();
  return orderedKeysFromDom().map(key => map[key]).filter(Boolean);
}

function insertDraggedCard(clientY) {
  if (!dragState) return;
  const home = document.getElementById('view-home');
  if (!home) return;

  const card = dragState.card;
  const others = sortableCards().filter(node => node !== card);
  let before = null;
  for (const node of others) {
    const rect = node.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      before = node;
      break;
    }
  }

  if (before) {
    if (card.nextElementSibling !== before) home.insertBefore(card, before);
  } else {
    const todo = document.getElementById('homeTodo')?.closest('.home-section') || null;
    if (todo) home.insertBefore(card, todo);
    else home.appendChild(card);
  }
  dragState.moved = true;
}

function startDrag(event) {
  if (locked || dragState || !(event.target instanceof Element)) return;
  const card = event.target.closest('[data-home-order-card]');
  if (!(card instanceof HTMLElement)) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  event.preventDefault();
  dragState = {
    card,
    pointerId:event.pointerId,
    moved:false
  };
  card.classList.add('home-order-dragging');
  document.body.classList.add('home-order-dragging-active');
  try { card.setPointerCapture(event.pointerId); } catch (_) {}
}

function moveDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();
  insertDraggedCard(event.clientY);
}

function finishDrag(event, cancelled = false) {
  if (!dragState) return;
  if (event && event.pointerId !== dragState.pointerId) return;

  const { card, moved, pointerId } = dragState;
  try { card.releasePointerCapture(pointerId); } catch (_) {}
  card.classList.remove('home-order-dragging');
  document.body.classList.remove('home-order-dragging-active');
  dragState = null;

  if (cancelled) {
    applyHomeOrder();
    return;
  }

  const order = saveOrder(orderedKeysFromDom());
  const home = document.getElementById('view-home');
  if (home) home.dataset.homeOrder = order.join(',');
  if (moved) toast('홈 카드 순서를 저장했어.');
}

function removeLegacySettingsControl() {
  document.getElementById('homeOrderCard')?.remove();
}

const style = document.createElement('style');
style.textContent = `
  .home-order-lock-btn { flex:none; }
  .home-order-lock-btn svg { width:19px; height:19px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .home-order-lock-btn.unlocked { color:#d99a6a; border-color:rgba(217,154,106,.45); background:rgba(217,154,106,.09); }

  .home-theme #view-home.active { display:grid; gap:16px; }
  .home-theme #view-home > .hero-card,
  .home-theme #view-home > .my-prep-quick-card,
  .home-theme #view-home > .home-section { margin:0 !important; }
  .home-theme #view-home > [data-home-order-card] { position:relative; }

  .home-theme .home-prep-member-section {
    padding:15px 16px 14px;
    border:1px solid rgba(216,160,113,.14);
    border-radius:22px;
    background:rgba(19,23,21,.86);
    box-shadow:0 9px 24px rgba(0,0,0,.08);
  }
  .home-theme .home-prep-member-section > .section-head,
  .home-theme .home-meal-section > .section-head { display:none !important; }
  .home-theme .home-prep-member-section::before,
  .home-theme #nextMealCard.meal-feature::before {
    display:block;
    color:rgba(234,217,196,.72);
    font-size:12px;
    line-height:1.2;
    font-weight:850;
    letter-spacing:-.02em;
  }
  .home-theme .home-prep-member-section::before { content:'담당자별 준비율'; margin-bottom:8px; }
  .home-theme #nextMealCard.meal-feature::before { content:'식사 일정'; padding:14px 16px 1px; }

  .home-theme .home-prep-member-section .member-progress { gap:0; }
  .home-theme .home-prep-member-section .member-row {
    padding:10px 0;
    border:0;
    border-radius:0;
    background:transparent;
  }
  .home-theme .home-prep-member-section .member-row + .member-row { border-top:1px solid rgba(216,160,113,.08); }
  .home-theme .home-prep-member-section .member-row:first-child { padding-top:7px; }
  .home-theme .home-prep-member-section .member-row:last-child { padding-bottom:2px; }

  .home-theme .home-meal-section { padding:0 !important; border:0 !important; }
  .home-theme #nextMealCard.meal-feature { margin:0; }
  .home-theme .my-prep-quick-card { margin:0 !important; }

  .home-theme #view-home.home-order-editing > [data-home-order-card] {
    touch-action:none;
    user-select:none;
    -webkit-user-select:none;
    cursor:grab;
    outline:1px solid rgba(217,154,106,.22);
    outline-offset:-1px;
  }
  .home-theme #view-home.home-order-editing > [data-home-order-card] > * { pointer-events:none !important; }
  .home-theme #view-home.home-order-editing > [data-home-order-card]::after {
    content:'';
    position:absolute;
    z-index:5;
    top:12px;
    right:12px;
    width:18px;
    height:22px;
    opacity:.58;
    background-image:radial-gradient(circle, rgba(234,217,196,.72) 1.5px, transparent 1.7px);
    background-size:6px 6px;
    pointer-events:none;
  }
  .home-theme #view-home.home-order-editing > .home-order-dragging {
    z-index:8;
    cursor:grabbing;
    opacity:.93;
    transform:scale(.985);
    box-shadow:0 16px 38px rgba(0,0,0,.22);
  }
  body.home-order-dragging-active { overflow:hidden; }
`;
document.head.appendChild(style);

window.CampingHomeOrder = {
  apply: applyHomeOrder,
  read: readOrder,
  lock: () => setLocked(true),
  unlock: () => setLocked(false)
};

const home = document.getElementById('view-home');
if (home) {
  home.addEventListener('pointerdown', startDrag, { passive:false });
  home.addEventListener('pointermove', moveDrag, { passive:false });
  home.addEventListener('pointerup', event => finishDrag(event));
  home.addEventListener('pointercancel', event => finishDrag(event, true));
  new MutationObserver(() => {
    decorateCards();
    if (!applying && !dragState) queueMicrotask(applyHomeOrder);
  }).observe(home, { childList:true });
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('[data-nav], [data-go]')) return;
  setTimeout(() => {
    if (!document.getElementById('view-home')?.classList.contains('active') && !locked) setLocked(true);
    syncLockUi();
  }, 0);
}, true);

removeLegacySettingsControl();
ensureLockButton();
applyHomeOrder();
syncLockUi();
const version = document.querySelector('#view-settings .version');
if (version) version.textContent = 'Camping Planner v0.5.9';
