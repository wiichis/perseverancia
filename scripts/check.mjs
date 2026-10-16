// npm run check: abre la página en un navegador invisible (Brave), guarda una captura
// y lista los errores de consola. Requiere el servidor dev encendido (npm run dev).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = process.env.CHECK_URL || 'http://localhost:5173';
const NAVEGADOR = process.env.CHECK_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const CAPTURA = 'screenshots/check.png';

mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch({
  executablePath: NAVEGADOR,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errores = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errores.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => errores.push(`pageerror: ${err.message}`));

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: CAPTURA });
  console.log(`Captura guardada en ${CAPTURA}`);
} catch (e) {
  errores.push(`navegación: ${e.message}`);
}
await browser.close();

if (errores.length) {
  console.log(`\n${errores.length} error(es):`);
  for (const e of errores) console.log(' -', e);
  process.exit(1);
}
console.log('Sin errores de consola ✔');
