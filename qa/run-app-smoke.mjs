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
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout:30000 });
  const landing=page.locator('.camp-landing');
  if(await landing.count()){
    await landing.click();
    await landing.waitFor({state:'detached', timeout:5000});
  }

  await page.waitForFunction(() => Boolean(document.querySelector('#tripDates')?.textContent.trim()), null, { timeout:15000 });

  await page.locator('[data-nav="meals"]').click();
  await page.locator('#view-meals.active').waitFor({state:'visible', timeout:5000});
  await page.waitForFunction(() => document.querySelectorAll('#dateTabs .date-tab').length >= 2, null, { timeout:15000 });
  await page.waitForFunction(() => document.querySelectorAll('#mealList .meal-overview-row').length > 0, null, { timeout:15000 });

  const dates=await page.locator('#dateTabs .date-tab').allTextContents();
  const allDefault=await page.locator('#dateTabs [data-meal-scope="all"].active').count()===1;
  const overviewDays=await page.locator('#mealList .meal-overview-day').count();
  const overviewRows=await page.locator('#mealList .meal-overview-row').count();
  const overviewDragHandles=await page.locator('#mealList .meal-overview-row .meal-drag-handle').count();
  const emptyOverviewRows=page.locator('#mealList .meal-overview-row').filter({hasText:'준비 항목 없음'});
  const emptyOverviewCount=await emptyOverviewRows.count();
  const emptyOverview100=emptyOverviewCount===0 || (await emptyOverviewRows.first().locator('.meal-overview-progress b').textContent())?.trim()==='100%';

  const firstDateTab=page.locator('#dateTabs [data-date]').first();
  await firstDateTab.click();
  await page.waitForTimeout(180);

  const cards=await page.locator('#mealList .meal-card').count();
  const empty=await page.locator('#mealList .empty-state').count();
  const toggles=cards ? await page.locator('#mealList .meal-inline-toggle').count() : 0;
  const detailDragHandles=cards ? await page.locator('#mealList .meal-card .meal-drag-handle').count() : 0;
  const visibleAddFormsBefore=cards ? await page.locator('#mealList .meal-inline-form:visible').count() : 0;
  const overflowBefore=await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

  let addToggleOk=true;
  let inlineEditOk=true;
  let editFocusOk=true;
  if(cards>0){
    const firstToggle=page.locator('#mealList .meal-inline-toggle:visible').first();
    await firstToggle.scrollIntoViewIfNeeded();
    await firstToggle.click();
    addToggleOk=(await firstToggle.getAttribute('aria-expanded'))==='true' && await page.locator('#mealList .meal-inline-form:visible').first().isVisible();
    await firstToggle.click();

    const editButtons=page.locator('#mealList [data-edit-meal-item]:visible');
    if(await editButtons.count()){
      const firstEdit=editButtons.first();
      await firstEdit.scrollIntoViewIfNeeded();
      await firstEdit.click();
      const editor=page.locator('#mealList .meal-inline-edit:visible').first();
      inlineEditOk=await editor.isVisible();
      const modalVisible=await page.locator('#modalBackdrop:not(.hidden)').count();
      inlineEditOk=inlineEditOk && modalVisible===0;
      await page.waitForTimeout(120);
      editFocusOk=await page.evaluate(() => document.activeElement?.matches?.('#mealList .meal-inline-edit input[name="name"]') === true);
      await page.locator('#mealList .meal-inline-cancel:visible').first().evaluate(button => button.click());
    }
  }

  const overflowAfter=await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

  await page.locator('[data-nav="home"]').click();
  await page.locator('[data-nav="meals"]').click();
  await page.waitForTimeout(150);
  const allAfterReentry=await page.locator('#dateTabs [data-meal-scope="all"].active').count()===1;

  await page.locator('[data-nav="items"]').click();
  await page.locator('#view-items.active').waitFor({state:'visible', timeout:5000});
  await page.waitForTimeout(150);
  const itemSummary=(await page.locator('#itemSummary').textContent())?.trim() || '';
  const packingViewOk=/^전체 \d+개 중 \d+개 준비$/.test(itemSummary)
    && await page.locator('#itemFilters [data-filter="all"]').count()===1
    && await page.locator('#itemFilters [data-filter="todo"]').count()===1;

  await page.locator('#settingsShortcut').click();
  await page.locator('#view-settings.active').waitFor({state:'visible', timeout:5000});
  await page.waitForFunction(() => {
    const start=document.querySelector('#tripStartDateInput');
    const end=document.querySelector('#tripEndDateInput');
    return Boolean(start?.value && end?.value);
  }, null, { timeout:15000 });
  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('Firebase 실시간 연결됨'), null, { timeout:15000 });

  const connectionText=await page.locator('#connectionText').textContent();
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

  const dbConnected=connectionText?.includes('Firebase 실시간 연결됨') === true;
  console.log(JSON.stringify({dates,allDefault,overviewDays,overviewRows,overviewDragHandles,emptyOverviewCount,emptyOverview100,cards,empty,toggles,detailDragHandles,visibleAddFormsBefore,addToggleOk,inlineEditOk,editFocusOk,allAfterReentry,itemSummary,packingViewOk,dbConnected,connectionText,overflowBefore,overflowAfter,initial,constrained,errors},null,2));
  await page.screenshot({ path:'qa/app-smoke-result.png', fullPage:true });

  const allViewOk=dates[0]==='전체' && allDefault && allAfterReentry && overviewDays>=1;
  const detailScreenOk=cards>0 ? toggles===cards && visibleAddFormsBefore===0 && addToggleOk && inlineEditOk && editFocusOk : empty>0;
  const dragUiOk=overviewRows>0 && overviewDragHandles===overviewRows && (cards===0 || detailDragHandles===cards);
  const emptyMealOk=emptyOverviewCount>0 && emptyOverview100;
  const widthOk=!overflowBefore && !overflowAfter;
  const dateConstraintOk=initial.min===initial.start && constrained.min===probeStart && constrained.end===probeStart;
  if(errors.length || !dbConnected || !allViewOk || !detailScreenOk || !dragUiOk || !emptyMealOk || !packingViewOk || !widthOk || !dateConstraintOk) process.exitCode=1;
} catch(e){
  console.error('APP_SMOKE_FAILED', e);
  console.error(errors.join('\n'));
  await page.screenshot({ path:'qa/app-smoke-result.png', fullPage:true }).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
