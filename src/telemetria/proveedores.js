// Proveedores de telemetría de Percy
import { minutosLuz, solMision, msDeSol } from './astronomia.js';

// --- NASA: historial de manejos de Perseverance (mapa oficial MMGIS de la misión) ---
// Cada punto es un lugar donde el rover se localizó. Solo usamos los de fin de manejo
// (final = "y"): los de mitad de manejo traen la distancia acumulada en 0.
export const URL_WAYPOINTS = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json';

let descarga = null;
function finesDeManejo() {
  descarga ??= fetch(URL_WAYPOINTS)
    .then((r) => {
      if (!r.ok) throw new Error(`NASA respondió ${r.status}`);
      return r.json();
    })
    .then((json) => json.features.map((f) => f.properties).filter((p) => p.final === 'y'))
    .catch((e) => {
      descarga = null; // permite reintentar más tarde
      throw e;
    });
  return descarga;
}

export const proveedorNasa = {
  nombre: 'NASA · M20_waypoints',
  supportsRequest: (dato) => dato.origen === 'nasa',
  async request(dato) {
    const puntos = await finesDeManejo();
    // "fuente" es el campo del JSON, como "source" en los metadatos de Open MCT
    return puntos.map((p) => ({ sol: p.sol, valor: p[dato.fuente] * (dato.escala ?? 1) }));
  },
};

// --- Cálculo orbital: tiempo de luz Tierra–Marte, en vivo ---
export const proveedorOrbital = {
  nombre: 'cálculo orbital (efemérides JPL)',
  supportsRequest: (dato) => dato.origen === 'orbita',
  supportsSubscribe: (dato) => dato.origen === 'orbita',
  // Un valor por sol, desde el aterrizaje hasta hoy
  async request() {
    const hoy = Math.floor(solMision(Date.now()));
    const historial = [];
    for (let sol = 0; sol <= hoy; sol++) historial.push({ sol, valor: minutosLuz(msDeSol(sol)) });
    return historial;
  },
  // Un valor nuevo cada segundo
  subscribe(dato, alRecibir) {
    const emitir = () => {
      const ahora = Date.now();
      alRecibir({ sol: solMision(ahora), valor: minutosLuz(ahora) });
    };
    emitir();
    const id = setInterval(emitir, 1000);
    return () => clearInterval(id);
  },
};
