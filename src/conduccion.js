// Conducción del rover con WASD: avanza, retrocede y gira sobre sí mismo,
// apoyando las seis ruedas en el terreno (cabeceo y alabeo según el suelo)
import * as THREE from 'three';
import { alturaSuelo } from './terrain.js';

// Velocidades de juego: el Perseverance real va a ~4 cm/s, aquí lo aceleramos
const VEL_MAX = 4; // m/s
const ACELERACION = 3; // m/s²
const FRENADO = 5; // m/s² al soltar las teclas
const GIRO = 0.9; // rad/s
const RADIO_LIMITE = 210; // no salir hacia las montañas del horizonte

const teclas = new Set();
window.addEventListener('keydown', (e) => teclas.add(e.code));
window.addEventListener('keyup', (e) => teclas.delete(e.code));
window.addEventListener('blur', () => teclas.clear());

export function crearConduccion(rover, x = 0, z = 0, rumbo = Math.PI) {
  const { via, eje } = rover.userData;
  const estado = { x, z, rumbo, velocidad: 0, giro: 0 };

  const adelante = new THREE.Vector3();
  const izquierda = new THREE.Vector3();
  const arriba = new THREE.Vector3();
  const matriz = new THREE.Matrix4();
  const objetivo = new THREE.Quaternion();

  // Coloca el rover sobre el suelo. "suave" (0..1) interpola desde la pose anterior.
  function apoyar(suave) {
    const s = Math.sin(estado.rumbo);
    const c = Math.cos(estado.rumbo);
    // El frente del modelo es +Z local y su izquierda +X local
    const alto = (adelanteM, izquierdaM) =>
      alturaSuelo(estado.x + s * adelanteM + c * izquierdaM, estado.z + c * adelanteM - s * izquierdaM);

    // Altura del suelo bajo las cuatro ruedas de las esquinas
    const di = alto(eje, via);
    const dd = alto(eje, -via);
    const ti = alto(-eje, via);
    const td = alto(-eje, -via);

    // Pendiente hacia delante y hacia la izquierda (el balancín reparte las diferencias)
    const pendAdelante = (di + dd - ti - td) / 2 / (2 * eje);
    const pendIzquierda = (di + ti - dd - td) / 2 / (2 * via);
    adelante.set(s, pendAdelante, c).normalize();
    izquierda.set(c, pendIzquierda, -s).normalize();
    arriba.crossVectors(adelante, izquierda).normalize();
    izquierda.crossVectors(arriba, adelante);
    objetivo.setFromRotationMatrix(matriz.makeBasis(izquierda, arriba, adelante));

    const y = (di + dd + ti + td) / 4;
    rover.position.set(estado.x, THREE.MathUtils.lerp(rover.position.y, y, suave), estado.z);
    rover.quaternion.slerp(objetivo, suave);
  }

  rover.position.y = alturaSuelo(x, z);
  apoyar(1);

  // Avanza la simulación dt segundos
  function actualizar(dt) {
    const acelerar = (teclas.has('KeyW') ? 1 : 0) - (teclas.has('KeyS') ? 1 : 0);
    const girar = (teclas.has('KeyA') ? 1 : 0) - (teclas.has('KeyD') ? 1 : 0);

    if (acelerar !== 0) {
      estado.velocidad += acelerar * ACELERACION * dt;
    } else {
      // Frenado suave hasta parar
      const f = Math.min(Math.abs(estado.velocidad), FRENADO * dt);
      estado.velocidad -= Math.sign(estado.velocidad) * f;
    }
    estado.velocidad = THREE.MathUtils.clamp(estado.velocidad, -VEL_MAX / 2, VEL_MAX);

    // Giro con inercia leve; A siempre gira a la izquierda del rover
    estado.giro = THREE.MathUtils.damp(estado.giro, girar * GIRO, 6, dt);
    estado.rumbo += estado.giro * dt;

    const paso = estado.velocidad * dt;
    let nx = estado.x + Math.sin(estado.rumbo) * paso;
    let nz = estado.z + Math.cos(estado.rumbo) * paso;
    // Límite circular de la zona explorable
    const d = Math.hypot(nx, nz);
    if (d > RADIO_LIMITE) {
      nx *= RADIO_LIMITE / d;
      nz *= RADIO_LIMITE / d;
      estado.velocidad = 0;
    }
    estado.x = nx;
    estado.z = nz;

    apoyar(1 - Math.exp(-dt * 10));
  }

  return { estado, actualizar };
}
