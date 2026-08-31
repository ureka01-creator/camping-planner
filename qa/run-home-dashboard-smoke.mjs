import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
const tripId=`qa-home-dashboard-${Date.now()}`;
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => { if (msg.type()==='error') errors.push(`console: ${msg.text()}`); });

try {
  await page.goto(`http://127.0.0.1:4173/?trip=${tripId}`, { waitUntil:'domcontentloaded', timeout:30000 });

  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }

  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('Firebase 실시간 연결됨'), null, { timeout:20000 });

  const ensureTeamSelected=async()=>{
    const selected=await page.evaluate(() => Boolean(localStorage.getItem('camp:myMemberId')));
    if(selected) return;
    const picker=page.locator('#firstEntryBackdrop');
    if(!(await picker.count())) {
      await page.locator('[data-open-team-picker]').first().click();
      await picker.waitFor({ state:'visible', timeout:5000 });
    }
    await page.locator('[data-first-entry-member]').first().click();
    await picker.waitFor({ state:'detached', timeout:5000 });
  };
  await ensureTeamSelected();

  await page.evaluate(async () => {
    const { dataAdapter } = await import('./js/firebase.js?v=064');
    await dataAdapter.mutate(data => {
      const firstDate = data?.trip?.startDate || '2026-09-11';
      const next = new Date(`${firstDate}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      const nextDate = next.toISOString().slice(0,10);
      const memberId = data.members?.[0]?.id || '';
      data.meals = [
        {
          id:'qa-home-1st', date:firstDate, mealType:'dinner', menu:'QA 해산물 파티',
          assigneeId:memberId, note:'첫날 메인 저녁',
          items:[{ id:'qa-home-1st-item', name:'QA 해산물', quantity:'1개', assigneeId:memberId, isDone:true, note:'' }]
        },
        {
          id:'qa-home-2nd', date:firstDate, mealType:'snack', menu:'QA 닭발 & 계란찜',
          assigneeId:memberId, note:'2차 테스트',
          items:[{ id:'qa-home-2nd-item', name:'QA 안주', quantity:'1개', assigneeId:memberId, isDone:false, note:'' }]
        },
        {
          id:'qa-home-next', date:nextDate, mealType:'breakfast', menu:'QA 다음 아침',
          assigneeId:memberId, note:'', items:[]
        }
      ];
    });
  });

  await page.waitForFunction(() => document.querySelectorAll('#nextMealCard .home-food-stage').length === 2, null, { timeout:15000 });
  await page.waitForFunction(() => document.querySelector('#nextMealCard .home-food-next')?.textContent.includes('QA 다음 아침'), null, { timeout:10000 });
  await page.waitForFunction(() => document.querySelector('#homeTodo')?.closest('.home-section')?.classList.contains('home-todo-hidden') === true, null, { timeout:5000 });
  await page.waitForFunction(() => document.querySelector('#progressCaption')?.textContent.startsWith('전체 준비 '), null, { timeout:5000 });

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

  const food=await page.evaluate(() => {
    const section=document.querySelector('#nextMealCard')?.closest('.home-section');
    const stages=[...document.querySelectorAll('#nextMealCard .home-food-stage')];
    const marks=stages.map(stage => stage.querySelector('.home-food-stage-mark span')?.textContent.trim() || '');
    const menus=stages.map(stage => stage.querySelector('.home-food-stage-copy strong')?.textContent.trim() || '');
    const cardText=document.querySelector('#nextMealCard')?.textContent || '';
    return {
      kicker:section?.querySelector('.home-food-heading > span')?.textContent.trim() || '',
      title:section?.querySelector('.home-food-heading h2')?.textContent.trim() || '',
      marks,
      menus,
      nextText:document.querySelector('#nextMealCard .home-food-next')?.textContent.replace(/\s+/g,' ').trim() || '',
      hasPercent:cardText.includes('%'),
      firstStatus:stages[0]?.querySelector('.home-food-stage-copy small')?.textContent.trim() || '',
      secondStatus:stages[1]?.querySelector('.home-food-stage-copy small')?.textContent.trim() || ''
    };
  });

  const todoHidden=await page.locator('#homeTodo').evaluate(node => getComputedStyle(node.closest('.home-section')).display === 'none');

  const prepMetric=await page.evaluate(() => {
    const memberId=localStorage.getItem('camp:myMemberId') || '';
    const myText=document.querySelector('#myPrepQuickCard .my-prep-copy strong')?.textContent || '';
    const memberText=document.querySelector(`[data-home-member-progress="${CSS.escape(memberId)}"] .tiny`)?.textContent || '';
    const myMatch=myText.match(/(\d+)\/(\d+)/);
    const memberMatch=memberText.match(/(\d+)\/(\d+)/);
    return {
      memberId,
      myText,
      memberText,
      aligned:Boolean(myMatch && memberMatch && myMatch[1]===memberMatch[1] && myMatch[2]===memberMatch[2])
    };
  });

  const heroCaption=(await page.locator('#progressCaption').textContent())?.trim() || '';
  const overflow=await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

  await page.screenshot({ path:'qa/home-dashboard-smoke-result.png', fullPage:true });
  console.log(JSON.stringify({tripId,layout,food,todoHidden,prepMetric,heroCaption,overflow,errors},null,2));

  const foodOk = food.kicker==='FOOD PLAN'
    && food.title==='첫날 먹을 것'
    && food.marks[0]==='1차'
    && food.marks[1]==='2차'
    && food.menus[0]==='QA 해산물 파티'
    && food.menus[1]==='QA 닭발 & 계란찜'
    && food.nextText.includes('NEXT')
    && food.nextText.includes('QA 다음 아침')
    && food.firstStatus.includes('준비 완료')
    && food.secondStatus.includes('1개 남음')
    && !food.hasPercent;

  if(errors.length || !layout.heroBeforeMyPrep || !layout.myPrepBeforeMember || !layout.memberBeforeMeal || !layout.memberClass || !layout.mealClass || !todoHidden || !foodOk || !prepMetric.aligned || !heroCaption.startsWith('전체 준비 ') || overflow) process.exitCode=1;
} catch(error) {
  console.error('HOME_DASHBOARD_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  await page.screenshot({ path:'qa/home-dashboard-smoke-result.png', fullPage:true }).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
