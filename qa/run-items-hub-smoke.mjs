import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => { if (msg.type()==='error') errors.push(`console: ${msg.text()}`); });

try {
  await page.goto('http://127.0.0.1:4173/?data=local', { waitUntil:'domcontentloaded', timeout:30000 });
  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }

  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('로컬 데모 모드'), null, { timeout:20000 });
  const picker=page.locator('#firstEntryBackdrop');
  if(await picker.count()) {
    await page.locator('[data-first-entry-member]').first().click();
    await picker.waitFor({ state:'detached', timeout:5000 });
  }
  await page.evaluate(async () => {
    const { dataAdapter } = await import('./js/firebase.js?v=064');
    await dataAdapter.mutate(data => {
      const memberId=data.members?.[0]?.id || '';
      data.items=[...(data.items || []), { id:'qa-liquor', name:'QA 음료', category:'주류', quantity:'1병', assigneeId:memberId, isDone:false, note:'' }];
      if(data.meals?.[0]) data.meals[0].items=[{ id:'qa-meal-prep', name:'QA 식사 준비', quantity:'1개', assigneeId:memberId, isDone:false, note:'' }];
    });
  });
  await page.waitForTimeout(120);

  await page.locator('[data-nav="items"]').click();
  await page.locator('#view-items.active').waitFor({ state:'visible', timeout:5000 });
  await page.waitForFunction(() => document.querySelector('#itemCategoryFilters [data-item-category="주류"]'), null, { timeout:15000 });
  await page.waitForFunction(() => document.querySelectorAll('#mealPrepList [data-toggle-meal-prep]').length > 0, null, { timeout:15000 });

  const categories=await page.locator('#itemCategoryFilters [data-item-category]').allTextContents();
  const liquorCategory=categories.some(text => text.includes('주류'));
  const mealPrepCount=await page.locator('#mealPrepList [data-toggle-meal-prep]').count();
  const memberCards=await page.locator('#itemsMemberProgress .items-member-card').count();
  const summary=(await page.locator('#itemSummary').textContent())?.trim() || '';
  const combinedSummary=/^전체 \d+개 중 \d+개 준비$/.test(summary);

  await page.locator('#itemCategoryFilters [data-item-category="주류"]').click();
  await page.waitForFunction(() => {
    const cards=[...document.querySelectorAll('#itemList > .packing-item')];
    const visible=cards.filter(card => getComputedStyle(card).display !== 'none' && !card.hidden);
    return visible.length > 0 && visible.every(card => card.querySelector('.item-meta span')?.textContent?.trim() === '주류');
  }, null, { timeout:5000 });
  await page.waitForTimeout(120);

  const liquorResult=await page.evaluate(() => {
    const cards=[...document.querySelectorAll('#itemList > .packing-item')];
    const visible=cards.filter(card => getComputedStyle(card).display !== 'none' && !card.hidden);
    const categories=visible.map(card => card.querySelector('.item-meta span')?.textContent?.trim() || '');
    return { visibleLiquor:visible.length, categories, ok:visible.length>0 && categories.every(category => category==='주류') };
  });

  await page.locator('#addItemBtn').click();
  await page.locator('#itemForm').waitFor({ state:'visible', timeout:5000 });
  const optionTexts=await page.locator('#itemForm select[name="category"] option').allTextContents();
  const liquorModalOption=optionTexts.includes('주류');
  await page.locator('#itemForm [data-close], #modalContent [data-close]').first().click();

  const overflow=await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(JSON.stringify({liquorCategory,mealPrepCount,memberCards,combinedSummary,summary,liquorFilterOk:liquorResult.ok,visibleLiquor:liquorResult.visibleLiquor,liquorCategories:liquorResult.categories,liquorModalOption,overflow,errors},null,2));

  if(errors.length || !liquorCategory || mealPrepCount<1 || memberCards<1 || !combinedSummary || !liquorResult.ok || !liquorModalOption || overflow) process.exitCode=1;
} catch(error) {
  console.error('ITEMS_HUB_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  process.exitCode=1;
} finally {
  await browser.close();
}
