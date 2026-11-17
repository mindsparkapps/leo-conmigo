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

Para la sincronización personal la app solo pide el permiso `drive.appdata` (más identidad): no puede ver nada más del Drive. El permiso `drive` (Biblioteca, cursos y carpetas de los alumnos) se pide aparte, y solo cuando el adulto habilita a un alumno. Mientras `CLIENT_ID` esté vacío, la pantalla «Cuenta de Google» avisa que falta configurarlo y la app funciona igual, solo en el dispositivo.

Para que cualquier alumno pueda entrar con su Gmail hay que configurar el proyecto de Google Cloud (orígenes autorizados, permisos, política de privacidad y publicar la app): sigue la guía [docs/google-cloud.md](docs/google-cloud.md). La política de privacidad pública está en [privacidad.html](privacidad.html) (`https://mindsparkapps.github.io/leo-conmigo/privacidad.html`).

## Alumnos con su propio celular

Un **perfil es un curso**: define qué se ve (palabras, frases, libros, álbumes, premios y ajustes). Un **alumno** usa la app en SU dispositivo, con su propio Gmail, y varios alumnos pueden usar el mismo perfil: cada uno tiene su **ficha** con su avance y sus estadísticas. El adulto lo habilita así:

1. Modo adulto → **Alumnos** (con la sesión de Google iniciada en «Cuenta») → dar el permiso de Drive → **Habilitar alumno** en el perfil → escribir el Gmail de cada alumno → **Invitar**.
2. En el dispositivo del alumno: instalar la app, tocar **«Este dispositivo es de un alumno»**, entrar con ese Gmail y esperar la descarga. Después funciona sin conexión.
3. En «Alumnos» el adulto ve «Invitado» → «Conectado», abre la **ficha** de cada alumno (Progreso, «Qué le cuesta» y Álbum, solo lectura), puede **Quitar acceso** y **Desvincular** un dispositivo. Un dispositivo del adulto con datos se puede convertir en «Cuenta» → «Convertir este dispositivo en celular de alumno».

En el Drive del adulto, dentro de «Leo Conmigo»: la **Biblioteca** (una sola copia de las fotos y voces propias, compartida en solo lectura con todos los alumnos invitados), un **curso** por perfil (compartido en solo lectura con sus alumnos) y, aparte, una **carpeta por alumno** (`Alumnos · <perfil>/<correo>/`, donde solo escribe ese alumno y nadie más la ve). Las voces del catálogo vienen en la app: no se suben. La tabla completa de quién puede tocar qué está en [PLAN.md](PLAN.md), «Ampliación 4».

**El celular del alumno y la familia.** El candado «Config» abre el mismo panel del adulto con el **menú reducido** (Vocabulario, Frases, Libros, Álbum, Tienda, Progreso, «Qué le cuesta» y Ayuda). Lo del curso solo se ve («Del curso»); la familia agrega lo suyo («De la familia»): palabras, frases, libros, álbumes completos, premios y monedas. Eso se guarda en el celular del alumno y en el **Drive del alumno** (su carpeta oculta y `familia/` dentro de su carpeta), nunca en el del adulto; el adulto recibe las estadísticas en la ficha y solo baja las fotos y voces con **«Traer el material de la familia»**. El alumno respalda su avance en su propio Drive y lo recupera al reinstalar.

**Actualizar con alumnos ya habilitados.** La primera vez que el adulto abre «Alumnos» con la versión nueva, la app reorganiza las carpetas (crea la Biblioteca, **mueve** las fotos y voces sin volver a subirlas, crea la carpeta de cada alumno y pasa su avance a su ficha). No se borra nada de Drive; la limpieza de repetidos es la fase 26 de [PLAN.md](PLAN.md).

Para probar con tres orígenes (adulto en `localhost:8080`, alumnos en `127.0.0.1:8080` y `127.0.0.2:8080`) con Google y Drive simulados: `python tests/servidor.py 8080` y `tests/navegador/simular-aulas.js`.

## Modo «Escritura» (experimental)

Un modo aparte donde el niño arma palabras poniendo sílabas en cajas (20 niveles, de las vocales a los dictados). Se habilita por perfil en modo adulto → **Escritura (experimental)** (o la casilla de Perfiles). Mientras no esté habilitada, solo la ven los **administradores** (Cuenta → «Administradores», por correo de Google) con la etiqueta «Modo administrador», y lo que juegan se guarda en un **perfil de prueba** (`prueba:<perfilId>`) que se puede borrar. Por defecto se toca (sin arrastrar) y el error es suave; arrastrar y rojo suave son opciones. Progreso y «Qué le cuesta» tienen su sección de escritura y la exportación para IA la incluye. Base pedagógica y fuentes: [docs/escritura-fuentes.md](docs/escritura-fuentes.md).

**Voces que faltan.** Las sílabas y palabras del banco sin grabación usan la voz sintética (una sílaba suelta suena peor). Para ver qué falta y dónde va cada mp3: `node herramientas/listar-voces-escritura.mjs` (deja [data/escritura/faltan-voces.txt](data/escritura/faltan-voces.txt)); al generar una voz, anótala en `js/silabas-voz.js` (sílabas) o en `data/voces/indice.json` (palabras) y agrégala a `PRECACHE` en `sw.js`.

### Cada vez que se publica una versión nueva

- Agregar a `PRECACHE` en `sw.js` los archivos nuevos que haya.
- Subir `VERSION` en `js/config.js`: así se crea una caché nueva y el adulto ve el aviso «Hay una versión nueva» (el niño nunca lo ve).

## Créditos y licencias

- Símbolos pictográficos de [ARASAAC](https://arasaac.org), del Gobierno de Aragón (autor: Sergio Palao), bajo licencia Creative Commons BY-NC-SA. Uso no comercial.
- Letra [Andika](https://software.sil.org/andika/), de SIL International, bajo SIL Open Font License 1.1 (`fonts/OFL.txt`).
