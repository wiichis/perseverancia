// npm run check: abre la página en un navegador invisible (Brave), guarda una captura,
// confirma que el control de misión cargó sus 4 datos reales y que la tecla T lo oculta,
// y lista los errores de consola. Requiere el servidor dev encendido (npm run dev).
// Necesita internet: los datos de manejo se piden en vivo a la NASA.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = process.env.CHECK_URL || 'http://localhost:5173';
const NAVEGADOR = process.env.CHECK_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const CAPTURA = 'screenshots/check.png';
const DATOS_ESPERADOS = 4;

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

// Espera a que cada tarjeta del control de misión termine de cargar (bien o mal) y las revisa
async function revisarDatos() {
  await page
    .waitForFunction(
      (n) => {
        const t = document.querySelectorAll('.mision [data-punto]');
        return t.length === n && [...t].every((x) => x.dataset.estado !== 'cargando');
      },
      DATOS_ESPERADOS,
      { timeout: 30000 }
    )
    .catch(() => errores.push('control de misión: los datos no terminaron de cargar en 30 s'));

  const datos = await page.$$eval('.mision [data-punto]', (tarjetas) =>
    tarjetas.map((t) => ({
      nombre: t.querySelector('.dato-nombre').textContent,
      estado: t.dataset.estado,
      valor: Number(t.dataset.valor),
      texto: `${t.querySelector('.dato-numero').textContent} ${t.querySelector('.dato-unidad').textContent}`,
    }))
  );
  if (datos.length !== DATOS_ESPERADOS) {
    errores.push(`control de misión: hay ${datos.length} datos, se esperaban ${DATOS_ESPERADOS}`);
  }
  console.log('Control de misión:');
  for (const d of datos) {
    const ok = d.estado === 'listo' && Number.isFinite(d.valor);
    console.log(`  ${ok ? '✔' : '✘'} ${d.nombre}: ${d.texto}`);
    if (!ok) errores.push(`control de misión: "${d.nombre}" no cargó (estado ${d.estado})`);
  }
}

// La tecla T debe ocultar el panel y volver a mostrarlo
async function revisarTeclaT() {
  const visible = () =>
    page.$eval('.mision', (p) => getComputedStyle(p).visibility !== 'hidden' && !p.classList.contains('oculto'));
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(500);
  const ocultoTrasT = !(await visible());
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(500);
  const visibleTrasT = await visible();
  if (ocultoTrasT && visibleTrasT) console.log('  ✔ La tecla T oculta y muestra el panel');
  else errores.push(`tecla T: oculto tras pulsar=${ocultoTrasT}, visible tras pulsar de nuevo=${visibleTrasT}`);
}

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  await revisarDatos();
  await revisarTeclaT();
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
