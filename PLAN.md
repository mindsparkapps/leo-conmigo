# Plan de trabajo — «Leo Conmigo»

PWA para que un niño con síndrome de Down aprenda a leer en español, acompañado por un adulto (mamá, papá, educadora diferencial o fonoaudióloga).

> **Para quien programa (Sonnet):** este documento es la especificación completa. Trabaja **fase por fase, en orden**. No empieces una fase sin cerrar la anterior con su lista de aceptación. Las reglas pedagógicas de la sección 2 **no se negocian**: si una decisión técnica choca con ellas, ganan ellas. Si algo no está definido aquí, pregunta antes de inventar.

---

## 0. Decisiones abiertas (valores por defecto mientras el usuario no diga otra cosa)

| Tema | Por defecto |
|---|---|
| Nombre de la app / repo | «Leo Conmigo» / `mindsparkapps/leo-conmigo` |
| Edad del niño | 4–10 años, aún no lee |
| Dispositivo principal | Tablet o celular Android; también PC e iPhone/iPad |
| Variante del español | Chile (voz `es-CL`, vocabulario chileno: «auto», «pelota», «polera») |
| Tipo de letra | Minúscula de imprenta (Andika) |
| Perfiles | Varios niños por cuenta (útil si lo usa una terapeuta) |

---

## 1. Qué es y qué no es

**Es:** una app de sesiones cortas (5–10 min) que sigue el método de lectura global de María Victoria Troncoso y Mercedes del Cerro (*Síndrome de Down: lectura y escritura*), muy usado en Chile y España para niños con síndrome de Down. El niño aprende primero palabras completas con significado para él (su nombre, «mamá», su perro), luego frases, y solo después sílabas.

**Por qué ese método:** en el síndrome de Down la memoria y el procesamiento **visual** suelen ser un punto fuerte, mientras que la memoria auditiva de corto plazo y el lenguaje expresivo suelen ser más débiles. Por eso se lee primero «con los ojos» (reconocer la palabra entera como una imagen) y no se empieza por el deletreo fonético.

**No es:** un juego con puntajes, tiempos ni vidas. No reemplaza al adulto ni a los profesionales: el adulto elige y personaliza las palabras, y la app le muestra el avance.

---

## 2. Reglas pedagógicas (obligatorias)

1. **Aprendizaje sin error.** El niño nunca «pierde». Si toca una opción incorrecta:
   - la opción incorrecta se atenúa suavemente (sin sonido de error, sin cruz roja, sin vibración);
   - la correcta se ilumina y late, y se vuelve a decir la palabra;
   - el niño toca la correcta → elogio breve. El ensayo queda registrado como «con ayuda».
2. **Empezar fácil y subir de a poco.** Primero 2 opciones, luego 3, luego 4. Al principio los distractores son muy distintos (otra primera letra, otro largo); después, más parecidos.
3. **Palabras con significado personal primero.** Nombre del niño, familia, mascotas, comidas y juguetes favoritos, con **fotos reales** si es posible.
4. **Sesiones cortas.** Por defecto 8 ensayos (configurable 4–15). Sin cronómetro, sin límite de tiempo por ensayo.
5. **Éxito asegurado.** Cada sesión mezcla ~70 % de palabras en práctica y ~30 % de palabras ya dominadas. Como máximo 1–2 palabras nuevas por sesión; conjunto de trabajo de 3–5 palabras.
6. **Fatiga.** Si hay 3 errores seguidos, el siguiente ensayo es una palabra dominada con 2 opciones y la sesión termina con premio después de ese acierto.
7. **Apoyo visual siempre.** Todo lo que se dice se ve, y todo lo que se ve se puede escuchar tocándolo (muchos niños con síndrome de Down tienen pérdida auditiva).
8. **Pantalla tranquila.** Un solo foco por pantalla, sin animaciones de fondo, sin parpadeos, sin publicidad. Misma distribución en todas las actividades: modelo arriba, opciones abajo.
9. **Motricidad fina.** Solo toques simples (nada de arrastrar, doble toque ni mantener presionado en el modo niño). Objetivos táctiles grandes (mínimo 88 px, ideal 120 px), con separación generosa. Ignorar toques múltiples y repetidos en menos de 400 ms.
10. **Refuerzo positivo breve.** Elogio hablado corto y variado («¡Muy bien!», «¡Eso es!», «¡Lo lograste!») y una animación de ≤ 1,5 s. Al final de la sesión, una calcomanía para su álbum. La intensidad de las celebraciones es configurable (algunos niños se sobreestimulan).
11. **No se evalúa el habla.** Si se usa el micrófono, es solo para que el niño se escuche o para el adulto; nunca para decidir si acertó (la articulación suele ser difícil y no debe frustrar).

---

## 3. Progresión del aprendizaje

Las etapas siguen a Troncoso y del Cerro. Cada actividad tiene un código que se usa en el código fuente.

### Etapa 0 — Percepción y discriminación (pre-lectura)
Para niños que aún no emparejan bien. Se puede saltar desde el panel del adulto.

| Código | Actividad | Qué ve / hace el niño |
|---|---|---|
| `P1` | Imagen igual | Ve una imagen modelo; toca la imagen idéntica entre 2–4. |
| `P2` | Misma cosa | Ve una foto; toca el pictograma de lo mismo (foto de su perro → pictograma de perro). |
| `P3` | Clasificar | «¿Cuál es una comida?» — toca la imagen que corresponde a la categoría. |

### Etapa 1 — Lectura global de palabras (el núcleo de la app)

| Código | Actividad | Qué ve / hace el niño |
|---|---|---|
| `L1` | Palabra igual (con imagen) | Modelo: tarjeta con imagen + palabra. Toca la tarjeta con la **misma palabra** (las opciones también tienen imagen). |
| `L2` | Palabra igual (sin imagen) | Igual que L1, pero las opciones son solo palabras. Es emparejar formas, aún no leer. |
| `L3` | De la imagen a la palabra | Ve la imagen y escucha la palabra; toca la palabra escrita correcta. |
| `L4` | De la palabra a la imagen | Ve **solo la palabra escrita** (sin audio al inicio); toca la imagen correcta. **Esto ya es leer.** Si se equivoca, la ayuda incluye el audio. |
| `L5` | Escucho y elijo | Escucha la palabra; toca la palabra escrita entre 2–4 (sin imágenes). |
| `L6` | Leo en voz alta (asistida, opcional) | Ve la palabra; el niño la dice. El adulto toca un botón discreto ✓ / «otra vez» en una esquina. Solo se activa si el adulto lo habilita. |

**Orden por palabra:** L1 → L2 → L3 → L4 → L5. Una palabra pasa a la siguiente actividad cuando está *dominada* en la actual (ver §4). L4 es el criterio principal de «palabra leída».

### Etapa 2 — Frases
Se desbloquea cuando hay **≥ 10 palabras dominadas en L4**. Usa sustantivos ya dominados + un pequeño grupo de palabras de enlace que se enseñan igual que las palabras (por L1–L5): `come`, `bebe`, `duerme`, `juega`, `es`, `está`, `tiene`, `el`, `la`, `y`.

| Código | Actividad | Qué ve / hace el niño |
|---|---|---|
| `F1` | Frase igual | Modelo: frase con imagen. Toca la frase idéntica entre 2–3. |
| `F2` | Leo la frase | Ve la frase escrita («papá come pan»); toca la imagen que la representa. |
| `F3` | Armo la frase | Ve una imagen; toca las palabras **en orden** (aparecen en una franja de construcción). Sin arrastrar. Si toca la palabra equivocada, la correcta se ilumina. |
| `B1` | Mi libro | Libro personalizado: páginas con foto + frase corta creadas por el adulto. Lectura con resaltado palabra por palabra y audio al tocar. No se evalúa. |

### Etapa 3 — Sílabas
Se desbloquea cuando hay **≥ 20 palabras dominadas en L4** (el adulto puede adelantarla). Siempre parte de palabras que el niño ya conoce.

| Código | Actividad | Qué ve / hace el niño |
|---|---|---|
| `S1` | Descubro la sílaba | Ve una palabra conocida separada en sílabas por color («**ma**·má»); se resalta y suena «ma». Toca la palabra que **empieza igual** entre 2–3. |
| `S2` | Completo la palabra | Ve imagen + «__sa» (mesa); toca la sílaba que falta entre 2–4. |
| `S3` | Armo la palabra | Ve imagen; toca las sílabas en orden para formar la palabra. |
| `S4` | Palabra nueva | Lee una palabra **nunca vista** hecha con sílabas que ya domina; toca la imagen correcta. |

### Etapa 4 — Lectura con comprensión
Cuentos cortos (3–6 páginas, 1 frase por página) armados por el adulto o de una pequeña colección incluida. Al final, 1–2 preguntas con respuesta por imagen («¿Quién comió pan?»).

---

## 4. Motor de progreso (definición exacta)

Implementarlo como lógica **pura** en `js/core/progreso.js` y `js/core/sesion.js`, con pruebas.

**Estado por (perfil, palabra, actividad):** `nueva` → `practica` → `dominada`, más un historial de los últimos 10 ensayos `{fecha, correctoAlPrimerIntento, opciones}`.

- **Dominada:** acierto al primer intento en ≥ 4 de los últimos 5 ensayos de esa actividad, **en al menos 2 días distintos**.
- **Retroceso:** si una palabra dominada falla 2 veces seguidas en repaso, vuelve a `practica` (sin ningún aviso al niño).

**Número de opciones (por perfil y actividad):** empieza en 2. Sube 1 (máx. 4, o el máximo que fije el adulto) si la precisión al primer intento en los últimos 10 ensayos de esa actividad es ≥ 80 %. Baja 1 (mín. 2) si es < 50 %.

**Distractores:**
- Nivel fácil (2 opciones o precisión < 80 %): palabras con otra primera letra y largo distinto en ≥ 2 letras, de otra categoría.
- Nivel normal: cualquier palabra del vocabulario activo distinta de la objetivo.
- Nunca usar como distractor una palabra que el niño no haya visto en L1 al menos una vez.

**Repaso espaciado (palabras dominadas):** cajas tipo Leitner con intervalos de 1, 2, 4, 8 y 16 días. Acierto → sube de caja; error → vuelve a la caja 1.

**Armado de una sesión (`crearSesion(perfil, fecha)`):**
1. Tomar las palabras en `practica` (máx. 5) ordenadas por la más antigua sin practicar.
2. Si hay menos de 3 en práctica, introducir hasta 2 palabras nuevas del vocabulario en el orden que fijó el adulto.
3. Completar ~30 % con repasos vencidos según Leitner (si no hay, con dominadas al azar).
4. Para cada palabra, usar la actividad más baja no dominada de su etapa.
5. No repetir la misma palabra dos veces seguidas; no más de 3 ensayos seguidos de la misma actividad.
6. Primer y último ensayo: siempre algo que el niño hace bien.

**Desbloqueo de etapas:** automático según los umbrales de §3; el adulto puede forzar o bloquear cualquier etapa y marcar a mano una palabra como dominada o nueva.

---

## 5. Experiencia de uso

### Modo niño
- **Inicio:** foto o avatar del niño con su nombre escrito (es la primera palabra que verá a diario) y un solo botón grande ▶. Debajo, el álbum de calcomanías.
- **Ensayo:** modelo arriba (centrado, grande), opciones abajo en fila o cuadrícula 2×2. Ícono de altavoz grande para volver a escuchar. Sin textos de instrucción escritos: la consigna se dice en voz alta («Toca la que es igual»).
- **Fin de sesión:** celebración + calcomanía nueva + vuelta al inicio. No se muestran números ni porcentajes.
- **Sin salidas accidentales:** ningún enlace externo, sin menú. Para salir al modo adulto: **mantener presionado 3 s** el ícono de candado de una esquina y luego resolver una suma simple de dos cifras.
- En la ayuda del adulto, explicar cómo activar «Fijar pantalla» (Android) o «Acceso guiado» (iPhone/iPad).

### Modo adulto
- **Perfiles:** crear, editar, cambiar entre niños.
- **Primer uso (asistente):** nombre del niño, foto (cámara o galería), familiares y mascotas con foto, gustos. De ahí salen las primeras 5–8 palabras.
- **Vocabulario:** lista de palabras con imagen, audio, categoría y estado. Agregar palabra: escribir el texto → elegir imagen (foto propia, pictograma ARASAAC o emoji de respaldo) → grabar audio con su voz (recomendado) o usar voz sintética → revisar la división en sílabas propuesta (editable: «ma-má»). Reordenar la cola de palabras nuevas.
- **Frases y libros:** editor simple de frases (elegir palabras dominadas) y de libros (páginas con foto + frase).
- **Progreso:** tabla por palabra (estado en cada actividad), precisión por semana en un gráfico de barras SVG simple (sin librerías), historial de sesiones (fecha, duración, ensayos, aciertos al primer intento), palabras leídas totales.
- **Ajustes por perfil:** ensayos por sesión, máximo de opciones, actividades habilitadas, etapa inicial, mayúsculas o minúsculas, tamaño de letra, velocidad de voz, sonido, intensidad de celebraciones, alto contraste, habilitar `L6`.
- **Cuenta:** iniciar/cerrar sesión con Google, estado de sincronización, exportar/importar respaldo JSON.

### Diseño visual
- Letra **Andika** (SIL, licencia OFL), diseñada para alfabetización: «a» y «g» de un solo piso. Alojarla en `fonts/` (woff2), no cargarla desde Google Fonts, para que funcione sin conexión.
- Palabras en tarjetas: texto negro sobre fondo blanco o crema, mínimo 56 px en celular y 80 px en tablet; sin cursivas, sin sombras, sin degradados detrás del texto.
- Paleta calma (azules y verdes suaves); un único color de resalte para la ayuda (amarillo cálido) y uno para el acierto (verde). Nunca rojo para errores.
- Respetar `prefers-reduced-motion`.
- Orientación: funciona en vertical y horizontal; en tablet horizontal las opciones van en fila.

---

## 6. Audio, imágenes y hardware

**Voz:**
1. Prioridad: grabación del adulto (`MediaRecorder`; elegir el formato con `MediaRecorder.isTypeSupported`: `audio/webm;codecs=opus` en Chrome/Android, `audio/mp4` en Safari).
2. Respaldo: `speechSynthesis` con voz `es-CL` → `es-419` / `es-US` / `es-MX` → `es-ES` → cualquier `es-*`. Las voces cargan de forma asíncrona (`voiceschanged`). En iPhone el primer audio debe ir después de un toque del usuario: el botón ▶ de inicio sirve para «desbloquear» el audio.
3. Frases de consigna y elogios: también con voz sintética, o grabables por el adulto en Ajustes.

**Imágenes:**
- Fotos propias: `<input type="file" accept="image/*" capture="environment">`, recortar a cuadrado y reducir a 512×512 con `canvas`, guardar como WebP (JPEG si no hay soporte).
- Pictogramas **ARASAAC** (los más usados en Chile y España para necesidades educativas especiales). Buscar por texto en español con su API pública y **descargar la imagen a IndexedDB** al elegirla, para que funcione sin conexión. Verificar los endpoints vigentes en https://arasaac.org/developers/api (hoy: `https://api.arasaac.org/v1/pictograms/es/search/{texto}` y la imagen en `https://static.arasaac.org/pictograms/{id}/{id}_500.png`).
- Licencia ARASAAC: CC BY-NC-SA. Mostrar en «Acerca de»: *«Los símbolos pictográficos utilizados son propiedad del Gobierno de Aragón y han sido creados por Sergio Palao para ARASAAC (https://arasaac.org), que los distribuye bajo Licencia Creative Commons BY-NC-SA.»* La app no puede ser comercial mientras use ARASAAC.
- Respaldo sin conexión: emoji asociado en el vocabulario inicial.

**Hardware (siempre con detección de soporte y alternativa):** cámara (fotos), micrófono (grabar palabras), `navigator.vibrate` muy breve solo en aciertos y desactivable (no existe en iPhone), `navigator.storage.persist()` al iniciar para evitar que el navegador borre los datos.

---

## 7. Arquitectura técnica

Sigue el estándar de las apps MindSpark (igual que ZenBan y ApiTrack): app estática sin paso de compilación, HTML + CSS + JavaScript con módulos ES, IndexedDB local, login con Google Identity Services y datos en la carpeta oculta `appDataFolder` del Drive del usuario. **Si el código de ZenBan o ApiTrack está disponible, copiar su patrón de `auth.js`, `drive.js` y `store.js` en vez de reescribirlo.**

### Estructura

```
index.html
manifest.webmanifest
sw.js
fonts/            Andika-Regular.woff2, Andika-Bold.woff2, OFL.txt
icons/            192, 512 y 512-maskable
css/app.css
data/vocabulario-inicial.json
data/calcomanias/ (SVG propios, simples)
js/
  config.js       CLIENT_ID del cliente OAuth "MindSpark", versión de la app
  app.js          arranque, router por hash (#/nino, #/adulto/...)
  auth.js         login Google y renovación del token
  drive.js        leer/escribir data.json y archivos de medios en appDataFolder
  store.js        IndexedDB + cola de sincronización
  sync.js         fusión por updatedAt, subida/bajada de medios
  hardware.js     cámara, micrófono, vibración, almacenamiento persistente
  audio.js        reproducir grabación o voz sintética, consignas, elogios
  pictos.js       búsqueda y descarga de ARASAAC
  core/           LÓGICA PURA, sin DOM (probada con node --test)
    silabas.js    división silábica del español
    progreso.js   estados, dominio, opciones, Leitner
    sesion.js     crearSesion(), registrarRespuesta()
    distractores.js
    frases.js
  actividades/    un archivo por actividad: P1.js … S4.js
  ui/             componentes: tarjeta, boton-audio, celebracion, candado
  nino/           inicio.js, sesion.js, premio.js, album.js
  adulto/         panel.js, perfiles.js, vocabulario.js, editor-palabra.js,
                  frases.js, libros.js, progreso.js, ajustes.js, cuenta.js
tests/            *.test.js para js/core
```

### Interfaz común de actividades

```js
// js/actividades/L4.js
export default {
  id: 'L4',
  etapa: 1,
  nombre: 'De la palabra a la imagen',
  consigna: 'Lee y toca el dibujo',          // se dice en voz alta
  // Devuelve un ensayo serializable, sin DOM:
  crearEnsayo({ objetivo, distractores, ajustes }) {
    return { actividad: 'L4', modelo: {...}, opciones: [...], correctaId, audioInicial: false };
  },
  // Dibuja el ensayo y avisa cada toque; la ayuda sin error la maneja ui/ (común a todas)
  render(contenedor, ensayo, { onRespuesta }) { ... }
};
```

El motor de sesión no conoce los detalles de cada actividad: pide un ensayo, lo muestra, recibe `{correctoAlPrimerIntento, intentos, ms}` y actualiza el progreso. La lógica de «ayuda sin error» (§2.1) vive en un único lugar compartido.

### Modelo de datos

Todo registro tiene `id` (UUID), `updatedAt` (ISO) y `deleted` (booleano) para la sincronización.

```js
perfil     { id, nombre, fotoMedioId, fechaNacimiento?, ajustes:{...}, etapaActual, creado }
palabra    { id, perfilId, texto, silabas:['ma','má'], categoria, tipo:'sustantivo'|'enlace',
             medioImagenId?, arasaacId?, emoji?, medioAudioId?, orden, activa }
progreso   { id: `${perfilId}:${palabraId}:${actividad}`, estado, historial:[...], cajaLeitner, proximoRepaso }
nivel      { id: `${perfilId}:${actividad}`, opciones }
frase      { id, perfilId, palabraIds:[...], medioImagenId? }
libro      { id, perfilId, titulo, paginas:[{ medioImagenId, fraseId }] }
sesion     { id, perfilId, inicio, fin, ensayos:[{ palabraId|fraseId, actividad, correctoAlPrimerIntento, intentos, ms }] }
calcomania { id, perfilId, codigo, fecha }
medio      { id, tipo:'imagen'|'audio', mime, blob (solo local), driveFileId?, subido }
```

**IndexedDB:** un *object store* por entidad + `colaSync`.
**Drive:** `data.json` con todo excepto los `blob`; cada medio como archivo aparte en `appDataFolder` llamado `medio-<id>.<ext>`. Al sincronizar, subir medios pendientes y bajar bajo demanda los que falten en ese dispositivo.

### División silábica (`core/silabas.js`)
Implementar las reglas del español: grupos inseparables `pr br tr dr cr gr fr pl bl cl gl fl`; dígrafos `ch ll rr qu gu`; una consonante entre vocales va con la siguiente; diptongos (débil + fuerte o débil + débil) juntos; hiatos (dos fuertes `a e o`, o débil tildada `í ú`) separados; `h` intercalada no impide diptongo. El adulto siempre puede corregir el resultado. Pruebas con al menos 40 palabras, entre ellas: mamá, papá, perro, casa, pelota, leche, chocolate, llave, guitarra, queso, agua, auto, oreja, maíz, tía, flor, plátano, bicicleta, zanahoria, cuaderno.

### Service worker
Precachear el *shell* (HTML, CSS, JS, fuentes, íconos, vocabulario inicial, calcomanías). Responder desde caché y actualizar en segundo plano. **Nunca** cachear `googleapis.com`, `accounts.google.com` ni `api.arasaac.org` (las imágenes de ARASAAC se guardan en IndexedDB a propósito). Versionar la caché con `config.js` y avisar al adulto, no al niño, cuando hay versión nueva.

### Privacidad
Fotos y voz del niño se guardan solo en el dispositivo y en el Drive del adulto (`appDataFolder`). Sin analítica ni terceros, salvo Google (login y Drive) y ARASAAC (solo se envía el texto buscado). Indicarlo en «Acerca de».

---

## 8. Vocabulario inicial (`data/vocabulario-inicial.json`)

El asistente de primer uso agrega primero las palabras personales (nombre del niño, familia, mascotas). Además ofrece estas, que el adulto puede quitar o reordenar. Se priorizan palabras concretas, cortas y de sílabas simples.

- **Personas:** mamá, papá, tata, abuela, bebé, nene, nena
- **Cuerpo:** mano, pie, boca, ojo, nariz
- **Comida:** pan, agua, leche, sopa, queso, manzana, plátano, jugo
- **Casa:** casa, cama, mesa, silla, taza, puerta
- **Animales:** perro, gato, pato, vaca, oso, pez
- **Juguetes y cosas:** pelota, auto, globo, muñeca, libro, polera
- **Enlace (etapa 2):** come, bebe, duerme, juega, es, está, tiene, el, la, y

Cada entrada: `{ texto, silabas, categoria, tipo, emoji, arasaacBusqueda }`.

---

## 9. Fases de trabajo

Cada fase termina con un commit y con su lista de aceptación verificada en el navegador (y en el celular cuando corresponda). Hasta la fase 7 la app funciona completa **sin cuenta de Google**, solo con datos locales.

### Fase 1 — Esqueleto PWA
- `index.html`, `manifest.webmanifest`, `sw.js`, íconos, `css/app.css` con variables de diseño, fuente Andika local, router por hash con vistas vacías de modo niño y modo adulto, candado de salida del modo niño.
- **Acepta si:** se instala en Android y PC; abre sin conexión; el candado exige 3 s + suma; Lighthouse PWA sin errores.

### Fase 2 — Datos locales y lógica pura
- `store.js` (IndexedDB con todas las entidades), `core/silabas.js`, `core/progreso.js`, `core/distractores.js`, `core/sesion.js` con pruebas en `tests/` (`node --test tests/`).
- **Acepta si:** todas las pruebas pasan, incluyendo: dominio en 2 días distintos, subida y bajada de opciones, Leitner, regla de fatiga, primer y último ensayo fáciles, ninguna palabra repetida seguida, sílabas de las 40 palabras de prueba.

### Fase 3 — Modo adulto: perfiles y vocabulario
- Asistente de primer uso, perfiles, lista y editor de palabras (foto con cámara, ARASAAC, emoji; grabación de audio; sílabas editables), carga del vocabulario inicial, `audio.js`, `pictos.js`, `hardware.js`.
- **Acepta si:** se crea un perfil con foto; se agrega una palabra con foto propia y voz grabada, y otra con pictograma ARASAAC y voz sintética `es-CL`; todo sigue disponible sin conexión; en un navegador sin cámara o micrófono la app no se rompe y lo explica.

### Fase 4 — Modo niño y etapa 1 (L1–L5)
- Inicio del niño, motor de sesión conectado a la interfaz, actividades L1–L5, ayuda sin error compartida, elogios, fin de sesión con calcomanía, álbum.
- **Acepta si:** una sesión completa de 8 ensayos se juega solo con toques; un error nunca produce sonido ni color de error; toques dobles rápidos no cuentan dos veces; las opciones pasan de 2 a 3 tras buenos resultados; todo se ve bien en celular vertical y tablet horizontal.

### Fase 5 — Panel de progreso y ajustes
- Tabla por palabra, gráfico semanal SVG, historial de sesiones, todos los ajustes de §5, desbloqueo y marcado manual, exportar/importar JSON.
- **Acepta si:** cada ajuste cambia de verdad el comportamiento de la sesión siguiente; exportar y luego importar en un perfil vacío deja todo igual.

### Fase 6 — Etapa 0, frases y libros (P1–P3, F1–F3, B1, L6)
- **Acepta si:** la etapa 2 se desbloquea sola con 10 palabras dominadas en L4; F3 se resuelve solo con toques; un libro de 4 páginas creado por el adulto se lee con resaltado y audio.

### Fase 7 — Login con Google y sincronización con Drive
- `auth.js`, `drive.js`, `sync.js` según el estándar MindSpark (alcance `drive.appdata`), indicador de estado (sincronizado / pendiente / sin conexión), subida y bajada de medios.
- **Acepta si:** una palabra con foto y audio creada en el PC aparece con su foto y audio en el celular; una sesión jugada sin conexión se sube al reconectar; dos cambios al mismo registro se resuelven por el `updatedAt` más reciente; un borrado en un equipo se refleja en el otro.

### Fase 8 — Sílabas y lectura con comprensión (S1–S4, etapa 4)
- **Acepta si:** S4 solo propone palabras nuevas formadas por sílabas que el niño ya domina; el cuento termina con preguntas de respuesta por imagen.

### Fase 9 — Pulido y publicación
- Revisión de accesibilidad (contraste, tamaños, `prefers-reduced-motion`, lector de pantalla en el modo adulto), página «Acerca de» con créditos ARASAAC y Andika y nota de privacidad, ayuda para el adulto (cómo usar la app, cómo fijar la pantalla, recomendaciones: 1–2 sesiones al día, siempre acompañado), repositorio `mindsparkapps/leo-conmigo` con GitHub Pages.
- **Acepta si:** pasa la comprobación final del estándar MindSpark (login, cierre de sesión, renovación del token, sync PC ↔ celular, uso sin conexión, instalación, hardware sin soporte) y las listas de aceptación de todas las fases anteriores.

### Fase 10 — Prueba con el niño (la hace el adulto)
- 2 semanas de uso real. Anotar: palabras que confunde, actividades que lo aburren o frustran, si las celebraciones lo distraen. Ajustar umbrales del §4 con esa información y, si es posible, revisarlo con su educadora diferencial o fonoaudióloga.

---

## 10. Notas para el desarrollo

- **Git:** commit al cerrar cada fase con un mensaje claro. **No hacer `git push`** (no puede autenticarse desde este equipo): el usuario sube los cambios.
- **Pruebas locales:** servir la carpeta en `http://localhost:<puerto>` (por ejemplo `npx serve .` o `python -m http.server 8080`); ese origen debe estar autorizado en el cliente OAuth «MindSpark» para la fase 7.
- **`CLIENT_ID`:** tomarlo del código de ZenBan o ApiTrack, o pedírselo al usuario. Recordarle agregar `https://mindsparkapps.github.io` y el `localhost` usado como orígenes autorizados.
- Sin frameworks ni librerías externas salvo que una fase lo justifique y el usuario lo apruebe.
- Todo el texto de la interfaz, el código (nombres de funciones y variables) y los comentarios en español.
- Probar en Chrome de Android y en Safari de iPhone/iPad: son los que más fallan con audio, `MediaRecorder` y almacenamiento.
