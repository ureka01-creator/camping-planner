import { dataAdapter } from './firebase.js?v=064';
import { openModal, closeModal, esc, toast } from './ui.js';

let latestData = null;
let renderQueued = false;

function currentIdentity() {
  let memberId = '';
  let name = '';
  try {
    memberId = localStorage.getItem('camp:myMemberId') || '';
    name = localStorage.getItem('camp:myName') || '';
  } catch (_) {}

  const member = (latestData?.members || []).find(entry => entry.id === memberId)
    || (latestData?.members || []).find(entry => entry.name === name);
  return {
    key: member?.id || (name ? `name:${name}` : ''),
    memberId: member?.id || '',
    name: member?.name || name
  };
}

function memoList() {
  const source = latestData?.trip?.homeMemos;
  return Array.isArray(source) ? source.filter(memo => String(memo?.text || '').trim()) : [];
}

function ensureCard() {
  const home = document.getElementById('view-home');
  if (!home) return null;
  let card = document.getElementById('homeMemoCard');
  if (card) return card;

  card = document.createElement('section');
  card.id = 'homeMemoCard';
  card.className = 'home-memo-card';
  card.innerHTML = `
    <div class="home-memo-head">
      <strong>한줄 메모</strong>
      <button type="button" class="home-memo-edit" data-edit-home-memo aria-label="내 한줄 메모 작성"></button>
    </div>
    <div id="homeMemoList" class="home-memo-list"></div>`;

  const todo = document.getElementById('homeTodo')?.closest('.home-section') || null;
  if (todo) home.insertBefore(card, todo);
  else home.appendChild(card);
  return card;
}

function pencilSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.12 2.12 0 0 0-3-3L5 17l-1 3Z"></path><path d="m14.5 7.5 3 3"></path></svg>`;
}

function displayName(memo) {
  const current = (latestData?.members || []).find(member => member.id && member.id === memo.memberId);
  return current?.name || memo.name || '이름 없음';
}

function render() {
  renderQueued = false;
  const card = ensureCard();
  if (!card || !latestData) return;

  const edit = card.querySelector('[data-edit-home-memo]');
  if (edit && !edit.innerHTML) edit.innerHTML = pencilSvg();

  const list = card.querySelector('#homeMemoList');
  if (!list) return;
  const memos = memoList();
  const memberOrder = new Map((latestData.members || []).map((member, index) => [member.id, index]));
  memos.sort((a, b) => {
    const ao = memberOrder.has(a.memberId) ? memberOrder.get(a.memberId) : 999;
    const bo = memberOrder.has(b.memberId) ? memberOrder.get(b.memberId) : 999;
    return ao - bo || Number(a.updatedAt || 0) - Number(b.updatedAt || 0);
  });

  list.innerHTML = memos.length
    ? memos.map(memo => `<div class="home-memo-row"><strong>${esc(displayName(memo))}</strong><span>:</span><p>${esc(String(memo.text || '').trim())}</p></div>`).join('')
    : '<div class="home-memo-empty">아직 메모가 없어. 연필을 눌러 한 줄 남겨봐.</div>';

  window.CampingHomeOrder?.apply?.();
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(render);
}

function openMemoEditor() {
  const identity = currentIdentity();
  if (!identity.key || !identity.name) {
    toast('먼저 설정에서 내 표시 이름을 정해줘.');
    document.querySelector('[data-go="settings"]')?.click();
    return;
  }

  const existing = memoList().find(memo => (memo.memberId && memo.memberId === identity.memberId) || memo.key === identity.key);
  const value = String(existing?.text || '');
  openModal(`
    <div class="modal-title"><div><div class="tiny">${esc(identity.name)}</div><h3>한줄 메모</h3></div><button class="more-btn" data-close>×</button></div>
    <form id="homeMemoForm" class="form-grid">
      <label>메모<textarea name="memo" maxlength="80" rows="3" placeholder="예: 장작은 내가 가져갈게">${esc(value)}</textarea></label>
      <div class="home-memo-count"><span>다른 사람 홈에도 같이 보여.</span><b>${value.length}/80</b></div>
      <div class="modal-actions"><button type="button" class="cancel-btn" data-close>취소</button><button class="save-btn">저장</button></div>
    </form>`, root => {
      const form = root.querySelector('#homeMemoForm');
      const textarea = form?.querySelector('textarea[name="memo"]');
      const count = root.querySelector('.home-memo-count b');
      textarea?.addEventListener('input', () => { if (count) count.textContent = `${textarea.value.length}/80`; });
      form.onsubmit = async event => {
        event.preventDefault();
        const text = String(new FormData(form).get('memo') || '').trim().slice(0, 80);
        try {
          await dataAdapter.mutate(data => {
            if (!data.trip) data.trip = {};
            const memos = Array.isArray(data.trip.homeMemos) ? data.trip.homeMemos : [];
            const index = memos.findIndex(memo => (identity.memberId && memo.memberId === identity.memberId) || memo.key === identity.key);
            if (!text) {
              if (index >= 0) memos.splice(index, 1);
            } else {
              const next = { key:identity.key, memberId:identity.memberId, name:identity.name, text, updatedAt:Date.now() };
              if (index >= 0) memos[index] = next;
              else memos.push(next);
            }
            data.trip.homeMemos = memos;
          });
          closeModal();
          toast(text ? '한줄 메모를 저장했어.' : '한줄 메모를 지웠어.');
        } catch (error) {
          console.error(error);
          toast('메모 저장에 실패했어.');
        }
      };
    });
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-edit-home-memo]')) {
    event.preventDefault();
    openMemoEditor();
  }
}, true);

dataAdapter.subscribe(data => {
  latestData = data;
  queueRender();
});

const style = document.createElement('style');
style.textContent = `
  .home-memo-card {
    padding:14px 16px 13px;
    border:1px solid rgba(216,160,113,.14);
    border-radius:22px;
    background:rgba(19,23,21,.86);
    box-shadow:0 9px 24px rgba(0,0,0,.08);
  }
  .home-memo-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:7px; }
  .home-memo-head > strong { color:rgba(234,217,196,.76); font-size:12px; line-height:1.2; font-weight:850; letter-spacing:-.02em; }
  .home-memo-edit { width:30px; height:30px; display:grid; place-items:center; padding:0; border:0; border-radius:10px; background:transparent; color:rgba(216,160,113,.75); }
  .home-memo-edit svg { width:17px; height:17px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .home-memo-list { display:grid; }
  .home-memo-row { display:grid; grid-template-columns:auto auto minmax(0,1fr); gap:5px; align-items:start; padding:9px 0; border-top:1px solid rgba(216,160,113,.08); color:rgba(234,217,196,.62); font-size:11px; line-height:1.45; }
  .home-memo-row:first-child { border-top:0; padding-top:6px; }
  .home-memo-row:last-child { padding-bottom:1px; }
  .home-memo-row strong { color:#ead9c4; font-size:11px; white-space:nowrap; }
  .home-memo-row p { min-width:0; margin:0; overflow-wrap:anywhere; }
  .home-memo-empty { padding:7px 0 3px; color:rgba(234,217,196,.38); font-size:10px; }
  .home-memo-count { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:-4px; color:var(--muted); font-size:10px; }
  .home-memo-count b { font-size:10px; }
`;
document.head.appendChild(style);

ensureCard();
