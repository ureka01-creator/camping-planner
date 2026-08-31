import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
const networkWarnings=[];
const tripId=`qa-edit-icons-${Date.now()}`;

page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => {
  if (msg.type() !== 'error') return;
  const text=msg.text();
  if (/Failed to load resource/.test(text)) networkWarnings.push(text);
  else errors.push(`console: ${text}`);
});

try {
  await page.goto(`http://127.0.0.1:4173/?trip=${tripId}`, { waitUntil:'domcontentloaded', timeout:30000 });

  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }

  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('Firebase 실시간 연결됨'), null, { timeout:20000 });

  const picker=page.locator('#firstEntryBackdrop');
  if(await picker.count()) {
    await page.locator('[data-first-entry-member]').first().click();
    await picker.waitFor({ state:'detached', timeout:5000 });
  }

  await page.evaluate(async () => {
    const { dataAdapter } = await import('./js/firebase.js?v=064');
    await dataAdapter.mutate(data => {
      const memberId=data.members?.[0]?.id || '';
      const date=data.trip?.startDate || '2026-09-11';
      data.meals=[{
        id:'qa-icon-meal',
        date,
        mealType:'dinner',
        menu:'QA 아이콘 식단',
        assigneeId:memberId,
        note:'',
        items:[{
          id:'qa-icon-item',
          name:'QA 준비항목',
          quantity:'1개',
          assigneeId:memberId,
          payerId:memberId,
          cost:0,
          note:'',
          isDone:false
        }]
      }];
    });
  });

  await page.locator('[data-nav="meals"]').click();
  await page.locator('#view-meals.active').waitFor({ state:'visible', timeout:5000 });
  await page.locator('[data-edit-meal="qa-icon-meal"] svg').waitFor({ state:'visible', timeout:10000 });
  await page.locator('[data-edit-meal-item="qa-icon-meal:qa-icon-item"] svg').waitFor({ state:'visible', timeout:10000 });

  const result=await page.evaluate(() => {
    const mealButton=document.querySelector('[data-edit-meal="qa-icon-meal"]');
    const itemButton=document.querySelector('[data-edit-meal-item="qa-icon-meal:qa-icon-item"]');
    const navIcon=document.querySelector('[data-nav="meals"] > span');
    return {
      mealPencil:Boolean(mealButton?.querySelector('svg') && mealButton.classList.contains('edit-pencil-icon')),
      itemPencil:Boolean(itemButton?.querySelector('svg') && itemButton.classList.contains('edit-pencil-icon')),
      mealEllipsisGone:!/[•…]/.test(mealButton?.textContent || ''),
      itemEllipsisGone:!/[•…]/.test(itemButton?.textContent || ''),
      mealNavLineIcon:Boolean(navIcon?.querySelector('svg') && navIcon.classList.contains('meal-line-icon')),
      mealAria:mealButton?.getAttribute('aria-label') || '',
      itemAria:itemButton?.getAttribute('aria-label') || '',
      overflow:document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  });

  console.log(JSON.stringify({tripId,result,errors,networkWarnings},null,2));
  await page.screenshot({ path:'qa/edit-icons-smoke-result.png', fullPage:true });

  if(errors.length || !result.mealPencil || !result.itemPencil || !result.mealEllipsisGone || !result.itemEllipsisGone || !result.mealNavLineIcon || result.mealAria!=='식단 수정' || !result.itemAria.includes('수정') || result.overflow) process.exitCode=1;
} catch(error) {
  console.error('EDIT_ICONS_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  await page.screenshot({ path:'qa/edit-icons-smoke-result.png', fullPage:true }).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
