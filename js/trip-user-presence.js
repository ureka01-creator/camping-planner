import { dataAdapter } from './firebase.js?v=064';
import { esc } from './ui.js';

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

function formatRecent(timestamp) {
  const value = Number(timestamp || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat('ko-KR', { hour:'numeric', minute:'2-digit' }).format(date);
  if (sameDay) return `오늘 ${time}`;
  return new Intl.DateTimeFormat('ko-KR', { month:'numeric', day:'numeric', hour:'numeric', minute:'2-digit' }).format(date);
}

function decorateMemberCards() {
  const list = document.getElementById('memberList');
  if (!list) return;

  const me = currentUser();
  list.querySelectorAll('.member-card').forEach(card => {
    const edit = card.querySelector('[data-edit-member]');
    const memberId = String(edit?.dataset?.editMember || '');
    const memberProfiles = profiles()
      .filter(profile => String(profile?.memberId || '') === memberId)
      .sort((a, b) => Number(b?.lastLoginAt || 0) - Number(a?.lastLoginAt || 0));

    const info = card.firstElementChild;
    if (!(info instanceof HTMLElement)) return;

    let slot = info.querySelector('.member-login-presence');
    if (!memberProfiles.length) {
      slot?.remove();
      return;
    }

    const signature = memberProfiles.map(profile => [profile?.uid, profile?.nickname, profile?.googleName, profile?.lastLoginAt].join(':')).join('|');
    if (slot?.dataset?.signature === signature) return;

    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'member-login-presence';
      info.appendChild(slot);
    }
    slot.dataset.signature = signature;
    slot.innerHTML = memberProfiles.map(profile => {
      const name = String(profile?.nickname || profile?.googleName || '캠핑 멤버');
      const mine = Boolean(me?.uid && profile?.uid === me.uid);
      const recent = formatRecent(profile?.lastLoginAt);
      return `<span class="member-login-person"><b>${esc(name)}</b>${mine ? '<em>나</em>' : ''}${recent ? `<small>${esc(recent)}</small>` : ''}</span>`;
    }).join('');
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
  if (!event.target.closest('[data-first-entry-member]')) return;
  window.setTimeout(() => queueWrite({ touchLogin:false }), 0);
}, true);

dataAdapter.subscribe(data => {
  latestData = data;
  queueMicrotask(decorateMemberCards);
});

const memberList = document.getElementById('memberList');
if (memberList) {
  new MutationObserver(() => queueMicrotask(decorateMemberCards)).observe(memberList, { childList:true, subtree:true });
}

if (currentUser()) {
  lastRecordedUid = currentUser().uid;
  queueWrite({ touchLogin:true });
}

const style = document.createElement('style');
style.textContent = `
  .member-login-presence { display:flex; flex-wrap:wrap; align-items:center; gap:5px 8px; margin-top:7px; }
  .member-login-person { display:inline-flex; align-items:center; gap:5px; min-width:0; color:rgba(234,217,196,.68); font-size:10px; }
  .member-login-person b { color:#dca77b; font-size:10px; font-weight:800; }
  .member-login-person em { padding:1px 5px; border-radius:999px; background:rgba(201,137,93,.13); color:#dca77b; font-size:8px; font-style:normal; font-weight:800; }
  .member-login-person small { color:rgba(234,217,196,.36); font-size:9px; }
`;
document.head.appendChild(style);
