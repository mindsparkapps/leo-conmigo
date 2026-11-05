# Leo Conmigo

PWA para que un niño con síndrome de Down aprenda a leer. La especificación completa está en [PLAN.md](PLAN.md): léela entera antes de escribir código.

**Estado:** fases 1, 2 y 3 hechas (esqueleto PWA; motor + `store.js`; modo adulto con perfiles, vocabulario, fotos, voz y pictogramas). Sigue la fase 4 (modo niño y actividades L1–L5): usar `crearSesion`/`registrarRespuesta`/`aplicarResultado` de `js/core/` y `decirPalabra` de `js/audio.js`; las imágenes se muestran con `urlDeMedio` (`js/medios.js`) y, si no hay, con el emoji de la palabra.

- Trabaja una fase del §9 a la vez, en orden; ciérrala con su lista de aceptación y un commit antes de pasar a la siguiente.
- Las reglas pedagógicas del §2 y el motor de progreso del §4 (con sus «Decisiones de implementación») son obligatorios: no los simplifiques ni cambies umbrales sin que el usuario lo pida.
- La lógica de `js/core/` es pura (sin DOM) y lleva pruebas: `npm test` (equivale a `node --test "tests/*.test.js"`; en Node 24 `node --test tests/` falla). El almacén IndexedDB se prueba en el navegador: `/tests/navegador/store.html`.
- Toda función del motor que use azar recibe `aleatorio` (ver `core/azar.js`) para poder probarla con semillas fijas.
- App estática sin compilación, sin frameworks, interfaz y código en español.
- Cada vez que cambies archivos que se precachean, agrégalos a `PRECACHE` en `sw.js` y sube `VERSION` en `js/config.js`.
- Pruebas en el navegador: cierra las pestañas viejas del mismo origen antes de probar el service worker (mantienen vivo un worker antiguo y confunden las pruebas); para recargar de verdad usa `location.reload()`, porque navegar a la misma URL no recarga. No hay cámara ni micrófono: para probar fotos, intercepta `HTMLInputElement.prototype.click` y entrega un `File`; para el micrófono, reemplaza `navigator.mediaDevices.getUserMedia` por un stream de `AudioContext.createMediaStreamDestination()`.
- Servidor de pruebas: `preview_start` con el nombre `leo-conmigo` (su `launch.json` está en `D:\Escritorio\.claude`; fija los tipos MIME porque el `http.server` de Python en Windows sirve `.js` como `text/plain`). Para ver archivos de prueba usa `localhost:8080`; para probar el service worker, `127.0.0.1:8080` (el caché del navegador es aparte por origen).
- El shell Bash de este entorno falla con heredocs y con algunos `grep` con comillas: usa las herramientas Write/Edit o PowerShell.
- No hagas `git push`: el usuario sube los cambios.
- Si algo no está definido en el plan, pregunta.
