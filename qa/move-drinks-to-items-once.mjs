import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });

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

    const memberId = name => current.members?.find(member => member.name === name)?.id || '';
    const hyukjin = memberId('혁진이네');
    const minji = memberId('민지네');
    const seongho = memberId('성호네');

    const drinks = [
      { id:'drink-soju', name:'소주', category:'주류', quantity:'12병', assigneeId:hyukjin, isDone:false, note:'' },
      { id:'drink-beer', name:'맥주', category:'주류', quantity:'24캔', assigneeId:hyukjin, isDone:false, note:'' },
      { id:'drink-white-wine', name:'화와', category:'주류', quantity:'2병', assigneeId:hyukjin, isDone:false, note:'' },
      { id:'drink-red-wine', name:'레와', category:'주류', quantity:'2병', assigneeId:hyukjin, isDone:false, note:'' },
      { id:'drink-sake', name:'사케', category:'주류', quantity:'3병', assigneeId:minji, isDone:false, note:'' },
      { id:'drink-gaoliang', name:'고량주', category:'주류', quantity:'2병', assigneeId:seongho, isDone:false, note:'' }
    ];

    await dataAdapter.mutate(data => {
      data.meals = (data.meals || []).filter(meal => meal.id !== 'plan-0911-drinks' && meal.menu !== '주류');
      const keepItems = (data.items || []).filter(item => !String(item.id || '').startsWith('drink-') && !String(item.id || '').startsWith('plan-drink-'));
      data.items = [...keepItems, ...drinks];
    });

    return { drinkItems:drinks.length, removedMeal:true, assignees:{ hyukjin, minji, seongho } };
  });
  console.log('DRINKS_TO_ITEMS_OK', JSON.stringify(result));
} finally {
  await browser.close();
}
