// Rótulo con letras pegado en la parte de atrás del rover: sobre el panel trasero del RTG
// (el generador de energía), que es la cara plana más visible desde atrás.
import * as THREE from 'three';

const ANCHO = 0.9; // metros
const ALTO = 0.25;

// Letras dibujadas en un lienzo, con fondo transparente
function texturaTexto(texto) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 1024;
  lienzo.height = 256;
  const ctx = lienzo.getContext('2d');
  let tam = 200;
  ctx.font = `800 ${tam}px system-ui, sans-serif`;
  // Achica la letra si el texto no cabe
  const medida = ctx.measureText(texto).width;
  if (medida > lienzo.width * 0.92) tam *= (lienzo.width * 0.92) / medida;
  ctx.font = `800 ${tam}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1b1d22';
  ctx.fillText(texto, lienzo.width / 2, lienzo.height / 2 + tam * 0.04);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 8;
  return textura;
}

export function ponerRotulo(rover, texto) {
  // Busca la superficie del panel con un rayo que viene desde atrás, a la altura del panel
  rover.updateMatrixWorld(true);
  const rtg = rover.getObjectByName('rtg');
  const origen = rover.localToWorld(new THREE.Vector3(0, 1.4, -3));
  const direccion = rover.localToWorld(new THREE.Vector3(0, 1.4, 0)).sub(origen).normalize();
  const choque = new THREE.Raycaster(origen, direccion).intersectObject(rtg, true)[0];
  if (!choque) {
    console.warn('Rótulo: no se encontró el panel trasero del RTG');
    return null;
  }

  // Punto y normal del panel en coordenadas del rover
  const inversa = rover.matrixWorld.clone().invert();
  const punto = rover.worldToLocal(choque.point.clone());
  const normal = choque.face.normal.clone().transformDirection(choque.object.matrixWorld).transformDirection(inversa);
  // "Arriba" del texto: el arriba del rover proyectado sobre el panel inclinado
  const arriba = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
  const derecha = new THREE.Vector3().crossVectors(arriba, normal);

  const rotulo = new THREE.Mesh(
    new THREE.PlaneGeometry(ANCHO, ALTO),
    new THREE.MeshStandardMaterial({
      map: texturaTexto(texto),
      transparent: true,
      roughness: 0.55,
      metalness: 0.1,
      // Se dibuja encima del panel sin parpadear
      polygonOffset: true,
      polygonOffsetFactor: -4,
    })
  );
  rotulo.name = 'rotulo';
  rotulo.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(derecha, arriba, normal));
  rotulo.position.copy(punto).addScaledVector(normal, 0.004);
  rotulo.receiveShadow = true;
  rover.add(rotulo);
  return rotulo;
}
