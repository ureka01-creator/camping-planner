const pencilSvg = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 20h4L19 9a2.12 2.12 0 0 0-3-3L5 17l-1 3Z"></path>
    <path d="m14.5 7.5 3 3"></path>
  </svg>`;

const mealSvg = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2"></path>
    <path d="M7 2v20"></path>
    <path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Z"></path>
    <path d="M21 15v7"></path>
  </svg>`;

function applyPencil(button) {
  if (!button || button.dataset.pencilIcon === '1') return;
  button.dataset.pencilIcon = '1';
  button.classList.add('edit-pencil-icon');
  button.innerHTML = pencilSvg;
}

function enhanceEditButtons(root = document) {
  root.querySelectorAll?.('#mealList [data-edit-meal], #mealList [data-edit-meal-item], #itemList [data-edit-item]').forEach(applyPencil);
}

function enhanceMealNavIcon() {
  const icon = document.querySelector('.bottom-nav [data-nav="meals"] > span');
  if (!icon || icon.dataset.mealLineIcon === '1') return;
  icon.dataset.mealLineIcon = '1';
  icon.classList.add('meal-line-icon');
  icon.innerHTML = mealSvg;
}

function enhanceIcons(root = document) {
  enhanceEditButtons(root);
  enhanceMealNavIcon();
}

enhanceIcons();

const mealList = document.getElementById('mealList');
if (mealList) {
  new MutationObserver(() => enhanceEditButtons(mealList))
    .observe(mealList, { childList: true, subtree: true });
}

const itemList = document.getElementById('itemList');
if (itemList) {
  new MutationObserver(() => enhanceEditButtons(itemList))
    .observe(itemList, { childList: true, subtree: true });
}

const style = document.createElement('style');
style.textContent = `
  .edit-pencil-icon {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
  }

  .edit-pencil-icon svg {
    width: 18px;
    height: 18px;
    display: block;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: none;
  }

  .meal-detail-actions.edit-pencil-icon svg,
  .item-actions.edit-pencil-icon svg {
    width: 17px;
    height: 17px;
  }

  .meal-line-icon {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
  }

  .meal-line-icon svg {
    width: 24px;
    height: 24px;
    display: block;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: none;
  }
`;
document.head.appendChild(style);
