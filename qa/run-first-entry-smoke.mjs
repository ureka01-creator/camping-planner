import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const page = await context.newPage();
const errors=[];
const networkWarnings=[];
const personalDisplayName='QA 개인이름';

await page.addInitScript(name => {
  localStorage.setItem('camp:myName', name);
}, personalDisplayName);

page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => {
  if(msg.type()!=='error') return;
  const text=msg.text();
  if(text.startsWith('Failed to load resource:')) networkWarnings.push(`console: ${text}`);
  else errors.push(`console: ${text}`);
});

const url='http://127.0.0.1:4173/?trip=qa-first-entry-smoke-v1';

async function enterLanding() {
  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }
}

try {
  await page.goto(url, { waitUntil:'domcontentloaded', timeout:30000 });
  await enterLanding();
  await page.locator('#view-home.active').waitFor({ state:'visible', timeout:15000 });
  await page.locator('#firstEntryBackdrop').waitFor({ state:'visible', timeout:15000 });

  const teams=page.locator('.first-entry-team');
  const teamCount=await teams.count();
  const pickerText=(await page.locator('.first-entry-team-list').textContent()) || '';
  const commonHidden=!pickerText.includes('공용');
  const first=teams.first();
  const firstName=(await first.locator('strong').textContent())?.trim() || '';
  const firstId=await first.getAttribute('data-first-entry-member');

  if(!firstName || !firstId) throw new Error('No selectable team in first-entry picker');

  await first.click();
  await page.locator('#firstEntryBackdrop').waitFor({ state:'detached', timeout:5000 });

  const stored=await page.evaluate(() => ({
    id:localStorage.getItem('camp:myMemberId'),
    name:localStorage.getItem('camp:myName')
  }));
  const displayNamePreserved=stored.name===personalDisplayName;

  const card=page.locator('#myPrepQuickCard');
  await card.waitFor({ state:'visible', timeout:5000 });
  const cardText=(await card.textContent()) || '';
  const cardHasTeam=cardText.includes(firstName);
  const myPrepAction=await card.locator('[data-open-my-prep]').count()===1;

  await card.locator('[data-open-my-prep]').click();
  await page.locator('#view-items.active').waitFor({ state:'visible', timeout:5000 });
  await page.waitForFunction(id => document.querySelector(`#assigneeFilters [data-assignee-filter="${CSS.escape(id)}"]`)?.classList.contains('active') === true, firstId, { timeout:5000 });
  const assigneeFilterActive=await page.locator(`#assigneeFilters [data-assignee-filter="${firstId}"].active`).count()===1;

  await page.reload({ waitUntil:'domcontentloaded', timeout:30000 });
  await enterLanding();
  await page.locator('#view-home.active').waitFor({ state:'visible', timeout:15000 });
  await page.waitForTimeout(700);
  const pickerAfterReload=await page.locator('#firstEntryBackdrop').count();
  const retainedCardText=(await page.locator('#myPrepQuickCard').textContent()) || '';
  const retained=retainedCardText.includes(firstName);

  const result={teamCount,commonHidden,firstName,stored,displayNamePreserved,cardHasTeam,myPrepAction,assigneeFilterActive,pickerAfterReload,retained,errors,networkWarnings};
  console.log(JSON.stringify(result,null,2));
  await page.screenshot({ path:'qa/first-entry-smoke-result.png', fullPage:true });

  if(errors.length || teamCount<1 || !commonHidden || stored.id!==firstId || !displayNamePreserved || !cardHasTeam || !myPrepAction || !assigneeFilterActive || pickerAfterReload!==0 || !retained) process.exitCode=1;
} catch(error) {
  console.error('FIRST_ENTRY_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  await page.screenshot({ path:'qa/first-entry-smoke-result.png', fullPage:true }).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
