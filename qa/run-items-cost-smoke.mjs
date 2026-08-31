import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => { if (msg.type()==='error') errors.push(`console: ${msg.text()}`); });

const itemName = `QA 비용 ${Date.now()}`;

try {
  await page.goto('http://127.0.0.1:4173/?trip=qa-items-cost-smoke', { waitUntil:'domcontentloaded', timeout:30000 });
  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }

  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('Firebase 실시간 연결됨'), null, { timeout:20000 });
  await page.locator('[data-nav="items"]').click();
  await page.locator('#view-items.active').waitFor({ state:'visible', timeout:5000 });

  const mineFilterCount = await page.locator('#itemFilters [data-filter="mine"]').count();

  await page.locator('#addItemBtn').click();
  await page.locator('#itemForm').waitFor({ state:'visible', timeout:5000 });
  await page.locator('#itemForm input[name="cost"]').waitFor({ state:'visible', timeout:5000 });

  const costFieldExists = await page.locator('#itemForm input[name="cost"]').count() === 1;
  const groupedWithQuantity = await page.locator('#itemForm .item-quantity-cost-row input[name="quantity"]').count() === 1
    && await page.locator('#itemForm .item-quantity-cost-row input[name="cost"]').count() === 1;

  await page.locator('#itemForm input[name="name"]').fill(itemName);
  await page.locator('#itemForm input[name="quantity"]').fill('2개');
  await page.locator('#itemForm input[name="cost"]').fill('12345');
  await page.locator('#itemForm .save-btn').click();
  await page.locator('#modalBackdrop.hidden').waitFor({ state:'attached', timeout:10000 });

  const card = page.locator('#itemList .packing-item').filter({ has: page.locator('.item-name', { hasText:itemName }) }).first();
  await card.waitFor({ state:'visible', timeout:15000 });
  await page.waitForFunction(name => {
    const cards=[...document.querySelectorAll('#itemList .packing-item')];
    const card=cards.find(entry => entry.querySelector('.item-name')?.textContent.trim() === name);
    return card?.querySelector('.item-cost-meta')?.textContent.includes('12,345원') === true;
  }, itemName, { timeout:15000 });

  const displayedCost=(await card.locator('.item-cost-meta').textContent())?.trim() || '';

  await card.locator('.item-actions').click();
  await page.locator('#itemForm input[name="cost"]').waitFor({ state:'visible', timeout:5000 });
  const editCostValue=await page.locator('#itemForm input[name="cost"]').inputValue();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#deleteItemBtn').click();
  await page.waitForFunction(name => ![...document.querySelectorAll('#itemList .item-name')].some(entry => entry.textContent.trim() === name), itemName, { timeout:15000 });

  console.log(JSON.stringify({mineFilterCount,costFieldExists,groupedWithQuantity,displayedCost,editCostValue,errors},null,2));

  if(errors.length || mineFilterCount!==0 || !costFieldExists || !groupedWithQuantity || displayedCost!=='12,345원' || editCostValue!=='12345') process.exitCode=1;
} catch(error) {
  console.error('ITEMS_COST_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  process.exitCode=1;
} finally {
  await browser.close();
}
