// Cinemática de las 6 ruedas del Perseverance, como en el rover real:
// - Las 4 ruedas de las esquinas tienen motor de dirección; las 2 del medio son fijas.
// - Cada rueda de esquina se orienta según la velocidad de su punto de contacto, así ninguna
//   se arrastra de lado (el centro de giro queda sobre la línea de las ruedas del medio).
// - Cada rueda rueda sin deslizar: velocidad angular = velocidad de su punto de contacto / radio.
//   En una curva las de fuera giran más rápido; al girar sobre sí mismo, cada lado gira al revés.
import * as THREE from 'three';

// Límites de los motores de dirección (aproximados)
const DIRECCION_MAX = THREE.MathUtils.degToRad(90);
const VEL_DIRECCION = THREE.MathUtils.degToRad(120); // rad/s

// velocidad: m/s hacia delante; giro: rad/s (positivo = a la izquierda); dt: s
export function actualizarRuedas(rover, velocidad, giro, dt) {
  const { ruedas, radioRueda } = rover.userData;
  const quieto = Math.abs(velocidad) < 1e-3 && Math.abs(giro) < 1e-3;

  for (const r of ruedas) {
    // Velocidad del punto de contacto en el rover (x: izquierda, z: delante) = v + ω × posición
    const vx = giro * r.z;
    const vz = velocidad - giro * r.x;

    if (r.dirige && !quieto) {
      // Ángulo que alinea la rueda con su velocidad. Se deja en [-90°, 90°]:
      // en vez de girar media vuelta, la rueda rueda hacia atrás
      let objetivo = Math.atan2(vx, vz);
      if (objetivo > Math.PI / 2) objetivo -= Math.PI;
      if (objetivo < -Math.PI / 2) objetivo += Math.PI;
      objetivo = THREE.MathUtils.clamp(objetivo, -DIRECCION_MAX, DIRECCION_MAX);
      // El motor de dirección tarda en llegar al ángulo pedido
      const paso = VEL_DIRECCION * dt;
      r.angulo += THREE.MathUtils.clamp(objetivo - r.angulo, -paso, paso);
    }
    r.direccion.rotation.y = r.angulo;

    // Velocidad a lo largo de la dirección en que apunta la rueda → cuánto rueda
    const rodando = vx * Math.sin(r.angulo) + vz * Math.cos(r.angulo);
    r.rodadura.rotation.x += (rodando / radioRueda) * dt;
  }
}
