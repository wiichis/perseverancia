// Rover Perseverance: modelo 3D oficial de la NASA (NASA-3D-Resources, formato glTF con Draco)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const URL_MODELO = '/modelos/perseverance.glb';

// Las piezas que son cámaras se reconocen por su nombre en el modelo;
// las tapas, cables y soportes de las cámaras no cuentan
const ES_CAMARA = /cam|lens|watson/i;
const NO_CAMARA = /cover|wiring|bracket/i;

// Qué es cada cámara del modelo (según la misión Mars 2020)
const DESCRIPCION = {
  Mastcam_Z_cams: 'Mastcam-Z: par estéreo con zoom en el mástil',
  NavCams: 'Navcam: cámaras de navegación del mástil',
  lens: 'SuperCam: lente del láser y cámara remota (RMI) del mástil',
  hazcams_front: 'Hazcam delanteras: evitan obstáculos',
  hazcams_rear: 'Hazcam traseras: evitan obstáculos',
  Up_Look_Camera: 'Cámara que mira hacia arriba (descenso, EDL)',
  Down_Look_Camera: 'Cámara que mira hacia abajo (descenso, EDL)',
  WATSON: 'WATSON: cámara de primer plano en la torreta del brazo',
};

// El modelo viene con el mástil plegado (como viajó a Marte). Sus animaciones son un ciclo
// completo: el mástil se levanta (0–2,5 s), queda arriba hasta los 13,3 s y vuelve a plegarse.
// Las fijamos en un instante con el mástil levantado. El brazo queda plegado para conducir.
const MASTIL_ARRIBA = 8; // segundos dentro de la animación
function desplegarMastil(modelo, animaciones) {
  const mastil = [modelo.getObjectByName('Cylinder'), modelo.getObjectByName('Armature')];
  const enMastil = (o) => {
    for (; o; o = o.parent) if (mastil.includes(o)) return true;
    return false;
  };
  const mezclador = new THREE.AnimationMixer(modelo);
  for (const clip of animaciones) {
    const delMastil = clip.tracks.every((t) =>
      enMastil(modelo.getObjectByName(THREE.PropertyBinding.parseTrackName(t.name).nodeName))
    );
    if (!delMastil) continue;
    const accion = mezclador.clipAction(clip);
    accion.setLoop(THREE.LoopOnce, 1);
    accion.clampWhenFinished = true;
    accion.play();
  }
  mezclador.update(MASTIL_ARRIBA);
}

// En el modelo las 6 ruedas son una sola pieza (3 mallas: llanta, rin y buje, cada una con las 6).
// Las separamos repartiendo cada triángulo según su posición (lado y eje), y montamos cada rueda
// en dos pivotes en su centro: "direccion" gira en vertical (motor de dirección) y "rodadura" la hace rodar.
const NOMBRES_RUEDAS = {
  '1,1': 'delantera izquierda', '1,0': 'media izquierda', '1,-1': 'trasera izquierda',
  '-1,1': 'delantera derecha', '-1,0': 'media derecha', '-1,-1': 'trasera derecha',
};

function separarRuedas(piezaRuedas) {
  const grupos = new Map(); // clave "lado,eje" -> { triangulos por malla, caja }
  const v = new THREE.Vector3();
  const vertice = new THREE.Vector3();
  const mallas = piezaRuedas.children.filter((m) => m.isMesh);

  for (const malla of mallas) {
    const pos = malla.geometry.attributes.position;
    const indice = malla.geometry.index.array;
    for (let t = 0; t < indice.length; t += 3) {
      // Centro del triángulo: lado (+X izquierda) y eje (delante, medio, detrás)
      v.set(0, 0, 0);
      for (let k = 0; k < 3; k++) v.add(vertice.fromBufferAttribute(pos, indice[t + k]));
      v.divideScalar(3);
      const clave = `${v.x > 0 ? 1 : -1},${v.z > 0.55 ? 1 : v.z < -0.55 ? -1 : 0}`;
      if (!grupos.has(clave)) grupos.set(clave, { indices: new Map(), caja: new THREE.Box3() });
      const g = grupos.get(clave);
      if (!g.indices.has(malla)) g.indices.set(malla, []);
      g.indices.get(malla).push(indice[t], indice[t + 1], indice[t + 2]);
      for (let k = 0; k < 3; k++) g.caja.expandByPoint(vertice.fromBufferAttribute(pos, indice[t + k]));
    }
  }

  const ruedas = [];
  for (const [clave, g] of grupos) {
    const centro = g.caja.getCenter(new THREE.Vector3());
    const direccion = new THREE.Group();
    const rodadura = new THREE.Group();
    direccion.position.copy(centro);
    direccion.add(rodadura);
    for (const [malla, indices] of g.indices) {
      // Comparte los vértices de la malla original; solo cambia qué triángulos dibuja
      const geo = new THREE.BufferGeometry();
      for (const [nombre, atributo] of Object.entries(malla.geometry.attributes)) geo.setAttribute(nombre, atributo);
      geo.setIndex(indices);
      const parte = new THREE.Mesh(geo, malla.material);
      parte.position.copy(centro).negate();
      parte.castShadow = parte.receiveShadow = true;
      rodadura.add(parte);
    }
    piezaRuedas.add(direccion);
    const [, posicionEje] = clave.split(',').map(Number);
    ruedas.push({
      nombre: NOMBRES_RUEDAS[clave],
      direccion,
      rodadura,
      dirige: posicionEje !== 0, // en el rover real solo las 4 de las esquinas tienen dirección
      x: 0, // posición en el rover; se calcula después de centrar el modelo
      z: 0,
      angulo: 0, // ángulo de dirección actual
    });
  }
  for (const m of mallas) piezaRuedas.remove(m);
  return ruedas;
}

// Carga el modelo y lo devuelve envuelto en un grupo cuyo origen queda en el suelo,
// centrado entre las ruedas, con el frente hacia +Z. El modelo ya viene en metros (tamaño real).
// "entorno" es el mapa de reflejos del cielo para los metales del rover.
export async function cargarRover(entorno) {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync(URL_MODELO);
  draco.dispose();

  const modelo = gltf.scene;
  desplegarMastil(modelo, gltf.animations);

  const camaras = [];
  modelo.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      for (const m of [].concat(o.material)) {
        if (!m.isMeshStandardMaterial) continue;
        m.envMap = entorno;
        m.envMapIntensity = 0.8;
      }
    }
    if (ES_CAMARA.test(o.name) && !NO_CAMARA.test(o.name)) camaras.push(o);
  });

  // Apoyamos las ruedas en y = 0 y centramos en planta usando las ruedas como referencia
  const piezaRuedas = modelo.getObjectByName('Wheels_objs');
  modelo.updateMatrixWorld(true);
  const cajaRuedas = new THREE.Box3().setFromObject(piezaRuedas);
  const ruedas = separarRuedas(piezaRuedas);
  const centro = cajaRuedas.getCenter(new THREE.Vector3());
  modelo.position.set(-centro.x, -cajaRuedas.min.y, -centro.z);

  const rover = new THREE.Group();
  rover.name = 'Perseverance';
  rover.add(modelo);

  // Medidas de las ruedas para apoyarlas en el terreno y dejar huellas
  const tam = cajaRuedas.getSize(new THREE.Vector3());
  const radioRueda = tam.y / 2;
  const anchoRueda = 0.4; // aprox. de las ruedas reales de Perseverance
  // Posición de cada rueda en el rover (x: izquierda, z: delante)
  rover.updateMatrixWorld(true);
  const p = new THREE.Vector3();
  for (const r of ruedas) {
    rover.worldToLocal(r.direccion.getWorldPosition(p));
    r.x = p.x;
    r.z = p.z;
  }

  rover.userData = {
    camaras,
    ruedas,
    radioRueda,
    anchoRueda,
    // Distancia lateral del centro al centro de la rueda (vía) y del centro a los ejes extremos
    via: tam.x / 2 - anchoRueda / 2,
    eje: tam.z / 2 - radioRueda,
    animaciones: gltf.animations, // incluye el brazo robótico, para usarlo más adelante
  };

  // Medidas reales del rover completo (para comprobar la escala)
  rover.updateMatrixWorld(true);
  const dim = new THREE.Box3().setFromObject(rover).getSize(new THREE.Vector3());
  console.log(
    `Perseverance cargado: ${dim.z.toFixed(2)} m de largo, ${dim.x.toFixed(2)} m de ancho, ${dim.y.toFixed(2)} m de alto`
  );

  console.log(`Cámaras del rover (${camaras.length}):`);
  for (const c of camaras) console.log(`  • ${c.name} — ${DESCRIPCION[c.name] ?? 'cámara'}`);

  return rover;
}
