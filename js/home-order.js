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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
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

function keyForNode(node, map) {
  return DEFAULT_ORDER.find(key => map[key] === node) || '';
}

export function applyHomeOrder() {
  if (applying) return;
  const home = document.getElementById('view-home');
  if (!home) return;

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

function move(key, direction) {
  const order = readOrder();
  const index = order.indexOf(key);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= order.length) return;
  [order[index], order[next]] = [order[next], order[index]];
  saveOrder(order);
  renderSettings();
  applyHomeOrder();
  toast('홈 화면 순서를 바꿨어.');
}

function resetOrder() {
  localStorage.removeItem(STORAGE_KEY);
  renderSettings();
  applyHomeOrder();
  toast('홈 화면 순서를 기본값으로 되돌렸어.');
}

function ensureSettingsCard() {
  const settings = document.getElementById('view-settings');
  if (!settings || settings.querySelector('#homeOrderCard')) return;

  const shareCard = document.getElementById('copyLinkBtn')?.closest('.settings-card');
  const card = document.createElement('div');
  card.id = 'homeOrderCard';
  card.className = 'settings-card home-order-card';
  card.innerHTML = `
    <div class="home-order-head">
      <div>
        <strong>홈 화면 순서</strong>
        <p class="muted">내 기기에서만 적용돼. 자주 보는 정보를 위로 올려.</p>
      </div>
      <button id="resetHomeOrderBtn" type="button" class="home-order-reset">초기화</button>
    </div>
    <div id="homeOrderList" class="home-order-list"></div>`;

  if (shareCard) shareCard.before(card);
  else settings.appendChild(card);

  card.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const moveButton = event.target.closest('[data-home-order-move]');
    if (moveButton) {
      move(moveButton.dataset.homeOrderKey || '', moveButton.dataset.homeOrderMove === 'up' ? -1 : 1);
      return;
    }
    if (event.target.closest('#resetHomeOrderBtn')) resetOrder();
  });
}

function renderSettings() {
  ensureSettingsCard();
  const list = document.getElementById('homeOrderList');
  if (!list) return;
  const order = readOrder();
  const html = order.map((key, index) => `
    <div class="home-order-row" data-home-order-row="${key}">
      <span class="home-order-number">${index + 1}</span>
      <strong>${LABELS[key]}</strong>
      <div class="home-order-actions">
        <button type="button" data-home-order-key="${key}" data-home-order-move="up" aria-label="${LABELS[key]} 위로 이동" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-home-order-key="${key}" data-home-order-move="down" aria-label="${LABELS[key]} 아래로 이동" ${index === order.length - 1 ? 'disabled' : ''}>↓</button>
      </div>
    </div>`).join('');
  if (list.dataset.orderHtml !== html) {
    list.innerHTML = html;
    list.dataset.orderHtml = html;
  }
  const version = document.querySelector('#view-settings .version');
  if (version) version.textContent = 'Camping Planner v0.5.8';
}

const style = document.createElement('style');
style.textContent = `
  .home-order-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
  .home-order-head p { margin:6px 0 0; }
  .home-order-reset { border:0; background:transparent; color:#d2915f; font:inherit; font-weight:700; padding:2px 0; }
  .home-order-list { display:grid; gap:9px; margin-top:16px; }
  .home-order-row { display:grid; grid-template-columns:30px minmax(0,1fr) auto; align-items:center; gap:10px; min-height:54px; padding:8px 10px; border:1px solid rgba(210,145,95,.18); border-radius:16px; background:rgba(255,255,255,.015); }
  .home-order-number { width:26px; height:26px; display:grid; place-items:center; border-radius:50%; background:rgba(210,145,95,.12); color:#d2915f; font-size:12px; font-weight:800; }
  .home-order-row strong { font-size:15px; }
  .home-order-actions { display:flex; gap:6px; }
  .home-order-actions button { width:36px; height:36px; border:1px solid rgba(210,145,95,.22); border-radius:12px; background:transparent; color:inherit; font-size:18px; }
  .home-order-actions button:disabled { opacity:.25; }
`;
document.head.appendChild(style);

window.CampingHomeOrder = { apply: applyHomeOrder, read: readOrder };

const home = document.getElementById('view-home');
if (home) {
  new MutationObserver(() => {
    if (!applying) queueMicrotask(applyHomeOrder);
  }).observe(home, { childList:true });
}

renderSettings();
applyHomeOrder();
