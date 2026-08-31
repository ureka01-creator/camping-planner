import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => { if (msg.type()==='error') errors.push(`console: ${msg.text()}`); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil:'domcontentloaded', timeout:30000 });
  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }

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
  await page.waitForTimeout(80);
  const visibleLiquor=await page.locator('#itemList .packing-item:visible').count();
  const liquorTexts=await page.locator('#itemList .packing-item:visible .item-meta').allTextContents();
  const liquorFilterOk=visibleLiquor > 0 && liquorTexts.every(text => text.includes('주류'));

  await page.locator('#addItemBtn').click();
  await page.locator('#itemForm').waitFor({ state:'visible', timeout:5000 });
  const optionTexts=await page.locator('#itemForm select[name="category"] option').allTextContents();
  const liquorModalOption=optionTexts.includes('주류');
  await page.locator('#itemForm [data-close], #modalContent [data-close]').first().click();

  const overflow=await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(JSON.stringify({liquorCategory,mealPrepCount,memberCards,combinedSummary,summary,liquorFilterOk,visibleLiquor,liquorModalOption,overflow,errors},null,2));

  if(errors.length || !liquorCategory || mealPrepCount<1 || memberCards<1 || !combinedSummary || !liquorFilterOk || !liquorModalOption || overflow) process.exitCode=1;
} catch(error) {
  console.error('ITEMS_HUB_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  process.exitCode=1;
} finally {
  await browser.close();
}
