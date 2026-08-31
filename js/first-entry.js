import { dataAdapter } from './firebase.js?v=064';
import { esc, toast } from './ui.js';

const MEMBER_KEY = 'camp:myMemberId';
const LEGACY_NAME_KEY = 'camp:myName';
const sharedEntry = new URLSearchParams(location.search).has('trip');

let latestData = null;
let pickerOpen = false;
let pickerDismissedThisSession = false;

function members() {
  return Array.isArray(latestData?.members) ? latestData.members : [];
}

function identityMembers() {
  const filtered = members().filter(member => {
    const name = String(member?.name || '').trim();
    return name && !/^공용(?:\s*\/\s*미정)?$/.test(name);
  });
  return filtered.length ? filtered : members();
}

function resolveMyMember() {
  const candidates = identityMembers();
  const id = localStorage.getItem(MEMBER_KEY) || '';
  const byId = candidates.find(member => member.id === id);
  if (byId) return byId;

  const legacyName = localStorage.getItem(LEGACY_NAME_KEY) || '';
  const byName = candidates.find(member => member.name === legacyName);
  if (byName) {
    localStorage.setItem(MEMBER_KEY, byName.id);
    return byName;
  }

  if (id) localStorage.removeItem(MEMBER_KEY);
  return null;
}

function allAssignedItems(memberId) {
  const packing = (latestData?.items || []).map(item => ({ ...item, source:'packing' }));
  const mealPrep = (latestData?.meals || []).flatMap(meal =>
    (Array.isArray(meal.items) ? meal.items : []).map(item => ({
      ...item,
      source:'meal',
      mealMenu:meal.menu || '메뉴 미정'
    }))
  );
  return [...packing, ...mealPrep].filter(item => item.assigneeId === memberId);
}

function ensureHomeCard() {
  const home = document.getElementById('view-home');
  if (!home || document.getElementById('myPrepQuickCard')) return;

  const card = document.createElement('section');
  card.id = 'myPrepQuickCard';
  card.className = 'my-prep-quick-card';
  const hero = home.querySelector('.hero-card');
  hero?.insertAdjacentElement('afterend', card);
}

function renderHomeCard() {
  ensureHomeCard();
  const card = document.getElementById('myPrepQuickCard');
  if (!card || !latestData) return;

  const member = resolveMyMember();
  if (!member) {
    card.innerHTML = `
      <div class="my-prep-top">
        <div><span>MY PREP</span><strong>내가 챙길 것</strong></div>
        <button type="button" class="my-team-change" data-open-team-picker>팀 선택</button>
      </div>
      <button type="button" class="my-prep-empty" data-open-team-picker>
        <b>내 팀을 먼저 골라줘</b>
        <small>담당 준비물만 바로 모아서 보여줄게.</small>
      </button>`;
    return;
  }

  const assigned = allAssignedItems(member.id);
  const done = assigned.filter(item => item.isDone).length;
  const todo = assigned.filter(item => !item.isDone);
  const pct = assigned.length ? Math.round(done / assigned.length * 100) : 0;
  const preview = todo.slice(0, 3).map(item => `<span>${esc(item.name)}</span>`).join('');

  card.innerHTML = `
    <div class="my-prep-top">
      <div><span>MY PREP</span><strong>${esc(member.name)} 준비</strong></div>
      <button type="button" class="my-team-change" data-open-team-picker>팀 변경</button>
    </div>
    <button type="button" class="my-prep-main" data-open-my-prep>
      <div class="my-prep-count"><b>${todo.length}</b><span>개 남음</span></div>
      <div class="my-prep-copy">
        <strong>${assigned.length ? `${done}/${assigned.length} 준비 완료` : '담당 준비물 없음'}</strong>
        <small>${assigned.length ? `현재 ${pct}% 완료` : '아직 지정된 항목이 없어.'}</small>
      </div>
      <span class="my-prep-arrow">→</span>
    </button>
    ${preview ? `<div class="my-prep-preview">${preview}</div>` : ''}`;
}

function saveMember(member) {
  localStorage.setItem(MEMBER_KEY, member.id);
  localStorage.setItem(LEGACY_NAME_KEY, member.name);
  pickerDismissedThisSession = true;
  closePicker();
  renderHomeCard();
  toast(`${member.name}로 시작할게.`);
}

function closePicker() {
  document.getElementById('firstEntryBackdrop')?.remove();
  document.body.classList.remove('first-entry-open');
  pickerOpen = false;
}

function openPicker({ required = false } = {}) {
  const candidates = identityMembers();
  if (pickerOpen || !latestData || !candidates.length) return;
  pickerOpen = true;

  const current = resolveMyMember();
  const backdrop = document.createElement('div');
  backdrop.id = 'firstEntryBackdrop';
  backdrop.className = 'first-entry-backdrop';
  backdrop.innerHTML = `
    <section class="first-entry-sheet" role="dialog" aria-modal="true" aria-labelledby="firstEntryTitle">
      <div class="first-entry-kicker">WELCOME</div>
      <h2 id="firstEntryTitle">이번 캠핑, 누구로 볼까?</h2>
      <p>내 팀을 고르면 <b>내가 챙길 것</b>부터 바로 보여줄게.</p>
      <div class="first-entry-team-list">
        ${candidates.map(member => {
          const assigned = allAssignedItems(member.id);
          const todo = assigned.filter(item => !item.isDone).length;
          return `<button type="button" class="first-entry-team ${current?.id === member.id ? 'selected' : ''}" data-first-entry-member="${member.id}">
            <span><strong>${esc(member.name)}</strong><small>${assigned.length ? `${todo}개 남음 · 총 ${assigned.length}개` : '담당 준비물 없음'}</small></span>
            <b>→</b>
          </button>`;
        }).join('')}
      </div>
      ${required ? '<button type="button" class="first-entry-later" data-first-entry-later>그냥 둘러보기</button>' : '<button type="button" class="first-entry-later" data-first-entry-close>닫기</button>'}
    </section>`;

  document.body.appendChild(backdrop);
  document.body.classList.add('first-entry-open');
}

function showAfterLanding() {
  if (!sharedEntry || resolveMyMember() || pickerDismissedThisSession || pickerOpen) return;
  const landing = document.querySelector('.camp-landing');
  if (!landing) {
    openPicker({ required:true });
    return;
  }

  const observer = new MutationObserver(() => {
    if (document.querySelector('.camp-landing')) return;
    observer.disconnect();
    if (!resolveMyMember() && !pickerDismissedThisSession) openPicker({ required:true });
  });
  observer.observe(document.body, { childList:true });
}

function openMyPrep() {
  const member = resolveMyMember();
  if (!member) {
    openPicker({ required:false });
    return;
  }

  document.querySelector('[data-nav="items"]')?.click();
  setTimeout(() => {
    const chip = document.querySelector(`#assigneeFilters [data-assignee-filter="${CSS.escape(member.id)}"]`);
    if (chip && !chip.classList.contains('active')) chip.click();
  }, 80);
}

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;

  const memberButton = event.target.closest('[data-first-entry-member]');
  if (memberButton) {
    const member = identityMembers().find(entry => entry.id === memberButton.dataset.firstEntryMember);
    if (member) saveMember(member);
    return;
  }

  if (event.target.closest('[data-first-entry-later]')) {
    pickerDismissedThisSession = true;
    closePicker();
    renderHomeCard();
    return;
  }

  if (event.target.closest('[data-first-entry-close]')) {
    closePicker();
    return;
  }

  if (event.target.closest('[data-open-team-picker]')) {
    openPicker({ required:false });
    return;
  }

  if (event.target.closest('[data-open-my-prep]')) {
    openMyPrep();
    return;
  }

  if (event.target.closest('#saveMyNameBtn')) {
    queueMicrotask(() => {
      const name = localStorage.getItem(LEGACY_NAME_KEY) || '';
      const member = identityMembers().find(entry => entry.name === name);
      if (member) localStorage.setItem(MEMBER_KEY, member.id);
      else localStorage.removeItem(MEMBER_KEY);
      renderHomeCard();
    });
  }
}, true);

dataAdapter.subscribe(data => {
  latestData = data;
  renderHomeCard();
  showAfterLanding();
});
