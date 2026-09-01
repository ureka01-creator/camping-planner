import { dataAdapter } from './firebase.js?v=064';
import { toast } from './ui.js';

const mealList = document.getElementById('mealList');
let latestData = null;
let enhanceQueued = false;
let dragState = null;
let suppressClickUntil = 0;

function queueEnhance() {
  if (enhanceQueued) return;
  enhanceQueued = true;
  requestAnimationFrame(() => {
    enhanceQueued = false;
    enhanceRows();
  });
}

function parseItemKey(row) {
  const action = row.querySelector('[data-edit-meal-item], [data-toggle-meal-item]');
  const raw = action?.dataset.editMealItem || action?.dataset.toggleMealItem || '';
  const splitAt = raw.indexOf(':');
  if (splitAt < 1) return null;
  return { mealId:raw.slice(0, splitAt), itemId:raw.slice(splitAt + 1) };
}

function enhanceRows() {
  if (!mealList) return;
  mealList.querySelectorAll('.meal-detail-item').forEach(row => {
    const key = parseItemKey(row);
    if (!key?.mealId || !key?.itemId) return;
    row.dataset.mealId = key.mealId;
    row.dataset.mealItemId = key.itemId;

    if (row.querySelector('.meal-item-drag-handle')) return;
    const edit = row.querySelector('[data-edit-meal-item]');
    if (!edit) return;

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'meal-item-drag-handle';
    handle.setAttribute('aria-label', '준비 항목 순서 변경');
    handle.title = '끌어서 순서 변경';
    handle.textContent = '≡';
    edit.before(handle);
  });
}

async function persistOrder(container, mealId) {
  const ids = [...container.querySelectorAll(':scope > .meal-detail-item[data-meal-item-id]')]
    .map(row => row.dataset.mealItemId)
    .filter(Boolean);
  if (ids.length < 2) return;

  try {
    await dataAdapter.mutate(data => {
      const meal = data.meals?.find(entry => entry.id === mealId);
      if (!meal || !Array.isArray(meal.items)) return;

      const byId = new Map(meal.items.map(item => [item.id, item]));
      const ordered = ids.map(id => byId.get(id)).filter(Boolean);
      const orderedIds = new Set(ids);
      const leftovers = meal.items.filter(item => !orderedIds.has(item.id));
      meal.items = [...ordered, ...leftovers];
    });
    toast('준비 항목 순서 저장했어.');
  } catch (error) {
    console.error(error);
    toast('준비 항목 순서 저장에 실패했어.');
    queueEnhance();
  }
}

function startDrag(event) {
  const handle = event.target instanceof Element ? event.target.closest('.meal-item-drag-handle') : null;
  if (!handle) return;
  const row = handle.closest('.meal-detail-item[data-meal-item-id]');
  const container = row?.parentElement;
  if (!(row instanceof HTMLElement) || !(container instanceof HTMLElement) || !container.classList.contains('meal-detail-list')) return;

  event.preventDefault();
  event.stopPropagation();
  suppressClickUntil = performance.now() + 700;
  handle.setPointerCapture?.(event.pointerId);
  row.classList.add('meal-item-dragging');
  document.body.classList.add('meal-item-reordering');
  dragState = {
    handle,
    row,
    container,
    mealId:row.dataset.mealId || '',
    pointerId:event.pointerId,
    moved:false
  };
}

function moveDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();

  const { row, container } = dragState;
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const target = hit?.closest?.('.meal-detail-item[data-meal-item-id]');
  if (target && target !== row && target.parentElement === container) {
    const rect = target.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) container.insertBefore(row, target);
    else container.insertBefore(row, target.nextSibling);
    dragState.moved = true;
  }

  if (event.clientY < 110) window.scrollBy(0, -10);
  else if (event.clientY > window.innerHeight - 110) window.scrollBy(0, 10);
}

async function finishDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  event.preventDefault();
  event.stopPropagation();

  const { handle, row, container, mealId, moved } = dragState;
  dragState = null;
  handle.releasePointerCapture?.(event.pointerId);
  row.classList.remove('meal-item-dragging');
  document.body.classList.remove('meal-item-reordering');
  suppressClickUntil = performance.now() + 500;
  if (moved && mealId) await persistOrder(container, mealId);
}

document.addEventListener('pointerdown', startDrag, { passive:false, capture:true });
document.addEventListener('pointermove', moveDrag, { passive:false, capture:true });
document.addEventListener('pointerup', finishDrag, { passive:false, capture:true });
document.addEventListener('pointercancel', finishDrag, { passive:false, capture:true });

document.addEventListener('click', event => {
  if (!(event.target instanceof Element) || !event.target.closest('.meal-item-drag-handle')) return;
  if (performance.now() <= suppressClickUntil) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

dataAdapter.subscribe(data => {
  latestData = data;
  void latestData;
  queueEnhance();
});

if (mealList) {
  new MutationObserver(queueEnhance).observe(mealList, { childList:true, subtree:true });
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-nav], [data-date], [data-open-meal-date], [data-add-meal-item], [data-edit-meal-item]')) queueEnhance();
});

const style = document.createElement('style');
style.textContent = `
  .meal-detail-item:has(.meal-item-drag-handle) {
    grid-template-columns:34px minmax(0,1fr) 28px 32px;
    gap:6px;
  }
  .meal-item-drag-handle {
    width:28px;
    min-width:28px;
    height:32px;
    min-height:32px;
    display:grid;
    place-items:center;
    padding:0;
    border:0;
    border-radius:9px;
    background:transparent;
    color:rgba(234,217,196,.48);
    font-size:18px;
    line-height:1;
    cursor:grab;
    touch-action:none;
    user-select:none;
    -webkit-user-select:none;
  }
  .meal-item-drag-handle:active { cursor:grabbing; }
  .meal-item-dragging {
    opacity:.64 !important;
    transform:scale(.99);
    outline:1px solid rgba(220,167,123,.42);
    box-shadow:0 12px 30px rgba(0,0,0,.24);
  }
  .meal-item-reordering { cursor:grabbing; }
  .meal-item-reordering * { user-select:none !important; -webkit-user-select:none !important; }

  @media (max-width:390px) {
    .meal-detail-item:has(.meal-item-drag-handle) {
      grid-template-columns:30px minmax(0,1fr) 26px 28px;
      gap:5px;
    }
    .meal-item-drag-handle { width:26px; min-width:26px; height:30px; min-height:30px; font-size:17px; }
  }
`;
document.head.appendChild(style);

queueEnhance();
