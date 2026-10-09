import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/Users/santimontouliu/.gemini/antigravity/brain/d53f86ca-8416-40c4-95b8-6ec2b94b998e';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:4173 ...');
  await page.goto('http://127.0.0.1:4173');
  await page.waitForSelector('html.is-ready');
  await page.waitForTimeout(1000);

  // Capture hero
  const hero = page.locator('#top');
  await hero.screenshot({ path: path.join(OUT_DIR, 'preview-hero.png') });

  // Capture map
  const map = page.locator('#map');
  await map.screenshot({ path: path.join(OUT_DIR, 'preview-map.png') });

  // Capture explorer
  const explorer = page.locator('#explorer');
  await explorer.screenshot({ path: path.join(OUT_DIR, 'preview-explorer.png') });

  // Capture drivers
  const drivers = page.locator('#drivers');
  await drivers.screenshot({ path: path.join(OUT_DIR, 'preview-drivers.png') });

  // Capture movers
  const movers = page.locator('#movers');
  await movers.screenshot({ path: path.join(OUT_DIR, 'preview-movers.png') });

  // Capture compare deep dive
  const compare = page.locator('#compare');
  await compare.screenshot({ path: path.join(OUT_DIR, 'preview-compare.png') });

  // Also capture full desktop page screenshot
  await page.screenshot({ path: path.join(OUT_DIR, 'preview-full-desktop.png'), fullPage: true });

  // Also copy preview-hero as og-image.png in public and dist
  fs.copyFileSync(
    path.join(OUT_DIR, 'preview-hero.png'),
    path.join(process.cwd(), 'public', 'og-image.png')
  );
  if (fs.existsSync(path.join(process.cwd(), 'dist'))) {
    fs.copyFileSync(
      path.join(OUT_DIR, 'preview-hero.png'),
      path.join(process.cwd(), 'dist', 'og-image.png')
    );
  }

  // Mobile screenshot
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:4173');
  await mobilePage.waitForSelector('html.is-ready');
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: path.join(OUT_DIR, 'preview-mobile.png') });

  await browser.close();
  console.log('Screenshots saved successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
