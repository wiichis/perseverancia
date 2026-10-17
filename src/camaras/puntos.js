// Puntos que brillan sobre 4 cámaras del rover. Al pasar el mouse muestran su nombre;
// al hacer clic, la cámara "toma" una foto real de Marte (ver visor.js).
// Son elementos HTML que siguen a su pieza del modelo 3D en cada cuadro.
import * as THREE from 'three';
import { abrirFoto } from './visor.js';

// Pieza del modelo, nombre a mostrar y en qué parte de la pieza va el punto:
// "x" es la fracción a lo ancho de la pieza (0 = derecha del rover, 1 = izquierda). Mastcam-Z y
// las Navcam comparten la cabeza del mástil; cada punto va sobre un ojo distinto para no taparse.
export const CAMARAS = [
  { pieza: 'Mastcam_Z_cams', nombre: 'Mastcam-Z', detalle: 'cámaras con zoom del mástil', x: 0.85 },
  { pieza: 'NavCams', nombre: 'Navcam', detalle: 'cámaras de navegación', x: 0.1 },
  { pieza: 'hazcams_front', nombre: 'Hazcam delanteras', detalle: 'evitan obstáculos', x: 0.5 },
  { pieza: 'WATSON', nombre: 'WATSON', detalle: 'primer plano, en el brazo', x: 0.5 },
];

const CUADROS_ENTRE_OCLUSIONES = 6; // revisar si el rover tapa el punto no hace falta en cada cuadro

// Caja de una pieza en coordenadas del rover (sirve aunque el rover ya esté girado)
function cajaEnRover(rover, pieza) {
  const caja = new THREE.Box3();
  const parte = new THREE.Box3();
  const aRover = new THREE.Matrix4();
  rover.updateMatrixWorld(true);
  const inversa = rover.matrixWorld.clone().invert();
  pieza.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    aRover.multiplyMatrices(inversa, o.matrixWorld);
    caja.union(parte.copy(o.geometry.boundingBox).applyMatrix4(aRover));
  });
  return caja;
}

export function crearPuntosCamaras(rover, camara) {
  const capa = document.createElement('div');
  capa.className = 'camaras';
  document.body.appendChild(capa);

  const puntos = [];
  for (const c of CAMARAS) {
    const pieza = rover.getObjectByName(c.pieza);
    if (!pieza) {
      console.warn(`Cámaras: no está la pieza "${c.pieza}" en el modelo`);
      continue;
    }
    // Ancla en la cara delantera de la pieza (las cámaras miran hacia delante)
    const caja = cajaEnRover(rover, pieza);
    const ancla = new THREE.Object3D();
    ancla.position.set(
      THREE.MathUtils.lerp(caja.min.x, caja.max.x, c.x),
      (caja.min.y + caja.max.y) / 2,
      caja.max.z
    );
    rover.add(ancla);

    const boton = document.createElement('button');
    boton.className = 'camara-punto';
    boton.dataset.camara = c.pieza;
    boton.setAttribute('aria-label', `${c.nombre}: tomar una foto`);
    boton.innerHTML = `<span class="camara-nombre"><b>${c.nombre}</b> · ${c.detalle}</span>`;
    boton.addEventListener('click', () => {
      boton.classList.remove('disparo');
      void boton.offsetWidth; // reinicia la animación del disparo
      boton.classList.add('disparo');
      abrirFoto(c);
    });
    capa.appendChild(boton);
    puntos.push({ c, pieza, ancla, boton });
  }

  // ¿Alguna otra parte del rover queda entre la cámara del juego y el punto?
  const rayo = new THREE.Raycaster();
  const dentroDe = (o, pieza) => {
    for (; o; o = o.parent) if (o === pieza) return true;
    return false;
  };
  function tapado(p, mundo) {
    const distancia = camara.position.distanceTo(mundo);
    rayo.set(camara.position, mundo.clone().sub(camara.position).normalize());
    rayo.far = distancia;
    const choque = rayo.intersectObject(rover, true).find((h) => !dentroDe(h.object, p.pieza));
    return Boolean(choque && choque.distance < distancia - 0.05);
  }

  const mundo = new THREE.Vector3();
  const pantalla = new THREE.Vector3();
  let cuadro = 0;

  // Llamar en cada cuadro, después de mover la cámara
  function actualizar() {
    const revisarOclusion = cuadro++ % CUADROS_ENTRE_OCLUSIONES === 0;
    camara.updateMatrixWorld(); // la posición de este cuadro, no la del anterior
    for (const p of puntos) {
      p.ancla.getWorldPosition(mundo);
      pantalla.copy(mundo).project(camara);
      const visible = pantalla.z < 1 && Math.abs(pantalla.x) < 1.1 && Math.abs(pantalla.y) < 1.1;
      p.boton.hidden = !visible;
      if (!visible) continue;
      const x = (pantalla.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-pantalla.y * 0.5 + 0.5) * window.innerHeight;
      p.boton.style.transform = `translate(${x}px, ${y}px)`;
      // Tapado por el propio rover: se ve más tenue, pero se puede seguir pulsando
      if (revisarOclusion) p.boton.classList.toggle('tapado', tapado(p, mundo));
    }
  }

  return { actualizar };
}
