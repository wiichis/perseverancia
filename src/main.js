// Paisaje de Marte cinematográfico: dunas, rocas, cielo caramelo, polvo, sol de tarde y dos lunas
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { altura, crearTerreno } from './terrain.js';
import { crearRocas } from './rocks.js';
import { crearCielo } from './sky.js';
import { crearLunas } from './moons.js';
import { crearPolvo } from './dust.js';

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

// --- Cámara a ras del suelo mirando hacia el sol ---
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 3000);
const camX = 0;
const camZ = 30;
camera.position.set(camX, altura(camX, camZ) + 2.4, camZ);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, altura(0, -30) + 4.5, -30);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.update();

// --- Elementos de la escena ---
const cielo = crearCielo(dirSol);
scene.add(cielo);
scene.add(crearTerreno());
scene.add(crearRocas());
scene.add(crearLunas());

const polvo = crearPolvo();
polvo.position.set(0, altura(0, 0) - 2, 0);
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
sol.target.position.set(0, 0, -20);
sol.position.copy(sol.target.position).addScaledVector(dirSol, 250);
scene.add(sol, sol.target);

// Luz de cielo: cálida arriba, rebote rojizo del suelo
scene.add(new THREE.HemisphereLight('#e7b086', '#6a3420', 1.15));

// --- Postproceso: un toque de bloom para el sol ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- Bucle de render ---
const reloj = new THREE.Clock();
function animar() {
  const dt = Math.min(reloj.getDelta(), 0.05);
  controls.update();
  cielo.position.copy(camera.position);
  polvo.userData.actualizar(dt);
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
