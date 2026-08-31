import { dataAdapter } from './firebase.js?v=064';

const itemList = document.getElementById('itemList');
const modalContent = document.getElementById('modalContent');
let latestData = null;
let pendingItemId = null;

function numberValue(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function moneyText(value) {
  const n = numberValue(value);
  return n ? `${n.toLocaleString('ko-KR')}원` : '';
}

function decorateItemCards() {
  if (!itemList || !latestData) return;

  itemList.querySelectorAll('.packing-item').forEach(card => {
    const id = card.querySelector('[data-toggle-item]')?.dataset.toggleItem;
    if (!id) return;
    const item = (latestData.items || []).find(entry => entry.id === id);
    const meta = card.querySelector('.item-meta');
    if (!meta || !item) return;

    const oldSep = meta.querySelector('.item-cost-separator');
    const oldCost = meta.querySelector('.item-cost-meta');
    const cost = numberValue(item.cost);

    if (!cost) {
      oldSep?.remove();
      oldCost?.remove();
      return;
    }

    let sep = oldSep;
    if (!sep) {
      sep = document.createElement('span');
      sep.className = 'item-cost-separator';
      sep.textContent = '·';
      meta.appendChild(sep);
    }

    let amount = oldCost;
    if (!amount) {
      amount = document.createElement('span');
      amount.className = 'item-cost-meta';
      meta.appendChild(amount);
    }
    amount.textContent = moneyText(cost);
  });
}

function ensureCostField() {
  const form = modalContent?.querySelector('#itemForm');
  if (!form || form.querySelector('input[name="cost"]')) return;

  const quantityInput = form.querySelector('input[name="quantity"]');
  const quantityLabel = quantityInput?.closest('label');
  if (!quantityLabel) return;

  const row = document.createElement('div');
  row.className = 'form-row-2 item-quantity-cost-row';
  quantityLabel.insertAdjacentElement('beforebegin', row);
  row.appendChild(quantityLabel);

  const costLabel = document.createElement('label');
  costLabel.innerHTML = '금액<div class="cost-input-wrap"><input name="cost" type="number" inputmode="numeric" min="0" step="100" placeholder="예: 20000"></div>';
  row.appendChild(costLabel);

  const item = pendingItemId ? (latestData?.items || []).find(entry => entry.id === pendingItemId) : null;
  const input = costLabel.querySelector('input[name="cost"]');
  const cost = numberValue(item?.cost);
  if (input && cost) input.value = String(cost);
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('#addItemBtn')) pendingItemId = null;
  const edit = event.target.closest('[data-edit-item]');
  if (edit) pendingItemId = edit.dataset.editItem || null;
}, true);

if (itemList) {
  new MutationObserver(decorateItemCards).observe(itemList, { childList: true });
}

if (modalContent) {
  new MutationObserver(ensureCostField).observe(modalContent, { childList: true, subtree: true });
}

dataAdapter.subscribe(data => {
  latestData = data;
  decorateItemCards();
  ensureCostField();
});
