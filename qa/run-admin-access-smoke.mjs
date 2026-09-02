import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const errors=[];
const networkWarnings=[];
const tripId=`qa-admin-access-${Date.now()}`;

page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => {
  if(msg.type()!=='error') return;
  const text=msg.text();
  if(text.startsWith('Failed to load resource:')) networkWarnings.push(`console: ${text}`);
  else errors.push(`console: ${text}`);
});

try {
  await page.goto(`http://127.0.0.1:4173/?trip=${tripId}&data=local&qaRole=user`, { waitUntil:'domcontentloaded', timeout:30000 });

  const landing=page.locator('.camp-landing');
  if(await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }

  await page.waitForFunction(() => document.querySelector('#connectionText')?.textContent.includes('로컬 데모 모드'), null, { timeout:20000 });

  const picker=page.locator('#firstEntryBackdrop');
  if(await picker.count()) {
    await page.locator('[data-first-entry-later]').click();
    await picker.waitFor({ state:'detached', timeout:5000 });
  }

  await page.locator('[data-go="settings"]').first().click();
  await page.locator('#view-settings.active').waitFor({ state:'visible', timeout:5000 });
  await page.locator('#adminAccessCard').waitFor({ state:'visible', timeout:5000 });

  const userState=await page.evaluate(() => ({
    shareHidden: !document.getElementById('shareBtn') || getComputedStyle(document.getElementById('shareBtn')).display === 'none',
    startDisabled: document.getElementById('tripStartDateInput')?.disabled === true,
    endDisabled: document.getElementById('tripEndDateInput')?.disabled === true,
    saveHidden: document.getElementById('saveTripDatesBtn')?.hidden === true,
    addMemberHidden: document.getElementById('addMemberBtn')?.hidden === true,
    editMembersVisible: [...document.querySelectorAll('[data-edit-member]')].some(button => getComputedStyle(button).display !== 'none' && !button.hidden),
    buttonText: document.getElementById('adminAccessBtn')?.textContent.trim() || ''
  }));

  const guardResult=await page.evaluate(async () => {
    const { dataAdapter } = await import('./js/firebase.js?v=064');
    try {
      await dataAdapter.mutate(data => {
        data.members.push({ id:'qa-forbidden-member', name:'금지 변경', type:'team', order:999 });
      });
      return 'allowed';
    } catch(error) {
      return error?.code || error?.message || 'blocked';
    }
  });

  page.once('dialog', dialog => dialog.accept('qa-admin'));
  await page.locator('#adminAccessBtn').click();
  await page.waitForFunction(() => document.documentElement.classList.contains('admin-mode'), null, { timeout:5000 });

  const adminState=await page.evaluate(() => ({
    startEnabled: document.getElementById('tripStartDateInput')?.disabled === false,
    endEnabled: document.getElementById('tripEndDateInput')?.disabled === false,
    saveVisible: document.getElementById('saveTripDatesBtn')?.hidden === false,
    addMemberVisible: document.getElementById('addMemberBtn')?.hidden === false,
    editMemberVisible: [...document.querySelectorAll('[data-edit-member]')].some(button => getComputedStyle(button).display !== 'none' && !button.hidden),
    buttonText: document.getElementById('adminAccessBtn')?.textContent.trim() || ''
  }));

  await page.screenshot({ path:'qa/admin-access-smoke-result.png', fullPage:true });
  console.log(JSON.stringify({tripId,userState,guardResult,adminState,errors,networkWarnings},null,2));

  const userLocked=userState.shareHidden && userState.startDisabled && userState.endDisabled && userState.saveHidden && userState.addMemberHidden && !userState.editMembersVisible && userState.buttonText==='관리자 인증';
  const guardBlocked=guardResult==='ADMIN_REQUIRED';
  const adminUnlocked=adminState.startEnabled && adminState.endEnabled && adminState.saveVisible && adminState.addMemberVisible && adminState.editMemberVisible && adminState.buttonText==='관리자 해제';

  if(errors.length || !userLocked || !guardBlocked || !adminUnlocked) process.exitCode=1;
} catch(error) {
  console.error('ADMIN_ACCESS_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  await page.screenshot({ path:'qa/admin-access-smoke-result.png', fullPage:true }).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
