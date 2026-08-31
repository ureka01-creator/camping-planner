import { dataAdapter, seedData } from './firebase.js?v=064';

try { localStorage.setItem('camp:lastView', 'home'); } catch (_) {}

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

await import('./app.js?v=064');
await import('./inline-meal-add.js?v=064');
await import('./trip-settings.js?v=064');
await import('./home-meal-progress.js?v=065');
await import('./meal-reorder.js?v=065');
await import('./meal-edit-focus.js?v=066');
await import('./items-hub.js?v=067');

repairTripDatesIfNeeded().catch(error => {
  console.warn('Trip date repair skipped.', error);
});
