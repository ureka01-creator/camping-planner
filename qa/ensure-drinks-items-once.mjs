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
    const existingByName = new Map((current.items || []).map(item => [item.name, item]));
    const desired = [
      ['drink-soju','소주','12병',memberId('혁진이네')],
      ['drink-beer','맥주','24캔',memberId('혁진이네')],
      ['drink-white-wine','화와','2병',memberId('혁진이네')],
      ['drink-red-wine','레와','2병',memberId('혁진이네')],
      ['drink-sake','사케','3병',memberId('민지네')],
      ['drink-gaoliang','고량주','2병',memberId('성호네')]
    ].map(([id,name,quantity,assigneeId]) => {
      const previous = existingByName.get(name) || {};
      return {
        ...previous,
        id,
        name,
        category:'주류',
        quantity,
        assigneeId,
        isDone:previous.isDone === true,
        note:previous.note || ''
      };
    });

    await dataAdapter.mutate(data => {
      data.meals = (data.meals || []).filter(meal => meal.id !== 'plan-0911-drinks' && meal.menu !== '주류');
      const drinkNames = new Set(desired.map(item => item.name));
      const keep = (data.items || []).filter(item =>
        !drinkNames.has(item.name) &&
        !String(item.id || '').startsWith('drink-') &&
        !String(item.id || '').startsWith('plan-drink-')
      );
      data.items = [...keep, ...desired];
    });

    return { names:desired.map(item => item.name), assignees:desired.map(item => item.assigneeId) };
  });
  console.log('DRINK_PACKING_REPAIR_OK', JSON.stringify(result));
} finally {
  await browser.close();
}
