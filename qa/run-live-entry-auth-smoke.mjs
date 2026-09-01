import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const page = await context.newPage();
const errors=[];
const url='https://ureka01-creator.github.io/camping-planner/';

page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => {
  if (msg.type()==='error' && !msg.text().startsWith('Failed to load resource:')) errors.push(`console: ${msg.text()}`);
});

try {
  await page.goto(url, { waitUntil:'domcontentloaded', timeout:30000 });
  const landing=page.locator('.camp-landing').first();
  await landing.waitFor({ state:'visible', timeout:10000 });
  await page.waitForFunction(() => {
    const image=document.querySelector('.camp-landing .camp-landing-poster');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth>0;
  }, null, {timeout:10000});

  const landingState=await page.evaluate(() => ({
    id:document.querySelector('.camp-landing')?.id || '',
    imageWidth:document.querySelector('.camp-landing .camp-landing-poster')?.naturalWidth || 0,
    version:document.querySelector('#view-settings .version')?.textContent || ''
  }));

  await page.waitForFunction(() => window.CampingGoogleAuthReady === true, null, {timeout:20000});
  await landing.click();
  await page.locator('.camp-landing').waitFor({state:'detached',timeout:5000});

  const gate=page.locator('.google-login-backdrop');
  await gate.waitFor({state:'visible',timeout:10000});
  const button=gate.locator('[data-google-login]');
  await button.waitFor({state:'visible',timeout:5000});

  const popupPromise=page.waitForEvent('popup',{timeout:10000}).catch(()=>null);
  await button.click();
  const popup=await popupPromise;
  await page.waitForTimeout(1500);
  const authState=await page.evaluate(() => ({
    started:document.querySelector('[data-google-login]')?.dataset.authStarted || '',
    status:document.querySelector('[data-google-login-status]')?.textContent?.trim() || '',
    currentUrl:location.href
  }));
  const popupUrl=popup?.url() || '';
  await popup?.close().catch(()=>{});

  console.log(JSON.stringify({landingState,authState,popupUrl,errors},null,2));
  const unauthorized=/허용 도메인|unauthorized-domain/.test(authState.status + ' ' + errors.join(' '));
  if(landingState.imageWidth<=0 || !landingState.version.includes('v1.0.5') || authState.started!=='1' || unauthorized) process.exitCode=1;
} catch(error) {
  console.error('LIVE_ENTRY_AUTH_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  process.exitCode=1;
} finally {
  await browser.close();
}