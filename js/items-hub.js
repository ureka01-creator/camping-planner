import { dataAdapter } from './firebase.js?v=064';
import { esc, toast } from './ui.js';

const view = document.getElementById('view-items');
const itemList = document.getElementById('itemList');
const itemFilters = document.getElementById('itemFilters');
const assigneeFilters = document.getElementById('assigneeFilters');
const modalContent = document.getElementById('modalContent');

const fixedCategories = ['주류','식재료','조리','텐트','침구','놀이','기타'];
let latestData = null;
let categoryFilter = 'all';
let syncQueued = false;

function memberName(id) {
  return latestData?.members?.find(member => member.id === id)?.name || '공용';
}

function currentStatusFilter() {
  return itemFilters?.querySelector('.chip.active')?.dataset.filter || 'all';
}

function currentAssigneeFilter() {
  return assigneeFilters?.querySelector('.chip.active')?.dataset.assigneeFilter || '';
}

function myMemberId() {
  const myName = localStorage.getItem('camp:myName') || '';
  return latestData?.members?.find(member => member.name === myName)?.id || '';
}

function allMealPrepItems() {
  return (latestData?.meals || []).flatMap(meal =>
    (Array.isArray(meal.items) ? meal.items : []).map(item => ({
      ...item,
      mealId: meal.id,
      mealMenu: meal.menu || '메뉴 미정',
      mealDate: meal.date || '',
      mealType: meal.mealType || ''
    }))
  );
}

function combinedItems() {
  return [...(latestData?.items || []), ...allMealPrepItems()];
}

function ensureHubUi() {
  if (!view || !itemList) return;

  if (!document.getElementById('itemCategoryFilters')) {
    const category = document.createElement('div');
    category.className = 'item-category-block';
    category.innerHTML = '<div class="items-subtitle">카테고리</div><div id="itemCategoryFilters" class="chips item-category-chips"></div>';
    assigneeFilters?.insertAdjacentElement('afterend', category);
  }

  if (!document.getElementById('itemsMemberProgress')) {
    const progress = document.createElement('section');
    progress.id = 'itemsMemberProgress';
    progress.className = 'items-member-progress';
    document.getElementById('itemCategoryFilters')?.closest('.item-category-block')?.insertAdjacentElement('afterend', progress);
  }

  if (!document.getElementById('generalPackingHeading')) {
    const heading = document.createElement('div');
    heading.id = 'generalPackingHeading';
    heading.className = 'items-section-head';
    heading.innerHTML = '<div><span>PACKING</span><strong>공용 준비물</strong></div><small id="generalPackingCount"></small>';
    itemList.insertAdjacentElement('beforebegin', heading);
  }

  if (!document.getElementById('itemCategoryEmpty')) {
    const empty = document.createElement('div');
    empty.id = 'itemCategoryEmpty';
    empty.className = 'empty-state item-category-empty';
    empty.textContent = '이 카테고리에 준비물이 없어.';
    empty.hidden = true;
    itemList.insertAdjacentElement('afterend', empty);
  }

  if (!document.getElementById('mealPrepHub')) {
    const section = document.createElement('section');
    section.id = 'mealPrepHub';
    section.className = 'meal-prep-hub';
    section.innerHTML = '<div class="items-section-head"><div><span>MEAL PREP</span><strong>식단 준비</strong></div><small id="mealPrepCount"></small></div><div id="mealPrepList" class="item-list meal-prep-list"></div>';
    document.getElementById('itemCategoryEmpty')?.insertAdjacentElement('afterend', section);
  }
}

function renderCategoryFilters() {
  const host = document.getElementById('itemCategoryFilters');
  if (!host || !latestData) return;
  const known = new Set(fixedCategories);
  (latestData.items || []).forEach(item => known.add(item.category || '기타'));
  const categories = [...fixedCategories, ...[...known].filter(value => !fixedCategories.includes(value))];
  const countFor = category => (latestData.items || []).filter(item => (item.category || '기타') === category).length;
  host.innerHTML = [
    `<button type="button" class="chip ${categoryFilter === 'all' ? 'active' : ''}" data-item-category="all">전체</button>`,
    ...categories.map(category => `<button type="button" class="chip ${categoryFilter === category ? 'active' : ''}" data-item-category="${esc(category)}">${esc(category)}<small>${countFor(category)}</small></button>`)
  ].join('');
}

function applyGeneralCategoryFilter() {
  if (!itemList) return;
  const cards = [...itemList.querySelectorAll(':scope > .packing-item')];
  let visible = 0;
  cards.forEach(card => {
    const category = card.querySelector('.item-meta span')?.textContent?.trim() || '기타';
    const show = categoryFilter === 'all' || category === categoryFilter;
    card.hidden = !show;
    if (show) visible += 1;
  });

  const empty = document.getElementById('itemCategoryEmpty');
  if (empty) empty.hidden = !(cards.length > 0 && visible === 0);
  const count = document.getElementById('generalPackingCount');
  if (count) count.textContent = `${visible}개`;
}

function filteredMealPrepItems() {
  let list = allMealPrepItems();
  const status = currentStatusFilter();
  const assignee = currentAssigneeFilter();
  const mine = myMemberId();

  if (status === 'todo') list = list.filter(item => !item.isDone);
  if (status === 'mine') list = mine ? list.filter(item => item.assigneeId === mine) : [];
  if (assignee) list = list.filter(item => item.assigneeId === assignee);
  if (categoryFilter !== 'all') list = [];

  return list.sort((a, b) =>
    Number(a.isDone) - Number(b.isDone) ||
    String(a.mealDate).localeCompare(String(b.mealDate)) ||
    String(a.name).localeCompare(String(b.name), 'ko')
  );
}

function mealPrepCard(item) {
  const meta = [
    item.mealDate ? item.mealDate.slice(5).replace('-', '/') : '',
    item.mealMenu,
    item.quantity || '수량 미정',
    memberName(item.assigneeId)
  ].filter(Boolean);
  return `<article class="packing-item meal-prep-item ${item.isDone ? 'done' : ''}" data-meal-prep="${item.mealId}:${item.id}">
    <button type="button" class="check-btn" data-toggle-meal-prep="${item.mealId}:${item.id}" aria-label="${esc(item.name)} 완료 토글">${item.isDone ? '✓' : ''}</button>
    <div class="meal-prep-main"><div class="item-name">${esc(item.name)}</div><div class="item-meta">${meta.map((value, index) => `${index ? '<span>·</span>' : ''}<span>${esc(value)}</span>`).join('')}</div></div>
    <span class="meal-prep-source">식단</span>
  </article>`;
}

function renderMealPrep() {
  const host = document.getElementById('mealPrepList');
  const count = document.getElementById('mealPrepCount');
  if (!host) return;
  const list = filteredMealPrepItems();
  if (count) count.textContent = categoryFilter === 'all' ? `${list.length}개` : '카테고리 전체에서 표시';
  host.innerHTML = list.length
    ? list.map(mealPrepCard).join('')
    : `<div class="empty-state">${categoryFilter === 'all' ? '조건에 맞는 식단 준비항목이 없어.' : '식단 준비는 카테고리 전체에서 보여.'}</div>`;
}

function renderMemberProgress() {
  const host = document.getElementById('itemsMemberProgress');
  if (!host || !latestData) return;
  const all = combinedItems();
  host.innerHTML = `<div class="items-section-head"><div><span>TEAM</span><strong>담당자별 전체 준비율</strong></div></div><div class="items-member-grid">${(latestData.members || []).map(member => {
    const mine = all.filter(item => item.assigneeId === member.id);
    const done = mine.filter(item => item.isDone).length;
    const pct = mine.length ? Math.round(done / mine.length * 100) : 0;
    return `<div class="items-member-card"><div><strong>${esc(member.name)}</strong><b>${pct}%</b></div><div class="small-track"><span style="width:${pct}%"></span></div><small>${mine.length ? `${done}/${mine.length}개 완료` : '담당 항목 없음'}</small></div>`;
  }).join('')}</div>`;
}

function renderCombinedSummary() {
  if (!latestData) return;
  const all = combinedItems();
  const done = all.filter(item => item.isDone).length;
  const pct = all.length ? Math.round(done / all.length * 100) : 0;
  const summary = document.getElementById('itemSummary');
  const percent = document.getElementById('itemPercent');
  if (summary) summary.textContent = `전체 ${all.length}개 중 ${done}개 준비`;
  if (percent) percent.textContent = `${pct}%`;
}

function ensureLiquorOption() {
  const select = modalContent?.querySelector('#itemForm select[name="category"]');
  if (!select || [...select.options].some(option => option.value === '주류' || option.textContent === '주류')) return;
  const option = document.createElement('option');
  option.value = '주류';
  option.textContent = '주류';
  const other = [...select.options].find(entry => entry.value === '기타' || entry.textContent === '기타');
  select.insertBefore(option, other || null);
}

function renderHub() {
  syncQueued = false;
  if (!latestData) return;
  ensureHubUi();
  renderCategoryFilters();
  applyGeneralCategoryFilter();
  renderCombinedSummary();
  renderMemberProgress();
  renderMealPrep();
  ensureLiquorOption();
}

function queueRender() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(renderHub);
}

document.addEventListener('click', event => {
  const category = event.target instanceof Element ? event.target.closest('[data-item-category]') : null;
  if (category) {
    categoryFilter = category.dataset.itemCategory || 'all';
    renderHub();
    return;
  }

  const toggle = event.target instanceof Element ? event.target.closest('[data-toggle-meal-prep]') : null;
  if (toggle) {
    event.preventDefault();
    const [mealId, itemId] = toggle.dataset.toggleMealPrep.split(':');
    toggle.disabled = true;
    dataAdapter.mutate(data => {
      const meal = (data.meals || []).find(entry => entry.id === mealId);
      const item = meal?.items?.find(entry => entry.id === itemId);
      if (item) item.isDone = !item.isDone;
    }).catch(error => {
      console.error(error);
      toast('저장에 실패했어.');
      toggle.disabled = false;
    });
    return;
  }

  if (event.target instanceof Element && event.target.closest('#itemFilters .chip, #assigneeFilters .chip, [data-nav="items"], [data-go="items"], #addItemBtn, [data-edit-item]')) {
    setTimeout(queueRender, 0);
  }
}, true);

if (itemList) new MutationObserver(() => queueMicrotask(applyGeneralCategoryFilter)).observe(itemList, { childList:true });
if (modalContent) new MutationObserver(ensureLiquorOption).observe(modalContent, { childList:true, subtree:true });

dataAdapter.subscribe(data => {
  latestData = data;
  queueRender();
});

const style = document.createElement('style');
style.textContent = `
  .item-category-block { margin:12px 0 16px; }
  .items-subtitle { margin:0 0 8px 3px; font-size:11px; font-weight:850; letter-spacing:.04em; color:rgba(234,217,196,.52); }
  .item-category-chips { gap:7px; overflow-x:auto; flex-wrap:nowrap; padding-bottom:3px; scrollbar-width:none; }
  .item-category-chips::-webkit-scrollbar { display:none; }
  .item-category-chips .chip { flex:0 0 auto; display:inline-flex; align-items:center; gap:5px; }
  .item-category-chips .chip small { font-size:9px; opacity:.55; }
  .items-section-head { display:flex; align-items:end; justify-content:space-between; gap:12px; margin:18px 2px 9px; }
  .items-section-head > div { display:grid; gap:2px; }
  .items-section-head span { font-size:9px; font-weight:900; letter-spacing:.18em; color:#c9895d; }
  .items-section-head strong { color:#ead9c4; font-size:15px; }
  .items-section-head small { color:rgba(234,217,196,.44); font-size:10px; }
  .items-member-progress { margin:6px 0 2px; }
  .items-member-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .items-member-card { min-width:0; padding:12px; border:1px solid rgba(216,160,113,.14); border-radius:15px; background:rgba(20,24,22,.78); }
  .items-member-card > div:first-child { display:flex; justify-content:space-between; gap:8px; align-items:center; }
  .items-member-card strong { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; color:#ead9c4; }
  .items-member-card b { font-size:11px; color:#dca77b; }
  .items-member-card small { display:block; margin-top:6px; font-size:9px; color:rgba(234,217,196,.42); }
  .items-member-card .small-track { margin-top:8px; }
  .item-category-empty { margin-top:8px; }
  .meal-prep-hub { margin-top:22px; padding-bottom:8px; }
  .meal-prep-list { display:grid; gap:8px; }
  .meal-prep-item { grid-template-columns:auto minmax(0,1fr) auto; }
  .meal-prep-main { min-width:0; }
  .meal-prep-source { align-self:center; padding:5px 7px; border:1px solid rgba(216,160,113,.18); border-radius:999px; color:#c9895d; font-size:9px; font-weight:850; }
  @media (max-width:370px) { .items-member-grid { grid-template-columns:1fr; } }
`;
document.head.appendChild(style);
