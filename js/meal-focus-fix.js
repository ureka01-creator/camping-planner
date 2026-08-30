import { dataAdapter } from './firebase.js';
import { esc } from './ui.js';

const mealList = document.getElementById('mealList');
const dateTabs = document.getElementById('dateTabs');
let latestData = null;
let allActive = localStorage.getItem('camp:mealScope') === 'all';
let syncQueued = false;

const mealLabels = { breakfast:'아침', lunch:'점심', dinner:'저녁', snack:'간식' };
const mealOrder = { breakfast:1, lunch:2, dinner:3, snack:4 };
const weekdayLabels = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

function centerFocusedInput(toggle) {
  if (!toggle || toggle.getAttribute('aria-expanded') !== 'true') return;
  const panel = toggle.nextElementSibling;
  const input = panel?.querySelector('.meal-inline-name, input[name="name"]');
  if (!input) return;

  input.focus({ preventScroll: false });
  const bringIntoView = () => input.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  requestAnimationFrame(bringIntoView);
  setTimeout(bringIntoView, 220);
}

function dateRange(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) return [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  const result = [];
  while (cursor <= last) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function shortDate(iso) {
  const [, m, d] = String(iso).split('-').map(Number);
  return `${m}/${d}`;
}

function weekday(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return weekdayLabels[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function progress(items) {
  const list = Array.isArray(items) ? items : [];
  const done = list.filter(item => item?.isDone).length;
  return { done, total:list.length, pct:list.length ? Math.round(done / list.length * 100) : 0 };
}

function memberName(id) {
  return latestData?.members?.find(member => member.id === id)?.name || '공용';
}

function ensureAllTab() {
  if (!dateTabs) return;
  let button = dateTabs.querySelector('[data-meal-scope="all"]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'date-tab';
    button.dataset.mealScope = 'all';
    button.textContent = '전체';
    button.addEventListener('click', event => {
      event.preventDefault();
      allActive = true;
      localStorage.setItem('camp:mealScope', 'all');
      renderAllMeals();
    });
    dateTabs.prepend(button);
  }

  button.classList.toggle('active', allActive);
  if (allActive) {
    dateTabs.querySelectorAll('[data-date]').forEach(tab => tab.classList.remove('active'));
  }
}

function mealOverviewRow(meal) {
  const p = progress(meal.items);
  return `<button type="button" class="meal-overview-row" data-open-meal-date="${meal.date}">
    <span class="meal-overview-main">
      <span class="meal-overview-type">${mealLabels[meal.mealType] || '식사'}</span>
      <strong>${esc(meal.menu || '메뉴 미정')}</strong>
      <span class="meal-overview-meta">식단 담당 ${esc(memberName(meal.assigneeId))}</span>
    </span>
    <span class="meal-overview-progress">${p.total ? `준비 ${p.done}/${p.total}` : '준비 항목 없음'}<b>${p.pct}%</b></span>
  </button>`;
}

function renderAllMeals() {
  if (!allActive || !mealList || !latestData?.trip) return;

  ensureAllTab();
  const days = dateRange(latestData.trip.startDate, latestData.trip.endDate);
  const daySet = new Set(days);
  const meals = [...(latestData.meals || [])]
    .filter(meal => daySet.has(meal.date))
    .sort((a, b) => a.date.localeCompare(b.date) || (mealOrder[a.mealType] || 99) - (mealOrder[b.mealType] || 99));
  const allItems = meals.flatMap(meal => Array.isArray(meal.items) ? meal.items : []);
  const totalProgress = progress(allItems);

  const summary = `<div class="meal-total-summary">
    <span>전체 일정</span>
    <strong>${meals.length}식 · 준비 ${totalProgress.done}/${totalProgress.total}</strong>
  </div>`;

  const schedule = days.map(day => {
    const dayMeals = meals.filter(meal => meal.date === day);
    return `<section class="meal-overview-day">
      <div class="meal-overview-day-head">
        <strong>${shortDate(day)} <small>${weekday(day)}</small></strong>
        <span>${dayMeals.length ? `${dayMeals.length}식` : '일정 없음'}</span>
      </div>
      ${dayMeals.length ? `<div class="meal-overview-list">${dayMeals.map(mealOverviewRow).join('')}</div>` : `<div class="meal-overview-empty">등록된 식단이 없어.</div>`}
    </section>`;
  }).join('');

  mealList.dataset.mealAllView = '1';
  mealList.innerHTML = summary + schedule;
}

function queueAllSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    ensureAllTab();
    if (allActive) renderAllMeals();
  });
}

mealList?.addEventListener('click', event => {
  const toggle = event.target.closest('.meal-inline-toggle');
  if (toggle) {
    requestAnimationFrame(() => centerFocusedInput(toggle));
    return;
  }

  const overview = event.target.closest('[data-open-meal-date]');
  if (!overview) return;
  const date = overview.dataset.openMealDate;
  allActive = false;
  localStorage.setItem('camp:mealScope', 'date');
  const targetTab = dateTabs?.querySelector(`[data-date="${date}"]`);
  targetTab?.click();
});

dateTabs?.addEventListener('click', event => {
  const dateButton = event.target.closest('[data-date]');
  if (!dateButton) return;
  allActive = false;
  localStorage.setItem('camp:mealScope', 'date');
});

if (dateTabs) {
  new MutationObserver(queueAllSync).observe(dateTabs, { childList:true });
}

dataAdapter.subscribe(data => {
  latestData = data;
  queueAllSync();
});

const style = document.createElement('style');
style.textContent = `
  .meal-total-summary { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 0 12px; padding:13px 15px; border:1px solid var(--line); border-radius:16px; background:var(--paper); font-size:12px; }
  .meal-total-summary span { font-weight:850; }
  .meal-total-summary strong { font-size:12px; }
  .meal-overview-day { display:grid; gap:8px; min-width:0; }
  .meal-overview-day + .meal-overview-day { margin-top:14px; }
  .meal-overview-day-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 3px; }
  .meal-overview-day-head strong { font-size:15px; }
  .meal-overview-day-head small { margin-left:3px; font-size:10px; font-weight:800; opacity:.62; }
  .meal-overview-day-head > span { font-size:10px; color:var(--muted); }
  .meal-overview-list { display:grid; gap:7px; }
  .meal-overview-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; width:100%; min-width:0; padding:12px 13px; border:1px solid var(--line); border-radius:16px; background:var(--paper); text-align:left; }
  .meal-overview-main { display:grid; gap:3px; min-width:0; }
  .meal-overview-type { font-size:10px; font-weight:900; color:var(--accent); }
  .meal-overview-main strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:15px; }
  .meal-overview-meta { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10px; color:var(--muted); }
  .meal-overview-progress { display:grid; justify-items:end; gap:2px; white-space:nowrap; font-size:9px; color:var(--muted); }
  .meal-overview-progress b { font-size:12px; color:var(--ink); }
  .meal-overview-empty { padding:16px 13px; border:1px dashed var(--line); border-radius:15px; color:var(--muted); font-size:11px; text-align:center; }

  .home-theme #view-meals .meal-total-summary,
  .home-theme #view-meals .meal-overview-row { border-color:rgba(216,160,113,.14); background:rgba(20,24,22,.86); color:#ead9c4; }
  .home-theme #view-meals .meal-total-summary strong { color:#dca77b; }
  .home-theme #view-meals .meal-overview-day-head strong { color:#ead9c4; }
  .home-theme #view-meals .meal-overview-day-head > span,
  .home-theme #view-meals .meal-overview-meta,
  .home-theme #view-meals .meal-overview-progress { color:rgba(234,217,196,.46); }
  .home-theme #view-meals .meal-overview-type { color:#c9895d; }
  .home-theme #view-meals .meal-overview-progress b { color:#dca77b; }
  .home-theme #view-meals .meal-overview-empty { border-color:rgba(216,160,113,.14); background:rgba(23,24,21,.45); color:rgba(234,217,196,.42); }
`;
document.head.appendChild(style);
