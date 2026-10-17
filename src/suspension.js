// Suspensión rocker-bogie del Perseverance, con las rocas como obstáculos reales.
//
// - Cada rueda es un círculo que rueda sobre el suelo y las rocas: si delante o debajo de ella
//   hay una roca, el centro de la rueda sube lo justo para apoyarse en ella sin atravesarla.
// - Si el suelo desaparece bajo una rueda (al bajar de una roca), cae con la gravedad de Marte.
// - En cada lado, el "bogie" une la rueda del medio y la trasera; el "rocker" une la delantera con
//   el pivote del bogie y se articula al cuerpo. Un diferencial reparte el giro de los dos rockers:
//   el cuerpo se inclina la media de ambos. Así cada rueda carga más o menos un tercio del peso
//   y el cuerpo se mueve mucho menos que las ruedas.
import * as THREE from 'three';
import { alturaSuelo } from './terrain.js';
import { alturaRocas, altoRoca } from './rocks.js';

export const GRAVEDAD_MARTE = 3.71; // m/s²
const DESPEJE = 0.6; // altura de la panza sobre el suelo (Perseverance: ~60 cm)
const RECORRIDO = { min: -0.35, max: 0.7 }; // cuánto puede bajar o subir una rueda respecto al cuerpo

// Puntos de la panza (entre las ruedas) que se revisan contra las rocas
const PANZA = [];
for (const x of [-0.6, 0, 0.6]) for (const z of [-0.9, -0.45, 0, 0.45, 0.9]) PANZA.push({ x, z });

export function crearSuspension(rover) {
  const { ruedas, radioRueda: R, anchoRueda, suspension: brazos } = rover.userData;
  // Ejes del rocker (en el cuerpo) y del bogie (en el rocker), a lo largo del rover
  const zRocker = brazos.ejeRocker;
  const zBogie = brazos.ejeBogie;

  // Ruedas de cada lado: delantera, media y trasera (z: hacia delante)
  const lado = (signo) => {
    const delLado = ruedas.map((r, i) => ({ r, i })).filter(({ r }) => Math.sign(r.x) === signo);
    delLado.sort((a, b) => b.r.z - a.r.z);
    const [delantera, media, trasera] = delLado;
    return { delantera, media, trasera, x: delLado.reduce((s, { r }) => s + r.x, 0) / 3 };
  };
  const lados = [lado(1), lado(-1)]; // izquierda (+X), derecha (-X)
  lados[0].brazos = brazos.izquierda;
  lados[1].brazos = brazos.derecha;

  // Altura (o desplazamiento) del eje del bogie, entre la rueda del medio y la trasera
  const enBogie = (m, t, hm, ht) => hm + ((ht - hm) * (m.r.z - zBogie)) / (m.r.z - t.r.z);
  const alturaBase = ruedas.map((r) => r.direccion.position.y);

  // Muestras bajo cada rueda: a lo largo (de -R a R, hacia delante) y a lo ancho
  const MUESTRAS = [];
  for (let k = -4; k <= 4; k++) {
    const largo = (k / 4) * R * 0.98;
    for (const ancho of [-0.4, 0, 0.4]) {
      MUESTRAS.push({ largo, ancho: ancho * anchoRueda, alto: Math.sqrt(R * R - largo * largo) });
    }
  }

  // Punto del rover (lx: izquierda, lz: delante) en el mundo, sin inclinar
  const enMundo = (x, z, s, c, lx, lz) => [x + s * lz + c * lx, z + c * lz - s * lx];

  // Pose del cuerpo según la altura del apoyo de cada rueda (rocker-bogie + diferencial)
  function poseCuerpo(apoyos) {
    const rockers = lados.map(({ delantera: d, media: m, trasera: t, x }) => {
      const bogie = enBogie(m, t, apoyos[m.i], apoyos[t.i]);
      const pendiente = (apoyos[d.i] - bogie) / (d.r.z - zBogie);
      return { x, pendiente, pivote: bogie + pendiente * (zRocker - zBogie) };
    });
    const [izq, der] = rockers;
    const pendAdelante = (izq.pendiente + der.pendiente) / 2; // el diferencial promedia los dos rockers
    return {
      y: (izq.pivote + der.pivote) / 2 - pendAdelante * zRocker, // altura en el centro del rover
      pendAdelante,
      pendIzquierda: (izq.pivote - der.pivote) / (izq.x - der.x),
    };
  }

  // Calcula, para una posición y rumbo del rover, dónde se apoya cada rueda y si la panza
  // tocaría alguna roca. No mueve nada: sirve para probar un movimiento antes de hacerlo.
  function evaluar(x, z, rumbo) {
    const s = Math.sin(rumbo);
    const c = Math.cos(rumbo);
    const apoyos = []; // altura de la parte de abajo de cada rueda
    const elevaciones = []; // cuánto la levantan las rocas sobre el suelo
    let roca = null; // la roca que más empuja a las ruedas o a la panza
    const info = {};
    for (const r of ruedas) {
      const [rx, rz] = enMundo(x, z, s, c, r.x, r.z);
      const suelo = alturaSuelo(rx, rz);
      let centro = suelo + R; // centro de la rueda apoyada en el suelo
      for (const m of MUESTRAS) {
        const [px, pz] = enMundo(rx, rz, s, c, m.ancho, m.largo);
        const techo = alturaRocas(px, pz, info);
        // El círculo de la rueda toca este punto de la roca si su centro está a esta altura
        if (techo + m.alto > centro) {
          centro = techo + m.alto;
          roca = info.roca;
        }
      }
      apoyos.push(centro - R);
      elevaciones.push(centro - suelo - R);
    }

    // ¿Cuánto se metería una roca en la panza? (> 0: choque)
    const pose = poseCuerpo(apoyos);
    let panza = -Infinity;
    for (const p of PANZA) {
      const [px, pz] = enMundo(x, z, s, c, p.x, p.z);
      const techo = alturaRocas(px, pz, info);
      if (techo === -Infinity) continue;
      const fondo = pose.y + p.z * pose.pendAdelante + p.x * pose.pendIzquierda + DESPEJE;
      if (techo - fondo > panza) {
        panza = techo - fondo;
        if (panza > 0) roca = info.roca;
      }
    }
    // roca: altura en metros de esa roca sobre el suelo (0 si no hay ninguna)
    return { x, z, rumbo, apoyos, elevaciones, panza, roca: roca ? altoRoca(roca) : 0 };
  }

  // Estado físico de cada rueda: altura real y velocidad vertical (para caer con gravedad)
  const alturas = [];
  const velocidades = ruedas.map(() => 0);
  const adelante = new THREE.Vector3();
  const izquierda = new THREE.Vector3();
  const arriba = new THREE.Vector3();
  const matriz = new THREE.Matrix4();
  const objetivo = new THREE.Quaternion();
  const montaje = new THREE.Vector3();

  // Mueve el rover a la pose evaluada "ev": las ruedas suben al instante si algo las empuja
  // y caen con gravedad si se quedan sin apoyo. "suave" (0..1) amortigua el cuerpo;
  // "cabeceo" (rad) inclina el cuerpo de más sobre la suspensión (sacudida de un choque).
  function aplicar(ev, dt, suave = 1, cabeceo = 0) {
    for (let i = 0; i < ruedas.length; i++) {
      const apoyo = ev.apoyos[i];
      if (alturas[i] === undefined) alturas[i] = apoyo;
      const antes = alturas[i];
      const enCaida = antes + (velocidades[i] - GRAVEDAD_MARTE * dt) * dt;
      alturas[i] = Math.max(apoyo, enCaida);
      // Apoyada: no conserva velocidad hacia arriba (no sale despedida al subir una roca)
      velocidades[i] = (alturas[i] - antes) / Math.max(dt, 1e-4);
      if (alturas[i] === apoyo) velocidades[i] = Math.min(velocidades[i], 0);
    }

    // Cuerpo: posición e inclinación que dan el rocker-bogie y el diferencial
    const pose = poseCuerpo(alturas);
    const s = Math.sin(ev.rumbo);
    const c = Math.cos(ev.rumbo);
    // El frente del modelo es +Z local y su izquierda +X local
    adelante.set(s, pose.pendAdelante + Math.tan(cabeceo), c).normalize();
    izquierda.set(c, pose.pendIzquierda, -s).normalize();
    arriba.crossVectors(adelante, izquierda).normalize();
    izquierda.crossVectors(arriba, adelante);
    objetivo.setFromRotationMatrix(matriz.makeBasis(izquierda, arriba, adelante));
    rover.position.set(ev.x, THREE.MathUtils.lerp(rover.position.y, pose.y, suave), ev.z);
    rover.quaternion.slerp(objetivo, suave);
    rover.updateMatrixWorld();

    // Cada rueda sube o baja respecto al cuerpo hasta su apoyo real: así se ve levantarse
    const desplazamientos = ruedas.map((r, i) => {
      const alturaMontaje = rover.localToWorld(montaje.set(r.x, 0, r.z)).y;
      const d = THREE.MathUtils.clamp(alturas[i] - alturaMontaje, RECORRIDO.min, RECORRIDO.max);
      r.direccion.position.y = alturaBase[i] + d;
      return d;
    });

    // Los brazos giran sobre sus ejes para seguir a las ruedas: el bogie según la rueda del medio
    // y la trasera; el rocker según la delantera y el eje del bogie (girar en +X baja el frente)
    for (const { delantera: d, media: m, trasera: t, brazos: b } of lados) {
      const [dd, dm, dt] = [desplazamientos[d.i], desplazamientos[m.i], desplazamientos[t.i]];
      const anguloBogie = Math.atan((dm - dt) / (m.r.z - t.r.z));
      const anguloRocker = Math.atan((dd - enBogie(m, t, dm, dt)) / (d.r.z - zBogie));
      b.rocker.rotation.x = -anguloRocker;
      b.bogie.rotation.x = -(anguloBogie - anguloRocker); // el bogie cuelga del rocker
    }
  }

  return { evaluar, aplicar };
}
