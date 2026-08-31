import { dataAdapter } from './firebase.js?v=064';
import { toast, esc } from './ui.js';

const mealList = document.getElementById('mealList');
const mealOrder = { breakfast:1, lunch:2, dinner:3, snack:4 };
const mealLabels = { breakfast:'아침', lunch:'점심', dinner:'저녁', snack:'간식' };
let latestData = null;
let applyQueued = false;
let dragState = null;
let suppressClickUntil = 0;

function mealItems(meal) {
  return Array.isArray(meal?.items) ? meal.items : [];
}

function memberName(id) {
  return latestData?.members?.find(member => member.id === id)?.name || '공용';
}

function formatShortDate(iso) {
  const [, m, d] = String(iso || '').split('-').map(Number);
  return `${m}/${d}`;
}

function orderValue(meal) {
  const explicit = Number(meal?.sortOrder);
  if (Number.isFinite(explicit)) return explicit;
  return 1000 + (mealOrder[meal?.mealType] || 99) * 100;
}

function compareMealOrder(a, b) {
  return orderValue(a) - orderValue(b);
}

function queueApply() {
  if (applyQueued) return;
  applyQueued = true;
  requestAnimationFrame(() => {
    applyQueued = false;
    applyEnhancements();
  });
}

function ensureDetailHandles() {
  if (!mealList || !latestData) return;
  const cards = [...mealList.querySelectorAll(':scope > .meal-card')];
  if (!cards.length) return;

  const cardById = new Map();
  for (const card of cards) {
    const edit = card.querySelector('[data-edit-meal]');
    const mealId = edit?.dataset.editMeal;
    const meal = latestData.meals?.find(entry => entry.id === mealId);
    if (!mealId || !meal) continue;

    card.dataset.mealId = mealId;
    card.dataset.mealDate = meal.date;
    cardById.set(mealId, card);

    const top = card.querySelector('.meal-card-top');
    if (!top || top.querySelector('.meal-drag-handle')) continue;

    const controls = document.createElement('div');
    controls.className = 'meal-card-controls';
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'meal-drag-handle';
    handle.setAttribute('aria-label', '식단 순서 변경');
    handle.title = '끌어서 순서 변경';
    handle.textContent = '≡';

    if (edit) {
      edit.before(controls);
      controls.append(handle, edit);
    } else {
      top.append(handle);
    }
  }

  const date = cards.find(card => card.dataset.mealDate)?.dataset.mealDate;
  if (!date) return;
  const ordered = (latestData.meals || []).filter(meal => meal.date === date).sort(compareMealOrder);
  ordered.forEach(meal => {
    const card = cardById.get(meal.id);
    if (card) mealList.appendChild(card);
  });
}

function renderHomeNextMeal() {
  const card = document.getElementById('nextMealCard');
  if (!card || !latestData) return;
  const meals = [...(latestData.meals || [])].sort((a, b) => a.date.localeCompare(b.date) || compareMealOrder(a, b));
  const next = meals[0];
  if (!next) return;
  const items = mealItems(next);
  const done = items.filter(item => item?.isDone).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 100;
  card.innerHTML = `<div class="meal-day">${formatShortDate(next.date)} · ${mealLabels[next.mealType] || '식사'}</div><div class="meal-name">${esc(next.menu || '메뉴 미정')}</div><div class="meal-assignee">식단 담당 ${esc(memberName(next.assigneeId))}</div><div class="meal-feature-progress"><span>${items.length ? `${done}/${items.length} 준비` : '준비 항목 없음'}</span><strong>${pct}%</strong></div>`;
}

function applyEmptyMealCompletion() {
  if (!latestData) return;

  document.querySelectorAll('#mealList .meal-card[data-meal-id]').forEach(card => {
    const meal = latestData.meals?.find(entry => entry.id === card.dataset.mealId);
    if (!meal || mealItems(meal).length) return;

    const percent = card.querySelector('.meal-progress-head strong');
    const bar = card.querySelector('.meal-detail-track > span');
    const empty = card.querySelector('.meal-detail-empty');
    if (percent) percent.textContent = '100%';
    if (bar) bar.style.width = '100%';
    if (empty) empty.textContent = '준비 항목 없음 · 자동 완료';
  });
}

function applyEnhancements() {
  ensureDetailHandles();
  applyEmptyMealCompletion();
  renderHomeNextMeal();
}

function dragCandidateFromHandle(handle) {
  return handle.closest('.meal-card[data-meal-id], .meal-overview-row[data-meal-id]');
}

function dragContainerFor(item) {
  if (item?.classList.contains('meal-card')) return mealList;
  if (item?.classList.contains('meal-overview-row')) return item.parentElement;
  return null;
}

async function persistOrder(container, date) {
  const ids = [...container.querySelectorAll(':scope > [data-meal-id]')].map(node => node.dataset.mealId).filter(Boolean);
  if (ids.length < 2) return;

  try {
    await dataAdapter.mutate(data => {
      ids.forEach((id, index) => {
        const meal = data.meals?.find(entry => entry.id === id && entry.date === date);
        if (meal) meal.sortOrder = index;
      });
    });
    toast('식단 순서 저장했어.');
  } catch (error) {
    console.error(error);
    toast('식단 순서 저장에 실패했어.');
    queueApply();
  }
}

document.addEventListener('pointerdown', event => {
  const handle = event.target instanceof Element ? event.target.closest('.meal-drag-handle') : null;
  if (!handle) return;
  const item = dragCandidateFromHandle(handle);
  const container = dragContainerFor(item);
  if (!item || !container) return;

  event.preventDefault();
  event.stopPropagation();
  suppressClickUntil = performance.now() + 700;
  handle.setPointerCapture?.(event.pointerId);
  item.classList.add('meal-dragging');
  document.body.classList.add('meal-reordering');
  dragState = {
    handle,
    item,
    container,
    pointerId:event.pointerId,
    date:item.dataset.mealDate || '',
    moved:false
  };
}, { passive:false, capture:true });

document.addEventListener('pointermove', event => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();

  const { item, container } = dragState;
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const target = hit?.closest?.('.meal-card[data-meal-id], .meal-overview-row[data-meal-id]');
  if (target && target !== item && target.parentElement === container) {
    const rect = target.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) container.insertBefore(item, target);
    else container.insertBefore(item, target.nextSibling);
    dragState.moved = true;
  }

  if (event.clientY < 110) window.scrollBy(0, -10);
  else if (event.clientY > window.innerHeight - 110) window.scrollBy(0, 10);
}, { passive:false, capture:true });

async function finishDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const { handle, item, container, date, moved } = dragState;
  dragState = null;
  handle.releasePointerCapture?.(event.pointerId);
  item.classList.remove('meal-dragging');
  document.body.classList.remove('meal-reordering');
  suppressClickUntil = performance.now() + 500;
  if (moved && date) await persistOrder(container, date);
}

document.addEventListener('pointerup', finishDrag, { passive:false, capture:true });
document.addEventListener('pointercancel', finishDrag, { passive:false, capture:true });

document.addEventListener('click', event => {
  if (!(event.target instanceof Element) || !event.target.closest('.meal-drag-handle')) return;
  if (performance.now() <= suppressClickUntil) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-nav], [data-go], [data-date], [data-open-meal-date]')) queueApply();
});

dataAdapter.subscribe(data => {
  latestData = data;
  queueApply();
});

const style = document.createElement('style');
style.textContent = `
  .meal-card-controls { display:flex; align-items:center; gap:6px; flex:0 0 auto; }
  .meal-drag-handle { display:inline-grid; place-items:center; width:34px; min-width:34px; height:34px; min-height:34px; padding:0; border:1px solid rgba(216,160,113,.18); border-radius:10px; background:rgba(255,255,255,.035); color:rgba(234,217,196,.66); font-size:20px; line-height:1; cursor:grab; touch-action:none; user-select:none; -webkit-user-select:none; }
  .meal-drag-handle:active { cursor:grabbing; }
  .meal-overview-drag { width:28px; min-width:28px; height:34px; min-height:34px; border:0; background:transparent; font-size:18px; }
  .meal-dragging { opacity:.62; transform:scale(.99); outline:1px solid rgba(220,167,123,.42); box-shadow:0 12px 30px rgba(0,0,0,.24); }
  .meal-reordering { cursor:grabbing; }
  .meal-reordering * { user-select:none !important; -webkit-user-select:none !important; }
`;
document.head.appendChild(style);
