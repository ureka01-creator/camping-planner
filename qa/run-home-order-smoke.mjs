import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
const networkWarnings=[];
const tripId=`qa-home-order-${Date.now()}`;
const url=`http://127.0.0.1:4173/?trip=${tripId}`;

page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => {
  if(msg.type()!=='error') return;
  const text=msg.text();
  if(/Failed to load resource/.test(text)) networkWarnings.push(text);
  else errors.push(`console: ${text}`);
});

async function passLanding() {
  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }
}

async function ensureTeam() {
  const picker=page.locator('#firstEntryBackdrop');
  if(await picker.count()) {
    await page.locator('[data-first-entry-member]').first().click();
    await picker.waitFor({ state:'detached', timeout:5000 });
  }
}

async function homeOrder() {
  return page.evaluate(() => {
    const home=document.getElementById('view-home');
    const keys=[];
    for(const child of home?.children || []) {
      if(child.matches('.hero-card')) keys.push('prep');
      else if(child.id==='myPrepQuickCard') keys.push('mine');
      else if(child.querySelector?.('#memberProgress')) keys.push('members');
      else if(child.querySelector?.('#nextMealCard')) keys.push('meals');
    }
    return keys;
  });
}

try {
  await page.goto(url, { waitUntil:'domcontentloaded', timeout:30000 });
  await passLanding();
  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('Firebase 실시간 연결됨'), null, { timeout:20000 });
  await ensureTeam();
  await page.waitForSelector('#myPrepQuickCard', { timeout:10000 });

  await page.locator('#settingsShortcut').click();
  await page.locator('#view-settings.active').waitFor({ state:'visible', timeout:5000 });
  await page.locator('#homeOrderCard').waitFor({ state:'visible', timeout:5000 });

  const initialRows=await page.locator('[data-home-order-row]').evaluateAll(nodes => nodes.map(node => node.dataset.homeOrderRow));
  if(initialRows.join(',')!=='prep,mine,members,meals') throw new Error(`Unexpected default rows: ${initialRows.join(',')}`);

  for(let i=0;i<3;i++) {
    await page.locator('[data-home-order-key="meals"][data-home-order-move="up"]').click();
  }

  const stored=await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), `camp:homeOrder:${tripId}`);
  const settingsRows=await page.locator('[data-home-order-row]').evaluateAll(nodes => nodes.map(node => node.dataset.homeOrderRow));

  await page.locator('[data-nav="home"]').click();
  await page.waitForTimeout(150);
  const reordered=await homeOrder();

  await page.reload({ waitUntil:'domcontentloaded', timeout:30000 });
  await passLanding();
  await page.waitForSelector('#myPrepQuickCard', { timeout:10000 });
  await page.waitForTimeout(200);
  const persisted=await homeOrder();

  await page.screenshot({ path:'qa/home-order-smoke-result.png', fullPage:true });
  console.log(JSON.stringify({tripId,initialRows,stored,settingsRows,reordered,persisted,errors,networkWarnings},null,2));

  const expected='meals,prep,mine,members';
  if(errors.length || stored.join(',')!==expected || settingsRows.join(',')!==expected || reordered.join(',')!==expected || persisted.join(',')!==expected) process.exitCode=1;
} catch(error) {
  console.error('HOME_ORDER_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  await page.screenshot({ path:'qa/home-order-smoke-result.png', fullPage:true }).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
