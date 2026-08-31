import { dataAdapter, DATA_MODE } from './firebase.js?v=064';
import { toast } from './ui.js';

const ADMIN_CODE_HASH = '95ea8dc58a8b9e5efcf2c61662c8d7daadcfd5d289f7f0287341b145c348932d';
const STORAGE_KEY = `camp:admin:${DATA_MODE.tripId}`;
const params = new URLSearchParams(location.search);
const forceUserForQa = params.get('qaRole') === 'user';
const localhostAdmin = !forceUserForQa && ['localhost', '127.0.0.1'].includes(location.hostname);

function storedAdmin() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; }
  catch (_) { return false; }
}

export function isAdmin() {
  return localhostAdmin || storedAdmin();
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function verifyAdminCode(code) {
  if (forceUserForQa && ['localhost', '127.0.0.1'].includes(location.hostname) && code === 'qa-admin') return true;
  return (await sha256(code)) === ADMIN_CODE_HASH;
}

function protectedSnapshot(data) {
  const trip = data?.trip || {};
  return JSON.stringify({
    trip: {
      id: trip.id || '',
      title: trip.title || '',
      startDate: trip.startDate || '',
      endDate: trip.endDate || '',
      location: trip.location || ''
    },
    members: data?.members || []
  });
}

if (!dataAdapter.__adminGuardInstalled) {
  const originalMutate = dataAdapter.mutate.bind(dataAdapter);
  dataAdapter.mutate = async mutator => originalMutate(data => {
    if (isAdmin()) {
      mutator(data);
      return;
    }

    const before = protectedSnapshot(data);
    mutator(data);
    const after = protectedSnapshot(data);
    if (before !== after) {
      const error = new Error('관리자만 캠핑 일정과 참여자/팀을 수정할 수 있어.');
      error.code = 'ADMIN_REQUIRED';
      throw error;
    }
  });
  dataAdapter.__adminGuardInstalled = true;
}

function setText(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}

function ensureAdminCard() {
  const settings = document.getElementById('view-settings');
  if (!settings || settings.querySelector('#adminAccessCard')) return;

  const devCard = settings.querySelector('.dev-card');
  const card = document.createElement('div');
  card.id = 'adminAccessCard';
  card.className = 'settings-card admin-access-card';
  card.innerHTML = `
    <div class="admin-access-head">
      <div><strong>관리자 권한</strong><p id="adminAccessStatus" class="muted"></p></div>
      <span id="adminAccessBadge" class="admin-access-badge"></span>
    </div>
    <button id="adminAccessBtn" type="button" class="secondary-wide"></button>`;
  devCard?.before(card);
  if (!devCard) settings.appendChild(card);

  card.querySelector('#adminAccessBtn')?.addEventListener('click', async () => {
    if (isAdmin()) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      toast('관리자 모드를 종료했어.');
      applyAdminUi();
      return;
    }

    const code = window.prompt('관리자 코드를 입력해줘.');
    if (!code) return;
    try {
      if (!(await verifyAdminCode(code.trim()))) {
        toast('관리자 코드가 맞지 않아.');
        return;
      }
      localStorage.setItem(STORAGE_KEY, '1');
      toast('관리자 모드로 전환했어.');
      applyAdminUi();
    } catch (error) {
      console.error(error);
      toast('관리자 인증에 실패했어.');
    }
  });
}

function applyAdminUi() {
  ensureAdminCard();
  const admin = isAdmin();
  document.documentElement.classList.toggle('admin-mode', admin);
  document.documentElement.classList.toggle('user-mode', !admin);

  document.getElementById('shareBtn')?.remove();

  const startInput = document.getElementById('tripStartDateInput');
  const endInput = document.getElementById('tripEndDateInput');
  const saveDates = document.getElementById('saveTripDatesBtn');
  const addMember = document.getElementById('addMemberBtn');

  if (startInput && startInput.disabled === admin) startInput.disabled = !admin;
  if (endInput && endInput.disabled === admin) endInput.disabled = !admin;
  if (saveDates && saveDates.hidden === admin) saveDates.hidden = !admin;
  if (addMember && addMember.hidden === admin) addMember.hidden = !admin;

  document.querySelectorAll('[data-edit-member]').forEach(button => {
    if (button.hidden === admin) button.hidden = !admin;
  });

  setText(document.getElementById('adminAccessStatus'), admin
    ? '캠핑 일정과 참여자/팀을 수정할 수 있어.'
    : '일반 사용자는 일정과 참여자/팀을 조회만 할 수 있어.');
  setText(document.getElementById('adminAccessBadge'), admin ? '관리자' : '읽기 전용');
  setText(document.getElementById('adminAccessBtn'), admin ? '관리자 모드 종료' : '관리자 인증');
  setText(document.querySelector('#view-settings .version'), 'Camping Planner v0.5.9');
}

const style = document.createElement('style');
style.textContent = `
  .admin-access-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
  .admin-access-head p { margin:6px 0 0; }
  .admin-access-badge { flex:none; padding:5px 9px; border:1px solid rgba(210,145,95,.32); border-radius:999px; color:#d2915f; font-size:12px; font-weight:700; }
  .user-mode #tripStartDateInput:disabled,
  .user-mode #tripEndDateInput:disabled { opacity:.72; -webkit-text-fill-color:currentColor; }
  .user-mode [data-edit-member],
  .user-mode #addMemberBtn { display:none !important; }
`;
document.head.appendChild(style);

document.addEventListener('click', event => {
  if (isAdmin() || !(event.target instanceof Element)) return;
  const protectedControl = event.target.closest('#saveTripDatesBtn, #addMemberBtn, [data-edit-member], #deleteMemberBtn');
  if (!protectedControl) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  toast('관리자만 수정할 수 있어.');
}, true);

const memberList = document.getElementById('memberList');
if (memberList) {
  new MutationObserver(() => queueMicrotask(applyAdminUi)).observe(memberList, { childList:true });
}

applyAdminUi();
