import { dataAdapter, DATA_MODE } from './firebase.js';
import { toast, openModal, closeModal, esc, uid } from './ui.js';

const state = {
  data:null,
  view: localStorage.getItem('camp:lastView') || 'home',
  selectedDate: localStorage.getItem('camp:selectedDate') || '2026-09-11',
  itemFilter:'all',
  assigneeFilter:null,
  myName: localStorage.getItem('camp:myName') || ''
};

const mealLabels={breakfast:'아침',lunch:'점심',dinner:'저녁',snack:'간식'};
const mealOrder={breakfast:1,lunch:2,dinner:3,snack:4};
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function memberName(id){ return state.data?.members.find(m=>m.id===id)?.name || '공용'; }
function dateRange(start,end){
  const arr=[];
  const [sy,sm,sd]=start.split('-').map(Number);
  const [ey,em,ed]=end.split('-').map(Number);
  const d=new Date(Date.UTC(sy,sm-1,sd));
  const e=new Date(Date.UTC(ey,em-1,ed));
  while(d<=e){ arr.push(d.toISOString().slice(0,10)); d.setUTCDate(d.getUTCDate()+1); }
  return arr;
}
function formatShortDate(iso){ const [,m,d]=iso.split('-').map(Number); return `${m}/${d}`; }
function tripDateText(){
  const t=state.data.trip; return `${formatShortDate(t.startDate)} — ${formatShortDate(t.endDate)}`;
}

function setView(view){
  state.view=view; localStorage.setItem('camp:lastView',view);
  $$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===view));
  $$('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.nav===view));
  window.scrollTo({top:0,behavior:'instant'});
  render();
}

function render(){
  if(!state.data) return;
  const t=state.data.trip;
  $('#tripTitle').textContent=t.title;
  $('#tripDates').textContent=tripDateText();
  $('#tripLocation').textContent=t.location || '장소 미정';
  renderHome(); renderMeals(); renderItems(); renderSettings();
}

function renderHome(){
  const items=state.data.items; const done=items.filter(i=>i.isDone).length; const pct=items.length?Math.round(done/items.length*100):0;
  $('#progressPercent').textContent=`${pct}%`; $('#progressBar').style.width=`${pct}%`; $('#progressCaption').textContent=items.length?`${items.length}개 중 ${done}개 준비 완료`:'준비물을 추가해봐.';

  const meals=[...state.data.meals].sort((a,b)=>a.date.localeCompare(b.date)||mealOrder[a.mealType]-mealOrder[b.mealType]);
  const next=meals[0];
  $('#nextMealCard').innerHTML=next?`<div class="meal-day">${formatShortDate(next.date)} · ${mealLabels[next.mealType]}</div><div class="meal-name">${esc(next.menu)}</div><div class="meal-assignee">담당 ${esc(memberName(next.assigneeId))}</div>`:'아직 식단이 없어.';

  $('#memberProgress').innerHTML=state.data.members.map(m=>{
    const mine=items.filter(i=>i.assigneeId===m.id); const md=mine.filter(i=>i.isDone).length; const mp=mine.length?Math.round(md/mine.length*100):0;
    return `<div class="member-row"><div class="member-row-top"><span>${esc(m.name)}</span><span>${mp}%</span></div><div class="small-track"><span style="width:${mp}%"></span></div></div>`;
  }).join('') || `<div class="empty-state">참여자를 추가해봐.</div>`;

  const todo=items.filter(i=>!i.isDone).slice(0,4);
  $('#homeTodo').innerHTML=todo.map(i=>`<div class="mini-item"><span class="dot-status"></span><span><b>${esc(i.name)}</b> · ${esc(memberName(i.assigneeId))}</span></div>`).join('') || `<div class="empty-state">준비 완료! 🎉</div>`;
}

function renderMeals(){
  const dates=dateRange(state.data.trip.startDate,state.data.trip.endDate);
  if(!dates.includes(state.selectedDate)) state.selectedDate=dates[0];
  $('#dateTabs').innerHTML=dates.map(d=>`<button class="date-tab ${d===state.selectedDate?'active':''}" data-date="${d}">${formatShortDate(d)}</button>`).join('');
  $$('#dateTabs [data-date]').forEach(btn=>btn.onclick=()=>{state.selectedDate=btn.dataset.date;localStorage.setItem('camp:selectedDate',state.selectedDate);renderMeals();});
  const list=state.data.meals.filter(m=>m.date===state.selectedDate).sort((a,b)=>mealOrder[a.mealType]-mealOrder[b.mealType]);
  $('#mealList').innerHTML=list.map(m=>`<article class="meal-card"><div class="meal-card-top"><div><div class="meal-type">${mealLabels[m.mealType]}</div><div class="meal-menu">${esc(m.menu)}</div><span class="badge">${esc(memberName(m.assigneeId))}</span></div><button class="more-btn" data-edit-meal="${m.id}" aria-label="식단 수정">•••</button></div>${m.note?`<p class="meal-note">${esc(m.note)}</p>`:''}</article>`).join('') || `<div class="empty-state">이 날 식단이 아직 없어.<br>위의 + 식단을 눌러 추가해.</div>`;
  $$('[data-edit-meal]').forEach(btn=>btn.onclick=()=>openMealModal(state.data.meals.find(m=>m.id===btn.dataset.editMeal)));
}

function renderItems(){
  const items=state.data.items; const done=items.filter(i=>i.isDone).length; const pct=items.length?Math.round(done/items.length*100):0;
  $('#itemSummary').textContent=`${items.length}개 중 ${done}개 준비`; $('#itemPercent').textContent=`${pct}%`;
  $('#assigneeFilters').innerHTML=state.data.members.map(m=>`<button class="chip ${state.assigneeFilter===m.id?'active':''}" data-assignee-filter="${m.id}">${esc(m.name)}</button>`).join('');
  $$('[data-assignee-filter]').forEach(b=>b.onclick=()=>{state.assigneeFilter=state.assigneeFilter===b.dataset.assigneeFilter?null:b.dataset.assigneeFilter;renderItems();});
  let list=[...items];
  if(state.itemFilter==='todo') list=list.filter(i=>!i.isDone);
  if(state.itemFilter==='mine' && state.myName){ const member=state.data.members.find(m=>m.name===state.myName); list=member?list.filter(i=>i.assigneeId===member.id):[]; }
  if(state.assigneeFilter) list=list.filter(i=>i.assigneeId===state.assigneeFilter);
  list.sort((a,b)=>Number(a.isDone)-Number(b.isDone)||a.name.localeCompare(b.name,'ko'));
  $('#itemList').innerHTML=list.map(i=>`<article class="packing-item ${i.isDone?'done':''}"><button class="check-btn" data-toggle-item="${i.id}" aria-label="완료 토글">${i.isDone?'✓':''}</button><div><div class="item-name">${esc(i.name)}</div><div class="item-meta"><span>${esc(i.category||'기타')}</span><span>·</span><span>${esc(i.quantity||'수량 미정')}</span><span>·</span><span>${esc(memberName(i.assigneeId))}</span></div></div><button class="item-actions" data-edit-item="${i.id}" aria-label="준비물 수정">•••</button></article>`).join('') || `<div class="empty-state">조건에 맞는 준비물이 없어.</div>`;
  $$('[data-toggle-item]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.toggleItem; btn.disabled=true;
    try { await dataAdapter.mutate(data=>{const item=data.items.find(i=>i.id===id); if(item)item.isDone=!item.isDone;}); }
    catch(e){ console.error(e); toast('저장에 실패했어.'); }
    finally { btn.disabled=false; }
  });
  $$('[data-edit-item]').forEach(btn=>btn.onclick=()=>openItemModal(state.data.items.find(i=>i.id===btn.dataset.editItem)));
}

function renderSettings(){
  $('#myNameInput').value=state.myName;
  $('#memberList').innerHTML=state.data.members.map(m=>`<div class="member-card"><div><strong>${esc(m.name)}</strong><div class="tiny">${m.type==='team'?'팀':'개인'}</div></div><button data-edit-member="${m.id}">수정</button></div>`).join('');
  $$('[data-edit-member]').forEach(btn=>btn.onclick=()=>openMemberModal(state.data.members.find(m=>m.id===btn.dataset.editMember)));
  $('#connectionText').textContent=DATA_MODE.useFirebase?'Firebase 실시간 동기화 모드':'로컬 데모 모드 · 같은 기기 탭 간 동기화';
}

function memberOptions(selected=''){
  return `<option value="">공용 / 미정</option>`+state.data.members.map(m=>`<option value="${m.id}" ${m.id===selected?'selected':''}>${esc(m.name)}</option>`).join('');
}

function openMealModal(meal=null){
  const isEdit=!!meal; const m=meal||{date:state.selectedDate,mealType:'dinner',menu:'',assigneeId:'',note:''};
  openModal(`<div class="modal-title"><h3>${isEdit?'식단 수정':'식단 추가'}</h3><button class="more-btn" data-close>×</button></div><form id="mealForm" class="form-grid"><label>날짜<input name="date" type="date" value="${m.date}" required></label><label>구분<select name="mealType">${Object.entries(mealLabels).map(([k,v])=>`<option value="${k}" ${m.mealType===k?'selected':''}>${v}</option>`).join('')}</select></label><label>메뉴<input name="menu" value="${esc(m.menu)}" placeholder="예: 바비큐" required></label><label>담당자<select name="assigneeId">${memberOptions(m.assigneeId)}</select></label><label>메모<textarea name="note" placeholder="준비할 것, 시간 등">${esc(m.note||'')}</textarea></label><div class="modal-actions"><button type="button" class="cancel-btn" data-close>취소</button><button class="save-btn">저장</button></div>${isEdit?'<button type="button" id="deleteMealBtn" class="delete-btn">식단 삭제</button>':''}</form>`,root=>{
    root.querySelector('#mealForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const v=Object.fromEntries(fd);await dataAdapter.mutate(data=>{if(isEdit)Object.assign(data.meals.find(x=>x.id===meal.id),v);else data.meals.push({id:uid('meal'),...v});});closeModal();toast('식단 저장 완료');};
    root.querySelector('#deleteMealBtn')?.addEventListener('click',async()=>{if(!confirm('이 식단을 삭제할까?'))return;await dataAdapter.mutate(d=>{d.meals=d.meals.filter(x=>x.id!==meal.id)});closeModal();});
  });
}

function openItemModal(item=null){
  const isEdit=!!item; const i=item||{name:'',category:'기타',quantity:'',assigneeId:'',isDone:false,note:''};
  openModal(`<div class="modal-title"><h3>${isEdit?'준비물 수정':'준비물 추가'}</h3><button class="more-btn" data-close>×</button></div><form id="itemForm" class="form-grid"><label>준비물<input name="name" value="${esc(i.name)}" placeholder="예: 버너" required></label><label>카테고리<select name="category">${['식재료','조리','텐트','침구','놀이','기타'].map(v=>`<option ${i.category===v?'selected':''}>${v}</option>`).join('')}</select></label><label>수량<input name="quantity" value="${esc(i.quantity||'')}" placeholder="예: 2개 / 1박스"></label><label>담당자<select name="assigneeId">${memberOptions(i.assigneeId)}</select></label><label>메모<textarea name="note">${esc(i.note||'')}</textarea></label><div class="modal-actions"><button type="button" class="cancel-btn" data-close>취소</button><button class="save-btn">저장</button></div>${isEdit?'<button type="button" id="deleteItemBtn" class="delete-btn">준비물 삭제</button>':''}</form>`,root=>{
    root.querySelector('#itemForm').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget));await dataAdapter.mutate(data=>{if(isEdit)Object.assign(data.items.find(x=>x.id===item.id),v);else data.items.push({id:uid('item'),...v,isDone:false});});closeModal();toast('준비물 저장 완료');};
    root.querySelector('#deleteItemBtn')?.addEventListener('click',async()=>{if(!confirm('이 준비물을 삭제할까?'))return;await dataAdapter.mutate(d=>{d.items=d.items.filter(x=>x.id!==item.id)});closeModal();});
  });
}

function openMemberModal(member=null){
  const isEdit=!!member; const m=member||{name:'',type:'person'};
  openModal(`<div class="modal-title"><h3>${isEdit?'참여자 수정':'참여자 추가'}</h3><button class="more-btn" data-close>×</button></div><form id="memberForm" class="form-grid"><label>이름<input name="name" value="${esc(m.name)}" required placeholder="예: 민지 / 1팀"></label><label>유형<select name="type"><option value="person" ${m.type==='person'?'selected':''}>개인</option><option value="team" ${m.type==='team'?'selected':''}>팀</option></select></label><div class="modal-actions"><button type="button" class="cancel-btn" data-close>취소</button><button class="save-btn">저장</button></div>${isEdit?'<button type="button" id="deleteMemberBtn" class="delete-btn">참여자 삭제</button>':''}</form>`,root=>{
    root.querySelector('#memberForm').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget));await dataAdapter.mutate(data=>{if(isEdit)Object.assign(data.members.find(x=>x.id===member.id),v);else data.members.push({id:uid('member'),order:data.members.length+1,...v});});closeModal();};
    root.querySelector('#deleteMemberBtn')?.addEventListener('click',async()=>{if(!confirm('삭제하면 이 담당자로 지정된 항목은 공용/미정으로 바뀌어. 계속할까?'))return;await dataAdapter.mutate(d=>{d.members=d.members.filter(x=>x.id!==member.id);d.items.forEach(x=>{if(x.assigneeId===member.id)x.assigneeId=''});d.meals.forEach(x=>{if(x.assigneeId===member.id)x.assigneeId=''})});closeModal();});
  });
}

async function copyLink(){
  const url=new URL(location.href);url.searchParams.set('trip',DATA_MODE.tripId);
  try{await navigator.clipboard.writeText(url.toString());toast('공유 링크 복사 완료');}catch{prompt('이 링크를 복사해줘.',url.toString());}
}

$$('[data-nav]').forEach(btn=>btn.onclick=()=>setView(btn.dataset.nav));
$$('[data-go]').forEach(btn=>btn.onclick=()=>setView(btn.dataset.go));
$('#addMealBtn').onclick=()=>openMealModal();
$('#addItemBtn').onclick=()=>openItemModal();
$('#addMemberBtn').onclick=()=>openMemberModal();
$('#shareBtn').onclick=copyLink; $('#copyLinkBtn').onclick=copyLink;
$('#saveMyNameBtn').onclick=()=>{state.myName=$('#myNameInput').value.trim();localStorage.setItem('camp:myName',state.myName);toast('내 이름을 저장했어.');renderItems();};
$$('#itemFilters .chip').forEach(btn=>btn.onclick=()=>{state.itemFilter=btn.dataset.filter;$$('#itemFilters .chip').forEach(b=>b.classList.toggle('active',b===btn));renderItems();});

dataAdapter.subscribe(data=>{state.data=data;render();});
setView(state.view);
