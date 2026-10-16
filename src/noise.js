// Utilidades de ruido deterministas (misma escena en cada carga)

// Generador pseudoaleatorio con semilla (mulberry32)
export function crearRandom(semilla = 1) {
  let s = semilla >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash entero 2D -> [0, 1)
function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const suave = (t) => t * t * (3 - 2 * t);

// Ruido de valor 2D en el rango [-1, 1]
export function ruido(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = suave(x - ix);
  const fy = suave(y - iy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  const v = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  return v * 2 - 1;
}

// Ruido fractal (suma de octavas)
export function fbm(x, y, octavas = 4) {
  let total = 0;
  let amp = 0.5;
  let frec = 1;
  for (let i = 0; i < octavas; i++) {
    total += ruido(x * frec, y * frec) * amp;
    frec *= 2.03;
    amp *= 0.5;
  }
  return total;
}

export function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}
