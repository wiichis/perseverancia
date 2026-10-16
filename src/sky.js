// Cielo marciano al atardecer: caramelo polvoriento con halo azulado alrededor del sol
import * as THREE from 'three';

export function crearCielo(direccionSol) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      dirSol: { value: direccionSol.clone().normalize() },
      cenit: { value: new THREE.Color('#6e4130') },
      horizonte: { value: new THREE.Color('#dca06c') },
      suelo: { value: new THREE.Color('#9c5e3c') },
      halo: { value: new THREE.Color('#86a8c2') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 dirSol;
      uniform vec3 cenit;
      uniform vec3 horizonte;
      uniform vec3 suelo;
      uniform vec3 halo;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(horizonte, cenit, smoothstep(0.0, 0.65, h));
        col = mix(col, suelo, smoothstep(0.0, -0.15, h));

        float c = max(dot(d, dirSol), 0.0);
        // Halo azul característico del atardecer en Marte
        col = mix(col, halo, pow(c, 30.0) * 0.7);
        // Resplandor cálido y disco solar
        col += vec3(1.0, 0.8, 0.55) * pow(c, 300.0) * 0.5;
        col += vec3(1.0, 0.95, 0.85) * smoothstep(0.99965, 0.99985, c) * 3.0;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1200, 48, 24), material);
}
