import { dataAdapter } from './firebase.js?v=064';
import { openModal, closeModal, toast, uid, esc } from './ui.js';

const view = document.getElementById('view-settlement');
const totalEl = document.getElementById('settlementTotal');
const statusEl = document.getElementById('settlementStatus');
const memberEl = document.getElementById('settlementMembers');
const transferEl = document.getElementById('settlementTransfers');
const listEl = document.getElementById('settlementList');
const addBtn = document.getElementById('addExpenseBtn');
let latestData = null;

function numberValue(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function money(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`;
}

function settlementMembers() {
  return (latestData?.members || []).filter(member => {
    const name = String(member?.name || '').trim();
    return name && !name.startsWith('공용');
  });
}

function memberName(id) {
  return (latestData?.members || []).find(member => member.id === id)?.name || '결제자 미정';
}

function validParticipantIds(ids, members) {
  const valid = new Set(members.map(member => member.id));
  const filtered = Array.isArray(ids) ? ids.filter(id => valid.has(id)) : [];
  return filtered.length ? filtered : members.map(member => member.id);
}

function sourceEntries() {
  const members = settlementMembers();
  const allIds = members.map(member => member.id);
  const entries = [];

  (latestData?.meals || []).forEach(meal => {
    (Array.isArray(meal.items) ? meal.items : []).forEach(item => {
      const cost = numberValue(item.cost);
      if (!cost) return;
      entries.push({
        id: `meal:${meal.id}:${item.id}`,
        source: '식단',
        sourceKey: 'meal',
        name: item.name || meal.menu || '식단 준비',
        detail: meal.menu || '',
        date: meal.date || '',
        cost,
        payerId: item.payerId || item.assigneeId || '',
        participantIds: validParticipantIds(item.participantIds, members),
        go: 'meals'
      });
    });
  });

  (latestData?.items || []).forEach(item => {
    const cost = numberValue(item.cost);
    if (!cost) return;
    entries.push({
      id: `item:${item.id}`,
      source: '준비물',
      sourceKey: 'item',
      name: item.name || '준비물',
      detail: item.category || '',
      date: '',
      cost,
      payerId: item.payerId || item.assigneeId || '',
      participantIds: validParticipantIds(item.participantIds, members),
      go: 'items'
    });
  });

  const manual = Array.isArray(latestData?.trip?.expenses) ? latestData.trip.expenses : [];
  manual.forEach(expense => {
    const cost = numberValue(expense.cost);
    if (!cost) return;
    entries.push({
      id: `manual:${expense.id}`,
      rawId: expense.id,
      source: '직접입력',
      sourceKey: 'manual',
      name: expense.name || '현장 지출',
      detail: expense.note || '',
      date: expense.date || '',
      cost,
      payerId: expense.payerId || '',
      participantIds: validParticipantIds(expense.participantIds, members),
      go: ''
    });
  });

  return entries.sort((a, b) =>
    String(b.date).localeCompare(String(a.date)) ||
    a.source.localeCompare(b.source, 'ko') ||
    a.name.localeCompare(b.name, 'ko')
  );
}

function allocateCost(cost, participantIds) {
  const allocation = new Map();
  if (!participantIds.length) return allocation;
  const base = Math.floor(cost / participantIds.length);
  let remainder = cost % participantIds.length;
  participantIds.forEach(id => {
    allocation.set(id, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder -= 1;
  });
  return allocation;
}

function settlementResult(entries, members) {
  const memberIds = new Set(members.map(member => member.id));
  const stats = new Map(members.map(member => [member.id, { paid: 0, owed: 0, balance: 0 }]));
  const validEntries = entries.filter(entry => memberIds.has(entry.payerId) && entry.participantIds.length);

  validEntries.forEach(entry => {
    stats.get(entry.payerId).paid += entry.cost;
    const shares = allocateCost(entry.cost, entry.participantIds);
    shares.forEach((share, id) => {
      if (stats.has(id)) stats.get(id).owed += share;
    });
  });

  stats.forEach(stat => { stat.balance = stat.paid - stat.owed; });
  return { stats, validEntries };
}

function transfersFrom(stats, members) {
  const creditors = [];
  const debtors = [];
  members.forEach(member => {
    const balance = stats.get(member.id)?.balance || 0;
    if (balance > 0) creditors.push({ id: member.id, amount: balance });
    if (balance < 0) debtors.push({ id: member.id, amount: -balance });
  });

  const transfers = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    if (amount > 0) transfers.push({ from: debtors[d].id, to: creditors[c].id, amount });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (debtors[d].amount === 0) d += 1;
    if (creditors[c].amount === 0) c += 1;
  }
  return transfers;
}

function renderMemberCards(stats, members) {
  if (!memberEl) return;
  memberEl.innerHTML = members.length ? members.map(member => {
    const stat = stats.get(member.id) || { paid: 0, owed: 0, balance: 0 };
    const balanceText = stat.balance > 0 ? `+${money(stat.balance)}` : stat.balance < 0 ? `-${money(-stat.balance)}` : '0원';
    const balanceClass = stat.balance > 0 ? 'positive' : stat.balance < 0 ? 'negative' : '';
    return `<article class="settlement-member-card">
      <div class="settlement-member-head"><strong>${esc(member.name)}</strong><b class="${balanceClass}">${balanceText}</b></div>
      <div class="settlement-member-meta"><span>결제 ${money(stat.paid)}</span><span>부담 ${money(stat.owed)}</span></div>
    </article>`;
  }).join('') : `<div class="empty-state">정산할 참여자/팀이 없어.</div>`;
}

function renderTransfers(stats, members, unknownCount) {
  if (!transferEl) return;
  if (unknownCount) {
    transferEl.innerHTML = `<div class="settlement-warning">결제자 미정 ${unknownCount}건이 있어. 결제자를 지정하면 최종 송금액을 정확히 계산할 수 있어.</div>`;
    return;
  }
  const transfers = transfersFrom(stats, members);
  transferEl.innerHTML = transfers.length ? transfers.map(transfer => `
    <div class="transfer-row">
      <span><strong>${esc(memberName(transfer.from))}</strong><i>→</i><strong>${esc(memberName(transfer.to))}</strong></span>
      <b>${money(transfer.amount)}</b>
    </div>`).join('') : `<div class="settlement-done">현재 입력 기준으로 주고받을 금액이 없어.</div>`;
}

function participantLabel(entry, members) {
  if (!members.length) return '정산 대상 없음';
  if (entry.participantIds.length === members.length) return '전체 분담';
  return `${entry.participantIds.length}팀 분담`;
}

function renderEntries(entries, members) {
  if (!listEl) return;
  listEl.innerHTML = entries.length ? entries.map(entry => `
    <article class="settlement-entry" data-settlement-entry="${esc(entry.id)}">
      <div class="settlement-entry-main">
        <div class="settlement-entry-top"><span class="settlement-source ${entry.sourceKey}">${entry.source}</span>${entry.date ? `<small>${esc(entry.date.slice(5).replace('-', '/'))}</small>` : ''}</div>
        <strong>${esc(entry.name)}</strong>
        <div class="settlement-entry-meta"><span>${esc(memberName(entry.payerId))} 결제</span><span>·</span><span>${participantLabel(entry, members)}</span>${entry.detail ? `<span>·</span><span>${esc(entry.detail)}</span>` : ''}</div>
      </div>
      <div class="settlement-entry-side"><b>${money(entry.cost)}</b>${entry.sourceKey === 'manual' ? `<button type="button" data-edit-expense="${esc(entry.rawId)}">수정</button>` : `<button type="button" data-settlement-go="${entry.go}">원본</button>`}</div>
    </article>`).join('') : `<div class="empty-state">아직 금액이 입력된 항목이 없어.<br>식단이나 준비물에 금액을 적으면 자동으로 들어와.</div>`;
}

function render() {
  if (!latestData || !view) return;
  const members = settlementMembers();
  const entries = sourceEntries();
  const total = entries.reduce((sum, entry) => sum + entry.cost, 0);
  const { stats, validEntries } = settlementResult(entries, members);
  const validPayers = new Set(members.map(member => member.id));
  const unknownCount = entries.filter(entry => !validPayers.has(entry.payerId)).length;
  const reflected = validEntries.reduce((sum, entry) => sum + entry.cost, 0);

  if (totalEl) totalEl.textContent = money(total);
  if (statusEl) {
    statusEl.textContent = unknownCount
      ? `정산 반영 ${money(reflected)} · 결제자 미정 ${unknownCount}건`
      : `${entries.length}건 · 전부 정산 계산에 반영 중`;
  }
  renderMemberCards(stats, members);
  renderTransfers(stats, members, unknownCount);
  renderEntries(entries, members);
}

function openExpenseModal(expense = null) {
  const members = settlementMembers();
  if (!members.length) {
    toast('먼저 설정에서 참여자/팀을 추가해줘.');
    return;
  }

  const isEdit = Boolean(expense);
  const selected = new Set(validParticipantIds(expense?.participantIds, members));
  const payer = expense?.payerId || '';
  const defaultDate = expense?.date || latestData?.trip?.startDate || new Date().toISOString().slice(0, 10);

  openModal(`<div class="modal-title"><h3>${isEdit ? '지출 수정' : '현장 지출 추가'}</h3><button class="more-btn" data-close>×</button></div>
    <form id="expenseForm" class="form-grid">
      <label>날짜<input name="date" type="date" value="${esc(defaultDate)}" required></label>
      <label>항목<input name="name" value="${esc(expense?.name || '')}" placeholder="예: 캠핑장 매점" required></label>
      <label>금액<div class="cost-input-wrap"><input name="cost" type="number" inputmode="numeric" min="0" step="1" value="${numberValue(expense?.cost) || ''}" placeholder="35000" required></div></label>
      <label>결제자<select name="payerId" required><option value="">선택해줘</option>${members.map(member => `<option value="${member.id}" ${payer === member.id ? 'selected' : ''}>${esc(member.name)}</option>`).join('')}</select></label>
      <fieldset class="expense-participants"><legend>정산 대상</legend><p>이 비용을 같이 나눌 팀만 선택해.</p><div>${members.map(member => `<label><input type="checkbox" name="participantId" value="${member.id}" ${selected.has(member.id) ? 'checked' : ''}><span>${esc(member.name)}</span></label>`).join('')}</div></fieldset>
      <label>메모<textarea name="note" placeholder="선택 사항">${esc(expense?.note || '')}</textarea></label>
      <div class="modal-actions"><button type="button" class="cancel-btn" data-close>취소</button><button class="save-btn">저장</button></div>
      ${isEdit ? '<button type="button" id="deleteExpenseBtn" class="delete-btn">지출 삭제</button>' : ''}
    </form>`, root => {
      root.querySelector('#expenseForm').onsubmit = async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const participantIds = formData.getAll('participantId').map(String);
        if (!participantIds.length) {
          toast('정산 대상을 한 팀 이상 선택해줘.');
          return;
        }
        const value = {
          date: String(formData.get('date') || ''),
          name: String(formData.get('name') || '').trim(),
          cost: numberValue(formData.get('cost')),
          payerId: String(formData.get('payerId') || ''),
          participantIds,
          note: String(formData.get('note') || '').trim()
        };
        if (!value.cost) {
          toast('금액을 입력해줘.');
          return;
        }
        await dataAdapter.mutate(data => {
          if (!data.trip) data.trip = {};
          if (!Array.isArray(data.trip.expenses)) data.trip.expenses = [];
          if (isEdit) {
            const target = data.trip.expenses.find(item => item.id === expense.id);
            if (target) Object.assign(target, value);
          } else {
            data.trip.expenses.push({ id: uid('expense'), ...value });
          }
        });
        closeModal();
        toast('정산 지출을 저장했어.');
      };

      root.querySelector('#deleteExpenseBtn')?.addEventListener('click', async () => {
        if (!confirm('이 지출을 삭제할까?')) return;
        await dataAdapter.mutate(data => {
          if (!Array.isArray(data.trip?.expenses)) return;
          data.trip.expenses = data.trip.expenses.filter(item => item.id !== expense.id);
        });
        closeModal();
      });
    });
}

addBtn?.addEventListener('click', () => openExpenseModal());

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const edit = event.target.closest('[data-edit-expense]');
  if (edit) {
    const expense = (latestData?.trip?.expenses || []).find(item => item.id === edit.dataset.editExpense);
    if (expense) openExpenseModal(expense);
    return;
  }
  const go = event.target.closest('[data-settlement-go]');
  if (go?.dataset.settlementGo) {
    document.querySelector(`[data-nav="${go.dataset.settlementGo}"]`)?.click();
  }
});

dataAdapter.subscribe(data => {
  latestData = data;
  render();
});
