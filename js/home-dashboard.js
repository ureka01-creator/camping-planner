import { dataAdapter } from './firebase.js?v=064';
import { esc } from './ui.js';

const mealLabels = { breakfast:'아침', lunch:'점심', dinner:'저녁', snack:'간식' };
const mealOrder = { breakfast:1, lunch:2, dinner:3, snack:4 };
const weekdayLabels = ['일','월','화','수','목','금','토'];
let latestData = null;

function formatShortDate(iso='') {
  const [,m,d] = iso.split('-').map(Number);
  return m && d ? `${m}/${d}` : '';
}

function weekdayText(iso='') {
  const [y,m,d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return weekdayLabels[new Date(Date.UTC(y,m-1,d)).getUTCDay()] || '';
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
  const percentText = `${progress.pct}%`;
  const captionText = progress.total
    ? `전체 준비 ${progress.total}개 중 ${progress.done}개 완료`
    : '준비 항목을 추가해봐.';

  if (percent && percent.textContent !== percentText) percent.textContent = percentText;
  if (bar && bar.style.width !== percentText) bar.style.width = percentText;
  if (ring && ring.style.getPropertyValue('--progress') !== `${progress.pct * 3.6}deg`) {
    ring.style.setProperty('--progress', `${progress.pct * 3.6}deg`);
  }
  if (caption && caption.textContent !== captionText) caption.textContent = captionText;

  const host = document.getElementById('memberProgress');
  if (!host) return;
  const html = (latestData.members || []).map(member => {
    const mine = all.filter(item => item?.assigneeId === member.id);
    const p = progressOfItems(mine);
    return `<div class="member-row" data-home-member-progress="${esc(member.id)}"><div class="member-row-top"><span>${esc(member.name)}</span><span>${p.pct}%</span></div><div class="small-track"><span style="width:${p.pct}%"></span></div><div class="tiny">${p.total ? `${p.done}/${p.total}개 준비` : '담당 항목 없음'}</div></div>`;
  }).join('') || '<div class="empty-state">참여자를 추가해봐.</div>';
  if (!host.querySelector('[data-home-member-progress]') || host.dataset.homeCombinedHtml !== html) {
    host.innerHTML = html;
    host.dataset.homeCombinedHtml = html;
  }
}

function mealPrepStatus(meal) {
  const items = mealItems(meal);
  if (!items.length) return '준비 항목 없음';
  const left = items.filter(item => item?.isDone !== true).length;
  return left ? `${left}개 남음` : '준비 완료';
}

function renderFoodStage(meal, roundLabel) {
  if (!meal) return '';
  const note = String(meal.note || '').trim();
  return `
    <button type="button" class="home-food-stage" data-food-date="${esc(meal.date || '')}">
      <div class="home-food-stage-mark">
        <span>${esc(roundLabel)}</span>
        <small>${esc(mealLabels[meal.mealType] || '식사')}</small>
      </div>
      <div class="home-food-stage-copy">
        <strong>${esc(meal.menu || '메뉴 미정')}</strong>
        ${note ? `<p>${esc(note)}</p>` : ''}
        <small>${esc(memberName(meal.assigneeId))} · ${esc(mealPrepStatus(meal))}</small>
      </div>
      <span class="home-food-stage-arrow" aria-hidden="true">›</span>
    </button>`;
}

function renderNextPreview(meal) {
  if (!meal) return '';
  return `
    <button type="button" class="home-food-next" data-food-date="${esc(meal.date || '')}">
      <span>다음 식사 · ${esc(formatShortDate(meal.date))} ${esc(weekdayText(meal.date))} · ${esc(mealLabels[meal.mealType] || '식사')}</span>
      <div><strong>${esc(meal.menu || '메뉴 미정')}</strong><b aria-hidden="true">→</b></div>
    </button>`;
}

function renderFoodHeader() {
  const card = document.getElementById('nextMealCard');
  const section = card?.closest('.home-section');
  const head = section?.querySelector('.section-head');
  if (!head) return;
  head.innerHTML = `
    <div class="home-food-heading">
      <h2>식사 일정</h2>
    </div>
    <button class="text-btn" data-go="meals">전체보기</button>`;
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

  renderFoodHeader();
  card.classList.remove('empty-card');

  const sameDayMeals = meals.filter(meal => meal.date === first.date).slice(0, 2);
  const nextDayMeal = meals.find(meal => meal.date > first.date) || null;
  const dayLabel = `${formatShortDate(first.date)} ${weekdayText(first.date)}`;
  const html = `
    <div class="home-food-plan">
      <div class="home-food-day">${esc(dayLabel)}</div>
      <div class="home-food-rounds">
        ${sameDayMeals.map((meal, index) => renderFoodStage(meal, `${index + 1}차`)).join('<div class="home-food-divider"></div>')}
      </div>
      ${renderNextPreview(nextDayMeal)}
    </div>`;

  if (!card.querySelector('.home-food-plan') || card.dataset.homeMealHtml !== html) {
    card.innerHTML = html;
    card.dataset.homeMealHtml = html;
  }
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

function openMealDate(date) {
  if (!date) return;
  localStorage.setItem('camp:selectedDate', date);
  document.querySelector('[data-nav="meals"]')?.click();
  setTimeout(() => {
    const tab = document.querySelector(`#dateTabs [data-date="${CSS.escape(date)}"]`);
    if (tab instanceof HTMLElement) tab.click();
  }, 80);
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
    if (!nextMealCard.querySelector('.home-food-plan')) queueMicrotask(renderNextMeals);
  }).observe(nextMealCard, { childList:true, subtree:true, characterData:true });
}

const prepHero = document.querySelector('#view-home .hero-card');
const memberProgress = document.getElementById('memberProgress');
const keepCombinedPrep = () => {
  if (!latestData) return;
  const captionOk = document.getElementById('progressCaption')?.textContent.startsWith('전체 준비 ') || false;
  const memberOk = memberProgress?.querySelector('[data-home-member-progress]') || false;
  if (!captionOk || !memberOk) queueMicrotask(renderCombinedPrep);
};
if (prepHero) new MutationObserver(keepCombinedPrep).observe(prepHero, { childList:true, subtree:true, characterData:true });
if (memberProgress) new MutationObserver(keepCombinedPrep).observe(memberProgress, { childList:true, subtree:true, characterData:true });

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;

  const foodTarget = event.target.closest('[data-food-date]');
  if (foodTarget) {
    openMealDate(foodTarget.dataset.foodDate || '');
    return;
  }

  const target = event.target.closest('[data-nav], [data-go], [data-first-entry-member], [data-first-entry-later], [data-toggle-item], [data-toggle-meal-prep], [data-toggle-meal-item]');
  if (target) setTimeout(apply, 0);
}, true);
