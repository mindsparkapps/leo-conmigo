# Leo Conmigo

Aplicación web progresiva (PWA) para que un niño con síndrome de Down aprenda a leer paso a paso, con calma y acompañado. Sigue el método de lectura global de María Victoria Troncoso y Mercedes del Cerro. Sin puntajes, tiempos ni vidas: el niño nunca pierde.

- Especificación y decisiones: [PLAN.md](PLAN.md). Notas para quien desarrolla: [CLAUDE.md](CLAUDE.md).
- App estática: HTML, CSS y JavaScript con módulos ES. Sin compilación ni dependencias.
- Funciona sin conexión y se instala en el celular. Con una cuenta de Google, los datos quedan iguales en el computador y en el celular (carpeta oculta de Google Drive).

## Probar en el computador

```bash
python -m http.server 8080
```

Abrir `http://localhost:8080`. Las pruebas de la lógica:

```bash
npm test
```

## Publicar en GitHub Pages

La app vive en `https://mindsparkapps.github.io/leo-conmigo/`. Todas las rutas son relativas, así que funciona en esa subcarpeta sin cambios.

1. Crear el repositorio `leo-conmigo` en la organización `mindsparkapps` y subir esta carpeta (rama `main`).
2. En el repositorio: **Settings › Pages › Build and deployment › Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Completar `CLIENT_ID` en `js/config.js` con el cliente OAuth compartido «MindSpark» (ver abajo).
4. Abrir la dirección publicada en el celular y elegir «Instalar aplicación» (Android/Chrome) o «Agregar a pantalla de inicio» (iPhone/Safari).

### Inicio de sesión con Google

En Google Cloud Console, el cliente OAuth «MindSpark» debe tener como **orígenes de JavaScript autorizados**:

- `https://mindsparkapps.github.io`
- `http://localhost:8080` (o el puerto que se use para probar)

La app solo pide el permiso `drive.appdata` (más identidad): no puede ver nada más del Drive. Mientras `CLIENT_ID` esté vacío, la pantalla «Cuenta de Google» avisa que falta configurarlo y la app funciona igual, solo en el dispositivo.

### Cada vez que se publica una versión nueva

- Agregar a `PRECACHE` en `sw.js` los archivos nuevos que haya.
- Subir `VERSION` en `js/config.js`: así se crea una caché nueva y el adulto ve el aviso «Hay una versión nueva» (el niño nunca lo ve).

## Créditos y licencias

- Símbolos pictográficos de [ARASAAC](https://arasaac.org), del Gobierno de Aragón (autor: Sergio Palao), bajo licencia Creative Commons BY-NC-SA. Uso no comercial.
- Letra [Andika](https://software.sil.org/andika/), de SIL International, bajo SIL Open Font License 1.1 (`fonts/OFL.txt`).
