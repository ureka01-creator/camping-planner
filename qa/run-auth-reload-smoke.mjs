import { chromium } from 'playwright';

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2 });
const page = await context.newPage();
const errors=[];

page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', msg => { if (msg.type()==='error') errors.push(`console: ${msg.text()}`); });

const tripId = 'qa-auth-reload-smoke';
const url = `http://127.0.0.1:4173/?trip=${tripId}`;

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
    () => document.querySelector('#connectionText')?.textContent.includes('Firebase 실시간 연결됨'),
    null,
    { timeout:25000 }
  );
}

async function currentUid() {
  return page.evaluate(async () => {
    const mod = await import('./js/firebase.js?v=064');
    if (typeof mod.dataAdapter?.auth?.authStateReady === 'function') await mod.dataAdapter.auth.authStateReady();
    return mod.dataAdapter?.auth?.currentUser?.uid || null;
  });
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
    const mode = await page.evaluate(async () => (await import('./js/firebase.js?v=064')).dataAdapter?.authPersistence || null);
    uids.push(uid);
    persistence.push(mode);
  }

  const stableUid = Boolean(uids[0]) && uids.every(uid => uid === uids[0]);
  const connectedEveryTime = persistence.every(mode => ['local','session','memory'].includes(mode));

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
