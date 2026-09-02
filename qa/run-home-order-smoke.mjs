import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
const networkWarnings=[];
const tripId=`qa-home-order-${Date.now()}`;
const url=`http://127.0.0.1:4173/?trip=${tripId}&data=local`;

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
  return page.evaluate(() => [...document.querySelectorAll('#view-home > [data-home-order-card]')].map(node => node.dataset.homeOrderCard));
}

async function cardGaps() {
  return page.evaluate(() => {
    const cards=[...document.querySelectorAll('#view-home > [data-home-order-card]')];
    return cards.slice(0,-1).map((card,index) => {
      const a=card.getBoundingClientRect();
      const b=cards[index+1].getBoundingClientRect();
      return Math.round((b.top-a.bottom)*10)/10;
    });
  });
}

try {
  await page.goto(url, { waitUntil:'domcontentloaded', timeout:30000 });
  await passLanding();
  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('로컬 데모 모드'), null, { timeout:25000 });
  await ensureTeam();
  await page.waitForSelector('#myPrepQuickCard', { timeout:10000 });
  await page.waitForFunction(() => {
    const keys=[...document.querySelectorAll('#view-home > [data-home-order-card]')].map(node => node.dataset.homeOrderCard);
    return ['prep','mine','members','meals','memo'].every(key => keys.includes(key));
  }, null, { timeout:10000 });

  const initial=await homeOrder();
  if(initial.join(',')!=='prep,mine,members,meals,memo') throw new Error(`Unexpected default order: ${initial.join(',')}`);

  if(await page.locator('#homeOrderCard').count()) throw new Error('Legacy settings order card still exists');
  const lock=page.locator('#homeOrderLockBtn');
  await lock.waitFor({ state:'visible', timeout:5000 });
  if(await lock.getAttribute('aria-pressed')!=='false') throw new Error('Home order should start locked');

  const mealHeadCount=await page.locator('#nextMealCard').evaluate(card => card.closest('.home-section')?.querySelectorAll(':scope > .section-head').length || 0);
  const memberHeadCount=await page.locator('#memberProgress').evaluate(card => card.closest('.home-section')?.querySelectorAll(':scope > .section-head').length || 0);
  if(mealHeadCount || memberHeadCount) throw new Error(`External headings remain: meal=${mealHeadCount}, member=${memberHeadCount}`);

  const initialGaps=await cardGaps();
  if(initialGaps.some(gap => Math.abs(gap-16)>1)) throw new Error(`Uneven initial card gaps: ${initialGaps.join(',')}`);

  await lock.click();
  if(await lock.getAttribute('aria-pressed')!=='true') throw new Error('Unlock control did not enter reorder mode');

  const meal=page.locator('[data-home-order-card="meals"]');
  await meal.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const mealBox=await meal.boundingBox();
  if(!mealBox) throw new Error('Missing sortable meal card bounds');

  const dragX=mealBox.x+mealBox.width/2;
  const dragY=Math.min(mealBox.y+45, 760);
  await page.mouse.move(dragX, dragY);
  await page.mouse.down();
  await page.mouse.move(dragX, 70, { steps:36 });
  await page.waitForTimeout(120);
  await page.mouse.move(dragX, 62, { steps:8 });
  await page.mouse.up();
  await page.waitForTimeout(180);

  const expected='meals,prep,mine,members,memo';
  const reordered=await homeOrder();
  const stored=await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), `camp:homeOrder:${tripId}`);
  if(reordered.join(',')!==expected || stored.join(',')!==expected) throw new Error(`Drag order not saved: dom=${reordered.join(',')} stored=${stored.join(',')}`);

  await page.evaluate(() => window.scrollTo(0,0));
  await page.waitForTimeout(80);
  const reorderedGaps=await cardGaps();
  if(reorderedGaps.some(gap => Math.abs(gap-16)>1)) throw new Error(`Uneven reordered card gaps: ${reorderedGaps.join(',')}`);

  await lock.click();
  if(await lock.getAttribute('aria-pressed')!=='false') throw new Error('Lock control did not lock reorder mode');

  await page.reload({ waitUntil:'domcontentloaded', timeout:30000 });
  await passLanding();
  await page.waitForSelector('#myPrepQuickCard', { timeout:10000 });
  await page.waitForFunction(() => {
    const keys=[...document.querySelectorAll('#view-home > [data-home-order-card]')].map(node => node.dataset.homeOrderCard);
    return ['prep','mine','members','meals','memo'].every(key => keys.includes(key));
  }, null, { timeout:10000 });
  await page.waitForTimeout(150);

  const persisted=await homeOrder();
  const persistedLocked=await page.locator('#homeOrderLockBtn').getAttribute('aria-pressed');
  const persistedGaps=await cardGaps();
  await page.screenshot({ path:'qa/home-order-smoke-result.png', fullPage:true });

  console.log(JSON.stringify({tripId,initial,initialGaps,reordered,reorderedGaps,stored,persisted,persistedLocked,persistedGaps,mealHeadCount,memberHeadCount,errors,networkWarnings},null,2));

  if(errors.length || persisted.join(',')!==expected || persistedLocked!=='false' || persistedGaps.some(gap => Math.abs(gap-16)>1)) process.exitCode=1;
} catch(error) {
  console.error('HOME_ORDER_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  await page.screenshot({ path:'qa/home-order-smoke-result.png', fullPage:true }).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
