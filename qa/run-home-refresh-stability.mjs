import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const page = await context.newPage();
const errors=[];

page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => {
  if (msg.type()==='error' && !msg.text().startsWith('Failed to load resource:')) errors.push(msg.text());
});

await page.addInitScript(() => {
  window.__homeVisibleSnapshots=[];
  document.addEventListener('DOMContentLoaded', () => {
    let frames=0;
    const tick=() => {
      const home=document.getElementById('view-home');
      const landing=document.querySelector('.camp-landing:not(.is-exiting)');
      if(home) {
        const style=getComputedStyle(home);
        const visible=home.classList.contains('active')
          && style.display!=='none'
          && style.visibility!=='hidden'
          && !landing
          && !document.body.classList.contains('landing-cover-active');
        if(visible) {
          const key=node => {
            if(node.matches('.hero-card')) return 'prep';
            if(node.id==='myPrepQuickCard') return 'mine';
            if(node.querySelector?.('#memberProgress')) return 'members';
            if(node.querySelector?.('#nextMealCard')) return 'meals';
            if(node.id==='homeMemoCard') return 'memo';
            return '';
          };
          window.__homeVisibleSnapshots.push({
            order:[...home.children].map(key).filter(Boolean),
            foodPlan:Boolean(document.querySelector('#nextMealCard .home-food-plan')),
            legacyMeal:Boolean(document.querySelector('#nextMealCard .meal-day, #nextMealCard .meal-name')),
            hydrating:document.body.classList.contains('home-hydrating')
          });
        }
      }
      if(frames++ < 160) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { once:true });
});

async function closeLanding() {
  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({state:'detached',timeout:5000});
  }
  await page.evaluate(() => {
    document.querySelectorAll('.google-login-backdrop').forEach(node=>node.remove());
    document.body.classList.remove('google-login-open');
  });
}

try {
  await page.goto('http://127.0.0.1:4173/', {waitUntil:'domcontentloaded',timeout:30000});
  await closeLanding();
  await page.waitForFunction(() => !document.body.classList.contains('home-hydrating'), null, {timeout:15000});
  await page.waitForFunction(() => Boolean(window.CampingHomeOrder?.apply), null, {timeout:15000});

  await page.evaluate(() => {
    const trip='camp-2026-09-demo';
    localStorage.setItem(`camp:homeOrder:${trip}`, JSON.stringify(['meals','prep','mine','members','memo']));
    window.CampingHomeOrder.apply();
  });

  const expected=await page.evaluate(() => [...document.querySelector('#view-home').children].map(node => {
    if(node.matches('.hero-card')) return 'prep';
    if(node.id==='myPrepQuickCard') return 'mine';
    if(node.querySelector?.('#memberProgress')) return 'members';
    if(node.querySelector?.('#nextMealCard')) return 'meals';
    if(node.id==='homeMemoCard') return 'memo';
    return '';
  }).filter(Boolean));

  await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  await closeLanding();
  await page.waitForFunction(() => !document.body.classList.contains('home-hydrating'), null, {timeout:15000});
  await page.waitForTimeout(500);

  const result=await page.evaluate(expectedOrder => {
    const snapshots=window.__homeVisibleSnapshots || [];
    const bad=snapshots.filter(s => s.order.join(',')!==expectedOrder.join(',') || s.legacyMeal || s.hydrating);
    return {expectedOrder,snapshots,bad};
  }, expected);

  console.log(JSON.stringify({result,errors},null,2));
  if(errors.length || !result.snapshots.length || result.bad.length) process.exitCode=1;
} catch(error) {
  console.error('HOME_REFRESH_STABILITY_FAILED', error);
  process.exitCode=1;
} finally {
  await browser.close();
}