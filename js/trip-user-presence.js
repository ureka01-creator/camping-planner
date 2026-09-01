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

function members() {
  return Array.isArray(latestData?.members) ? latestData.members : [];
}

function memberName(memberId) {
  if (!memberId) return '팀 미선택';
  return members().find(member => member.id === memberId)?.name || '팀 미선택';
}

function profiles() {
  return Array.isArray(latestData?.trip?.userProfiles) ? latestData.trip.userProfiles : [];
}

function formatRecent(timestamp) {
  const value = Number(timestamp || 0);
  if (!Number.isFinite(value) || value <= 0) return '접속 기록 없음';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat('ko-KR', { hour:'numeric', minute:'2-digit' }).format(date);
  if (sameDay) return `오늘 ${time}`;
  return new Intl.DateTimeFormat('ko-KR', { month:'numeric', day:'numeric', hour:'numeric', minute:'2-digit' }).format(date);
}

function ensureCard() {
  const account = document.getElementById('googleAccountCard');
  if (!account || document.getElementById('tripUserPresenceCard')) return;

  const card = document.createElement('div');
  card.id = 'tripUserPresenceCard';
  card.className = 'settings-card trip-user-presence-card';
  card.innerHTML = `
    <div class="trip-user-presence-head">
      <div><strong>참여 현황</strong><p>Google 로그인 · 선택한 팀</p></div>
      <span id="tripUserPresenceCount">0명</span>
    </div>
    <div id="tripUserPresenceList" class="trip-user-presence-list"></div>`;
  account.insertAdjacentElement('afterend', card);
}

function render() {
  ensureCard();
  const list = document.getElementById('tripUserPresenceList');
  const count = document.getElementById('tripUserPresenceCount');
  if (!list || !count) return;

  const me = currentUser();
  const rows = [...profiles()].sort((a, b) => Number(b?.lastLoginAt || 0) - Number(a?.lastLoginAt || 0));
  count.textContent = `${rows.length}명`;

  if (!rows.length) {
    list.innerHTML = '<p class="trip-user-presence-empty">아직 기록된 사용자가 없어.</p>';
    return;
  }

  list.innerHTML = rows.map(profile => {
    const name = String(profile?.nickname || profile?.googleName || '캠핑 멤버');
    const mine = me?.uid && profile?.uid === me.uid;
    return `
      <div class="trip-user-presence-row">
        <div class="trip-user-presence-main">
          <strong>${esc(name)}${mine ? '<em>나</em>' : ''}</strong>
          <small>${esc(formatRecent(profile?.lastLoginAt))}</small>
        </div>
        <span class="trip-user-presence-team">${esc(memberName(profile?.memberId))}</span>
      </div>`;
  }).join('');
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
  render();
});

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest('[data-first-entry-member]')) return;
  // first-entry.js writes camp:myMemberId during this same click. Waiting until
  // the next task guarantees we persist the newly selected team, regardless of
  // listener registration order.
  window.setTimeout(() => queueWrite({ touchLogin:false }), 0);
}, true);

dataAdapter.subscribe(data => {
  latestData = data;
  render();
});

if (currentUser()) {
  lastRecordedUid = currentUser().uid;
  queueWrite({ touchLogin:true });
}

const style = document.createElement('style');
style.textContent = `
  .trip-user-presence-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
  .trip-user-presence-head p { margin:5px 0 0; color:rgba(234,217,196,.46); font-size:11px; }
  .trip-user-presence-head > span { flex:none; padding:5px 9px; border:1px solid rgba(216,160,113,.14); border-radius:999px; color:#dca77b; font-size:10px; font-weight:800; }
  .trip-user-presence-list { margin-top:14px; border-top:1px solid rgba(216,160,113,.10); }
  .trip-user-presence-row { min-height:58px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid rgba(216,160,113,.08); }
  .trip-user-presence-row:last-child { border-bottom:0; padding-bottom:0; }
  .trip-user-presence-main { min-width:0; }
  .trip-user-presence-main strong { display:flex; align-items:center; gap:6px; color:#ead9c4; font-size:13px; }
  .trip-user-presence-main em { padding:2px 5px; border-radius:999px; background:rgba(201,137,93,.13); color:#dca77b; font-size:8px; font-style:normal; }
  .trip-user-presence-main small { display:block; margin-top:4px; color:rgba(234,217,196,.40); font-size:9px; }
  .trip-user-presence-team { flex:none; max-width:45%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:6px 9px; border-radius:999px; background:rgba(234,217,196,.055); color:rgba(234,217,196,.70); font-size:10px; font-weight:750; }
  .trip-user-presence-empty { margin:13px 0 0; color:rgba(234,217,196,.40); font-size:10px; }
`;
document.head.appendChild(style);
