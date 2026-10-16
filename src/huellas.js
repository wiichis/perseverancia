// Huellas de las ruedas en la arena: cada rueda deja tramos que unen su posición anterior
// con la actual, así el rastro es continuo y sigue las curvas.
// Se usa un InstancedMesh como búfer circular: al llenarse, se reemplazan las huellas más viejas.
import * as THREE from 'three';
import { alturaSuelo, normalSuelo } from './terrain.js';

const MAX_TRAMOS = 8000; // ~1,4 km de rastro con las dos ruedas
const LARGO_TRAMO = 0.35; // metros entre marcas (cada tramo lleva 8 relieves, como la rueda real)

// Textura de la rodada: arena aplastada con las marcas de los relieves (grousers) de la rueda
function texturaRodada() {
  const lienzo = document.createElement('canvas');
  lienzo.width = 64;
  lienzo.height = 128;
  const ctx = lienzo.getContext('2d');

  // Fondo: arena compactada, más marcada en el centro y difusa en los bordes
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 128);

  // Relieves de la rueda: barras transversales ligeramente curvas
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 5;
  for (let y = 8; y < 128; y += 16) {
    ctx.beginPath();
    ctx.moveTo(8, y + 3);
    ctx.quadraticCurveTo(32, y - 3, 56, y + 3);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function crearHuellas(anchoRueda = 0.4) {
  // Tramo de 1 m de largo; cada instancia se escala a la distancia recorrida por la rueda
  const geo = new THREE.PlaneGeometry(anchoRueda, 1);
  geo.rotateX(-Math.PI / 2); // tumbada en el plano XZ, a lo largo de Z

  const material = new THREE.MeshStandardMaterial({
    map: texturaRodada(),
    color: '#4a200f',
    roughness: 1,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    // Evita el parpadeo con el suelo (z-fighting)
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const malla = new THREE.InstancedMesh(geo, material, MAX_TRAMOS);
  malla.count = 0;
  malla.frustumCulled = false;
  malla.receiveShadow = true;
  malla.renderOrder = 1;

  let siguiente = 0;
  const n = new THREE.Vector3();
  const f = new THREE.Vector3();
  const lado = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const m = new THREE.Matrix4();

  // Coloca un tramo de huella entre (x0, z0) y (x1, z1), apoyado en el suelo
  function tramo(x0, z0, x1, z1) {
    const largo = Math.hypot(x1 - x0, z1 - z0);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    normalSuelo(mx, mz, n);
    // Dirección del tramo proyectada sobre la pendiente del suelo
    f.set(x1 - x0, alturaSuelo(x1, z1) - alturaSuelo(x0, z0), z1 - z0);
    f.addScaledVector(n, -f.dot(n)).normalize();
    lado.crossVectors(n, f);
    pos.set(mx, alturaSuelo(mx, mz), mz).addScaledVector(n, 0.02);
    m.makeBasis(lado, n, f.multiplyScalar(largo)).setPosition(pos);

    malla.setMatrixAt(siguiente, m);
    siguiente = (siguiente + 1) % MAX_TRAMOS;
    malla.count = Math.min(malla.count + 1, MAX_TRAMOS);
    malla.instanceMatrix.needsUpdate = true;
  }

  // Última marca de cada rueda (por nombre)
  const ultimas = new Map();

  // Informa la posición actual de una rueda; cuando avanzó lo suficiente deja un tramo
  malla.userData.rueda = (nombre, x, z) => {
    const u = ultimas.get(nombre);
    if (!u) {
      ultimas.set(nombre, { x, z });
      return;
    }
    if (Math.hypot(x - u.x, z - u.z) < LARGO_TRAMO) return;
    tramo(u.x, u.z, x, z);
    u.x = x;
    u.z = z;
  };

  return malla;
}
