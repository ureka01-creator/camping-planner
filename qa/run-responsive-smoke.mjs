import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const cases = [
  { name: 'android-360', width: 360, height: 800 },
  { name: 'android-412', width: 412, height: 915 }
];

let failed = false;

for (const c of cases) {
  const page = await browser.newPage({ viewport: { width: c.width, height: c.height }, deviceScaleFactor: 2 });
  const errors = [];
  const networkWarnings = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to load resource/.test(text)) networkWarnings.push(text);
    else errors.push(text);
  });

  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const landing = page.locator('.camp-landing');
    if (await landing.count()) {
      await landing.click();
      await landing.waitFor({ state: 'detached', timeout: 5000 });
    }

    await page.locator('#view-home.active').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(250);

    const check = async label => {
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        appBg: getComputedStyle(document.getElementById('app')).backgroundColor
      }));
      console.log(c.name, label, result);
      if (result.overflow || result.bodyBg === 'rgb(246, 240, 230)' || result.bodyBg === 'rgb(255, 255, 255)') failed = true;
    };

    await check('home');

    await page.locator('[data-nav="meals"]').click();
    await page.locator('#view-meals.active').waitFor({ state: 'visible', timeout: 5000 });
    await check('meals');

    await page.locator('[data-nav="items"]').click();
    await page.locator('#view-items.active').waitFor({ state: 'visible', timeout: 5000 });
    await check('items');

    await page.locator('[data-nav="settlement"]').click();
    await page.locator('#view-settlement.active').waitFor({ state: 'visible', timeout: 5000 });
    await check('settlement');

    await page.locator('#settingsShortcut').click();
    await page.locator('#view-settings.active').waitFor({ state: 'visible', timeout: 5000 });
    await check('settings');

    if (errors.length) {
      console.error(c.name, errors);
      failed = true;
    }
    if (networkWarnings.length) console.warn(c.name, networkWarnings);
  } catch (error) {
    console.error(c.name, error);
    failed = true;
  } finally {
    await page.close();
  }
}

await browser.close();
if (failed) process.exitCode = 1;
