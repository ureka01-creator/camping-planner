import { dataAdapter } from './firebase.js';
import { toast, esc, uid } from './ui.js';

const mealList = document.getElementById('mealList');
let latestData = null;

function memberOptions(selected='') {
  return `<option value="">공용 / 미정</option>` + (latestData?.members || []).map(member =>
    `<option value="${member.id}" ${member.id===selected?'selected':''}>${esc(member.name)}</option>`
  ).join('');
}

function numberValue(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g,''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function buildInlineForm(meal) {
  const form = document.createElement('form');
  form.className = 'meal-inline-form';
  form.dataset.mealInlineForm = meal.id;
  form.innerHTML = `
    <input class="meal-inline-name" name="name" placeholder="준비 항목 (예: 돼지고기)" autocomplete="off" required />
    <div class="meal-inline-row">
      <input name="quantity" placeholder="수량 (예: 4근)" autocomplete="off" />
      <div class="cost-input-wrap"><input name="cost" type="number" inputmode="numeric" min="0" step="100" placeholder="금액" /></div>
    </div>
    <div class="meal-inline-row meal-inline-bottom">
      <select name="assigneeId" aria-label="준비 담당자">${memberOptions(meal.assigneeId || '')}</select>
      <button class="meal-inline-submit" type="submit">+ 추가</button>
    </div>`;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('.meal-inline-submit');
    const values = Object.fromEntries(new FormData(form));
    values.name = String(values.name || '').trim();
    values.quantity = String(values.quantity || '').trim();
    values.cost = numberValue(values.cost);
    if (!values.name) return;

    submit.disabled = true;
    try {
      await dataAdapter.mutate(data => {
        const target = data.meals.find(item => item.id === meal.id);
        if (!target) return;
        if (!Array.isArray(target.items)) target.items = [];
        target.items.push({ id: uid('mealitem'), ...values, note:'', isDone:false });
      });
      toast(`${values.name} 추가 완료`);
    } catch (error) {
      console.error(error);
      toast('준비 항목 추가에 실패했어.');
      submit.disabled = false;
    }
  });

  return form;
}

function enhanceMealCards() {
  if (!mealList || !latestData) return;
  mealList.querySelectorAll('[data-add-meal-item]').forEach(button => {
    const mealId = button.dataset.addMealItem;
    const meal = latestData.meals?.find(item => item.id === mealId);
    if (!meal) return;
    const block = button.closest('.meal-progress-block');
    if (block?.querySelector('.meal-inline-form')) {
      button.remove();
      return;
    }
    button.replaceWith(buildInlineForm(meal));
  });
}

if (mealList) {
  new MutationObserver(() => enhanceMealCards()).observe(mealList, { childList:true, subtree:true });
  dataAdapter.subscribe(data => {
    latestData = data;
    queueMicrotask(enhanceMealCards);
  });
  queueMicrotask(enhanceMealCards);
}
