import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const page = await context.newPage();
const errors=[];

page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => {
  if (msg.type()==='error' && !msg.text().startsWith('Failed to load resource:')) errors.push(`console: ${msg.text()}`);
});

try {
  await page.goto('http://localhost:4173/', { waitUntil:'domcontentloaded', timeout:30000 });

  const landing=page.locator('#initialLanding.camp-landing');
  await landing.waitFor({ state:'visible', timeout:3000 });
  await page.waitForFunction(() => {
    const image=document.querySelector('#initialLanding .camp-landing-poster');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth>0;
  }, null, {timeout:5000});

  const landingState=await page.evaluate(() => ({
    body:document.body.className,
    visible:getComputedStyle(document.getElementById('initialLanding')).display!=='none',
    imageWidth:document.querySelector('#initialLanding .camp-landing-poster')?.naturalWidth || 0
  }));

  await page.waitForFunction(() => window.CampingGoogleAuthReady === true, null, {timeout:15000});
  await landing.click();
  await page.locator('.camp-landing').waitFor({ state:'detached', timeout:5000 });

  const gate=page.locator('.google-login-backdrop');
  await gate.waitFor({ state:'visible', timeout:8000 });
  const button=gate.locator('[data-google-login]');
  await button.waitFor({ state:'visible', timeout:3000 });

  const hitTest=await button.evaluate(node => {
    const r=node.getBoundingClientRect();
    const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return Boolean(hit && (hit===node || node.contains(hit))) && !node.disabled;
  });

  const popupPromise=page.waitForEvent('popup', {timeout:8000}).catch(()=>null);
  await button.click();
  const popup=await popupPromise;
  await page.waitForTimeout(1200);

  const authState=await page.evaluate(() => ({
    started:document.querySelector('[data-google-login]')?.dataset.authStarted || '',
    status:document.querySelector('[data-google-login-status]')?.textContent?.trim() || '',
    gateVisible:Boolean(document.querySelector('.google-login-backdrop'))
  }));
  const popupUrl=popup ? popup.url() : '';
  await popup?.close().catch(()=>{});

  const hardFailure=/허용 도메인|실패했어|시작할 수 없어/.test(authState.status);
  const loginStarted=authState.started==='1' && (Boolean(popup) || !hardFailure);
  console.log(JSON.stringify({landingState,hitTest,authState,popupUrl,errors},null,2));

  if(errors.length || !landingState.visible || landingState.imageWidth<=0 || !hitTest || !loginStarted || hardFailure) process.exitCode=1;
} catch(error) {
  console.error('BASE_ENTRY_AUTH_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  await page.screenshot({path:'qa/base-entry-auth-smoke-result.png',fullPage:true}).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}