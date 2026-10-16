// Control de misión dentro del juego: 4 datos reales de Percy con su valor, gráfica de toda
// la misión y una frase simple. La tecla T lo muestra u oculta.
import { agregarProveedor, pedirHistorial, suscribir, proveedorDe } from './telemetria.js';
import { proveedorNasa, proveedorOrbital } from './proveedores.js';
import { DATOS } from './datos.js';
import { dibujarGrafica } from './grafica.js';
import { solMision, horaJezero } from './astronomia.js';

agregarProveedor(proveedorNasa);
agregarProveedor(proveedorOrbital);

const solHoy = () => solMision(Date.now());

// Tarjeta de un dato: nombre, valor con unidad, gráfica, frase y proveedor
function crearTarjeta(dato) {
  const t = document.createElement('article');
  t.className = 'dato';
  t.dataset.punto = dato.clave;
  t.dataset.estado = 'cargando';
  const proveedor = proveedorDe(dato);
  const campo = dato.fuente ? ` · campo ${dato.fuente}` : '';
  t.innerHTML = `
    <div class="dato-cabecera">
      <span class="dato-nombre">${dato.nombre}</span>
      <span class="dato-sello">cargando…</span>
    </div>
    <div class="dato-fila">
      <div class="dato-valor"><span class="dato-numero">—</span><span class="dato-unidad">${dato.unidad}</span></div>
      <canvas class="dato-grafica" aria-label="Gráfica de ${dato.nombre} en toda la misión"></canvas>
    </div>
    <p class="dato-frase"></p>
    <div class="dato-proveedor">Proveedor: ${proveedor.nombre}${campo}</div>`;
  return t;
}

function mostrarValor(tarjeta, dato, valor, historial) {
  tarjeta.dataset.valor = valor;
  tarjeta.querySelector('.dato-numero').textContent = dato.formato(valor);
  tarjeta.querySelector('.dato-frase').textContent = dato.frase(valor, historial);
}

async function cargarDato(dato, tarjeta) {
  const sello = tarjeta.querySelector('.dato-sello');
  try {
    const historial = await pedirHistorial(dato);
    const ultimo = historial[historial.length - 1];
    mostrarValor(tarjeta, dato, ultimo.valor, historial);
    dibujarGrafica(tarjeta.querySelector('.dato-grafica'), historial, solHoy());
    sello.textContent = `último manejo · sol ${ultimo.sol}`;

    // Si el proveedor da datos en vivo, el valor se actualiza solo
    const enVivo = suscribir(dato, (d) => mostrarValor(tarjeta, dato, d.valor, historial));
    if (enVivo) {
      sello.textContent = 'en vivo';
      sello.classList.add('vivo');
    }
    tarjeta.dataset.estado = 'listo';
  } catch (e) {
    tarjeta.dataset.estado = 'error';
    sello.textContent = 'sin señal';
    tarjeta.querySelector('.dato-frase').textContent = 'No se pudo recibir el dato. Revisa la conexión a internet.';
    console.error(`Control de misión: no se pudo cargar "${dato.nombre}":`, e);
  }
}

export function crearPanelMision() {
  const panel = document.createElement('aside');
  panel.className = 'mision';
  panel.setAttribute('aria-label', 'Control de misión');
  panel.innerHTML = `
    <header class="mision-cabecera">
      <div>
        <div class="mision-titulo">Control de misión · Percy</div>
        <div class="mision-reloj"></div>
      </div>
      <kbd title="Ocultar o mostrar">T</kbd>
    </header>`;
  const reloj = panel.querySelector('.mision-reloj');
  const actualizarReloj = () => {
    reloj.textContent = `Sol ${Math.floor(solHoy())} · ${horaJezero(Date.now())} en Jezero`;
  };
  actualizarReloj();
  setInterval(actualizarReloj, 1000);

  const pie = document.createElement('footer');
  pie.className = 'mision-pie';
  pie.textContent = 'Datos reales: NASA/JPL-Caltech (Mars 2020) y efemérides de JPL.';

  // Primero se agregan todas las tarjetas a la página (las gráficas necesitan su tamaño)
  const tarjetas = DATOS.map((dato) => [dato, crearTarjeta(dato)]);
  for (const [, tarjeta] of tarjetas) panel.appendChild(tarjeta);
  panel.appendChild(pie);
  document.body.appendChild(panel);
  for (const [dato, tarjeta] of tarjetas) cargarDato(dato, tarjeta);

  // T muestra u oculta el panel
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT' && !e.repeat) panel.classList.toggle('oculto');
  });
  return panel;
}
