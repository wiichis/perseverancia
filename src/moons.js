// Fobos y Deimos: las dos lunas irregulares de Marte
import * as THREE from 'three';
import { geometriaRoca } from './rocks.js';

export function crearLunas() {
  // Tono pálido y luminoso: se ven a través de la atmósfera polvorienta
  const material = new THREE.MeshStandardMaterial({
    color: '#d8c6b4',
    emissive: '#9c8574',
    roughness: 1,
    fog: false,
  });

  // Fobos: más grande y algo alargada
  const fobos = new THREE.Mesh(geometriaRoca(3.1, 3, 0.12), material);
  fobos.scale.set(14, 11, 11);
  fobos.position.set(-300, 260, -700);

  // Deimos: pequeña y casi esférica
  const deimos = new THREE.Mesh(geometriaRoca(8.4, 3, 0.08), material);
  deimos.scale.set(6.5, 6, 6);
  deimos.position.set(60, 240, -700);

  const grupo = new THREE.Group();
  grupo.add(fobos, deimos);
  grupo.userData = { fobos, deimos };
  return grupo;
}
