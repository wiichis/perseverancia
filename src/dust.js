// Polvo en suspensión: partículas suaves que el viento arrastra
import * as THREE from 'three';
import { crearRandom } from './noise.js';

function texturaSuave() {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 64;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(lienzo);
}

export function crearPolvo(cantidad = 2500, ancho = 140, alto = 18) {
  const rand = crearRandom(7);
  const posiciones = new Float32Array(cantidad * 3);
  for (let i = 0; i < cantidad; i++) {
    posiciones[i * 3] = (rand() - 0.5) * ancho;
    posiciones[i * 3 + 1] = rand() * alto;
    posiciones[i * 3 + 2] = (rand() - 0.5) * ancho;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));

  const puntos = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.18,
      map: texturaSuave(),
      color: '#f0c49a',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );

  // Mueve el polvo con el viento y lo recicla dentro de la caja (coordenadas locales)
  puntos.userData.actualizar = (dt) => {
    const p = geo.attributes.position;
    for (let i = 0; i < cantidad; i++) {
      let x = p.getX(i) + dt * 2.2;
      let y = p.getY(i) + Math.sin((x + i) * 0.3) * dt * 0.15;
      let z = p.getZ(i) + dt * 0.8;
      if (x > ancho / 2) x -= ancho;
      if (z > ancho / 2) z -= ancho;
      if (y < 0) y += alto;
      if (y > alto) y -= alto;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
  };
  return puntos;
}
