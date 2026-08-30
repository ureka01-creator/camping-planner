import { dataAdapter } from './firebase.js';

const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');
const progressRing = document.getElementById('progressRing');
const progressCaption = document.getElementById('progressCaption');

let latestData = null;
let applying = false;

function mealDone(meal) {
  const items = Array.isArray(meal?.items) ? meal.items : [];
  return items.length > 0 && items.every(item => item?.isDone === true);
}

function applyMealProgress() {
  if (!latestData || !progressPercent || applying) return;

  const meals = Array.isArray(latestData.meals) ? latestData.meals : [];
  const total = meals.length;
  const done = meals.filter(mealDone).length;
  const pct = total ? Math.round(done / total * 100) : 0;

  applying = true;
  progressPercent.textContent = `${pct}%`;
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (progressRing) progressRing.style.setProperty('--progress', `${pct * 3.6}deg`);
  if (progressCaption) {
    progressCaption.textContent = total
      ? `전체 식단 ${total}개 중 ${done}개 준비 완료`
      : '식단을 추가해봐.';
  }
  applying = false;
}

dataAdapter.subscribe(data => {
  latestData = data;
  queueMicrotask(applyMealProgress);
});

// app.js가 탭 전환/렌더링 때 기존 준비항목 비율을 다시 그려도
// 홈의 최종 기준은 항상 '완료된 식단 수 / 전체 식단 수'로 유지한다.
if (progressPercent) {
  new MutationObserver(() => {
    if (!applying) queueMicrotask(applyMealProgress);
  }).observe(progressPercent, { childList: true, characterData: true, subtree: true });
}
