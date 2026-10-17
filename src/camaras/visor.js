// Visor de fotos: al disparar una cámara suena el obturador, salta un flash y la foto real
// de Marte se revela poco a poco, como si llegara línea a línea desde el rover.
// Clic en la foto: ampliar · ← →: más fotos de esa cámara · Esc: volver al juego.
//
// fotos.json se armó con la API de imágenes crudas de la NASA
// (https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&ver=1.2…):
// se descargaron y revisaron una a una las fotos a color de los últimos soles de cada cámara y se
// escogieron las mejores (horizonte, brazo sobre el suelo, rocas de cerca). Sin cielo vacío, sol,
// blancos de calibración ni miniaturas. Cada foto conserva su sol, fecha y enlace oficial.
import FOTOS from './fotos.json';

const MS_DIA = 86400000;

// Hace cuántos días (terrestres) se tomó la foto
function hace(fecha) {
  const dias = Math.floor((Date.now() - Date.parse(fecha)) / MS_DIA);
  if (dias <= 0) return 'hoy';
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

// --- Sonido del obturador: dos chasquidos de ruido filtrado, sin archivos de audio ---
let audio = null;
function sonarObturador() {
  try {
    audio ??= new AudioContext();
    const t0 = audio.currentTime;
    const ruido = audio.createBuffer(1, audio.sampleRate * 0.05, audio.sampleRate);
    const datos = ruido.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    // Abre y cierra: el segundo chasquido es más suave y algo más grave
    for (const [retraso, volumen, tono] of [[0, 0.5, 2400], [0.075, 0.3, 1500]]) {
      const fuente = audio.createBufferSource();
      fuente.buffer = ruido;
      const filtro = audio.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.frequency.value = tono;
      const ganancia = audio.createGain();
      ganancia.gain.setValueAtTime(volumen, t0 + retraso);
      ganancia.gain.exponentialRampToValueAtTime(0.001, t0 + retraso + 0.045);
      fuente.connect(filtro).connect(ganancia).connect(audio.destination);
      fuente.start(t0 + retraso);
    }
  } catch {
    // Sin audio la foto se muestra igual
  }
}

// --- Elementos de la página (se crean la primera vez que se usa el visor) ---
let visor = null;
let flash = null;
const estado = { camara: null, indice: 0 };

function crearVisor() {
  flash = document.createElement('div');
  flash.className = 'flash';
  document.body.appendChild(flash);

  visor = document.createElement('div');
  visor.className = 'visor';
  visor.hidden = true;
  visor.setAttribute('role', 'dialog');
  visor.setAttribute('aria-label', 'Foto de Marte');
  visor.innerHTML = `
    <figure class="visor-foto">
      <div class="visor-marco" data-estado="recibiendo">
        <img class="visor-imagen" alt="" draggable="false" />
        <div class="visor-espera">Recibiendo imagen de Marte…</div>
      </div>
      <figcaption>
        <div class="visor-titulo"></div>
        <div class="visor-pie"></div>
      </figcaption>
    </figure>
    <button class="visor-flecha anterior" aria-label="Foto anterior">‹</button>
    <button class="visor-flecha siguiente" aria-label="Foto siguiente">›</button>
    <div class="visor-ayuda">Clic en la foto para ampliar · <kbd>←</kbd> <kbd>→</kbd> más fotos · <kbd>Esc</kbd> volver al juego</div>`;
  document.body.appendChild(visor);

  const imagen = visor.querySelector('.visor-imagen');
  imagen.addEventListener('click', () => visor.classList.toggle('ampliada'));
  visor.querySelector('.anterior').addEventListener('click', () => cambiar(-1));
  visor.querySelector('.siguiente').addEventListener('click', () => cambiar(1));
  // Clic fuera de la foto también vuelve al juego
  visor.addEventListener('click', (e) => {
    if (e.target === visor) cerrar();
  });

  window.addEventListener('keydown', (e) => {
    if (visor.hidden) return;
    if (e.code === 'Escape') cerrar();
    else if (e.code === 'ArrowRight') cambiar(1);
    else if (e.code === 'ArrowLeft') cambiar(-1);
    else return;
    e.preventDefault();
  });
}

function dispararFlash() {
  flash.classList.remove('activo');
  void flash.offsetWidth; // reinicia la animación
  flash.classList.add('activo');
}

// Muestra la foto número "indice" de la cámara actual y la revela poco a poco
function mostrar(indice) {
  const fotos = FOTOS[estado.camara.pieza];
  estado.indice = (indice + fotos.length) % fotos.length;
  const foto = fotos[estado.indice];

  const marco = visor.querySelector('.visor-marco');
  const imagen = visor.querySelector('.visor-imagen');
  marco.dataset.estado = 'recibiendo';
  imagen.dataset.id = foto.id;
  imagen.alt = `Foto real de Marte tomada por ${estado.camara.nombre} en el sol ${foto.sol}`;

  visor.querySelector('.visor-titulo').innerHTML =
    `<b>${estado.camara.nombre}</b> · Sol ${foto.sol} · ${hace(foto.fecha)}`;
  visor.querySelector('.visor-pie').innerHTML =
    `${estado.indice + 1} / ${fotos.length} · ${foto.credito} · ` +
    `<a href="${foto.enlace}" target="_blank" rel="noopener">ver en NASA</a>`;

  imagen.onload = () => {
    if (imagen.dataset.id !== foto.id) return; // llegó tarde una foto que ya no se pide
    // Un cuadro en estado inicial y luego la transición de revelado (ver style.css)
    requestAnimationFrame(() => {
      marco.dataset.estado = 'revelando';
    });
  };
  // El revelado termina cuando la foto ya está enfocada (la transición más larga es el filtro)
  imagen.ontransitionend = (e) => {
    if (e.propertyName === 'filter' && imagen.dataset.id === foto.id) marco.dataset.estado = 'revelada';
  };
  imagen.onerror = () => {
    if (imagen.dataset.id !== foto.id) return;
    marco.dataset.estado = 'error';
    visor.querySelector('.visor-espera').textContent = 'La foto no llegó. Revisa la conexión a internet.';
  };
  visor.querySelector('.visor-espera').textContent = 'Recibiendo imagen de Marte…';
  imagen.removeAttribute('src'); // así "load" llega aunque se repita la misma foto
  imagen.src = foto.imagen;

  // Precarga la siguiente para que las flechas sean rápidas
  new Image().src = fotos[(estado.indice + 1) % fotos.length].imagen;
}

function cambiar(paso) {
  sonarObturador();
  mostrar(estado.indice + paso);
}

function cerrar() {
  visor.hidden = true;
  visor.classList.remove('ampliada');
}

// Dispara la cámara "c" (una de CAMARAS en puntos.js): obturador, flash y su mejor foto
export function abrirFoto(c) {
  if (!visor) crearVisor();
  sonarObturador();
  dispararFlash();
  estado.camara = c;
  visor.classList.remove('ampliada');
  visor.hidden = false;
  mostrar(0);
}
