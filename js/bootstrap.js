import { dataAdapter, seedData } from './firebase.js?v=064';

try { localStorage.setItem('camp:lastView', 'home'); } catch (_) {}

// The top-right share button was removed from the visible UI in v0.5.7.
// app.js still binds the legacy control during boot, so provide an invisible
// compatibility target until that older binding is retired.
if (!document.getElementById('shareBtn')) {
  const legacyShare = document.createElement('button');
  legacyShare.id = 'shareBtn';
  legacyShare.type = 'button';
  legacyShare.hidden = true;
  legacyShare.tabIndex = -1;
  legacyShare.setAttribute('aria-hidden', 'true');
  document.body.appendChild(legacyShare);
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [y,m,d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y,m-1,d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m-1 && dt.getUTCDate() === d;
}

function firstData(timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    let unsubscribe = null;
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      reject(new Error('Initial data timeout'));
    }, timeoutMs);

    unsubscribe = dataAdapter.subscribe(data => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      queueMicrotask(() => unsubscribe?.());
      resolve(data);
    });
  });
}

async function repairTripDatesIfNeeded() {
  const data = await firstData();
  const trip = data?.trip || {};
  const mealDates = (data?.meals || [])
    .map(meal => meal?.date)
    .filter(isIsoDate)
    .sort();

  let startDate = isIsoDate(trip.startDate) ? trip.startDate : (mealDates[0] || seedData.trip.startDate);
  let endDate = isIsoDate(trip.endDate) ? trip.endDate : (mealDates.at(-1) || startDate);
  if (endDate < startDate) endDate = startDate;

  if (trip.startDate === startDate && trip.endDate === endDate) return;

  await dataAdapter.mutate(current => {
    if (!current.trip) current.trip = {};
    current.trip.startDate = startDate;
    current.trip.endDate = endDate;
  });
}

async function safeImport(path) {
  try {
    return await import(path);
  } catch (error) {
    console.error(`Optional module failed: ${path}`, error);
    return null;
  }
}

// Core app must load. Enhancements are isolated so one bad optional feature
// can never stop the rest of the UI from booting.
await import('./app.js?v=064');

for (const path of [
  './modal-keyboard-fix.js?v=100',
  './inline-meal-add.js?v=071',
  './trip-settings.js?v=064',
  './home-meal-progress.js?v=065',
  './meal-reorder.js?v=065',
  './meal-edit-focus.js?v=066',
  './items-hub.js?v=089',
  './item-edit-fix.js?v=082',
  './edit-icons.js?v=081',
  './admin-access.js?v=084',
  // Load home controls early so the cover/lock buttons cannot be blocked by
  // a later memo or decoration feature.
  './home-order.js?v=096',
  './name-home-redirect.js?v=097',
  './home-memo.js?v=098',
  './admin-board-delete.js?v=099',
  './home-board-paging.js?v=094',
  './meal-item-notes.js?v=091',
  './packing-item-notes.js?v=096'
]) {
  await safeImport(path);
}

const version = document.querySelector('#view-settings .version');
if (version) version.textContent = 'Camping Planner v0.7.8';

repairTripDatesIfNeeded().catch(error => {
  if (error?.code === 'ADMIN_REQUIRED') return;
  console.warn('Trip date repair skipped.', error);
});
