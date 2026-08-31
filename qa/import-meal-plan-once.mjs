import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil:'domcontentloaded', timeout:30000 });

  const result = await page.evaluate(async () => {
    const { dataAdapter } = await import('/js/firebase.js?v=064');

    const current = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Firebase data timeout')), 15000);
      let off = null;
      off = dataAdapter.subscribe(data => {
        clearTimeout(timer);
        queueMicrotask(() => off?.());
        resolve(data);
      });
    });

    const memberByName = new Map((current.members || []).map(member => [member.name, member]));

    function idFor(name) {
      const existing = memberByName.get(name);
      if (existing) return existing.id;
      const id = `team-${name.replace(/[^0-9A-Za-z가-힣]/g, '')}`;
      memberByName.set(name, { id, name, type:'team', order: memberByName.size + 1 });
      return id;
    }

    const minji = idFor('민지네');
    const hyukjin = idFor('혁진이네');
    const seongho = idFor('성호네');
    const dongpa = idFor('동파네');

    const prep = (id, name, assigneeId, quantity='') => ({
      id, name, quantity, cost:0, assigneeId, note:'', isDone:false
    });

    const meals = [
      {
        id:'plan-0911-dinner', date:'2026-09-11', mealType:'dinner',
        menu:'해산물 & 탕류', assigneeId:'', note:'팀별 분담',
        items:[
          prep('plan-0911-flatfish-octopus','광어 & 문어',dongpa),
          prep('plan-0911-shellfish','가리비 · 전복 · 맛조개',seongho),
          prep('plan-0911-soup','탕류',hyukjin)
        ]
      },
      {
        id:'plan-0911-second', date:'2026-09-11', mealType:'snack',
        menu:'2차 · 닭발 & 계란찜', assigneeId:hyukjin, note:'',
        items:[prep('plan-0911-second-item','닭발 & 계란찜',hyukjin)]
      },
      {
        id:'plan-0911-drinks', date:'2026-09-11', mealType:'snack',
        menu:'주류', assigneeId:'', note:'전체 일정용',
        items:[
          prep('plan-drink-soju','소주',hyukjin,'12병'),
          prep('plan-drink-beer','맥주',hyukjin,'24캔'),
          prep('plan-drink-whitewine','화와',hyukjin,'2병'),
          prep('plan-drink-redwine','레와',hyukjin,'2병'),
          prep('plan-drink-sake','사케',minji,'3병'),
          prep('plan-drink-gaoliang','고량주',seongho,'2병')
        ]
      },
      { id:'plan-0912-breakfast', date:'2026-09-12', mealType:'breakfast', menu:'각자 알아서', assigneeId:'', note:'', items:[] },
      {
        id:'plan-0912-lunch', date:'2026-09-12', mealType:'lunch',
        menu:'칼국수 대동 간결', assigneeId:seongho, note:'',
        items:[prep('plan-0912-kalguksu','칼국수 대동 간결',seongho)]
      },
      {
        id:'plan-0912-pajeon', date:'2026-09-12', mealType:'snack',
        menu:'간식 · 파전', assigneeId:hyukjin, note:'',
        items:[prep('plan-0912-pajeon-item','파전',hyukjin)]
      },
      {
        id:'plan-0912-dinner', date:'2026-09-12', mealType:'dinner',
        menu:'돼지고기 & 탕류', assigneeId:'', note:'팀별 분담',
        items:[
          prep('plan-0912-pork','돼지고기 · 등갈비까지',minji),
          prep('plan-0912-soup','탕류',hyukjin)
        ]
      },
      { id:'plan-0912-second', date:'2026-09-12', mealType:'snack', menu:'2차 · 메뉴 미정', assigneeId:hyukjin, note:'', items:[] },
      { id:'plan-0913-breakfast', date:'2026-09-13', mealType:'breakfast', menu:'각자 알아서', assigneeId:'', note:'', items:[] },
      { id:'plan-0913-lunch', date:'2026-09-13', mealType:'lunch', menu:'퇴실 후 · 미정', assigneeId:'', note:'퇴실 후 점심', items:[] }
    ];

    await dataAdapter.mutate(data => {
      data.members = [...memberByName.values()];
      const outside = (data.meals || []).filter(meal => meal.date < '2026-09-11' || meal.date > '2026-09-13');
      data.meals = [...outside, ...meals];
      data.trip.startDate = '2026-09-11';
      data.trip.endDate = '2026-09-13';
    });

    return {
      members: [...memberByName.values()].map(member => member.name),
      mealCount: meals.length,
      prepCount: meals.flatMap(meal => meal.items || []).length
    };
  });

  console.log('MEAL_PLAN_DB_WRITE_OK', JSON.stringify(result));
} finally {
  await browser.close();
}
