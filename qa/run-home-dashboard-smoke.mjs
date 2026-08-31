import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => { if (msg.type()==='error') errors.push(`console: ${msg.text()}`); });

try {
  await page.goto('http://127.0.0.1:4173/?trip=qa-home-dashboard-smoke', { waitUntil:'domcontentloaded', timeout:30000 });

  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }

  const picker=page.locator('#firstEntryBackdrop');
  if(await picker.count()) {
    await page.locator('[data-first-entry-later]').click();
    await picker.waitFor({ state:'detached', timeout:5000 });
  }

  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('Firebase 실시간 연결됨'), null, { timeout:20000 });

  await page.evaluate(async () => {
    const { dataAdapter } = await import('./js/firebase.js?v=064');
    await dataAdapter.mutate(data => {
      const firstDate = data?.trip?.startDate || '2026-09-11';
      const existing = (data.meals || []).find(meal => meal.id === 'qa-home-2nd');
      if (existing) {
        existing.date = firstDate;
        existing.mealType = 'snack';
        existing.menu = 'QA 2차';
        existing.note = '2차 테스트';
        existing.items = existing.items || [];
      } else {
        data.meals = data.meals || [];
        data.meals.push({
          id:'qa-home-2nd',
          date:firstDate,
          mealType:'snack',
          menu:'QA 2차',
          assigneeId:data.members?.[0]?.id || '',
          note:'2차 테스트',
          items:[{ id:'qa-home-2nd-item', name:'QA 안주', quantity:'1개', assigneeId:data.members?.[0]?.id || '', isDone:false, note:'' }]
        });
      }
    });
  });

  await page.waitForFunction(() => document.querySelectorAll('#nextMealCard .home-meal-stage').length >= 2, null, { timeout:15000 });
  await page.waitForFunction(() => document.querySelector('#homeTodo')?.closest('.home-section')?.classList.contains('home-todo-hidden') === true, null, { timeout:5000 });

  const layout=await page.evaluate(() => {
    const hero=document.querySelector('#view-home .hero-card');
    const myPrep=document.querySelector('#myPrepQuickCard');
    const member=document.querySelector('#memberProgress')?.closest('.home-section');
    const meal=document.querySelector('#nextMealCard')?.closest('.home-section');
    const before=(a,b)=>Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    return {
      heroBeforeMyPrep: before(hero,myPrep),
      myPrepBeforeMember: before(myPrep,member),
      memberBeforeMeal: before(member,meal),
      memberClass: member?.classList.contains('home-prep-member-section') === true,
      mealClass: meal?.classList.contains('home-meal-section') === true
    };
  });

  const labels=await page.locator('#nextMealCard .home-meal-stage-label').allTextContents();
  const stages=await page.locator('#nextMealCard .home-meal-stage').allTextContents();
  const todoHidden=await page.locator('#homeTodo').evaluate(node => getComputedStyle(node.closest('.home-section')).display === 'none');
  const firstHasDetail=stages[0]?.includes('준비')===true && stages[0]?.includes('담당')===true;
  const secondIsRoundTwo=labels[1]?.trim()==='2차' && stages[1]?.includes('QA 2차')===true;
  const overflow=await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

  await page.screenshot({ path:'qa/home-dashboard-smoke-result.png', fullPage:true });
  console.log(JSON.stringify({layout,labels,todoHidden,firstHasDetail,secondIsRoundTwo,overflow,errors},null,2));

  if(errors.length || !layout.heroBeforeMyPrep || !layout.myPrepBeforeMember || !layout.memberBeforeMeal || !layout.memberClass || !layout.mealClass || !todoHidden || !firstHasDetail || !secondIsRoundTwo || overflow) process.exitCode=1;
} catch(error) {
  console.error('HOME_DASHBOARD_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  await page.screenshot({ path:'qa/home-dashboard-smoke-result.png', fullPage:true }).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
