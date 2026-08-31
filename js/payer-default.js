import { dataAdapter } from './firebase.js?v=064';

const modalContent = document.getElementById('modalContent');
let latestData = null;
let pendingPackingId = null;
let pendingMealItemRef = null;

function payerMembers() {
  return (latestData?.members || []).filter(member => {
    const name = String(member?.name || '').trim();
    return name && !name.startsWith('공용');
  });
}

function isValidPayer(id) {
  return payerMembers().some(member => member.id === id);
}

function memberOptions(selected = '') {
  return `<option value="">결제자 미정</option>` + payerMembers()
    .map(member => `<option value="${member.id}" ${member.id === selected ? 'selected' : ''}>${escapeHtml(member.name)}</option>`)
    .join('');
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function findPendingRecord(form) {
  if (form.id === 'itemForm') {
    return pendingPackingId ? (latestData?.items || []).find(item => item.id === pendingPackingId) : null;
  }
  if (form.id === 'mealItemForm' && pendingMealItemRef) {
    const [mealId, itemId] = pendingMealItemRef.split(':');
    const meal = (latestData?.meals || []).find(entry => entry.id === mealId);
    return Array.isArray(meal?.items) ? meal.items.find(item => item.id === itemId) : null;
  }
  return null;
}

function defaultPayerForAssignee(assigneeId) {
  return isValidPayer(assigneeId) ? assigneeId : '';
}

function ensurePayerField(form) {
  if (!form || form.querySelector('select[name="payerId"]')) return;
  const assignee = form.querySelector('select[name="assigneeId"]');
  if (!assignee) return;

  const record = findPendingRecord(form);
  const savedPayer = isValidPayer(record?.payerId) ? record.payerId : '';
  const initialPayer = savedPayer || defaultPayerForAssignee(assignee.value);
  const explicitOverride = Boolean(savedPayer && savedPayer !== record?.assigneeId);

  const label = document.createElement('label');
  label.className = 'payer-field';
  label.innerHTML = `결제자
    <select name="payerId" aria-label="결제자">${memberOptions(initialPayer)}</select>
    <small class="payer-help">기본은 담당자와 동일 · 대신 결제했을 때만 바꿔.</small>`;

  const assigneeLabel = assignee.closest('label');
  assigneeLabel?.insertAdjacentElement('afterend', label);

  const payer = label.querySelector('select[name="payerId"]');
  if (!payer) return;
  payer.value = initialPayer;
  payer.dataset.overridden = explicitOverride ? '1' : '0';

  assignee.addEventListener('change', () => {
    if (payer.dataset.overridden !== '1') payer.value = defaultPayerForAssignee(assignee.value);
  });

  payer.addEventListener('change', () => {
    const defaultPayer = defaultPayerForAssignee(assignee.value);
    payer.dataset.overridden = payer.value && payer.value !== defaultPayer ? '1' : '0';
  });
}

function ensureFields() {
  if (!modalContent) return;
  ensurePayerField(modalContent.querySelector('#itemForm'));
  ensurePayerField(modalContent.querySelector('#mealItemForm'));
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;

  if (event.target.closest('#addItemBtn')) pendingPackingId = null;
  const packingEdit = event.target.closest('[data-edit-item]');
  if (packingEdit) pendingPackingId = packingEdit.dataset.editItem || null;

  const mealAdd = event.target.closest('[data-add-meal-item]');
  if (mealAdd) pendingMealItemRef = null;
  const mealEdit = event.target.closest('[data-edit-meal-item]');
  if (mealEdit) pendingMealItemRef = mealEdit.dataset.editMealItem || null;
}, true);

if (modalContent) {
  new MutationObserver(ensureFields).observe(modalContent, { childList: true, subtree: true });
}

dataAdapter.subscribe(data => {
  latestData = data;
  ensureFields();
});

const style = document.createElement('style');
style.textContent = `
  .payer-field { display:grid; gap:7px; }
  .payer-help { margin-top:-2px; color:rgba(234,217,196,.40); font-size:10px; font-weight:500; line-height:1.45; }
`;
document.head.appendChild(style);
