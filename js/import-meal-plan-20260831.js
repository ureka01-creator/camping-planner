import { dataAdapter } from './firebase.js?v=064';

const IMPORT_VERSION = 'meal-plan-2026-08-31-v1';
const PLAN_START = '2026-09-11';
const PLAN_END = '2026-09-13';

function ensureTeam(data, name) {
  if (!Array.isArray(data.members)) data.members = [];
  let member = data.members.find(entry => entry?.name === name);

  // The current data had a similarly placed team entry. If the new plan names
  // 동파네 and no exact team exists, reuse that slot instead of creating a duplicate.
  if (!member && name === '동파네') {
    member = data.members.find(entry => entry?.name === '동소이네');
    if (member) member.name = '동파네';
  }

  if (!member) {
    member = {
      id: `team-${name.replace(/[^0-9A-Za-z가-힣]/g, '')}`,
      name,
      type: 'team',
      order: data.members.length + 1
    };
    data.members.push(member);
  }
  return member.id;
}

function prep(id, name, assigneeId, quantity = '', note = '') {
  return { id, name, quantity, cost: 0, assigneeId, note, isDone: false };
}

async function importPlan() {
  await dataAdapter.mutate(data => {
    if (!data.trip) data.trip = {};
    if (data.trip.mealPlanImportVersion === IMPORT_VERSION) return;

    const minji = ensureTeam(data, '민지네');
    const hyukjin = ensureTeam(data, '혁진이네');
    const seongho = ensureTeam(data, '성호네');
    const dongpa = ensureTeam(data, '동파네');

    const planMeals = [
      {
        id: 'plan-0911-dinner', date: '2026-09-11', mealType: 'dinner',
        menu: '해산물 & 탕류', assigneeId: '', note: '팀별 분담',
        items: [
          prep('plan-0911-flatfish-octopus', '광어 & 문어', dongpa),
          prep('plan-0911-shellfish', '가리비 · 전복 · 맛조개', seongho),
          prep('plan-0911-soup', '탕류', hyukjin)
        ]
      },
      {
        id: 'plan-0911-second', date: '2026-09-11', mealType: 'snack',
        menu: '2차 · 닭발 & 계란찜', assigneeId: hyukjin, note: '',
        items: [prep('plan-0911-second-item', '닭발 & 계란찜', hyukjin)]
      },
      {
        id: 'plan-drinks', date: '2026-09-11', mealType: 'snack',
        menu: '주류 (전체 일정)', assigneeId: '', note: '캠핑 전체 일정용',
        items: [
          prep('plan-drink-soju', '소주', hyukjin, '12병'),
          prep('plan-drink-beer', '맥주', hyukjin, '24캔'),
          prep('plan-drink-whitewine', '화와', hyukjin, '2병'),
          prep('plan-drink-redwine', '레와', hyukjin, '2병'),
          prep('plan-drink-sake', '사케', minji, '3병'),
          prep('plan-drink-gaoliang', '고량주', seongho, '2병')
        ]
      },
      {
        id: 'plan-0912-breakfast', date: '2026-09-12', mealType: 'breakfast',
        menu: '각자 알아서', assigneeId: '', note: '', items: []
      },
      {
        id: 'plan-0912-lunch', date: '2026-09-12', mealType: 'lunch',
        menu: '칼국수 대동 간결', assigneeId: seongho, note: '',
        items: [prep('plan-0912-kalguksu', '칼국수 대동 간결', seongho)]
      },
      {
        id: 'plan-0912-pajeon', date: '2026-09-12', mealType: 'snack',
        menu: '간식 · 파전', assigneeId: hyukjin, note: '',
        items: [prep('plan-0912-pajeon-item', '파전', hyukjin)]
      },
      {
        id: 'plan-0912-dinner', date: '2026-09-12', mealType: 'dinner',
        menu: '돼지고기 & 탕류', assigneeId: '', note: '팀별 분담',
        items: [
          prep('plan-0912-pork', '돼지고기 · 등갈비까지', minji),
          prep('plan-0912-soup', '탕류', hyukjin)
        ]
      },
      {
        id: 'plan-0912-second', date: '2026-09-12', mealType: 'snack',
        menu: '2차 · 메뉴 미정', assigneeId: hyukjin, note: '', items: []
      },
      {
        id: 'plan-0913-breakfast', date: '2026-09-13', mealType: 'breakfast',
        menu: '각자 알아서', assigneeId: '', note: '', items: []
      },
      {
        id: 'plan-0913-lunch', date: '2026-09-13', mealType: 'lunch',
        menu: '퇴실 후 · 미정', assigneeId: '', note: '퇴실 후 점심', items: []
      }
    ];

    const existingOutsidePlan = (data.meals || []).filter(meal => meal.date < PLAN_START || meal.date > PLAN_END);
    data.meals = [...existingOutsidePlan, ...planMeals];
    data.trip.startDate = PLAN_START;
    data.trip.endDate = PLAN_END;
    data.trip.mealPlanImportVersion = IMPORT_VERSION;
  });
}

importPlan().catch(error => {
  console.error('Meal plan import failed.', error);
});
