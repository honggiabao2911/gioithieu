const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    const visibleCursors = () => page.locator('.virtual-cursor').evaluateAll(cursors => cursors.filter(cursor => {
      const r = cursor.getBoundingClientRect();
      return !cursor.closest('[hidden]') && Number(getComputedStyle(cursor).opacity) > .9 && r.left >= 0 && r.left < innerWidth && r.top >= 0 && r.top + 35 < innerHeight;
    }).length);
    assert.equal(await visibleCursors(), 6, `six visible cursors on entry at ${width}px`);
    assert.ok(await page.locator('#home .virtual-cursor svg').first().evaluate(el => el.getBoundingClientRect().width) >= 25);
    await page.waitForTimeout(500);
    assert.equal(await visibleCursors(), 6, 'cursors do not disappear while pausing');
    for (const y of [60, 120, 180, 240]) {
      await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y);
      await page.waitForTimeout(40);
      assert.ok(await visibleCursors() >= 6, `collaboration remains visible at scroll ${y} on ${width}px`);
    }
    await page.locator('#effects-toggle').click();
    assert.equal(await visibleCursors(), 0);
    await page.locator('#replay').click();
    await page.waitForTimeout(60);
    assert.equal(await visibleCursors(), 6, 'replay enables effects and shows the team');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await page.close();
  }
  await browser.close();
  console.log('PASS: six large cursors visible on entry, pause and scroll; replay from effects-off; desktop and mobile.');
})().catch(error => { console.error(error); process.exit(1); });
