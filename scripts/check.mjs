// npm run check: abre la página en un navegador invisible (Brave), guarda una captura,
// confirma que el control de misión cargó sus 4 datos reales y que la tecla T lo oculta,
// hace clic en cada cámara del rover y comprueba que abre una foto real de Marte (guarda una
// captura con la foto abierta), prueba la física con las rocas (una rueda sube una roca baja y
// el rover choca con una alta), y lista los errores de consola.
// Requiere el servidor dev encendido (npm run dev). Necesita internet: los datos y las fotos
// se piden en vivo a la NASA.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = process.env.CHECK_URL || 'http://localhost:5173';
const NAVEGADOR = process.env.CHECK_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const CAPTURA = 'screenshots/check.png';
const CAPTURA_FOTO = 'screenshots/foto.png';
const CAMARAS = ['Mastcam_Z_cams', 'NavCams', 'hazcams_front', 'WATSON'];
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

// Espera a que la foto del visor termine de revelarse y devuelve qué foto es
async function fotoRevelada() {
  await page.waitForSelector('.visor-marco[data-estado="revelada"], .visor-marco[data-estado="error"]', {
    timeout: 30000,
  });
  return page.$eval('.visor', (v) => {
    const img = v.querySelector('.visor-imagen');
    return {
      estado: v.querySelector('.visor-marco').dataset.estado,
      id: img.dataset.id,
      real: img.naturalWidth > 0 && img.src.startsWith('https://mars.nasa.gov/'),
      titulo: v.querySelector('.visor-titulo').textContent,
    };
  });
}

// Cada cámara abre una foto real; en la primera, las flechas pasan a otra foto y se guarda la captura
async function revisarCamaras() {
  console.log('Cámaras de Percy:');
  for (const [n, camara] of CAMARAS.entries()) {
    try {
      await page.click(`.camara-punto[data-camara="${camara}"]`, { timeout: 15000 });
      const foto = await fotoRevelada();
      if (foto.estado !== 'revelada' || !foto.real) throw new Error(`la foto no cargó (${foto.id})`);
      console.log(`  ✔ ${foto.titulo}`);

      if (n === 0) {
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction((id) => document.querySelector('.visor-imagen').dataset.id !== id, foto.id);
        const otra = await fotoRevelada();
        if (otra.estado !== 'revelada' || !otra.real) throw new Error('la flecha → no abrió otra foto');
        console.log(`  ✔ La flecha → muestra otra foto: ${otra.titulo}`);
        await page.screenshot({ path: CAPTURA_FOTO });
        console.log(`  Captura con la foto abierta en ${CAPTURA_FOTO}`);
      }

      await page.keyboard.press('Escape');
      if (!(await page.$eval('.visor', (v) => v.hidden))) throw new Error('Esc no cerró el visor');
    } catch (e) {
      errores.push(`cámara ${camara}: ${e.message.split('\n')[0]}`);
    }
  }
}

// Física: lleva el rover junto a una roca y simula la conducción paso a paso dentro de la página
// (el navegador de prueba dibuja pocos cuadros por segundo, así no depende de eso)
async function revisarFisica() {
  console.log('Física con las rocas:');
  const resultado = await page.evaluate(async () => {
    const { datosRocas, altoRoca } = await import('/src/rocks.js');
    const { ESCALON_MAX } = await import('/src/conduccion.js');
    const { rover, conduccion } = window.perseverance;
    const e = conduccion.estado;
    const rocas = datosRocas().rocas.sort((a, b) => Math.hypot(a.x, a.z + 20) - Math.hypot(b.x, b.z + 20));
    const baja = rocas.find((r) => altoRoca(r) > 0.25 && altoRoca(r) < 0.4);
    const alta = rocas.find((r) => altoRoca(r) > 1);

    // Coloca el rover a "dist" m de la roca, mirando hacia ella y corrido "lado" m a su izquierda,
    // y avanza "seg" segundos a 1 m/s. Devuelve la mayor subida de una rueda y cuánto avanzó.
    function conducir(roca, dist, lado, seg) {
      const rumbo = Math.atan2(-1, 0.3);
      const [s, c] = [Math.sin(rumbo), Math.cos(rumbo)];
      Object.assign(e, { x: roca.x - s * dist + c * lado, z: roca.z - c * dist - s * lado, rumbo, velocidad: 0, giro: 0 });
      for (let i = 0; i < 180; i++) conduccion.actualizar(1 / 60); // se asienta tras el salto
      const inicio = { x: e.x, z: e.z };
      let subida = 0;
      for (let i = 0; i < seg * 60; i++) {
        e.velocidad = 1;
        conduccion.actualizar(1 / 60);
        for (const r of rover.userData.ruedas) subida = Math.max(subida, r.direccion.position.y);
      }
      return { subida, avance: Math.hypot(e.x - inicio.x, e.z - inicio.z), roca: altoRoca(roca) };
    }
    return {
      baja: conducir(baja, 3, 1.12, 6), // la roca queda bajo las ruedas derechas
      alta: conducir(alta, alta.radio + 3, 0, 6),
      escalon: ESCALON_MAX,
    };
  });
  const cm = (m) => Math.round(m * 100);
  const { baja, alta } = resultado;
  if (baja.subida > 0.12 && baja.avance > 5) {
    console.log(`  ✔ Roca de ${cm(baja.roca)} cm: una rueda sube ${cm(baja.subida)} cm respecto al cuerpo y el rover pasa`);
  } else errores.push(`física: no pasó sobre la roca de ${cm(baja.roca)} cm (subida ${cm(baja.subida)} cm, avance ${baja.avance.toFixed(1)} m)`);
  if (alta.avance < 6 - 1) {
    console.log(`  ✔ Roca de ${cm(alta.roca)} cm: el rover choca y se detiene tras ${alta.avance.toFixed(1)} m`);
  } else errores.push(`física: atravesó la roca de ${cm(alta.roca)} cm`);
}

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  await revisarDatos();
  await revisarTeclaT();
  await page.screenshot({ path: CAPTURA });
  console.log(`Captura guardada en ${CAPTURA}`);
  await revisarCamaras();
  await revisarFisica();
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
