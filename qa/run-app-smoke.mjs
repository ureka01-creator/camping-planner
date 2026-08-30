import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors=[];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', msg => { if(msg.type()==='error') errors.push(`console: ${msg.text()}`); });

function addDay(iso){
  const [y,m,d]=iso.split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d+1));
  return date.toISOString().slice(0,10);
}

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const landing=page.locator('.camp-landing');
  if(await landing.count()) await landing.click();

  await page.locator('[data-nav="meals"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#dateTabs .date-tab').length >= 1, null, { timeout: 15000 });
  const dates=await page.locator('#dateTabs .date-tab').allTextContents();
  const cards=await page.locator('#mealList .meal-card').count();
  const empty=await page.locator('#mealList .empty-state').count();
  const inlineForms=cards ? await page.locator('#mealList .meal-inline-form').count() : 0;

  await page.locator('[data-nav="settings"]').click();
  await page.waitForFunction(() => {
    const start=document.querySelector('#tripStartDateInput');
    const end=document.querySelector('#tripEndDateInput');
    return Boolean(start?.value && end?.value);
  }, null, { timeout: 15000 });

  const initial=await page.evaluate(() => ({
    start: document.querySelector('#tripStartDateInput').value,
    end: document.querySelector('#tripEndDateInput').value,
    min: document.querySelector('#tripEndDateInput').min
  }));
  const probeStart=addDay(initial.start);
  await page.locator('#tripEndDateInput').fill(initial.start);
  await page.locator('#tripStartDateInput').fill(probeStart);
  await page.locator('#tripStartDateInput').dispatchEvent('input');
  const constrained=await page.evaluate(() => ({
    start: document.querySelector('#tripStartDateInput').value,
    end: document.querySelector('#tripEndDateInput').value,
    min: document.querySelector('#tripEndDateInput').min
  }));

  console.log(JSON.stringify({dates,cards,empty,inlineForms,initial,constrained,errors},null,2));
  await page.screenshot({ path:'qa/app-smoke-result.png', fullPage:true });

  const mealScreenOk=dates.length>=1 && (cards>0 ? inlineForms===cards : empty>0);
  const dateConstraintOk=initial.min===initial.start && constrained.min===probeStart && constrained.end===probeStart;
  if(errors.length || !mealScreenOk || !dateConstraintOk) process.exitCode=1;
} catch(e){
  console.error('APP_SMOKE_FAILED', e);
  console.error(errors.join('\n'));
  await page.screenshot({ path:'qa/app-smoke-result.png', fullPage:true }).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
