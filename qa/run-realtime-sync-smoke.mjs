import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const contextA = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const contextB = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const pageA = await contextA.newPage();
const pageB = await contextB.newPage();
const errors=[];

for (const [label, page] of [['A', pageA], ['B', pageB]]) {
  page.on('pageerror', error => errors.push(`${label} pageerror: ${error.message}`));
  page.on('console', msg => { if (msg.type()==='error') errors.push(`${label} console: ${msg.text()}`); });
}

const tripId = 'qa-realtime-smoke';
const url = `http://127.0.0.1:4173/?trip=${tripId}&data=local`;

async function dismissFirstEntryIfShown(page) {
  await page.waitForTimeout(80);
  const picker=page.locator('#firstEntryBackdrop');
  if(await picker.count()) {
    await picker.locator('[data-first-entry-later]').click();
    await picker.waitFor({ state:'detached', timeout:5000 });
  }
}

async function enterApp(page) {
  await page.goto(url, { waitUntil:'domcontentloaded', timeout:30000 });
  const landing = page.locator('.camp-landing');
  if (await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }
  await page.waitForFunction(
    () => document.querySelector('#connectionText')?.textContent.includes('로컬 데모 모드'),
    null,
    { timeout:20000 }
  );
  await dismissFirstEntryIfShown(page);
  await page.locator('[data-nav="items"]').click();
  await page.locator('#view-items.active').waitFor({ state:'visible', timeout:5000 });
  await page.locator('#itemList [data-toggle-item]').first().waitFor({ state:'visible', timeout:15000 });
}

function itemDone(page, itemId) {
  return page.locator(`[data-toggle-item="${itemId}"]`).evaluate(button => button.closest('.packing-item')?.classList.contains('done') === true);
}

try {
  await Promise.all([enterApp(pageA), enterApp(pageB)]);

  const firstToggle = pageA.locator('#itemList [data-toggle-item]').first();
  const itemId = await firstToggle.getAttribute('data-toggle-item');
  if (!itemId) throw new Error('No preparation item id found');

  await pageB.locator(`[data-toggle-item="${itemId}"]`).waitFor({ state:'visible', timeout:15000 });

  const initialA = await itemDone(pageA, itemId);
  await pageB.waitForFunction(
    ({ id, expected }) => document.querySelector(`[data-toggle-item="${id}"]`)?.closest('.packing-item')?.classList.contains('done') === expected,
    { id:itemId, expected:initialA },
    { timeout:15000 }
  );
  const initialB = await itemDone(pageB, itemId);

  await pageA.locator(`[data-toggle-item="${itemId}"]`).click();
  await pageB.waitForFunction(
    ({ id, initial }) => document.querySelector(`[data-toggle-item="${id}"]`)?.closest('.packing-item')?.classList.contains('done') !== initial,
    { id:itemId, initial:initialA },
    { timeout:15000 }
  );
  const changedB = await itemDone(pageB, itemId);
  const propagated = changedB !== initialA;

  await pageA.locator(`[data-toggle-item="${itemId}"]`).click();
  await pageB.waitForFunction(
    ({ id, initial }) => document.querySelector(`[data-toggle-item="${id}"]`)?.closest('.packing-item')?.classList.contains('done') === initial,
    { id:itemId, initial:initialA },
    { timeout:15000 }
  );
  const restoredB = await itemDone(pageB, itemId);
  const restored = restoredB === initialA;

  console.log(JSON.stringify({tripId,itemId,initialA,initialB,changedB,propagated,restoredB,restored,errors},null,2));

  if (errors.length || initialA !== initialB || !propagated || !restored) process.exitCode=1;
} catch(error) {
  console.error('REALTIME_SYNC_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  process.exitCode=1;
} finally {
  await contextA.close();
  await contextB.close();
  await browser.close();
}
