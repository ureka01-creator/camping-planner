const modalContent = document.getElementById('modalContent');
const itemList = document.getElementById('itemList');

const ITEM_CATEGORIES = ['주류', '식재료', '조리', '텐트', '침구', '놀이', '기타'];
let pendingCategory = '';

function categoryFromCard(button) {
  const card = button?.closest?.('.packing-item');
  return card?.querySelector('.item-meta span')?.textContent?.trim() || '';
}

function resetModalTop() {
  const sheet = modalContent?.closest('.modal-sheet');
  if (!sheet) return;
  sheet.scrollTop = 0;
  modalContent.scrollTop = 0;
}

function normalizeItemCategorySelect() {
  const form = modalContent?.querySelector('#itemForm');
  const select = form?.querySelector('select[name="category"]');
  if (!form || !select) return;

  const selected = pendingCategory || select.value || '기타';
  const categories = ITEM_CATEGORIES.includes(selected)
    ? ITEM_CATEGORIES
    : [...ITEM_CATEGORIES, selected];

  if (select.dataset.fixedCategoryOptions !== '1') {
    select.innerHTML = categories
      .map(category => `<option value="${category}">${category}</option>`)
      .join('');
    select.dataset.fixedCategoryOptions = '1';
  }

  if ([...select.options].some(option => option.value === selected)) {
    select.value = selected;
  }

  requestAnimationFrame(resetModalTop);
  window.setTimeout(resetModalTop, 40);
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;

  const editButton = event.target.closest('[data-edit-item]');
  if (editButton) {
    pendingCategory = categoryFromCard(editButton);
    return;
  }

  if (event.target.closest('#addItemBtn')) {
    pendingCategory = '기타';
  }
}, true);

if (modalContent) {
  new MutationObserver(normalizeItemCategorySelect)
    .observe(modalContent, { childList: true, subtree: true });
}

if (itemList) {
  new MutationObserver(() => {
    if (!modalContent?.querySelector('#itemForm')) return;
    normalizeItemCategorySelect();
  }).observe(itemList, { childList: true, subtree: true });
}
