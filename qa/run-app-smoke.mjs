import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors=[];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', msg => { if(msg.type()==='error') errors.push(`console: ${msg.text()}`); });

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const landing=page.locator('.camp-landing');
  if(await landing.count()) await landing.click();
  await page.locator('[data-nav="meals"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#dateTabs .date-tab').length >= 3, null, { timeout: 15000 });
  const dates=await page.locator('#dateTabs .date-tab').allTextContents();
  const cards=await page.locator('#mealList .meal-card').count();
  const empty=await page.locator('#mealList .empty-state').count();
  console.log(JSON.stringify({dates,cards,empty,errors},null,2));
  await page.screenshot({ path:'qa/app-smoke-result.png', fullPage:true });
  if(errors.length || dates.join('|')!=='9/11|9/12|9/13' || (cards===0 && empty===0)) process.exitCode=1;
} catch(e){
  console.error('APP_SMOKE_FAILED', e);
  console.error(errors.join('\n'));
  await page.screenshot({ path:'qa/app-smoke-result.png', fullPage:true }).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
