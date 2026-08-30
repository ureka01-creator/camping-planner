import { dataAdapter } from './firebase.js';
import { toast, openModal, closeModal, esc, uid } from './ui.js';

let data=null;
const mealLabels={breakfast:'아침',lunch:'점심',dinner:'저녁',snack:'간식'};
const mealOrder={breakfast:1,lunch:2,dinner:3,snack:4};
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function memberName(id){ return data?.members.find(m=>m.id===id)?.name || '공용'; }
function mealItems(meal){ return Array.isArray(meal?.items)?meal.items:[]; }
function formatShortDate(iso){ const [,m,d]=iso.split('-').map(Number); return `${m}/${d}`; }
function progressOf(items){
  const total=items.length;
  const done=items.filter(i=>i.isDone).length;
  return {total,done,pct:total?Math.round(done/total*100):0};
}
function numberValue(value){
  const n=Number(String(value??'').replace(/[^0-9.-]/g,''));
  return Number.isFinite(n)&&n>0?Math.round(n):0;
}
function moneyText(value){
  const n=numberValue(value);
  return n?`${n.toLocaleString('ko-KR')}원`:'';
}
function memberOptions(selected=''){
  return `<option value="">공용 / 미정</option>`+(data?.members||[]).map(m=>`<option value="${m.id}" ${m.id===selected?'selected':''}>${esc(m.name)}</option>`).join('');
}
function allMealItems(){
  if(!data) return [];
  return data.meals.flatMap(meal=>mealItems(meal).map(item=>({
    ...item,
    mealId:meal.id,
    mealMenu:meal.menu,
    mealDate:meal.date,
    mealType:meal.mealType
  })));
}

function renderHomeProgress(){
  if(!data || !$('#view-home') || !$('#progressPercent')) return;
  const prepItems=allMealItems();
  const prep=progressOf(prepItems);

  $('#progressPercent').textContent=`${prep.pct}%`;
  $('#progressBar').style.width=`${prep.pct}%`;
  $('#progressRing')?.style.setProperty('--progress',`${prep.pct*3.6}deg`);
  $('#progressCaption').textContent=prep.total?`식단 준비 ${prep.total}개 중 ${prep.done}개 완료`:'식단에 준비 항목을 추가해봐.';

  const memberProgress=$('#memberProgress');
  if(memberProgress){
    memberProgress.innerHTML=data.members.map(m=>{
      const mine=prepItems.filter(i=>i.assigneeId===m.id);
      const p=progressOf(mine);
      return `<div class="member-row"><div class="member-row-top"><span>${esc(m.name)}</span><span>${p.pct}%</span></div><div class="small-track"><span style="width:${p.pct}%"></span></div><div class="tiny">${p.total?`${p.done}/${p.total}개 준비`:'담당 항목 없음'}</div></div>`;
    }).join('') || `<div class="empty-state">참여자를 추가해봐.</div>`;
  }

  const homeTodo=$('#homeTodo');
  if(homeTodo){
    const todo=prepItems.filter(i=>!i.isDone).slice(0,4);
    homeTodo.innerHTML=todo.map(i=>`<div class="mini-item"><span class="dot-status"></span><span><b>${esc(i.name)}</b> · ${esc(i.mealMenu)} · ${esc(memberName(i.assigneeId))}</span></div>`).join('') || `<div class="empty-state">식단 준비 완료! 🎉</div>`;
  }

  const meals=[...data.meals].sort((a,b)=>a.date.localeCompare(b.date)||mealOrder[a.mealType]-mealOrder[b.mealType]);
  const next=meals[0];
  const nextCard=$('#nextMealCard');
  if(next&&nextCard){
    const p=progressOf(mealItems(next));
    nextCard.innerHTML=`<div class="meal-day">${formatShortDate(next.date)} · ${mealLabels[next.mealType]}</div><div class="meal-name">${esc(next.menu)}</div><div class="meal-assignee">식단 담당 ${esc(memberName(next.assigneeId))}</div><div class="meal-feature-progress"><span>${p.total?`${p.done}/${p.total} 준비`:'준비 항목 없음'}</span><strong>${p.pct}%</strong></div>`;
  }
}

function mealDetailHtml(meal){
  const items=mealItems(meal);
  const p=progressOf(items);
  const cost=items.reduce((sum,item)=>sum+numberValue(item.cost),0);
  const list=items.map(item=>{
    const meta=[];
    if(item.quantity) meta.push(esc(item.quantity));
    meta.push(esc(memberName(item.assigneeId)));
    if(numberValue(item.cost)) meta.push(`<span class="meal-detail-cost">${moneyText(item.cost)}</span>`);
    return `<div class="meal-detail-item ${item.isDone?'done':''}">
      <button class="meal-detail-check" data-toggle-meal-item="${meal.id}:${item.id}" aria-label="${esc(item.name)} 준비 완료 토글">${item.isDone?'✓':''}</button>
      <div class="meal-detail-main"><div class="meal-detail-name">${esc(item.name)}</div><div class="meal-detail-meta">${meta.map(v=>`<span>${v}</span>`).join('')}</div></div>
      <button class="meal-detail-actions" data-edit-meal-item="${meal.id}:${item.id}" aria-label="${esc(item.name)} 수정">•••</button>
    </div>`;
  }).join('');

  return `<div class="meal-progress-block" data-meal-detail-block="${meal.id}">
    <div class="meal-progress-head"><span>식단 준비 ${p.done}/${p.total}</span><strong>${p.pct}%</strong></div>
    <div class="meal-detail-track"><span style="width:${p.pct}%"></span></div>
    ${list?`<div class="meal-detail-list">${list}</div>`:`<div class="meal-detail-empty">고기, 채소, 음료처럼<br>이 식단에 필요한 준비 항목을 추가해.</div>`}
    <button class="meal-add-detail" data-add-meal-item="${meal.id}">+ 준비 항목</button>
    ${cost?`<div class="meal-cost-total">현재 입력 금액 합계 ${moneyText(cost)}</div>`:''}
  </div>`;
}

function renderMealDetails(){
  if(!data) return;
  const mealList=$('#mealList');
  if(!mealList) return;
  const selectedDate=localStorage.getItem('camp:selectedDate') || data.trip.startDate;
  const meals=data.meals.filter(m=>m.date===selectedDate).sort((a,b)=>mealOrder[a.mealType]-mealOrder[b.mealType]);
  const cards=$$('#mealList .meal-card');
  cards.forEach((card,index)=>{
    const meal=meals[index];
    if(!meal) return;
    card.querySelector('[data-meal-detail-block]')?.remove();
    card.insertAdjacentHTML('beforeend',mealDetailHtml(meal));
  });
}

function renderEnhancements(){
  renderHomeProgress();
  renderMealDetails();
}

function openMealItemModal(meal,item=null){
  const isEdit=!!item;
  const i=item||{name:'',quantity:'',cost:0,assigneeId:meal.assigneeId||'',note:'',isDone:false};
  openModal(`<div class="modal-title"><div><div class="tiny">${formatShortDate(meal.date)} · ${mealLabels[meal.mealType]} · ${esc(meal.menu)}</div><h3>${isEdit?'준비 항목 수정':'준비 항목 추가'}</h3></div><button class="more-btn" data-close>×</button></div><form id="mealItemForm" class="form-grid"><label>항목<input name="name" value="${esc(i.name)}" placeholder="예: 돼지고기" required></label><div class="form-row-2"><label>수량<input name="quantity" value="${esc(i.quantity||'')}" placeholder="예: 4근"></label><label>금액<div class="cost-input-wrap"><input name="cost" type="number" inputmode="numeric" min="0" step="100" value="${numberValue(i.cost)||''}" placeholder="80000"></div></label></div><label>담당자<select name="assigneeId">${memberOptions(i.assigneeId)}</select></label><label>메모<textarea name="note" placeholder="구매처, 브랜드, 추가 메모 등">${esc(i.note||'')}</textarea></label><div class="modal-actions"><button type="button" class="cancel-btn" data-close>취소</button><button class="save-btn">저장</button></div>${isEdit?'<button type="button" id="deleteMealItemBtn" class="delete-btn">준비 항목 삭제</button>':''}</form>`,root=>{
    root.querySelector('#mealItemForm').onsubmit=async e=>{
      e.preventDefault();
      const v=Object.fromEntries(new FormData(e.currentTarget));
      v.cost=numberValue(v.cost);
      await dataAdapter.mutate(store=>{
        const target=store.meals.find(m=>m.id===meal.id);
        if(!target) return;
        if(!Array.isArray(target.items)) target.items=[];
        if(isEdit){
          const targetItem=target.items.find(x=>x.id===item.id);
          if(targetItem) Object.assign(targetItem,v);
        }else{
          target.items.push({id:uid('mealitem'),...v,isDone:false});
        }
      });
      closeModal();
      toast('준비 항목 저장 완료');
    };
    root.querySelector('#deleteMealItemBtn')?.addEventListener('click',async()=>{
      if(!confirm('이 준비 항목을 삭제할까?')) return;
      await dataAdapter.mutate(store=>{
        const target=store.meals.find(m=>m.id===meal.id);
        if(target&&Array.isArray(target.items)) target.items=target.items.filter(x=>x.id!==item.id);
      });
      closeModal();
    });
  });
}

async function toggleMealItem(mealId,itemId,button){
  button.disabled=true;
  try{
    await dataAdapter.mutate(store=>{
      const meal=store.meals.find(m=>m.id===mealId);
      if(!meal) return;
      if(!Array.isArray(meal.items)) meal.items=[];
      const item=meal.items.find(i=>i.id===itemId);
      if(item) item.isDone=!item.isDone;
    });
  }catch(error){
    console.error(error);
    toast('저장에 실패했어.');
  }finally{
    button.disabled=false;
  }
}

document.addEventListener('click',event=>{
  const add=event.target.closest('[data-add-meal-item]');
  if(add){
    event.preventDefault();
    const meal=data?.meals.find(m=>m.id===add.dataset.addMealItem);
    if(meal) openMealItemModal(meal);
    return;
  }

  const edit=event.target.closest('[data-edit-meal-item]');
  if(edit){
    event.preventDefault();
    const [mealId,itemId]=edit.dataset.editMealItem.split(':');
    const meal=data?.meals.find(m=>m.id===mealId);
    const item=mealItems(meal).find(i=>i.id===itemId);
    if(meal&&item) openMealItemModal(meal,item);
    return;
  }

  const toggle=event.target.closest('[data-toggle-meal-item]');
  if(toggle){
    event.preventDefault();
    const [mealId,itemId]=toggle.dataset.toggleMealItem.split(':');
    toggleMealItem(mealId,itemId,toggle);
    return;
  }

  if(event.target.closest('[data-date]')){
    setTimeout(renderMealDetails,0);
    return;
  }

  if(event.target.closest('[data-nav]') || event.target.closest('[data-go]')){
    setTimeout(renderEnhancements,0);
  }
});

dataAdapter.subscribe(next=>{
  data=next;
  queueMicrotask(renderEnhancements);
});
