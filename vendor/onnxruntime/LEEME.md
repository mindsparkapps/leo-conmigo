# onnxruntime-web (copiado, sin npm)

- **Versión:** 1.31.1 (la última estable del registro de npm el 2026-11-25).
- **Licencia:** MIT, © Microsoft Corporation (campo `license` de su `package.json`; el paquete no trae archivo LICENSE: el texto está en `LICENSE-ONNXRUNTIME.txt`).
- **Origen:** `https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.31.1.tgz`, carpeta `package/dist/`. Se copiaron tal cual (sin modificar):

| Archivos | Peso del `.wasm` | Para qué |
|---|---|---|
| `ort.wasm.min.mjs` + `ort-wasm-simd-threaded.mjs` + `.wasm` | 14,8 MB | Motor solo WASM (CPU, SIMD; con hilos si la página está aislada entre orígenes). **El que se usa por defecto** (con el int8 gana por mucho, ver PLAN.md). |
| `ort.webgpu.min.mjs` + `ort-wasm-simd-threaded.asyncify.mjs` + `.wasm` | 28,7 MB | WebGPU con Asyncify (funciona en cualquier Chrome con WebGPU). |
| `ort.jspi.min.mjs` + `ort-wasm-simd-threaded.jspi.mjs` + `.wasm` | 17,9 MB | WebGPU con JSPI (solo Chrome reciente). |

Cada `ort.*.min.mjs` carga sus propios archivos `ort-wasm-simd-threaded[.asyncify|.jspi].{mjs,wasm}` desde la carpeta que se le indique en `ort.env.wasm.wasmPaths`.
(El paquete 1.31 ya no usa los `*.jsep.*` de versiones anteriores.)

Para actualizar: bajar el `.tgz` nuevo y copiar esos mismos archivos; anotar aquí la versión.
Nada de esto va en `PRECACHE` todavía: lo decide la fase 35 (ver PLAN.md, «Decisiones de implementación (fase 33a)»). **Ojo:** el flujo `.github/workflows/pages.yml` solo copia `index.html`, `manifest.webmanifest`, `sw.js`, `css`, `data`, `fonts`, `icons` y `js`: hay que agregar `vendor` (y revisar `privacidad.html`) antes de que la app publicada use este motor.
