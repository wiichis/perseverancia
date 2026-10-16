// Cálculos astronómicos sin dependencias:
// - distancia Tierra–Marte y tiempo que tarda la luz (y la radio) en recorrerla
// - número de sol (día marciano) de la misión de Perseverance y hora local en Jezero

const UA_KM = 149597870.7; // unidad astronómica
const LUZ_KM_S = 299792.458;
const MS_DIA = 86400000;
const RAD = Math.PI / 180;

// Elementos orbitales aproximados de JPL ("Approximate Positions of the Planets", válidos 1800–2050).
// Cada par es [valor en J2000, cambio por siglo]. a en UA, ángulos en grados.
const ORBITAS = {
  tierra: {
    a: [1.00000261, 0.00000562],
    e: [0.01671123, -0.00004392],
    I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981],
    peri: [102.93768193, 0.32327364],
    nodo: [0, 0],
  },
  marte: {
    a: [1.52371034, 0.00001847],
    e: [0.0933941, 0.00007882],
    I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499],
    peri: [-23.94362959, 0.44441088],
    nodo: [49.55953891, -0.29257343],
  },
};

// Día juliano a partir de milisegundos Unix (UTC)
const diaJuliano = (ms) => ms / MS_DIA + 2440587.5;

// Posición heliocéntrica (x, y, z en UA, plano de la eclíptica) de un planeta en una fecha
function posicion(planeta, ms) {
  const T = (diaJuliano(ms) - 2451545.0) / 36525; // siglos desde J2000
  const o = ORBITAS[planeta];
  const val = ([v0, dv]) => v0 + dv * T;
  const a = val(o.a);
  const e = val(o.e);
  const I = val(o.I) * RAD;
  const nodo = val(o.nodo) * RAD;
  const peri = val(o.peri) * RAD;
  const argPeri = peri - nodo;

  // Anomalía media en [-π, π] y ecuación de Kepler resuelta por Newton
  let M = (val(o.L) * RAD - peri) % (2 * Math.PI);
  if (M > Math.PI) M -= 2 * Math.PI;
  if (M < -Math.PI) M += 2 * Math.PI;
  let E = M;
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));

  // Posición en el plano de la órbita y giro al plano de la eclíptica
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const [cw, sw, cn, sn, ci, si] = [Math.cos(argPeri), Math.sin(argPeri), Math.cos(nodo), Math.sin(nodo), Math.cos(I), Math.sin(I)];
  return {
    x: (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    y: (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    z: sw * si * xp + cw * si * yp,
  };
}

// Distancia Tierra–Marte en km
export function distanciaTierraMarte(ms) {
  const t = posicion('tierra', ms);
  const m = posicion('marte', ms);
  return Math.hypot(m.x - t.x, m.y - t.y, m.z - t.z) * UA_KM;
}

// Minutos que tarda la luz (o una señal de radio) en ir de la Tierra a Marte
export function minutosLuz(ms) {
  return distanciaTierraMarte(ms) / LUZ_KM_S / 60;
}

// --- Soles de la misión ---
// Fecha solar de Marte (MSD, algoritmo Mars24 de NASA GISS): días marcianos desde 1873
const TT_MENOS_UTC_S = 69.184;
const LONGITUD_JEZERO = 77.45; // grados este
const fechaSolarMarte = (ms) => (diaJuliano(ms) + TT_MENOS_UTC_S / 86400 - 2405522.0028779) / 1.0274912517;
// Días marcianos contados a la hora local de Jezero (cada sol empieza a la medianoche local)
const solesLocales = (ms) => fechaSolarMarte(ms) + LONGITUD_JEZERO / 360;

// Aterrizaje: 18 feb 2021, 20:44 UTC (hora en Marte). Ese día local fue el sol 0.
const ATERRIZAJE_MS = Date.UTC(2021, 1, 18, 20, 44);
const SOL_CERO = Math.floor(solesLocales(ATERRIZAJE_MS));

// Sol de la misión con decimales (la parte decimal es la hora del día en Jezero)
export const solMision = (ms) => solesLocales(ms) - SOL_CERO;

// Fecha (ms) del mediodía de un sol de la misión
export function msDeSol(sol) {
  const msd = sol + SOL_CERO + 0.5 - LONGITUD_JEZERO / 360;
  return ((msd * 1.0274912517 + 2405522.0028779 - TT_MENOS_UTC_S / 86400) - 2440587.5) * MS_DIA;
}

// Hora local media en Jezero ("hh:mm") en una fecha
export function horaJezero(ms) {
  const minutos = Math.floor((solMision(ms) % 1) * 24 * 60);
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}
