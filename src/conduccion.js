// Conducción del rover con WASD: avanza, retrocede y gira sobre sí mismo.
// Las ruedas se apoyan en el suelo y en las rocas con la suspensión rocker-bogie (suspension.js).
// Antes de cada movimiento se prueba la nueva posición: si una rueda tendría que subir una roca
// más alta de lo que puede, o la panza chocaría con una, el rover choca y rebota.
import * as THREE from 'three';
import { crearSuspension } from './suspension.js';

// Velocidades de juego: el Perseverance real va a ~4 cm/s, aquí lo aceleramos
const VEL_MAX = 4; // m/s
const ACELERACION = 3; // m/s²
const FRENADO = 5; // m/s² al soltar las teclas
const GIRO = 0.9; // rad/s
const RADIO_LIMITE = 210; // no salir hacia las montañas del horizonte

// Choques: el rocker-bogie supera obstáculos casi tan altos como el diámetro de sus ruedas (52 cm)
export const ESCALON_MAX = 0.45; // m que puede subir una rueda sobre el suelo
const REBOTE = 0.25; // fracción de la velocidad que conserva al rebotar (coeficiente de restitución)
const VEL_MIN_REBOTE = 0.4; // m/s: por debajo, el choque solo frena (empuja la roca sin rebotar)

const teclas = new Set();
window.addEventListener('keydown', (e) => teclas.add(e.code));
window.addEventListener('keyup', (e) => teclas.delete(e.code));
window.addEventListener('blur', () => teclas.clear());

// alChocar(info) se llama en cada choque con { tipo: 'rueda' | 'panza', velocidad, roca }
// (roca: altura en metros de la roca sobre el suelo)
export function crearConduccion(rover, x = 0, z = 0, rumbo = Math.PI, alChocar = () => {}) {
  const suspension = crearSuspension(rover);
  const estado = { x, z, rumbo, velocidad: 0, giro: 0 };

  let actual = suspension.evaluar(x, z, rumbo);
  suspension.aplicar(actual, 1 / 60, 1);

  // Sacudida del cuerpo al chocar: oscilación amortiguada en cabeceo (rad)
  const sacudida = { amplitud: 0, t: 0 };

  // ¿El movimiento a "nuevo" choca con una roca? Solo cuenta si empeora la situación actual,
  // así el rover siempre puede retroceder o girar para salir.
  function choque(nuevo) {
    for (let i = 0; i < nuevo.elevaciones.length; i++) {
      const e = nuevo.elevaciones[i];
      if (e > ESCALON_MAX && e > actual.elevaciones[i] + 1e-3) {
        return { tipo: 'rueda', roca: nuevo.roca };
      }
    }
    if (nuevo.panza > 0 && nuevo.panza > actual.panza + 1e-3) return { tipo: 'panza', roca: nuevo.roca };
    return null;
  }

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

    const nuevoRumbo = estado.rumbo + estado.giro * dt;
    const paso = estado.velocidad * dt;
    let nx = estado.x + Math.sin(nuevoRumbo) * paso;
    let nz = estado.z + Math.cos(nuevoRumbo) * paso;
    // Límite circular de la zona explorable
    const d = Math.hypot(nx, nz);
    if (d > RADIO_LIMITE) {
      nx *= RADIO_LIMITE / d;
      nz *= RADIO_LIMITE / d;
      estado.velocidad = 0;
    }

    // Se prueba la nueva posición antes de moverse
    const nuevo = suspension.evaluar(nx, nz, nuevoRumbo);
    const golpe = choque(nuevo);
    if (golpe) {
      // Choque: no avanza; rebota hacia atrás si iba rápido, y el cuerpo se sacude
      const impacto = Math.abs(estado.velocidad);
      if (impacto > VEL_MIN_REBOTE) {
        sacudida.amplitud = Math.min(0.012 * impacto, 0.05) * Math.sign(estado.velocidad);
        sacudida.t = 0;
      }
      estado.velocidad = impacto > VEL_MIN_REBOTE ? -estado.velocidad * REBOTE : 0;
      estado.giro = 0;
      alChocar({ ...golpe, velocidad: impacto });
    } else {
      actual = nuevo;
      estado.x = nx;
      estado.z = nz;
      estado.rumbo = nuevoRumbo;
    }

    // Sacudida: por inercia el cuerpo cabecea hacia el choque y oscila sobre la suspensión
    let cabeceo = 0;
    if (sacudida.amplitud !== 0) {
      sacudida.t += dt;
      cabeceo = -sacudida.amplitud * Math.exp(-sacudida.t * 5) * Math.sin(sacudida.t * 22);
      if (sacudida.t > 1.2) sacudida.amplitud = 0;
    }

    suspension.aplicar(actual, dt, 1 - Math.exp(-dt * 10), cabeceo);
  }

  return { estado, actualizar };
}
