// Perseverance en Marte: paisaje cinematográfico (dunas, rocas, cielo caramelo, polvo, sol de tarde
// y dos lunas) con el rover oficial de la NASA, conducible con WASD, que deja huellas
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { alturaSuelo, crearTerreno } from './terrain.js';
import { crearRocas } from './rocks.js';
import { crearCielo } from './sky.js';
import { crearLunas } from './moons.js';
import { crearPolvo } from './dust.js';
import { cargarRover } from './rover.js';
import { crearConduccion } from './conduccion.js';
import { crearHuellas } from './huellas.js';

// --- Renderizador ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- Escena y polvo atmosférico (niebla) ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#c98e60', 0.003);

// --- Sol de tarde: bajo en el horizonte, delante de la cámara ---
const dirSol = new THREE.Vector3(0.42, 0.16, -1).normalize();

// --- Punto de partida del rover: zona sin rocas, mirando hacia el sol (-Z) ---
const INICIO = { x: 0, z: -20, rumbo: Math.PI };
const ALTURA_MIRA = 1.3; // la cámara apunta a la altura del cuerpo del rover

// --- Cámara detrás del rover; se puede girar alrededor de él con el ratón ---
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(INICIO.x + 2.5, alturaSuelo(INICIO.x, INICIO.z + 9) + 3.2, INICIO.z + 9);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(INICIO.x, alturaSuelo(INICIO.x, INICIO.z) + ALTURA_MIRA, INICIO.z);
controls.enableDamping = true;
controls.enablePan = false; // el centro de giro siempre es el rover
controls.minDistance = 4;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.49;
controls.update();

// --- Elementos de la escena ---
const cielo = crearCielo(dirSol);
scene.add(cielo);
scene.add(crearTerreno());
scene.add(crearRocas());
scene.add(crearLunas());

const polvo = crearPolvo();
scene.add(polvo);

// --- Luces ---
const sol = new THREE.DirectionalLight('#ffbe85', 3.4);
sol.castShadow = true;
sol.shadow.mapSize.set(4096, 4096);
const cam = sol.shadow.camera;
cam.left = -110;
cam.right = 110;
cam.top = 110;
cam.bottom = -110;
cam.near = 1;
cam.far = 600;
sol.shadow.bias = -0.0004;
sol.shadow.normalBias = 0.4;
scene.add(sol, sol.target);

// La zona de sombras (220 m) se recentra cuando el rover se aleja de su centro.
// Moverla solo a saltos evita que los bordes de las sombras tiemblen al conducir.
function centrarSombras(x, z) {
  sol.target.position.set(x, 0, z);
  sol.position.copy(sol.target.position).addScaledVector(dirSol, 250);
}
centrarSombras(INICIO.x, INICIO.z);

// Luz de cielo: cálida arriba, rebote rojizo del suelo
scene.add(new THREE.HemisphereLight('#e7b086', '#6a3420', 1.15));

// --- Postproceso: un toque de bloom para el sol ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- Reflejos del cielo para los metales del rover (solo afecta al rover) ---
const pmrem = new THREE.PMREMGenerator(renderer);
const escenaEntorno = new THREE.Scene();
escenaEntorno.add(crearCielo(dirSol));
const entorno = pmrem.fromScene(escenaEntorno, 0.04, 0.1, 2000).texture;
pmrem.dispose();

// --- Indicaciones en pantalla ---
const ayuda = document.createElement('div');
ayuda.className = 'ayuda';
ayuda.textContent = 'Cargando el rover Perseverance…';
document.body.appendChild(ayuda);

// --- Rover, conducción y huellas (el modelo se carga en segundo plano) ---
let rover = null;
let conduccion = null;
let huellas = null;
const anterior = { posicion: new THREE.Vector3(), rumbo: 0 };

cargarRover(entorno)
  .then((modelo) => {
    rover = modelo;
    scene.add(rover);
    conduccion = crearConduccion(rover, INICIO.x, INICIO.z, INICIO.rumbo);
    huellas = crearHuellas(rover.userData.anchoRueda);
    scene.add(huellas);
    anterior.posicion.copy(rover.position);
    anterior.rumbo = conduccion.estado.rumbo;
    // Solo en desarrollo: acceso desde la consola del navegador para explorar y depurar
    if (import.meta.env.DEV) window.perseverance = { rover, conduccion, huellas, camera, controls };
    ayuda.textContent = 'W/S avanzar y retroceder · A/D girar · arrastra para mirar alrededor';
  })
  .catch((e) => {
    console.error('No se pudo cargar el rover:', e);
    ayuda.textContent = 'No se pudo cargar el rover (ver consola)';
  });

// Las tres ruedas de cada lado pisan casi la misma línea: basta con seguir las del medio
// (centradas en el rover) para dibujar un rastro por lado, avance o retroceda
function dejarHuellas() {
  const { x, z, rumbo } = conduccion.estado;
  const { via } = rover.userData;
  const c = Math.cos(rumbo);
  const s = Math.sin(rumbo);
  huellas.userData.rueda('izquierda', x + c * via, z - s * via);
  huellas.userData.rueda('derecha', x - c * via, z + s * via);
}

// La cámara acompaña al rover: se desplaza con él y gira lo mismo que él gira
const desplazamiento = new THREE.Vector3();
const EJE_Y = new THREE.Vector3(0, 1, 0);
function seguirRover() {
  desplazamiento.subVectors(rover.position, anterior.posicion);
  camera.position.add(desplazamiento);
  controls.target.set(rover.position.x, rover.position.y + ALTURA_MIRA, rover.position.z);

  const giro = conduccion.estado.rumbo - anterior.rumbo;
  camera.position.sub(controls.target).applyAxisAngle(EJE_Y, giro).add(controls.target);

  anterior.posicion.copy(rover.position);
  anterior.rumbo = conduccion.estado.rumbo;
}

// La cámara nunca se mete bajo el suelo
function camaraSobreSuelo() {
  const minimo = alturaSuelo(camera.position.x, camera.position.z) + 0.6;
  if (camera.position.y < minimo) camera.position.y = minimo;
}

// --- Bucle de render ---
const reloj = new THREE.Clock();
function animar() {
  const dt = Math.min(reloj.getDelta(), 0.05);
  if (rover) {
    conduccion.actualizar(dt);
    dejarHuellas();
    seguirRover();
    if (Math.hypot(rover.position.x - sol.target.position.x, rover.position.z - sol.target.position.z) > 25) {
      centrarSombras(rover.position.x, rover.position.z);
    }
  }
  controls.update();
  camaraSobreSuelo();
  cielo.position.copy(camera.position);
  polvo.userData.actualizar(dt, controls.target);
  composer.render();
  requestAnimationFrame(animar);
}
animar();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
