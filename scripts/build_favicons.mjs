import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const svgPath = path.resolve('public/favicon.svg');
  const svgUrl = `file://${svgPath}`;

  // 32x32 standard favicon
  await page.setViewportSize({ width: 32, height: 32 });
  await page.goto(svgUrl);
  await page.screenshot({ path: 'public/favicon.png', omitBackground: true });

  // 180x180 apple touch icon
  await page.setViewportSize({ width: 180, height: 180 });
  await page.goto(svgUrl);
  await page.screenshot({ path: 'public/apple-touch-icon.png' });

  // Copy 32x32 as favicon.ico so browsers that look for /favicon.ico find it
  fs.copyFileSync('public/favicon.png', 'public/favicon.ico');

  await browser.close();
  console.log('Favicons generated successfully!');
}

main().catch(console.error);
