import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
const tripId=`qa-meal-nav-${Date.now()}`;
page.on('pageerror', error => errors.push(error.message));

async function chooseTeamIfNeeded() {
  const picker=page.locator('#firstEntryBackdrop');
  if(await picker.count()) {
    await page.locator('[data-first-entry-member]').first().click();
    await picker.waitFor({ state:'detached', timeout:5000 });
  }
}

async function targetState() {
  return page.evaluate(() => {
    const edit=document.querySelector('[data-edit-meal="qa-meal-target"]');
    const card=edit?.closest('.meal-card');
    const rect=card?.getBoundingClientRect();
    return {
      mealsActive:document.getElementById('view-meals')?.classList.contains('active')===true,
      targetVisible:Boolean(card && rect && rect.bottom>0 && rect.top<innerHeight),
      focused:card?.classList.contains('meal-target-focus')===true,
      targetMenu:card?.querySelector('.meal-menu')?.textContent.trim() || ''
    };
  });
}

async function waitForTargetFocus() {
  await page.waitForFunction(() => document.getElementById('view-meals')?.classList.contains('active') && document.querySelector('[data-edit-meal="qa-meal-target"]')?.closest('.meal-card')?.classList.contains('meal-target-focus'), null, { timeout:5000 });
}

try {
  await page.goto(`http://127.0.0.1:4173/?trip=${tripId}&data=local`, { waitUntil:'domcontentloaded', timeout:30000 });
  const landing=page.locator('.camp-landing');
  if(await landing.count()) { await landing.click(); await landing.waitFor({ state:'detached', timeout:5000 }); }
  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('로컬 데모 모드'), null, { timeout:20000 });
  await chooseTeamIfNeeded();

  await page.evaluate(async () => {
    const { dataAdapter } = await import('./js/firebase.js?v=064');
    await dataAdapter.mutate(data => {
      const date=data.trip?.startDate || '2026-09-11';
      const memberId=data.members?.[0]?.id || '';
      data.meals=[
        { id:'qa-meal-first', date, mealType:'lunch', menu:'QA 첫 식사', assigneeId:memberId, note:'', items:[] },
        { id:'qa-meal-target', date, mealType:'dinner', menu:'QA 고기파티', assigneeId:memberId, note:'', items:[{ id:'qa-meal-item', name:'QA 고기', quantity:'1팩', assigneeId:memberId, isDone:false, note:'' }] }
      ];
    });
  });

  await page.locator('[data-nav="home"]').click();
  await page.waitForSelector('[data-food-meal-id="qa-meal-target"]');
  await page.locator('[data-food-meal-id="qa-meal-target"]').evaluate(button => button.click());
  await waitForTargetFocus();
  const fromHome=await targetState();

  await page.locator('[data-nav="meals"]').click();
  await page.waitForSelector('.meal-overview-row');
  await page.locator('.meal-overview-row', { hasText:'QA 고기파티' }).evaluate(button => button.click());
  await waitForTargetFocus();
  const fromAll=await targetState();

  await page.locator('[data-nav="items"]').click();
  await page.waitForSelector('.meal-prep-menu-link');
  await page.locator('.meal-prep-menu-link', { hasText:'QA 고기파티' }).evaluate(button => button.click());
  await waitForTargetFocus();
  const fromItems=await targetState();

  await page.screenshot({ path:'qa/meal-navigation-smoke-result.png', fullPage:true });
  console.log(JSON.stringify({fromHome,fromAll,fromItems,errors},null,2));
  const ok=state => state.mealsActive && state.targetVisible && state.focused && state.targetMenu==='QA 고기파티';
  if(errors.length || !ok(fromHome) || !ok(fromAll) || !ok(fromItems)) process.exitCode=1;
} catch(error) {
  console.error('MEAL_NAVIGATION_SMOKE_FAILED', error);
  await page.screenshot({ path:'qa/meal-navigation-smoke-result.png', fullPage:true }).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
