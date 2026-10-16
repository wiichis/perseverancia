// Fichas (metadatos) de los 4 datos reales de Percy, al estilo de Open MCT:
// clave, nombre, unidad, de qué proveedor y campo sale, cómo se muestra y qué significa

const numero = (v, decimales) =>
  v.toLocaleString('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: 'always', // "1.937" (en español, por defecto 4 cifras no llevan punto)
  });

export const DATOS = [
  {
    clave: 'distancia',
    nombre: 'Distancia recorrida',
    unidad: 'km',
    origen: 'nasa',
    fuente: 'dist_total_m',
    escala: 0.001, // metros → km
    formato: (v) => numero(v, 2),
    frase: () => 'Todo lo que Percy ha conducido desde que aterrizó. Avanza a unos 4 cm/s.',
  },
  {
    clave: 'altura',
    nombre: 'Altura del terreno',
    unidad: 'm',
    origen: 'nasa',
    fuente: 'elev_geoid',
    formato: (v) => numero(v, 0),
    frase: (v, historial) => {
      const subida = v - historial[0].valor;
      return `Marte no tiene mar: se mide desde un “nivel cero”. Ha subido ${numero(subida, 0)} m desde el fondo de Jezero.`;
    },
  },
  {
    clave: 'inclinacion',
    nombre: 'Inclinación',
    unidad: '°',
    origen: 'nasa',
    fuente: 'tilt',
    formato: (v) => numero(v, 1),
    frase: () => 'Cuánto quedó ladeado tras el último manejo. Aguanta 45° sin volcar; sus conductores evitan pasar de 30°.',
  },
  {
    clave: 'luz',
    nombre: 'Tiempo de luz Tierra–Marte',
    unidad: 'min',
    origen: 'orbita',
    formato: (v) => numero(v, 2),
    frase: (v) =>
      `Una orden enviada ahora tarda ${numero(v, 1)} min en llegar. Por eso Percy no se maneja con joystick: recibe el plan del día.`,
  },
];
