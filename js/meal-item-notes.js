import { dataAdapter } from './firebase.js?v=064';

let latestData = null;
let queued = false;

function itemByKey(value='') {
  const [mealId, itemId] = String(value).split(':');
  const meal = (latestData?.meals || []).find(entry => entry.id === mealId);
  const item = (Array.isArray(meal?.items) ? meal.items : []).find(entry => entry.id === itemId);
  return item || null;
}

function syncNote(host, item, className) {
  if (!host) return;
  const text = String(item?.note || '').trim();
  let note = host.querySelector(`:scope > .${className}`);
  if (!text) {
    note?.remove();
    return;
  }
  if (!note) {
    note = document.createElement('div');
    note.className = className;
    host.appendChild(note);
  }
  const next = `메모 · ${text}`;
  if (note.textContent !== next) note.textContent = next;
}

function decorateMealScreen() {
  document.querySelectorAll('#mealList [data-edit-meal-item]').forEach(button => {
    const item = itemByKey(button.dataset.editMealItem || '');
    syncNote(button.closest('.meal-detail-item')?.querySelector('.meal-detail-main'), item, 'meal-detail-note');
  });
}

function decoratePreparationHub() {
  document.querySelectorAll('#mealPrepList [data-meal-prep]').forEach(card => {
    const item = itemByKey(card.dataset.mealPrep || '');
    syncNote(card.querySelector('.meal-prep-main'), item, 'meal-prep-note');
  });
}

function apply() {
  queued = false;
  if (!latestData) return;
  decorateMealScreen();
  decoratePreparationHub();
}

function queueApply() {
  if (queued) return;
  queued = true;
  queueMicrotask(apply);
}

dataAdapter.subscribe(data => {
  latestData = data;
  queueApply();
});

const mealList = document.getElementById('mealList');
const itemsView = document.getElementById('view-items');
if (mealList) new MutationObserver(queueApply).observe(mealList, { childList:true, subtree:true });
if (itemsView) new MutationObserver(queueApply).observe(itemsView, { childList:true, subtree:true });

const style = document.createElement('style');
style.textContent = `
  .meal-detail-note,
  .meal-prep-note {
    margin-top:5px;
    color:rgba(201,137,93,.78);
    font-size:10px;
    line-height:1.45;
    overflow-wrap:anywhere;
  }
  .meal-detail-item.done .meal-detail-note,
  .meal-prep-item.done .meal-prep-note { opacity:.55; }
`;
document.head.appendChild(style);
