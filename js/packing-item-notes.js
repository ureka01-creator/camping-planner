import { dataAdapter } from './firebase.js?v=064';
import { esc } from './ui.js';

const itemList = document.getElementById('itemList');
let latestData = null;
let queued = false;

function renderPackingNotes() {
  queued = false;
  if (!itemList || !latestData) return;

  const byId = new Map((latestData.items || []).map(item => [item.id, item]));
  itemList.querySelectorAll('.packing-item').forEach(card => {
    const editButton = card.querySelector('[data-edit-item]');
    const item = editButton ? byId.get(editButton.dataset.editItem || '') : null;
    const note = String(item?.note || '').trim();
    const body = card.children?.[1];
    if (!(body instanceof HTMLElement)) return;

    let noteEl = body.querySelector('.packing-item-note');
    if (!note) {
      noteEl?.remove();
      return;
    }

    if (!noteEl) {
      noteEl = document.createElement('div');
      noteEl.className = 'packing-item-note';
      body.appendChild(noteEl);
    }

    // Do not rewrite the same DOM on every MutationObserver pass.
    // Rewriting innerHTML here triggers the observer again and can starve
    // the rest of the bootstrap chain on Safari.
    if (noteEl.dataset.noteText === note) return;
    noteEl.dataset.noteText = note;
    noteEl.innerHTML = `<span>메모</span><b>·</b><p>${esc(note)}</p>`;
  });
}

function queueRender() {
  if (queued) return;
  queued = true;
  queueMicrotask(renderPackingNotes);
}

if (itemList) {
  new MutationObserver(queueRender).observe(itemList, { childList:true, subtree:true });
}

dataAdapter.subscribe(data => {
  latestData = data;
  queueRender();
});

const style = document.createElement('style');
style.textContent = `
  .packing-item-note {
    display:grid;
    grid-template-columns:auto auto minmax(0,1fr);
    gap:5px;
    align-items:start;
    margin-top:5px;
    color:rgba(234,217,196,.43);
    font-size:10px;
    line-height:1.4;
  }
  .packing-item-note span { color:rgba(216,160,113,.64); font-weight:750; }
  .packing-item-note b { font-weight:400; opacity:.55; }
  .packing-item-note p { min-width:0; margin:0; overflow-wrap:anywhere; }
  .packing-item.done .packing-item-note { opacity:.55; }
`;
document.head.appendChild(style);
