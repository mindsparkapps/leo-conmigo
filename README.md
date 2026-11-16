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

Para la sincronización personal la app solo pide el permiso `drive.appdata` (más identidad): no puede ver nada más del Drive. El permiso `drive` (carpetas compartidas de los alumnos) se pide aparte, y solo cuando el adulto habilita a un alumno. Mientras `CLIENT_ID` esté vacío, la pantalla «Cuenta de Google» avisa que falta configurarlo y la app funciona igual, solo en el dispositivo.

Para que cualquier alumno pueda entrar con su Gmail hay que configurar el proyecto de Google Cloud (orígenes autorizados, permisos, política de privacidad y publicar la app): sigue la guía [docs/google-cloud.md](docs/google-cloud.md). La política de privacidad pública está en [privacidad.html](privacidad.html) (`https://mindsparkapps.github.io/leo-conmigo/privacidad.html`).

## Alumnos con su propio celular

Un alumno usa la app en SU dispositivo, con su propio Gmail, sin ninguna pantalla de configuración. El adulto lo habilita así:

1. Modo adulto → **Alumnos** (con la sesión de Google iniciada en «Cuenta») → dar el permiso de Drive → **Habilitar alumno** en el niño → escribir el Gmail del alumno → **Invitar**.
2. En el dispositivo del niño: instalar la app, tocar **«Este dispositivo es de un alumno»**, entrar con ese Gmail y esperar la descarga. Después funciona sin conexión.
3. En «Alumnos» el adulto ve «Invitado» → «Conectado», ve sus estadísticas, puede **Quitar acceso** y **Desvincular** un dispositivo. Un dispositivo del adulto con datos se puede convertir en «Cuenta» → «Convertir este dispositivo en celular de alumno».

El aula es una carpeta del Drive del adulto compartida **en solo lectura** con los correos invitados; el alumno solo escribe en su subcarpeta `del-alumno/` (más en [PLAN.md](PLAN.md), «Ampliación 3»). Para probar con dos orígenes (adulto en `localhost:8080`, alumno en `127.0.0.1:8080`) con Google y Drive simulados: `python tests/servidor.py 8080` y `tests/navegador/simular-aulas.js`.

### Cada vez que se publica una versión nueva

- Agregar a `PRECACHE` en `sw.js` los archivos nuevos que haya.
- Subir `VERSION` en `js/config.js`: así se crea una caché nueva y el adulto ve el aviso «Hay una versión nueva» (el niño nunca lo ve).

## Créditos y licencias

- Símbolos pictográficos de [ARASAAC](https://arasaac.org), del Gobierno de Aragón (autor: Sergio Palao), bajo licencia Creative Commons BY-NC-SA. Uso no comercial.
- Letra [Andika](https://software.sil.org/andika/), de SIL International, bajo SIL Open Font License 1.1 (`fonts/OFL.txt`).
