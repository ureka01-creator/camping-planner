import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const page = await context.newPage();
const errors=[];

page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => { if (msg.type()==='error') errors.push(`console: ${msg.text()}`); });

const tripId = 'qa-auth-reload-smoke';
const url = `http://127.0.0.1:4173/?trip=${tripId}&data=local`;

async function dismissLandingAndPicker() {
  const landing = page.locator('.camp-landing');
  if (await landing.count()) {
    await landing.click();
    await landing.waitFor({ state:'detached', timeout:5000 });
  }

  const picker = page.locator('#firstEntryBackdrop');
  if (await picker.count()) {
    await picker.locator('[data-first-entry-later]').click();
    await picker.waitFor({ state:'detached', timeout:5000 });
  }
}

async function waitConnected() {
  await page.waitForFunction(
    () => document.querySelector('#connectionText')?.textContent.includes('로컬 데모 모드'),
    null,
    { timeout:25000 }
  );
}

async function currentUid() {
  await page.waitForFunction(() => window.CampingGoogleAuthReady === true && Boolean(window.CampingGoogleUser?.uid), null, { timeout:10000 });
  return page.evaluate(() => ({
    runtime:window.CampingGoogleUser?.uid || null,
    stored:localStorage.getItem('camp:authUid') || null
  }));
}

try {
  await page.goto(url, { waitUntil:'domcontentloaded', timeout:30000 });
  await dismissLandingAndPicker();
  await waitConnected();

  const uids=[];
  const persistence=[];

  for (let i=0; i<4; i++) {
    if (i > 0) {
      await page.reload({ waitUntil:'domcontentloaded', timeout:30000 });
      await dismissLandingAndPicker();
      await waitConnected();
    }

    const uid = await currentUid();
    const mode = await page.locator('#connectionText').textContent();
    uids.push(uid);
    persistence.push(mode);
  }

  const stableUid = Boolean(uids[0]?.runtime) && uids.every(uid => uid.runtime === uids[0].runtime && uid.stored === uid.runtime);
  const connectedEveryTime = persistence.every(mode => mode?.includes('로컬 데모 모드'));

  console.log(JSON.stringify({ tripId, uids, persistence, stableUid, connectedEveryTime, errors }, null, 2));
  if (!stableUid || !connectedEveryTime || errors.length) process.exitCode=1;
} catch(error) {
  console.error('AUTH_RELOAD_SMOKE_FAILED', error);
  console.error(errors.join('\n'));
  process.exitCode=1;
} finally {
  await context.close();
  await browser.close();
}
