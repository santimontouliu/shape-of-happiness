import { test, expect } from '@playwright/test';

async function ready(page, hash = '') {
  await page.goto(`/${hash}`);
  await page.waitForSelector('html.is-ready');
}
async function belowHeader(page, chapter) {
  await expect.poll(async () => page.locator(`#${chapter}`).evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    const bottom = document.querySelector('.site-header').getBoundingClientRect().bottom;
    return top >= bottom - 1 && top < bottom + 40;
  })).toBe(true);
}

test('guided questions reset stale filters and open the correct chapter', async ({ page }) => {
  await ready(page, '#year=2021&x=health&r=sas&c=ARG&trails=1');
  for (const chapter of ['explorer', 'compare', 'movers']) {
    await page.locator('[href="#top"]').click();
    await page.locator(`[data-preset="${chapter}"]`).click();
    await expect(page).toHaveURL(new RegExp(`x=${chapter === 'explorer' ? 'gdp' : 'social'}&c=URY,FIN&chapter=${chapter}$`));
    await belowHeader(page, chapter);
    await expect(page.locator('#year-out')).toHaveText('2025');
    await expect(page.locator('#region-count')).toHaveText('All');
    await expect(page.locator('#toggle-trails')).toHaveAttribute('aria-pressed', 'false');
  }
});

test('chapter links reopen filters, trails and driver highlights', async ({ page }) => {
  await ready(page, '#year=2021&x=gdp&r=lac&c=URY,ARG&trails=1&chapter=drivers&focus=dystopia');
  await belowHeader(page, 'drivers');
  await expect(page.locator('#year-out')).toHaveText('2021');
  await expect(page.locator('#chips')).toContainText('Argentina');
  await expect(page.locator('#toggle-trails')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#drivers-legend button').filter({ hasText: 'Residual' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await belowHeader(page, 'drivers');
});

test('reset clears filters and stops playback', async ({ page, isMobile }) => {
  await ready(page, '#year=2021&x=gdp&r=lac&c=ARG&trails=1&chapter=explorer&focus=gdp');
  await page.locator('[data-play="all"]').click();
  if (isMobile) await page.locator('#filter-toggle').click();
  await page.locator('#reset-view').click();
  await belowHeader(page, 'top');
  await expect(page).toHaveURL(/year=2025&x=social&c=URY,FIN&chapter=top$/);
  await expect(page.locator('[data-play="all"]')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(1200);
  await expect(page.locator('#year-out')).toHaveText('2025');
  await expect(page.locator('#drivers-legend [aria-pressed="true"]')).toHaveCount(0);
});

test('legacy chapter anchors still open their chapter', async ({ page }) => {
  await ready(page, '#compare');
  await belowHeader(page, 'compare');
});
