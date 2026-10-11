import { test, expect } from '@playwright/test';

async function open(page, isMobile, hash = '') {
  await page.goto(`/${hash}`);
  await page.waitForSelector('html.is-ready');
  if (isMobile) await page.getByRole('button', { name: 'Filters', exact: true }).click();
}

test('fourth country preserves selections and explains how to replace one', async ({ page, isMobile }) => {
  await open(page, isMobile, '#c=URY,FIN,ARG');
  await page.locator('#search').fill('Brazil');
  await page.locator('#search').press('Enter');
  await expect(page.locator('#chips .chip')).toHaveCount(3);
  await expect(page.locator('#chips')).toContainText('Uruguay');
  await expect(page.locator('#chips')).not.toContainText('Brazil');
  await expect(page.getByRole('status').filter({ hasText: 'Remove one' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Uruguay', exact: true }).click();
  await page.locator('#search').press('Enter');
  await expect(page.locator('#chips')).toContainText('Brazil');
  await expect(page.locator('#selection-status')).toBeHidden();
});

test('regional accessible map summary matches visible insight', async ({ page, isMobile }) => {
  await open(page, isMobile, '#year=2025&r=sas&c=URY');
  await expect(page.locator('#insight-map')).toContainText('Nepal');
  await expect(page.locator('#map-chart svg')).toHaveAttribute('aria-label', /Nepal is highest in the selected regions/);
  await expect(page.locator('#explorer-table tbody tr')).toHaveCount(6);
});

test('missing year is represented as a gap and unavailable table values', async ({ page, isMobile }) => {
  await open(page, isMobile);
  const path = await page.locator('#deepdive-chart .series-line').first().getAttribute('d');
  expect(path.match(/M/g).length).toBe(2);
  await page.locator('#compare summary').click();
  const row = page.locator('#deepdive-table tbody tr').filter({ has: page.getByRole('rowheader', { name: '2013', exact: true }) });
  await expect(row).toContainText('—');
  await expect(page.locator('#hero-chart .hero-axis .tick text').first()).toHaveAttribute('text-anchor', 'start');
  await expect(page.locator('#hero-chart .hero-axis .tick text').last()).toHaveAttribute('text-anchor', 'end');
});

test('low scores stay within comparison chart and duplicate URL selections collapse', async ({ page, isMobile }) => {
  await open(page, isMobile, '#year=2025&c=AFG,AFG,FIN');
  await expect(page.locator('#chips .chip')).toHaveCount(2);
  const coords = await page.locator('#deepdive-chart .series-label').first().evaluate(el => ({y: Number(el.getAttribute('y')), height: el.ownerSVGElement.viewBox.baseVal.height}));
  expect(coords.y).toBeGreaterThan(0);
  expect(coords.y).toBeLessThan(coords.height - 32);
});

test('copy immediately after changing state includes current countries', async ({ page, isMobile }) => {
  await open(page, isMobile);
  await page.evaluate(() => {
    window.copiedUrl = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => { window.copiedUrl = value; } }, configurable: true });
    const input = document.querySelector('#search');
    input.value = 'Argentina';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#copy-link').click();
  });
  expect(await page.evaluate(() => window.copiedUrl)).toContain('c=URY,FIN,ARG');
});

test('mobile header is compact and navigation remains reachable', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-specific layout');
  await page.goto('/');
  await page.waitForSelector('html.is-ready');
  const header = await page.locator('.site-header').boundingBox();
  expect(header.height).toBeLessThan(150);
  await expect(page.getByRole('link', { name: 'Explorer', exact: true })).toBeVisible();
  await expect(page.locator('#filter-panel')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});
