// Rocas marcianas instanciadas: muchas pequeñas, pocas grandes
import * as THREE from 'three';
import { crearRandom, ruido } from './noise.js';
import { altura } from './terrain.js';

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

export function crearRocas() {
  const grupo = new THREE.Group();
  const rand = crearRandom(42);
  const material = new THREE.MeshStandardMaterial({
    color: '#7a4530',
    roughness: 1,
    flatShading: true,
  });

  const variantes = 4;
  const porVariante = 130;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();

  for (let k = 0; k < variantes; k++) {
    const malla = new THREE.InstancedMesh(geometriaRoca(k * 13.7, 1, 0.38), material, porVariante);
    malla.castShadow = true;
    malla.receiveShadow = true;

    for (let i = 0; i < porVariante; i++) {
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
      m.compose(p, q, s);
      malla.setMatrixAt(i, m);
    }
    grupo.add(malla);
  }
  return grupo;
}
