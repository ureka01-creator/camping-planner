import { dataAdapter } from './firebase.js?v=064';
import { toast } from './ui.js';

const mealList = document.getElementById('mealList');
const dateTabs = document.getElementById('dateTabs');
const mealOrder = { breakfast:1, lunch:2, dinner:3, snack:4 };

let latestData = null;
let syncQueued = false;
let draggingCard = null;
let dragPointerId = null;

function dateRange(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) return [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  const result = [];
  while (cursor <= last) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function baseMealsForDate(date) {
  return (latestData?.meals || [])
    .map((meal, index) => ({ meal, index }))
    .filter(entry => entry.meal.date === date)
    .sort((a, b) => (mealOrder[a.meal.mealType] || 99) - (mealOrder[b.meal.mealType] || 99) || a.index - b.index)
    .map(entry => entry.meal);
}

function orderedMealsForDate(date) {
  const base = baseMealsForDate(date);
  const baseIndex = new Map(base.map((meal, index) => [meal.id, index]));
  return [...base].sort((a, b) => {
    const ao = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 1000 + (baseIndex.get(a.id) || 0);
    const bo = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 1000 + (baseIndex.get(b.id) || 0);
    return ao - bo;
  });
}

function mealById(id) {
  return latestData?.meals?.find(meal => meal.id === id) || null;
}

function patchEmptyMealProgress(container, meal) {
  if (!container || !meal || (Array.isArray(meal.items) && meal.items.length > 0)) return;
  const percent = container.querySelector('.meal-progress-head strong, .meal-overview-progress b');
  if (percent && percent.textContent !== '100%') percent.textContent = '100%';
  const track = container.querySelector('.meal-detail-track > span');
  if (track && track.style.width !== '100%') track.style.width = '100%';
}

function annotateAndArrangeDetail() {
  if (!mealList || !latestData || draggingCard) return;
  const cards = [...mealList.querySelectorAll(':scope > .meal-card')];
  if (!cards.length) return;

  const activeDate = dateTabs?.querySelector('[data-date].active')?.dataset.date;
  if (!activeDate) return;

  const base = baseMealsForDate(activeDate);
  cards.forEach((card, index) => {
    if (!card.dataset.mealId && base[index]) card.dataset.mealId = base[index].id;
    const meal = mealById(card.dataset.mealId);
    if (meal) patchEmptyMealProgress(card, meal);

    const top = card.querySelector('.meal-card-top');
    if (top && !top.querySelector('.meal-drag-handle')) {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'meal-drag-handle';
      handle.setAttribute('aria-label', '식단 순서 변경');
      handle.textContent = '≡';
      const more = top.querySelector('.more-btn');
      if (more) top.insertBefore(handle, more);
      else top.appendChild(handle);
    }
  });

  const desired = orderedMealsForDate(activeDate).map(meal => meal.id);
  desired.forEach(id => {
    const card = mealList.querySelector(`:scope > .meal-card[data-meal-id="${CSS.escape(id)}"]`);
    if (card) mealList.appendChild(card);
  });
}

function annotateAndArrangeAll() {
  if (!mealList || !latestData || draggingCard) return;
  const days = dateRange(latestData.trip?.startDate, latestData.trip?.endDate);
  const sections = [...mealList.querySelectorAll(':scope > .meal-overview-day')];
  if (!sections.length) return;

  sections.forEach((section, dayIndex) => {
    const date = days[dayIndex];
    if (!date) return;
    const rows = [...section.querySelectorAll('.meal-overview-row')];
    const base = baseMealsForDate(date);
    rows.forEach((row, index) => {
      if (!row.dataset.mealId && base[index]) row.dataset.mealId = base[index].id;
      const meal = mealById(row.dataset.mealId);
      if (meal) patchEmptyMealProgress(row, meal);
    });

    const list = section.querySelector('.meal-overview-list');
    if (!list) return;
    orderedMealsForDate(date).forEach(meal => {
      const row = list.querySelector(`.meal-overview-row[data-meal-id="${CSS.escape(meal.id)}"]`);
      if (row) list.appendChild(row);
    });
  });
}

function patchHomeNextMeal() {
  if (!latestData) return;
  const card = document.getElementById('nextMealCard');
  const pct = card?.querySelector('.meal-feature-progress strong');
  if (!pct || pct.textContent !== '0%') return;
  const meals = [...(latestData.meals || [])].sort((a, b) => a.date.localeCompare(b.date) || (mealOrder[a.mealType] || 99) - (mealOrder[b.mealType] || 99));
  const next = meals[0];
  if (next && (!Array.isArray(next.items) || next.items.length === 0)) pct.textContent = '100%';
}

function sync() {
  syncQueued = false;
  if (draggingCard) return;
  annotateAndArrangeDetail();
  annotateAndArrangeAll();
  patchHomeNextMeal();
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(sync);
}

async function saveCurrentOrder() {
  if (!draggingCard) return;
  const date = dateTabs?.querySelector('[data-date].active')?.dataset.date;
  const ids = [...mealList.querySelectorAll(':scope > .meal-card[data-meal-id]')].map(card => card.dataset.mealId);
  if (!date || ids.length < 2) return;
  try {
    await dataAdapter.mutate(data => {
      ids.forEach((id, index) => {
        const meal = data.meals.find(entry => entry.id === id && entry.date === date);
        if (meal) meal.sortOrder = index;
      });
    });
    toast('식단 순서 저장됨');
  } catch (error) {
    console.error(error);
    toast('식단 순서 저장에 실패했어.');
  }
}

function endDrag() {
  if (!draggingCard) return;
  const card = draggingCard;
  draggingCard = null;
  dragPointerId = null;
  card.classList.remove('meal-card-dragging');
  document.body.classList.remove('meal-order-dragging');
  saveCurrentOrder().finally(queueSync);
}

mealList?.addEventListener('pointerdown', event => {
  const handle = event.target.closest('.meal-drag-handle');
  if (!handle || event.button > 0) return;
  const card = handle.closest('.meal-card');
  if (!card?.dataset.mealId) return;
  event.preventDefault();
  event.stopPropagation();
  draggingCard = card;
  dragPointerId = event.pointerId;
  card.classList.add('meal-card-dragging');
  document.body.classList.add('meal-order-dragging');
  try { handle.setPointerCapture(event.pointerId); } catch (_) {}
});

mealList?.addEventListener('pointermove', event => {
  if (!draggingCard || event.pointerId !== dragPointerId) return;
  event.preventDefault();
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.meal-card');
  if (!target || target === draggingCard || target.parentElement !== mealList) return;
  const rect = target.getBoundingClientRect();
  const before = event.clientY < rect.top + rect.height / 2;
  mealList.insertBefore(draggingCard, before ? target : target.nextSibling);
});

mealList?.addEventListener('pointerup', event => {
  if (event.pointerId === dragPointerId) endDrag();
});
mealList?.addEventListener('pointercancel', event => {
  if (event.pointerId === dragPointerId) endDrag();
});

if (mealList) new MutationObserver(queueSync).observe(mealList, { childList:true, subtree:true });
if (dateTabs) new MutationObserver(queueSync).observe(dateTabs, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });

document.addEventListener('click', event => {
  if (event.target.closest('[data-nav], [data-go], [data-date], [data-meal-scope]')) queueSync();
}, true);

dataAdapter.subscribe(data => {
  latestData = data;
  queueSync();
});

const style = document.createElement('style');
style.textContent = `
  .meal-card-top { gap:8px; }
  .meal-card-top > div:first-child { min-width:0; flex:1; }
  .meal-drag-handle {
    flex:0 0 34px;
    width:34px;
    height:34px;
    border:1px solid rgba(216,160,113,.18);
    border-radius:11px;
    background:rgba(255,255,255,.035);
    color:rgba(234,217,196,.62);
    font-size:22px;
    font-weight:800;
    line-height:1;
    touch-action:none;
    cursor:grab;
  }
  .meal-drag-handle:active { cursor:grabbing; color:#dca77b; border-color:rgba(220,167,123,.5); }
  .meal-card-dragging { opacity:.76; transform:scale(.985); box-shadow:0 18px 38px rgba(0,0,0,.32); z-index:6; }
  body.meal-order-dragging { user-select:none; overscroll-behavior:contain; }
`;
document.head.appendChild(style);
