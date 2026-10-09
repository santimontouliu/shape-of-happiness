import { test, expect } from '@playwright/test';

test.describe('The Shape of Happiness', () => {
  test('renders all 6 charts with no page errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForSelector('html.is-ready');

    expect(errors).toEqual([]);

    // Check header and hero
    await expect(page.locator('#hero-title')).toContainText('The Shape of Happiness');
    await expect(page.locator('#hero-chart svg')).toBeVisible();

    // Check all charts rendered SVGs
    await expect(page.locator('#map-chart svg')).toBeVisible();
    await expect(page.locator('#explorer-chart svg')).toBeVisible();
    await expect(page.locator('#drivers-chart svg')).toBeVisible();
    await expect(page.locator('#slope-chart svg')).toBeVisible();
    await expect(page.locator('#deepdive-chart svg')).toBeVisible();

    // Check pre-selected chips: Uruguay and Finland
    const chips = page.locator('#chips .chip');
    await expect(chips).toHaveCount(2);
    await expect(chips.first()).toContainText('Uruguay');
    await expect(chips.nth(1)).toContainText('Finland');
  });

  test('country search adds a country chip and updates URL hash', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('html.is-ready');

    const searchInput = page.locator('#search');
    await searchInput.fill('Argentina');
    await searchInput.press('Enter');

    const chips = page.locator('#chips .chip');
    await expect(chips).toHaveCount(3);
    await expect(page.locator('#chips')).toContainText('Argentina');

    // URL hash should contain ARG
    await page.waitForFunction(() => window.location.hash.includes('ARG'));
  });

  test('year slider updates year display and state', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('html.is-ready');

    const slider = page.locator('#year');
    await slider.fill('5');
    await slider.dispatchEvent('input');

    const yearOut = page.locator('#year-out');
    const text = await yearOut.textContent();
    expect(Number(text)).toBeGreaterThanOrEqual(2011);
  });

  test('deep links restore country and factor selection', async ({ page }) => {
    await page.goto('/#year=2021&x=gdp&c=URY,ISL');
    await page.waitForSelector('html.is-ready');

    await expect(page.locator('#year-out')).toHaveText('2021');
    const chips = page.locator('#chips .chip');
    await expect(chips).toHaveCount(2);
    await expect(chips.first()).toContainText('Uruguay');
    await expect(chips.nth(1)).toContainText('Iceland');
  });
});
