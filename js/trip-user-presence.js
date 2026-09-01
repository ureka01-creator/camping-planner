import { dataAdapter } from './firebase.js?v=064';
import { esc, openModal } from './ui.js';

const MEMBER_KEY = 'camp:myMemberId';
let latestData = null;
let lastRecordedUid = '';
let writeQueued = false;
let pendingTouchLogin = false;

function currentUser() {
  return window.CampingGoogleUser && window.CampingGoogleUser.uid ? window.CampingGoogleUser : null;
}

function currentMemberId() {
  try { return String(localStorage.getItem(MEMBER_KEY) || ''); }
  catch (_) { return ''; }
}

function profiles() {
  return Array.isArray(latestData?.trip?.userProfiles) ? latestData.trip.userProfiles : [];
}

function memberById(memberId) {
  return (latestData?.members || []).find(member => String(member?.id || '') === String(memberId || '')) || null;
}

function memberProfiles(memberId) {
  const seen = new Set();
  return profiles()
    .filter(profile => String(profile?.memberId || '') === String(memberId || ''))
    .filter(profile => {
      const key = String(profile?.uid || profile?.nickname || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function openMemberUsers(memberId) {
  const member = memberById(memberId);
  const rows = memberProfiles(memberId);
  const teamName = String(member?.name || '참여자 / 팀');

  openModal(`
    <div class="modal-title member-users-modal-title">
      <h3>${esc(teamName)} 참여자</h3>
      <button class="more-btn" data-close aria-label="닫기">×</button>
    </div>
    <div class="member-users-modal-list">
      ${rows.length
        ? rows.map(profile => `<div class="member-users-modal-row">${esc(String(profile?.nickname || '캠핑 멤버'))}</div>`).join('')
        : '<p class="member-users-modal-empty">연결된 참여자가 없어.</p>'}
    </div>`);
}

function decorateMemberCards() {
  const list = document.getElementById('memberList');
  if (!list) return;

  list.querySelectorAll('.member-login-presence').forEach(node => node.remove());

  list.querySelectorAll('.member-card').forEach(card => {
    const edit = card.querySelector('[data-edit-member]');
    const memberId = String(edit?.dataset?.editMember || card.dataset.memberId || '');
    if (!memberId) return;
    card.dataset.memberId = memberId;

    const rows = memberProfiles(memberId);
    let button = card.querySelector('[data-member-user-info]');

    if (!rows.length) {
      button?.remove();
      return;
    }

    if (!(button instanceof HTMLButtonElement)) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'member-user-info-btn';
      button.dataset.memberUserInfo = memberId;
      button.setAttribute('aria-label', '연결된 참여자 보기');
      if (edit) card.insertBefore(button, edit);
      else card.appendChild(button);
    }

    button.dataset.memberUserInfo = memberId;
    button.textContent = rows.length > 1 ? `참여자 ${rows.length}` : '참여자';
  });
}

async function writeProfile({ touchLogin = false } = {}) {
  const user = currentUser();
  if (!user) return;
  const memberId = currentMemberId();
  const now = Date.now();

  try {
    await dataAdapter.mutate(data => {
      if (!data.trip) data.trip = {};
      if (!Array.isArray(data.trip.userProfiles)) data.trip.userProfiles = [];
      let profile = data.trip.userProfiles.find(entry => entry?.uid === user.uid);
      if (!profile) {
        profile = { uid:user.uid, firstLoginAt:now };
        data.trip.userProfiles.push(profile);
        touchLogin = true;
      }
      profile.email = String(user.email || '');
      profile.nickname = String(user.name || '').trim() || '캠핑 멤버';
      profile.googleName = String(user.googleName || '').trim();
      profile.memberId = memberId;
      profile.updatedAt = now;
      if (touchLogin || !profile.lastLoginAt) profile.lastLoginAt = now;
    });
  } catch (error) {
    console.warn('Trip user profile sync skipped.', error);
  }
}

function queueWrite({ touchLogin = false } = {}) {
  pendingTouchLogin = pendingTouchLogin || touchLogin;
  if (writeQueued) return;
  writeQueued = true;
  window.setTimeout(async () => {
    writeQueued = false;
    const shouldTouch = pendingTouchLogin;
    pendingTouchLogin = false;
    await writeProfile({ touchLogin:shouldTouch });
  }, 40);
}

window.addEventListener('camp:auth-ready', event => {
  const uid = String(event?.detail?.uid || currentUser()?.uid || '');
  const firstForThisPage = Boolean(uid && uid !== lastRecordedUid);
  if (uid) lastRecordedUid = uid;
  queueWrite({ touchLogin:firstForThisPage });
  queueMicrotask(decorateMemberCards);
});

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;

  const userButton = event.target.closest('[data-member-user-info]');
  if (userButton) {
    event.preventDefault();
    event.stopPropagation();
    openMemberUsers(String(userButton.dataset.memberUserInfo || ''));
    return;
  }

  if (!event.target.closest('[data-first-entry-member]')) return;
  window.setTimeout(() => queueWrite({ touchLogin:false }), 0);
}, true);

dataAdapter.subscribe(data => {
  latestData = data;
  queueMicrotask(decorateMemberCards);
});

const memberList = document.getElementById('memberList');
if (memberList) {
  new MutationObserver(() => queueMicrotask(decorateMemberCards)).observe(memberList, { childList:true });
}

if (currentUser()) {
  lastRecordedUid = currentUser().uid;
  queueWrite({ touchLogin:true });
}

const style = document.createElement('style');
style.textContent = `
  .member-card { gap:8px; }
  .member-user-info-btn {
    flex:none; min-height:32px; padding:0 10px; margin-left:auto;
    border:1px solid rgba(216,160,113,.18); border-radius:999px;
    background:rgba(201,137,93,.08); color:#dca77b;
    font-size:10px; font-weight:800; white-space:nowrap;
  }
  .member-card > [data-edit-member] { margin-left:0; }
  .member-users-modal-list { display:grid; gap:8px; margin-top:14px; }
  .member-users-modal-row {
    min-height:44px; display:flex; align-items:center; padding:0 14px;
    border:1px solid rgba(216,160,113,.10); border-radius:14px;
    background:rgba(234,217,196,.035); color:#ead9c4;
    font-size:13px; font-weight:750;
  }
  .member-users-modal-empty { margin:14px 0 4px; color:rgba(234,217,196,.42); font-size:11px; }
`;
document.head.appendChild(style);