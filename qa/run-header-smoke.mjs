import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

try {
  await page.goto('http://127.0.0.1:4173/qa/header-smoke.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.dataset.qa === 'PASS' || document.body.dataset.qa === 'FAIL');
  const result = await page.locator('#qaResult').innerText();
  const status = await page.evaluate(() => document.body.dataset.qa);
  await page.screenshot({ path: 'qa/header-smoke-result.png', fullPage: true });
  console.log(result);
  if (status !== 'PASS') process.exitCode = 1;
} finally {
  await browser.close();
}
