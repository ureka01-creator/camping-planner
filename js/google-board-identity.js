import { dataAdapter } from './firebase.js?v=064';

const AUTH_UID_KEY = 'camp:authUid';
const NAME_KEY = 'camp:myName';
const AUTHOR_ID_KEY = 'camp:boardAuthorId';
const LEGACY_AUTHOR_ID_KEY = 'camp:legacyBoardAuthorId';
let latestData = null;
let syncing = false;

function currentAuth() {
  try {
    return {
      uid: String(localStorage.getItem(AUTH_UID_KEY) || ''),
      name: String(localStorage.getItem(NAME_KEY) || '').trim()
    };
  } catch (_) {
    return { uid:'', name:'' };
  }
}

function adoptGoogleAuthorId() {
  const { uid } = currentAuth();
  if (!uid) return false;
  try {
    const existing = String(localStorage.getItem(AUTHOR_ID_KEY) || '');
    if (existing && existing !== uid && !localStorage.getItem(LEGACY_AUTHOR_ID_KEY)) {
      localStorage.setItem(LEGACY_AUTHOR_ID_KEY, existing);
    }
    localStorage.setItem(AUTHOR_ID_KEY, uid);
  } catch (_) {}
  return true;
}

async function migrateBoardOwnership() {
  if (syncing || !latestData || !adoptGoogleAuthorId()) return;
  const { uid, name } = currentAuth();
  if (!uid || !name) return;

  let legacy = '';
  try { legacy = String(localStorage.getItem(LEGACY_AUTHOR_ID_KEY) || ''); } catch (_) {}
  const posts = Array.isArray(latestData?.trip?.homeMemos) ? latestData.trip.homeMemos : [];
  const needsSync = posts.some(post =>
    post?.authorId === uid
      ? post.name !== name || post.key !== uid
      : Boolean(legacy && (post?.authorId === legacy || post?.key === legacy))
  );
  if (!needsSync) return;

  syncing = true;
  try {
    await dataAdapter.mutate(data => {
      const stored = Array.isArray(data?.trip?.homeMemos) ? data.trip.homeMemos : [];
      stored.forEach(post => {
        const mine = post?.authorId === uid || Boolean(legacy && (post?.authorId === legacy || post?.key === legacy));
        if (!mine) return;
        post.authorId = uid;
        post.key = uid;
        post.name = name;
      });
    });
    try { localStorage.removeItem(LEGACY_AUTHOR_ID_KEY); } catch (_) {}
  } catch (error) {
    console.warn('Google board ownership migration skipped.', error);
  } finally {
    syncing = false;
  }
}

window.addEventListener('camp:auth-ready', () => {
  adoptGoogleAuthorId();
  migrateBoardOwnership();
});

dataAdapter.subscribe(data => {
  latestData = data;
  adoptGoogleAuthorId();
  migrateBoardOwnership();
});

adoptGoogleAuthorId();
