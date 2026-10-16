# Paisaje de Marte con Vite + Three.js

## Contexto
Carpeta casi vacía (solo CLAUDE.md). El usuario quiere ver pronto en el navegador de Cursor un paisaje marciano cinematográfico: dunas, rocas, cielo y polvo color caramelo, sol de tarde cálido con sombras suaves, y Fobos y Deimos. Luego iterar con un `npm run check` automático.

**Nota:** Google Chrome no está instalado; sí está **Brave** (Chromium). El check usará Brave vía `executablePath` (sin descargar navegadores).

## Paso 1 — Arranque rápido (< 2 min)
- Escribir a mano (sin `npm create`, más rápido): `package.json`, `index.html`, `src/main.js`, `src/style.css`.
- Deps: `three`, `vite`; dev: `playwright-core` (no descarga navegadores).
- `npm install`, luego `npm run dev` en background (puerto 5173, `--host`).
- Versión inicial: suelo desplazado con ruido, cielo degradado caramelo, `DirectionalLight` cálido baja + `HemisphereLight`, niebla `FogExp2` color polvo, algunas rocas, dos lunas pequeñas. Cámara baja con `OrbitControls`.

## Paso 2 — Mejora cinematográfica
- Módulos en `src/`: `terrain.js` (dunas con ondas direccionales + ruido simplex, colores por altura/pendiente), `rocks.js` (`InstancedMesh` con icosaedros deformados), `sky.js` (shader de cielo: caramelo en horizonte, halo azulado alrededor del sol — atardecer marciano), `moons.js` (Fobos más grande e irregular, Deimos pequeño), `dust.js` (partículas flotantes).
- Render: `ACESFilmicToneMapping`, sombras `PCFSoftShadowMap`, sRGB, pixel ratio limitado.
- Comentarios en español (según CLAUDE.md).

## Paso 3 — `npm run check`
- `scripts/check.mjs`: `playwright-core` `chromium.launch({ executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] })`, abre `http://localhost:5173`, espera ~3 s, guarda `screenshots/check.png`, imprime errores de consola y `pageerror`; código de salida 1 si hay errores.
- `"check": "node scripts/check.mjs"` en package.json (requiere el servidor dev encendido).

## Verificación
Tras cada mejora grande: `npm run check`, leer `screenshots/check.png`, corregir. Máximo 3 rondas. Listo cuando: 0 errores de consola y la captura muestra dunas, rocas, cielo caramelo con polvo, sol cálido con sombras, y ambas lunas.
