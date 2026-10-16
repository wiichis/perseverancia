// Terreno marciano: dunas con crestas afiladas, colinas suaves y montañas lejanas
import * as THREE from 'three';
import { fbm, smoothstep } from './noise.js';

// Altura del terreno en (x, z). La usan también las rocas y la cámara.
export function altura(x, z) {
  // Deformamos las coordenadas para que las dunas no sean rectas
  const warp = fbm(x * 0.01, z * 0.01, 3) * 30;
  const fase = (x * 0.8 + z * 0.6 + warp) * 0.045;
  // 1 - |sin| genera crestas afiladas y valles redondeados, como dunas reales
  const dunas = Math.pow(1 - Math.abs(Math.sin(fase)), 1.8) * 4.0;
  const colinas = fbm(x * 0.007, z * 0.007, 4) * 7;
  const detalle = fbm(x * 0.09, z * 0.09, 3) * 0.35;

  // Montañas y mesetas en el horizonte
  const d = Math.hypot(x, z);
  const montes = Math.max(0, fbm(x * 0.0045 + 11, z * 0.0045 - 3, 5) + 0.15);
  const lejos = smoothstep(230, 420, d) * (montes * 80 + 6);

  return dunas + colinas + detalle + lejos;
}

// Tamaño de la malla del terreno (metros) y número de divisiones por lado
const TAM = 1100;
const SEG = 480;
const CELDA = TAM / SEG;

// Alturas de cada vértice de la malla, calculadas una sola vez
let rejilla = null;
function alturasMalla() {
  if (!rejilla) {
    rejilla = new Float32Array((SEG + 1) * (SEG + 1));
    for (let iz = 0; iz <= SEG; iz++) {
      for (let ix = 0; ix <= SEG; ix++) {
        rejilla[iz * (SEG + 1) + ix] = altura(-TAM / 2 + ix * CELDA, -TAM / 2 + iz * CELDA);
      }
    }
  }
  return rejilla;
}

// Altura exacta del suelo tal como se dibuja (interpolando dentro de cada triángulo).
// Las celdas miden ~2,3 m, así que difiere un poco de altura(); el rover y las huellas usan esta.
export function alturaSuelo(x, z) {
  const h = alturasMalla();
  const gx = Math.min(Math.max((x + TAM / 2) / CELDA, 0), SEG - 1e-6);
  const gz = Math.min(Math.max((z + TAM / 2) / CELDA, 0), SEG - 1e-6);
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const u = gx - ix;
  const v = gz - iz;
  const fila = SEG + 1;
  const a = h[iz * fila + ix]; // (0,0)
  const b = h[(iz + 1) * fila + ix]; // (0,1)
  const c = h[(iz + 1) * fila + ix + 1]; // (1,1)
  const d = h[iz * fila + ix + 1]; // (1,0)
  // PlaneGeometry divide cada celda por la diagonal b-d
  if (u + v <= 1) return a + (d - a) * u + (b - a) * v;
  return c + (b - c) * (1 - u) + (d - c) * (1 - v);
}

// Normal del suelo en (x, z) por diferencias finitas
export function normalSuelo(x, z, destino = new THREE.Vector3()) {
  const e = 0.4;
  const dx = alturaSuelo(x + e, z) - alturaSuelo(x - e, z);
  const dz = alturaSuelo(x, z + e) - alturaSuelo(x, z - e);
  return destino.set(-dx, 2 * e, -dz).normalize();
}

export function crearTerreno() {
  const geo = new THREE.PlaneGeometry(TAM, TAM, SEG, SEG);
  geo.rotateX(-Math.PI / 2);

  // Los vértices de PlaneGeometry van fila a fila en z y columna a columna en x,
  // en el mismo orden que la rejilla de alturas
  const pos = geo.attributes.position;
  const h = alturasMalla();
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, h[i]);
  }
  geo.computeVertexNormals();

  // Colores por vértice: crestas claras, valles oscuros, roca en pendientes
  const arenaClara = new THREE.Color('#d39463');
  const arena = new THREE.Color('#b8693d');
  const arenaOscura = new THREE.Color('#8a4628');
  const roca = new THREE.Color('#6e3b26');
  const normales = geo.attributes.normal;
  const colores = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const pendiente = 1 - normales.getY(i);

    const t = smoothstep(-4, 9, y);
    c.copy(arenaOscura).lerp(arena, t);
    c.lerp(arenaClara, smoothstep(6, 12, y) * 0.6);
    c.lerp(roca, smoothstep(0.15, 0.45, pendiente));
    // Manchas sutiles para romper la uniformidad
    const mancha = fbm(x * 0.03 + 50, z * 0.03, 3) * 0.12;
    c.offsetHSL(0, 0, mancha);

    colores[i * 3] = c.r;
    colores[i * 3 + 1] = c.g;
    colores[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));

  const malla = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 })
  );
  malla.receiveShadow = true;
  return malla;
}
