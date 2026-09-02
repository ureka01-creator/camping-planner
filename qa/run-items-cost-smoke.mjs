import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
const networkWarnings=[];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => {
  if (msg.type()!=='error') return;
  const text=msg.text();
  if(text.startsWith('Failed to load resource:')) networkWarnings.push(`console: ${text}`);
  else errors.push(`console: ${text}`);
});

const itemName = `QA 주류 비용 ${Date.now()}`;
const tripId = `qa-items-cost-${Date.now()}`;

async function dismissFirstEntryIfShown() {
  await page.waitForTimeout(80);
  const picker=page.locator('#firstEntryBackdrop');
  if(await picker.count()) {
    await picker.locator('[data-first-entry-later]').click();
    await picker.waitFor({ state:'detached', timeout:5000 });
  }
}

try {
  await page.goto(`http://127.0.0.1:4173/?trip=${tripId}&data=local`, { waitUntil:'domcontentloaded', timeout:30000 });
  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }

  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('로컬 데모 모드'), null, { timeout:20000 });
  await dismissFirstEntryIfShown();
  await page.locator('[data-nav="items"]').click();
  await page.locator('#view-items.active').waitFor({ state:'visible', timeout:5000 });

  const mineFilterCount = await page.locator('#itemFilters [data-filter="mine"]').count();

  await page.locator('#addItemBtn').click();
  await page.locator('#itemForm').waitFor({ state:'visible', timeout:5000 });
  await page.locator('#itemForm input[name="cost"]').waitFor({ state:'visible', timeout:5000 });

  const liquorOptionExists = await page.locator('#itemForm select[name="category"] option[value="주류"]').count() === 1;
  const costFieldExists = await page.locator('#itemForm input[name="cost"]').count() === 1;
  const groupedWithQuantity = await page.locator('#itemForm .item-quantity-cost-row input[name="quantity"]').count() === 1
    && await page.locator('#itemForm .item-quantity-cost-row input[name="cost"]').count() === 1;

  await page.locator('#itemForm input[name="name"]').fill(itemName);
  await page.locator('#itemForm select[name="category"]').selectOption('주류');
  await page.locator('#itemForm input[name="quantity"]').fill('2병');
  await page.locator('#itemForm input[name="cost"]').fill('12345');
  await page.locator('.modal-sheet').evaluate(sheet => { sheet.scrollTop = sheet.scrollHeight; });
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
  const displayedCategory=(await card.locator('.item-meta span').first().textContent())?.trim() || '';
  await page.waitForFunction(name => {
    const card=[...document.querySelectorAll('#itemList .packing-item')].find(entry => entry.querySelector('.item-name')?.textContent.trim()===name);
    return card?.querySelector('[data-edit-item]')?.classList.contains('edit-pencil-icon') === true;
  }, itemName, { timeout:5000 });
  const pencilIcon = await card.locator('[data-edit-item].edit-pencil-icon svg').count() === 1;
  const hasEllipsis = ((await card.locator('[data-edit-item]').textContent()) || '').includes('•••');

  await card.locator('[data-edit-item]').click();
  await page.locator('#itemForm input[name="cost"]').waitFor({ state:'visible', timeout:5000 });
  await page.waitForTimeout(80);
  const editCostValue=await page.locator('#itemForm input[name="cost"]').inputValue();
  const editCategory=await page.locator('#itemForm select[name="category"]').inputValue();
  const modalTitle=(await page.locator('#modalContent .modal-title h3').textContent())?.trim() || '';
  const modalScrollTop=await page.locator('.modal-sheet').evaluate(sheet => sheet.scrollTop);

  await page.locator('#itemForm .save-btn').click();
  await page.locator('#modalBackdrop.hidden').waitFor({ state:'attached', timeout:10000 });
  await page.waitForFunction(name => {
    const card=[...document.querySelectorAll('#itemList .packing-item')].find(entry => entry.querySelector('.item-name')?.textContent.trim()===name);
    return card?.querySelector('.item-meta span')?.textContent.trim()==='주류';
  }, itemName, { timeout:10000 });
  const categoryPersisted=(await card.locator('.item-meta span').first().textContent())?.trim()==='주류';

  await card.locator('[data-edit-item]').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#deleteItemBtn').click();
  await page.waitForFunction(name => ![...document.querySelectorAll('#itemList .item-name')].some(entry => entry.textContent.trim() === name), itemName, { timeout:15000 });

  console.log(JSON.stringify({tripId,mineFilterCount,liquorOptionExists,costFieldExists,groupedWithQuantity,displayedCost,displayedCategory,pencilIcon,hasEllipsis,editCostValue,editCategory,modalTitle,modalScrollTop,categoryPersisted,errors,networkWarnings},null,2));

  if(errors.length || mineFilterCount!==0 || !liquorOptionExists || !costFieldExists || !groupedWithQuantity || displayedCost!=='12,345원' || displayedCategory!=='주류' || !pencilIcon || hasEllipsis || editCostValue!=='12345' || editCategory!=='주류' || modalTitle!=='준비물 수정' || modalScrollTop>1 || !categoryPersisted) process.exitCode=1;
} catch(error) {
  console.error('ITEMS_COST_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  process.exitCode=1;
} finally {
  await browser.close();
}
