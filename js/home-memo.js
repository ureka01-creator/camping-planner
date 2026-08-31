import { dataAdapter } from './firebase.js?v=064';
import { openModal, closeModal, esc, toast, uid } from './ui.js';

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

function boardPosts() {
  const source = latestData?.trip?.homeMemos;
  if (!Array.isArray(source)) return [];
  return source
    .map((memo, index) => ({
      ...memo,
      _boardId: memo?.id || `legacy:${memo?.key || memo?.memberId || memo?.name || index}`,
      _index: index
    }))
    .filter(memo => String(memo?.text || '').trim());
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
      <div><strong>한줄 게시판</strong><small>같이 보는 메모</small></div>
      <button type="button" class="home-memo-add" data-add-home-memo aria-label="한줄 게시글 작성">+</button>
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

function displayName(post) {
  const current = (latestData?.members || []).find(member => member.id && member.id === post.memberId);
  return current?.name || post.name || '이름 없음';
}

function isMine(post) {
  const identity = currentIdentity();
  if (!identity.key) return false;
  return Boolean(
    (post.memberId && identity.memberId && post.memberId === identity.memberId) ||
    (post.key && post.key === identity.key)
  );
}

function render() {
  renderQueued = false;
  const card = ensureCard();
  if (!card || !latestData) return;

  const list = card.querySelector('#homeMemoList');
  if (!list) return;
  const posts = boardPosts().sort((a, b) =>
    Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0) ||
    b._index - a._index
  );

  list.innerHTML = posts.length
    ? posts.map(post => `
      <article class="home-memo-row ${isMine(post) ? 'mine' : ''}" data-home-board-post="${esc(post._boardId)}">
        <div class="home-memo-copy"><strong>${esc(displayName(post))}</strong><span>:</span><p>${esc(String(post.text || '').trim())}</p></div>
        ${isMine(post) ? `<button type="button" class="home-memo-row-edit" data-edit-home-memo="${esc(post._boardId)}" aria-label="내 게시글 수정">${pencilSvg()}</button>` : ''}
      </article>`).join('')
    : '<div class="home-memo-empty">아직 글이 없어. + 버튼을 눌러 한 줄 남겨봐.</div>';

  window.CampingHomeOrder?.apply?.();
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(render);
}

function findStoredPost(data, boardId, fallbackIndex = -1) {
  const posts = Array.isArray(data?.trip?.homeMemos) ? data.trip.homeMemos : [];
  const byId = posts.findIndex(post => post?.id && post.id === boardId);
  if (byId >= 0) return byId;
  if (boardId.startsWith('legacy:') && fallbackIndex >= 0 && fallbackIndex < posts.length) return fallbackIndex;
  return -1;
}

function goToDisplayNameSetting() {
  toast('게시판에 글을 쓰려면 먼저 내 표시 이름을 정해줘.');
  document.querySelector('[data-go="settings"]')?.click();

  const focusName = () => {
    const input = document.getElementById('myNameInput');
    if (!(input instanceof HTMLInputElement)) return;
    const card = input.closest('.settings-card');
    card?.classList.add('display-name-target');
    input.scrollIntoView({ behavior:'smooth', block:'center', inline:'nearest' });
    window.setTimeout(() => input.focus({ preventScroll:true }), 220);
    window.setTimeout(() => card?.classList.remove('display-name-target'), 1800);
  };

  requestAnimationFrame(focusName);
  window.setTimeout(focusName, 120);
}

function openPostEditor(post = null) {
  const identity = currentIdentity();
  if (!identity.key || !identity.name) {
    goToDisplayNameSetting();
    return;
  }
  if (post && !isMine(post)) {
    toast('내가 쓴 글만 수정할 수 있어.');
    return;
  }

  const isEdit = Boolean(post);
  const value = String(post?.text || '');
  openModal(`
    <div class="modal-title"><div><div class="tiny">${esc(identity.name)}</div><h3>${isEdit ? '게시글 수정' : '한줄 남기기'}</h3></div><button class="more-btn" data-close>×</button></div>
    <form id="homeMemoForm" class="form-grid">
      <label>메모<textarea name="memo" maxlength="80" rows="3" placeholder="예: 장작은 내가 가져갈게">${esc(value)}</textarea></label>
      <div class="home-memo-count"><span>같은 캠핑을 보는 사람들에게 바로 보여.</span><b>${value.length}/80</b></div>
      <div class="modal-actions"><button type="button" class="cancel-btn" data-close>취소</button><button class="save-btn">${isEdit ? '수정' : '등록'}</button></div>
      ${isEdit ? '<button type="button" id="deleteHomeMemoBtn" class="delete-btn">게시글 삭제</button>' : ''}
    </form>`, root => {
      const form = root.querySelector('#homeMemoForm');
      const textarea = form?.querySelector('textarea[name="memo"]');
      const count = root.querySelector('.home-memo-count b');
      textarea?.addEventListener('input', () => { if (count) count.textContent = `${textarea.value.length}/80`; });
      requestAnimationFrame(() => textarea?.focus({ preventScroll:true }));

      form.onsubmit = async event => {
        event.preventDefault();
        const text = String(new FormData(form).get('memo') || '').trim().slice(0, 80);
        if (!text) {
          toast('메모를 한 줄 입력해줘.');
          return;
        }
        try {
          await dataAdapter.mutate(data => {
            if (!data.trip) data.trip = {};
            const posts = Array.isArray(data.trip.homeMemos) ? data.trip.homeMemos : [];
            const now = Date.now();
            if (isEdit) {
              const index = findStoredPost(data, post._boardId, post._index);
              if (index < 0) return;
              posts[index] = {
                ...posts[index],
                id: posts[index].id || uid('memo'),
                key: identity.key,
                memberId: identity.memberId,
                name: identity.name,
                text,
                createdAt: posts[index].createdAt || posts[index].updatedAt || now,
                updatedAt: now
              };
            } else {
              posts.push({
                id: uid('memo'),
                key: identity.key,
                memberId: identity.memberId,
                name: identity.name,
                text,
                createdAt: now,
                updatedAt: now
              });
            }
            data.trip.homeMemos = posts;
          });
          closeModal();
          toast(isEdit ? '게시글을 수정했어.' : '게시글을 등록했어.');
        } catch (error) {
          console.error(error);
          toast('게시글 저장에 실패했어.');
        }
      };

      root.querySelector('#deleteHomeMemoBtn')?.addEventListener('click', async () => {
        if (!window.confirm('이 게시글을 삭제할까?')) return;
        try {
          await dataAdapter.mutate(data => {
            const posts = Array.isArray(data?.trip?.homeMemos) ? data.trip.homeMemos : [];
            const index = findStoredPost(data, post._boardId, post._index);
            if (index >= 0) posts.splice(index, 1);
            if (data.trip) data.trip.homeMemos = posts;
          });
          closeModal();
          toast('게시글을 삭제했어.');
        } catch (error) {
          console.error(error);
          toast('게시글 삭제에 실패했어.');
        }
      });
    });
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-add-home-memo]')) {
    event.preventDefault();
    openPostEditor();
    return;
  }
  const edit = event.target.closest('[data-edit-home-memo]');
  if (edit) {
    event.preventDefault();
    const post = boardPosts().find(entry => entry._boardId === edit.dataset.editHomeMemo);
    if (post) openPostEditor(post);
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
  .home-memo-head > div { display:flex; align-items:baseline; gap:7px; min-width:0; }
  .home-memo-head strong { color:rgba(234,217,196,.82); font-size:12px; line-height:1.2; font-weight:850; letter-spacing:-.02em; }
  .home-memo-head small { color:rgba(234,217,196,.34); font-size:9px; }
  .home-memo-add { width:30px; height:30px; display:grid; place-items:center; flex:none; padding:0 0 2px; border:1px solid rgba(216,160,113,.18); border-radius:10px; background:rgba(216,160,113,.05); color:rgba(216,160,113,.80); font-size:20px; font-weight:400; line-height:1; }
  .home-memo-list { display:grid; }
  .home-memo-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:start; padding:10px 0; border-top:1px solid rgba(216,160,113,.08); }
  .home-memo-row:first-child { border-top:0; padding-top:6px; }
  .home-memo-row:last-child { padding-bottom:1px; }
  .home-memo-copy { display:grid; grid-template-columns:auto auto minmax(0,1fr); gap:5px; align-items:start; min-width:0; color:rgba(234,217,196,.62); font-size:11px; line-height:1.45; }
  .home-memo-copy strong { color:#ead9c4; font-size:11px; white-space:nowrap; }
  .home-memo-copy p { min-width:0; margin:0; overflow-wrap:anywhere; }
  .home-memo-row-edit { width:27px; height:27px; display:grid; place-items:center; flex:none; padding:0; border:0; border-radius:8px; background:transparent; color:rgba(216,160,113,.56); }
  .home-memo-row-edit svg { width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .home-memo-empty { padding:7px 0 3px; color:rgba(234,217,196,.38); font-size:10px; }
  .home-memo-count { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:-4px; color:var(--muted); font-size:10px; }
  .home-memo-count b { font-size:10px; }
  .settings-card.display-name-target { outline:2px solid rgba(220,167,123,.58); outline-offset:2px; box-shadow:0 0 0 5px rgba(220,167,123,.08); }
`;
document.head.appendChild(style);

ensureCard();
