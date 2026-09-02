import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
const networkWarnings=[];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => {
  if(msg.type()!=='error') return;
  const text=msg.text();
  if(/Failed to load resource/.test(text)) networkWarnings.push(text);
  else errors.push(`console: ${text}`);
});

const packingName = `QA 정산 준비물 ${Date.now()}`;
const expenseName = `QA 현장 지출 ${Date.now()}`;

async function dismissFirstEntryIfShown() {
  await page.waitForTimeout(80);
  const picker=page.locator('#firstEntryBackdrop');
  if(await picker.count()) {
    await picker.locator('[data-first-entry-later]').click();
    await picker.waitFor({ state:'detached', timeout:5000 });
  }
}

try {
  await page.goto('http://127.0.0.1:4173/?trip=qa-settlement-smoke&data=local', { waitUntil:'domcontentloaded', timeout:30000 });
  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }

  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('로컬 데모 모드'), null, { timeout:20000 });
  await dismissFirstEntryIfShown();

  await page.locator('[data-nav="items"]').click();
  await page.locator('#view-items.active').waitFor({ state:'visible', timeout:5000 });
  await page.locator('#addItemBtn').click();
  await page.locator('#itemForm select[name="payerId"]').waitFor({ state:'visible', timeout:5000 });

  const payerValues=await page.locator('#itemForm select[name="payerId"] option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
  if(!payerValues.length) throw new Error('No payable member available');
  const firstPayer=payerValues[0];
  const secondPayer=payerValues[1] || firstPayer;

  await page.locator('#itemForm input[name="name"]').fill(packingName);
  await page.locator('#itemForm input[name="quantity"]').fill('1개');
  await page.locator('#itemForm input[name="cost"]').fill('12345');
  await page.locator('#itemForm select[name="assigneeId"]').selectOption(firstPayer);
  const packingPayerDefault=await page.locator('#itemForm select[name="payerId"]').inputValue()===firstPayer;
  await page.locator('#itemForm .save-btn').click();
  await page.locator('#modalBackdrop.hidden').waitFor({ state:'attached', timeout:10000 });

  await page.locator('[data-nav="settlement"]').click();
  await page.locator('#view-settlement.active').waitFor({ state:'visible', timeout:5000 });
  const packingEntry=page.locator('#settlementList .settlement-entry').filter({hasText:packingName}).first();
  await packingEntry.waitFor({ state:'visible', timeout:15000 });
  const packingAutoImported=(await packingEntry.textContent())?.includes('12,345원')===true;
  const totalAfterPacking=(await page.locator('#settlementTotal').textContent())?.trim() || '';

  await page.locator('#addExpenseBtn').click();
  await page.locator('#expenseForm').waitFor({ state:'visible', timeout:5000 });
  await page.locator('#expenseForm input[name="name"]').fill(expenseName);
  await page.locator('#expenseForm input[name="cost"]').fill('1000');
  await page.locator('#expenseForm select[name="payerId"]').selectOption(secondPayer);
  const checkedParticipants=await page.locator('#expenseForm input[name="participantId"]:checked').count();
  await page.locator('#expenseForm .save-btn').click();
  await page.locator('#modalBackdrop.hidden').waitFor({ state:'attached', timeout:10000 });

  const manualEntry=page.locator('#settlementList .settlement-entry').filter({hasText:expenseName}).first();
  await manualEntry.waitFor({ state:'visible', timeout:15000 });
  const manualImported=(await manualEntry.textContent())?.includes('1,000원')===true;
  await page.waitForFunction(() => document.querySelector('#settlementTotal')?.textContent.includes('13,345원'), null, { timeout:15000 });
  const totalAfterManual=(await page.locator('#settlementTotal').textContent())?.trim() || '';
  const transferWarning=await page.locator('#settlementTransfers .settlement-warning').count();
  const memberCards=await page.locator('#settlementMembers .settlement-member-card').count();

  await page.locator('[data-nav="meals"]').click();
  await page.locator('#view-meals.active').waitFor({ state:'visible', timeout:5000 });
  await page.waitForFunction(() => document.querySelectorAll('#dateTabs [data-date]').length > 0, null, { timeout:15000 });
  await page.locator('#dateTabs [data-date]').first().click();
  await page.waitForTimeout(180);
  const firstToggle=page.locator('#mealList .meal-inline-toggle:visible').first();
  await firstToggle.waitFor({ state:'visible', timeout:10000 });
  await firstToggle.click();
  const mealForm=page.locator('#mealList .meal-inline-form:visible').first();
  await mealForm.locator('select[name="payerId"]').waitFor({ state:'visible', timeout:5000 });
  await mealForm.locator('select[name="assigneeId"]').selectOption(secondPayer);
  const mealPayerDefault=await mealForm.locator('select[name="payerId"]').inputValue()===secondPayer;
  await firstToggle.click();

  await page.locator('#settingsShortcut').click();
  const settingsShortcutOk=await page.locator('#view-settings.active').isVisible();

  await page.locator('[data-nav="settlement"]').click();
  await manualEntry.locator('[data-edit-expense]').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#deleteExpenseBtn').click();
  await page.waitForFunction(name => ![...document.querySelectorAll('#settlementList .settlement-entry')].some(entry => entry.textContent.includes(name)), expenseName, { timeout:15000 });

  await page.locator('[data-nav="items"]').click();
  const packingCard=page.locator('#itemList .packing-item').filter({hasText:packingName}).first();
  await packingCard.waitFor({state:'visible',timeout:10000});
  await packingCard.locator('[data-edit-item]').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#deleteItemBtn').click();
  await page.waitForFunction(name => ![...document.querySelectorAll('#itemList .item-name')].some(entry => entry.textContent.trim()===name), packingName, { timeout:15000 });

  console.log(JSON.stringify({packingPayerDefault,packingAutoImported,totalAfterPacking,checkedParticipants,manualImported,totalAfterManual,transferWarning,memberCards,mealPayerDefault,settingsShortcutOk,errors,networkWarnings},null,2));

  if(errors.length || !packingPayerDefault || !packingAutoImported || totalAfterPacking!=='12,345원' || checkedParticipants<1 || !manualImported || totalAfterManual!=='13,345원' || transferWarning!==0 || memberCards<1 || !mealPayerDefault || !settingsShortcutOk) process.exitCode=1;
} catch(error) {
  console.error('SETTLEMENT_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  process.exitCode=1;
} finally {
  await browser.close();
}
