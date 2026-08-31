import { dataAdapter } from './firebase.js?v=064';
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

function buildAddForm(meal, onDone) {
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
      form.reset();
      onDone?.();
    } catch (error) {
      console.error(error);
      toast('준비 항목 추가에 실패했어.');
      submit.disabled = false;
    }
  });

  return form;
}

function buildAddControl(meal) {
  const wrap = document.createElement('div');
  wrap.className = 'meal-inline-control';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'meal-inline-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span>+ 준비 항목</span><span class="meal-inline-chevron" aria-hidden="true">⌄</span>';

  const panel = document.createElement('div');
  panel.className = 'meal-inline-panel';
  panel.hidden = true;

  const closePanel = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };
  panel.appendChild(buildAddForm(meal, closePanel));

  toggle.addEventListener('click', () => {
    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    toggle.setAttribute('aria-expanded', String(nextOpen));
    if (nextOpen) queueMicrotask(() => panel.querySelector('input[name="name"]')?.focus({ preventScroll:true }));
  });

  wrap.append(toggle, panel);
  return wrap;
}

function closeExistingEditors(card) {
  card?.querySelectorAll('.meal-inline-edit').forEach(editor => {
    const row = editor.previousElementSibling;
    if (row?.classList.contains('meal-detail-item')) row.hidden = false;
    editor.remove();
  });
}

function buildEditForm(meal, item, row) {
  const form = document.createElement('form');
  form.className = 'meal-inline-edit';
  form.dataset.mealItemEdit = `${meal.id}:${item.id}`;
  form.innerHTML = `
    <div class="meal-inline-edit-title">준비 항목 수정</div>
    <input name="name" value="${esc(item.name || '')}" placeholder="준비 항목" autocomplete="off" required />
    <div class="meal-inline-row">
      <input name="quantity" value="${esc(item.quantity || '')}" placeholder="수량" autocomplete="off" />
      <div class="cost-input-wrap"><input name="cost" type="number" inputmode="numeric" min="0" step="100" value="${numberValue(item.cost) || ''}" placeholder="금액" /></div>
    </div>
    <select name="assigneeId" aria-label="준비 담당자">${memberOptions(item.assigneeId || meal.assigneeId || '')}</select>
    <textarea name="note" placeholder="구매처, 브랜드, 추가 메모 등">${esc(item.note || '')}</textarea>
    <div class="meal-inline-edit-actions">
      <button type="button" class="meal-inline-delete">삭제</button>
      <button type="button" class="meal-inline-cancel">취소</button>
      <button type="submit" class="meal-inline-save">저장</button>
    </div>`;

  const close = () => {
    row.hidden = false;
    form.remove();
  };

  form.querySelector('.meal-inline-cancel').addEventListener('click', close);
  form.querySelector('.meal-inline-delete').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await dataAdapter.mutate(data => {
        const target = data.meals.find(entry => entry.id === meal.id);
        if (!target || !Array.isArray(target.items)) return;
        target.items = target.items.filter(entry => entry.id !== item.id);
      });
      toast(`${item.name} 삭제 완료`);
    } catch (error) {
      console.error(error);
      toast('준비 항목 삭제에 실패했어.');
      button.disabled = false;
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('.meal-inline-save');
    const values = Object.fromEntries(new FormData(form));
    values.name = String(values.name || '').trim();
    values.quantity = String(values.quantity || '').trim();
    values.note = String(values.note || '').trim();
    values.cost = numberValue(values.cost);
    if (!values.name) return;

    submit.disabled = true;
    try {
      await dataAdapter.mutate(data => {
        const target = data.meals.find(entry => entry.id === meal.id);
        const targetItem = target?.items?.find(entry => entry.id === item.id);
        if (targetItem) Object.assign(targetItem, values);
      });
      toast(`${values.name} 수정 완료`);
    } catch (error) {
      console.error(error);
      toast('준비 항목 수정에 실패했어.');
      submit.disabled = false;
    }
  });

  return form;
}

function bindInlineEditors() {
  mealList?.querySelectorAll('[data-edit-meal-item]').forEach(button => {
    if (button.dataset.inlineEditBound === '1') return;
    button.dataset.inlineEditBound = '1';
    button.onclick = null;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const [mealId, itemId] = button.dataset.editMealItem.split(':');
      const meal = latestData?.meals?.find(entry => entry.id === mealId);
      const item = meal?.items?.find(entry => entry.id === itemId);
      const row = button.closest('.meal-detail-item');
      const card = button.closest('.meal-card');
      if (!meal || !item || !row || !card) return;

      closeExistingEditors(card);
      row.hidden = true;
      const editor = buildEditForm(meal, item, row);
      row.insertAdjacentElement('afterend', editor);
      queueMicrotask(() => editor.querySelector('input[name="name"]')?.focus({ preventScroll:true }));
    }, true);
  });
}

function enhanceMealCards() {
  if (!mealList || !latestData) return;

  mealList.querySelectorAll('[data-add-meal-item]').forEach(button => {
    const mealId = button.dataset.addMealItem;
    const meal = latestData.meals?.find(item => item.id === mealId);
    if (!meal) return;
    button.replaceWith(buildAddControl(meal));
  });

  bindInlineEditors();
}

if (mealList) {
  new MutationObserver(() => enhanceMealCards()).observe(mealList, { childList:true, subtree:true });
  dataAdapter.subscribe(data => {
    latestData = data;
    queueMicrotask(enhanceMealCards);
  });
  queueMicrotask(enhanceMealCards);
}
