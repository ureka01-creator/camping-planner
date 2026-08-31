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

function allPrepItems() {
  const packing = Array.isArray(latestData?.items) ? latestData.items : [];
  const mealPrep = (latestData?.meals || []).flatMap(meal => mealItems(meal));
  return [...packing, ...mealPrep];
}

function progressOfItems(items=[]) {
  const total = items.length;
  const done = items.filter(item => item?.isDone === true).length;
  return { total, done, pct: total ? Math.round(done / total * 100) : 0 };
}

function progressOfMeal(meal) {
  return progressOfItems(mealItems(meal));
}

function sortedMeals() {
  return [...(latestData?.meals || [])].sort((a,b) =>
    String(a.date || '').localeCompare(String(b.date || '')) ||
    (mealOrder[a.mealType] || 99) - (mealOrder[b.mealType] || 99)
  );
}

function renderCombinedPrep() {
  if (!latestData) return;
  const all = allPrepItems();
  const progress = progressOfItems(all);

  const percent = document.getElementById('progressPercent');
  const bar = document.getElementById('progressBar');
  const ring = document.getElementById('progressRing');
  const caption = document.getElementById('progressCaption');
  if (percent) percent.textContent = `${progress.pct}%`;
  if (bar) bar.style.width = `${progress.pct}%`;
  if (ring) ring.style.setProperty('--progress', `${progress.pct * 3.6}deg`);
  if (caption) caption.textContent = progress.total
    ? `전체 준비 ${progress.total}개 중 ${progress.done}개 완료`
    : '준비 항목을 추가해봐.';

  const host = document.getElementById('memberProgress');
  if (!host) return;
  host.innerHTML = (latestData.members || []).map(member => {
    const mine = all.filter(item => item?.assigneeId === member.id);
    const p = progressOfItems(mine);
    return `<div class="member-row" data-home-member-progress="${esc(member.id)}"><div class="member-row-top"><span>${esc(member.name)}</span><span>${p.pct}%</span></div><div class="small-track"><span style="width:${p.pct}%"></span></div><div class="tiny">${p.total ? `${p.done}/${p.total}개 준비` : '담당 항목 없음'}</div></div>`;
  }).join('') || '<div class="empty-state">참여자를 추가해봐.</div>';
}

function renderMealStage(meal, label) {
  if (!meal) return '';
  const progress = progressOfMeal(meal);
  const note = String(meal.note || '').trim();
  const prepText = progress.total ? `준비 ${progress.done}/${progress.total}` : '준비 항목 없음';

  return `
    <div class="home-meal-stage">
      <div class="home-meal-stage-top">
        <span class="home-meal-stage-label">${esc(label)}</span>
        <span class="home-meal-stage-time">${esc(formatShortDate(meal.date))} · ${esc(mealLabels[meal.mealType] || '식사')}</span>
      </div>
      <strong class="home-meal-menu">${esc(meal.menu || '메뉴 미정')}</strong>
      ${note ? `<p class="home-meal-note">${esc(note)}</p>` : ''}
      <div class="home-meal-stage-footer">
        <span>담당 ${esc(memberName(meal.assigneeId))}</span>
        <b>${prepText}</b>
      </div>
    </div>`;
}

function renderNextMeals() {
  const card = document.getElementById('nextMealCard');
  if (!card || !latestData) return;

  const meals = sortedMeals();
  const first = meals[0];
  if (!first) {
    const emptyText = '아직 식단이 없어.';
    if (card.textContent.trim() !== emptyText || !card.classList.contains('empty-card')) {
      card.classList.add('empty-card');
      card.textContent = emptyText;
    }
    return;
  }

  card.classList.remove('empty-card');
  const sameDayNext = meals.slice(1).find(meal => meal.date === first.date) || null;
  const secondary = sameDayNext || meals[1] || null;
  const secondaryLabel = sameDayNext ? '2차' : secondary ? '다음 일정' : '';

  card.innerHTML = `
    <div class="home-meal-flow">
      ${renderMealStage(first, '1차')}
      ${secondary ? `<div class="home-meal-divider"></div>${renderMealStage(secondary, secondaryLabel)}` : ''}
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
  renderCombinedPrep();
  renderNextMeals();
}

dataAdapter.subscribe(data => {
  latestData = data;
  queueMicrotask(apply);
});

const nextMealCard = document.getElementById('nextMealCard');
if (nextMealCard) {
  new MutationObserver(() => {
    if (!latestData || !sortedMeals().length) return;
    if (!nextMealCard.querySelector('.home-meal-flow')) queueMicrotask(renderNextMeals);
  }).observe(nextMealCard, { childList:true, subtree:true, characterData:true });
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('[data-nav], [data-go], [data-first-entry-member], [data-first-entry-later], [data-toggle-item], [data-toggle-meal-prep], [data-toggle-meal-item]') : null;
  if (target) setTimeout(apply, 0);
}, true);
