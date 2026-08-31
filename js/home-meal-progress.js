import { dataAdapter } from './firebase.js?v=064';

const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');
const progressRing = document.getElementById('progressRing');
const progressCaption = document.getElementById('progressCaption');

let latestData = null;

function mealDone(meal) {
  const items = Array.isArray(meal?.items) ? meal.items : [];
  return items.length > 0 && items.every(item => item?.isDone === true);
}

function applyMealProgress() {
  if (!latestData || !progressPercent) return;

  const meals = Array.isArray(latestData.meals) ? latestData.meals : [];
  const total = meals.length;
  const done = meals.filter(mealDone).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const pctText = `${pct}%`;
  const captionText = total
    ? `전체 식단 ${total}개 중 ${done}개 준비 완료`
    : '식단을 추가해봐.';

  if (progressPercent.textContent !== pctText) progressPercent.textContent = pctText;
  if (progressBar && progressBar.style.width !== pctText) progressBar.style.width = pctText;
  if (progressRing) {
    const degrees = `${pct * 3.6}deg`;
    if (progressRing.style.getPropertyValue('--progress') !== degrees) {
      progressRing.style.setProperty('--progress', degrees);
    }
  }
  if (progressCaption && progressCaption.textContent !== captionText) {
    progressCaption.textContent = captionText;
  }
}

dataAdapter.subscribe(data => {
  latestData = data;
  queueMicrotask(applyMealProgress);
});

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('[data-nav], [data-go]') : null;
  if (target) queueMicrotask(applyMealProgress);
});
