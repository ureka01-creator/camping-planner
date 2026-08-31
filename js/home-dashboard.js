import { dataAdapter } from './firebase.js?v=064';
import { esc } from './ui.js';

const mealLabels = { breakfast:'아침', lunch:'점심', dinner:'저녁', snack:'간식' };
const mealOrder = { breakfast:1, lunch:2, dinner:3, snack:4 };
let latestData = null;

function formatShortDate(iso='') {
  const [,m,d] = iso.split('-').map(Number);
  return m && d ? `${m}/${d}` : '';
}

function memberName(id) {
  return latestData?.members?.find(member => member.id === id)?.name || '공용';
}

function mealItems(meal) {
  return Array.isArray(meal?.items) ? meal.items : [];
}

function progressOf(meal) {
  const items = mealItems(meal);
  const total = items.length;
  const done = items.filter(item => item?.isDone === true).length;
  return { total, done, pct: total ? Math.round(done / total * 100) : 100 };
}

function sortedMeals() {
  return [...(latestData?.meals || [])].sort((a,b) =>
    String(a.date || '').localeCompare(String(b.date || '')) ||
    (mealOrder[a.mealType] || 99) - (mealOrder[b.mealType] || 99)
  );
}

function compactPrepNames(meal) {
  return mealItems(meal)
    .filter(item => !item?.isDone)
    .slice(0, 3)
    .map(item => item?.name)
    .filter(Boolean);
}

function renderMealLine(meal, label) {
  if (!meal) return '';
  const progress = progressOf(meal);
  const todoNames = compactPrepNames(meal);
  const prepText = progress.total
    ? `${progress.done}/${progress.total} 준비 · ${progress.pct}%`
    : '준비 항목 없음';
  const note = String(meal.note || '').trim();
  const detail = todoNames.length
    ? `남은 준비 · ${todoNames.map(esc).join(' · ')}`
    : note
      ? esc(note)
      : '준비 완료';

  return `
    <div class="home-meal-stage">
      <div class="home-meal-stage-top">
        <span class="home-meal-stage-label">${esc(label)}</span>
        <span class="home-meal-stage-time">${esc(formatShortDate(meal.date))} · ${esc(mealLabels[meal.mealType] || '식사')}</span>
      </div>
      <div class="home-meal-stage-main">
        <strong>${esc(meal.menu || '메뉴 미정')}</strong>
        <span>담당 ${esc(memberName(meal.assigneeId))}</span>
      </div>
      <div class="home-meal-stage-meta">
        <span>${prepText}</span>
        <small>${detail}</small>
      </div>
    </div>`;
}

function renderNextMeals() {
  const card = document.getElementById('nextMealCard');
  if (!card || !latestData) return;

  const meals = sortedMeals();
  const first = meals[0];
  if (!first) {
    card.classList.add('empty-card');
    card.innerHTML = '아직 식단이 없어.';
    return;
  }

  card.classList.remove('empty-card');
  const sameDayNext = meals.slice(1).find(meal => meal.date === first.date) || null;
  const secondary = sameDayNext || meals[1] || null;
  const secondaryLabel = sameDayNext ? '2차' : secondary ? '다음 일정' : '';

  card.innerHTML = `
    <div class="home-meal-flow">
      ${renderMealLine(first, '1차')}
      ${secondary ? `<div class="home-meal-connector"><span></span><b>→</b><span></span></div>${renderMealLine(secondary, secondaryLabel)}` : ''}
    </div>`;
}

function arrangeHome() {
  const home = document.getElementById('view-home');
  if (!home) return;

  const todoSection = document.getElementById('homeTodo')?.closest('.home-section');
  todoSection?.classList.add('home-todo-hidden');

  const memberSection = document.getElementById('memberProgress')?.closest('.home-section');
  const mealSection = document.getElementById('nextMealCard')?.closest('.home-section');
  const myPrep = document.getElementById('myPrepQuickCard');
  const anchor = myPrep || home.querySelector('.hero-card');
  if (!memberSection || !mealSection || !anchor) return;

  if (anchor.nextElementSibling !== memberSection) {
    anchor.insertAdjacentElement('afterend', memberSection);
  }
  if (memberSection.nextElementSibling !== mealSection) {
    memberSection.insertAdjacentElement('afterend', mealSection);
  }

  memberSection.classList.add('home-prep-member-section');
  mealSection.classList.add('home-meal-section');
}

function apply() {
  arrangeHome();
  renderNextMeals();
}

dataAdapter.subscribe(data => {
  latestData = data;
  queueMicrotask(apply);
});

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('[data-nav], [data-go], [data-first-entry-member], [data-first-entry-later]') : null;
  if (target) setTimeout(apply, 0);
}, true);
