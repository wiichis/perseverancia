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

export function crearTerreno() {
  const tam = 1100;
  const seg = 480;
  const geo = new THREE.PlaneGeometry(tam, tam, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, altura(pos.getX(i), pos.getZ(i)));
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
