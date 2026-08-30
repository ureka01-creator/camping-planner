import { dataAdapter, seedData } from './firebase.js';

// Every fresh app entry starts from Home. Do not restore the previously opened tab.
localStorage.setItem('camp:lastView', 'home');

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [y,m,d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y,m-1,d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m-1 && dt.getUTCDate() === d;
}

function firstData() {
  return new Promise(resolve => {
    let unsubscribe = null;
    let settled = false;
    unsubscribe = dataAdapter.subscribe(data => {
      if (settled) return;
      settled = true;
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

try {
  await repairTripDatesIfNeeded();
} catch (error) {
  console.error('Trip date repair failed; continuing with app boot.', error);
}

await import('./app.js?v=045');
await import('./inline-meal-add.js?v=046');
await import('./trip-settings.js?v=045');
await import('./home-meal-progress.js?v=050');
