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
  const ruedas = modelo.getObjectByName('Wheels_objs');
  modelo.updateMatrixWorld(true);
  const cajaRuedas = new THREE.Box3().setFromObject(ruedas);
  const centro = cajaRuedas.getCenter(new THREE.Vector3());
  modelo.position.set(-centro.x, -cajaRuedas.min.y, -centro.z);

  const rover = new THREE.Group();
  rover.name = 'Perseverance';
  rover.add(modelo);

  // Medidas de las ruedas para apoyarlas en el terreno y dejar huellas
  const tam = cajaRuedas.getSize(new THREE.Vector3());
  const radioRueda = tam.y / 2;
  const anchoRueda = 0.4; // aprox. de las ruedas reales de Perseverance
  rover.userData = {
    camaras,
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
