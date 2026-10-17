// Rocas marcianas instanciadas: muchas pequeñas, pocas grandes
import * as THREE from 'three';
import { crearRandom, ruido } from './noise.js';
import { altura, alturaSuelo } from './terrain.js';

// Icosaedro deformado con ruido: forma de roca irregular.
// El ruido depende de la posición, así los vértices duplicados se mueven igual (sin grietas).
export function geometriaRoca(semilla, detalle = 1, fuerza = 0.35) {
  const geo = new THREE.IcosahedronGeometry(1, detalle);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      ruido(v.x * 1.7 + semilla, v.y * 1.7 + v.z * 0.9) * fuerza +
      ruido(v.z * 4.1 - semilla, v.x * 4.1 + v.y) * fuerza * 0.3;
    v.multiplyScalar(1 + n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// --- Datos de las rocas: las mismas para dibujarlas y para la física del rover ---
const VARIANTES = 4;
const POR_VARIANTE = 130;
const CELDA = 2; // metros por celda de la rejilla para buscar rocas cercanas

let datos = null;
export function datosRocas() {
  if (datos) return datos;
  const rand = crearRandom(42);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const geometrias = [];
  const rocas = [];
  const rejilla = new Map(); // "ix,iz" -> rocas que tocan esa celda

  for (let k = 0; k < VARIANTES; k++) {
    const geo = geometriaRoca(k * 13.7, 1, 0.38);
    geo.computeBoundingSphere();
    geometrias.push(geo);

    for (let i = 0; i < POR_VARIANTE; i++) {
      // Distribución tipo ley de potencia: casi todas pequeñas
      const r = 0.12 + Math.pow(rand(), 5) * 1.8;
      const ang = rand() * Math.PI * 2;
      const dist = 10 + Math.pow(rand(), 0.8) * 140;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist - 20;

      p.set(x, altura(x, z) + r * 0.15, z);
      e.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
      q.setFromEuler(e);
      s.set(r * (0.8 + rand() * 0.6), r * (0.5 + rand() * 0.4), r * (0.8 + rand() * 0.6));
      const matriz = new THREE.Matrix4().compose(p, q, s);
      const roca = {
        variante: k,
        matriz,
        inversa: matriz.clone().invert(),
        x,
        z,
        // Radio que la contiene entera, para descartar rápido las que no están cerca
        radio: geo.boundingSphere.radius * Math.max(s.x, s.y, s.z),
        techo: p.y + geo.boundingSphere.radius * Math.max(s.x, s.y, s.z),
      };
      rocas.push(roca);
      for (let ix = Math.floor((x - roca.radio) / CELDA); ix <= Math.floor((x + roca.radio) / CELDA); ix++) {
        for (let iz = Math.floor((z - roca.radio) / CELDA); iz <= Math.floor((z + roca.radio) / CELDA); iz++) {
          const clave = `${ix},${iz}`;
          if (!rejilla.has(clave)) rejilla.set(clave, []);
          rejilla.get(clave).push(roca);
        }
      }
    }
  }
  datos = { geometrias, rocas, rejilla };
  return datos;
}

// Altura de la cara superior de las rocas en (x, z), o -Infinity si no hay roca ahí.
// Lanza un rayo vertical contra los triángulos de verdad de cada roca cercana (la misma
// forma que se dibuja), así las ruedas apoyan exactamente sobre lo que se ve.
// Si se pasa "info", info.roca queda con la roca más alta encontrada.
const rayo = new THREE.Ray();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();
const choque = new THREE.Vector3();
export function alturaRocas(x, z, info = null) {
  const { geometrias, rejilla } = datosRocas();
  const cercanas = rejilla.get(`${Math.floor(x / CELDA)},${Math.floor(z / CELDA)}`);
  if (!cercanas) return -Infinity;
  let maxima = -Infinity;
  for (const roca of cercanas) {
    const dx = x - roca.x;
    const dz = z - roca.z;
    if (dx * dx + dz * dz > roca.radio * roca.radio) continue;
    // Rayo hacia abajo desde encima de la roca, llevado al espacio propio de la roca
    rayo.origin.set(x, roca.techo + 1, z);
    rayo.direction.set(0, -1, 0);
    rayo.applyMatrix4(roca.inversa);
    // Cada triángulo que cruza el rayo es un punto de la superficie; nos quedamos con el más alto
    const pos = geometrias[roca.variante].attributes.position.array;
    for (let i = 0; i < pos.length; i += 9) {
      va.fromArray(pos, i);
      vb.fromArray(pos, i + 3);
      vc.fromArray(pos, i + 6);
      if (rayo.intersectTriangle(va, vb, vc, false, choque)) {
        const y = choque.applyMatrix4(roca.matriz).y;
        if (y > maxima) {
          maxima = y;
          if (info) info.roca = roca;
        }
      }
    }
  }
  return maxima;
}

// Cuánto sobresale una roca del suelo (medido en su centro), en metros
export function altoRoca(roca) {
  roca.alto ??= alturaRocas(roca.x, roca.z) - alturaSuelo(roca.x, roca.z);
  return roca.alto;
}

export function crearRocas() {
  const grupo = new THREE.Group();
  const { geometrias, rocas } = datosRocas();
  const material = new THREE.MeshStandardMaterial({
    color: '#7a4530',
    roughness: 1,
    flatShading: true,
  });

  for (let k = 0; k < VARIANTES; k++) {
    const malla = new THREE.InstancedMesh(geometrias[k], material, POR_VARIANTE);
    malla.castShadow = true;
    malla.receiveShadow = true;
    rocas
      .filter((roca) => roca.variante === k)
      .forEach((roca, i) => malla.setMatrixAt(i, roca.matriz));
    grupo.add(malla);
  }
  return grupo;
}
