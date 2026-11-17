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

### Decisiones de implementación (fase 2, ya en el código y con pruebas)

Precisan lo que arriba quedaba ambiguo. **Si hay que cambiar un umbral, se cambia en una constante de `js/core/` y su prueba, no en la interfaz.**

- **Dominio:** de los últimos 5 ensayos, ≥ 4 aciertos al primer intento y **esos aciertos** deben caer en ≥ 2 días distintos (con menos de 5 ensayos vale la misma regla). Por eso una palabra nunca se domina con un ensayo fallido.
- **Leitner:** un acierto solo sube de caja si el repaso estaba **vencido** (uno antes de tiempo no la adelanta); una dominada sin fecha de repaso (marcada a mano) cuenta como vencida. Un error vuelve a la caja 1 y se repasa al día siguiente. El retroceso a `practica` necesita 2 errores **seguidos** desde que está dominada (`fallosRepaso`).
- **Opciones:** la ventana de 10 ensayos se reinicia al cambiar de nivel. Los ensayos «fáciles» (primero, último y cierre por fatiga) **no cuentan** para el nivel. Mientras la ventana está vacía, el nivel se trata como fácil.
- **Quién está «en práctica»:** una palabra con historial (o dominada a mano) que aún no domina todas las actividades de la etapa. Al dominar L1 pasa a practicar L2, y así; sus actividades ya dominadas se siguen repasando.
- **Repasos:** primero todo lo vencido (los más atrasados antes, un repaso por palabra mientras se pueda) y solo después dominadas al azar. Si no hay nada nuevo que practicar, toda la sesión es repaso.
- **Orden:** ninguna palabra ocupa más de la mitad de la sesión (el sobrante se llena con repasos). El primer y el último ensayo se eligen entre los de mayor puntaje **que permitan cumplir las reglas de orden**. «Máximo 3 seguidos de la misma actividad» se cumple siempre que sea posible; en las primeras sesiones todo es L1 y es imposible (se comprobó por fuerza bruta que el orden elegido es el mejor que existe).
- **Ensayo «fácil»:** solo si lo que el niño hace bien existe de verdad (repaso o práctica con ≥ 60 % de aciertos); entonces se muestra con 2 opciones. En la primera sesión no hay nada así y ningún ensayo se marca fácil.
- **Una sola opción:** mientras el niño no ha visto ninguna otra palabra, un ensayo puede tener 1 sola opción (`opciones: 1`): la pantalla muestra solo la tarjeta («Toca la palabra»). Nunca se inventan distractores sin ver.
- **Fatiga:** con 3 errores seguidos el siguiente ensayo sale de `plan.reservaFacil` (hasta 3 palabras ya dominadas con 2 opciones) y la sesión termina al completarlo, aunque falle. Si no hay nada dominado, termina al instante. Se activa una sola vez por sesión.
- **Ritmo medido con un niño simulado** (`tests/simulador.js`, 14 palabras, 6 sesiones por semana): un niño «lento» (acierta 40 % al empezar) lee (L4) ~3 palabras en 4 semanas, ~6 en 8 y ~10 en 12 (la etapa 2 se abre hacia la semana 12); uno «medio» llega a 13–14 en 12 semanas; uno «rápido» abre la etapa 2 hacia la semana 9. Es un ritmo prudente a propósito; **afinarlo con datos reales es parte de la fase 10**.

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
data/cuentos-iniciales.json (3 cuentos de ejemplo con preguntas)
data/calcomanias/ (12 SVG propios, simples, sin rojo)
js/
  config.js       CLIENT_ID del cliente OAuth "MindSpark", versión de la app
  app.js          arranque, router por hash (#/nino, #/adulto/...)
  auth.js         login Google (Identity Services) y renovación del token en silencio
  drive.js        cliente de Drive en appDataFolder: listar, leer, crear, actualizar, borrar
  store.js        IndexedDB + cola de sincronización
  respaldo.js     exportarTodo / importarTodo sobre el almacén (la lógica pura está en core/respaldo.js)
  sync.js         sincronizador: une el almacén y Drive (la fusión pura está en core/sync.js)
  nube.js         estado de la cuenta y la sincronización, acciones y disparadores automáticos
  hardware.js     galería/cámara (elegirImagen), grabadora de voz, vibración, almacenamiento persistente
  imagenes.js     recorte cuadrado a 512 px y WebP (JPEG de respaldo)
  audio.js        reproducir grabación o voz sintética (es-CL → es-419 → es-US → es-MX → es-ES), consignas, elogios
  pictos.js       búsqueda y descarga de ARASAAC
  medios.js       guardar/borrar fotos y audios (Blob) y sus URLs para mostrarlos
  contexto.js     almacén compartido y perfil activo
  core/           LÓGICA PURA, sin DOM (probada con `npm test`)
    azar.js       azar reproducible (semilla), barajar
    id.js         UUID v4
    modelos.js    ajustes por defecto y normalización, nuevoPerfil, nuevaPalabra
    etapas.js     actividades por etapa y desbloqueo de etapas
    silabas.js    división silábica del español
    progreso.js   estados, dominio, opciones, Leitner
    sesion.js     crearSesion(), iniciarCurso(), registrarRespuesta() (fatiga)
    distractores.js
    suma.js       suma de control del candado
    intento.js    un ensayo del niño: toques, ayuda sin error, bloqueo de 400 ms
    controlador.js la sesión del niño (une motor + actividades + toques); no toca DOM ni almacén
    elogios.js    elogios hablados, sin repetir el anterior
    calcomanias.js catálogo de 12 calcomanías y cuál toca ganar
    estadisticas.js estado por palabra, tabla, precisión semanal, historial, marcado manual
    respaldo.js   copia de seguridad: armar, validar, decodificar y fusionar (sin DOM)
    vocabulario.js categorías, orden, sílabas editables, palabras del asistente
    frases.js     frases y libros: validar, texto, collage, elementos del motor, páginas legibles
    sync.js       fusión por updatedAt, documento de Drive, plan de imágenes y audios (sin red)
    silabeo.js    etapa 3: anota las palabras para S1–S4 (leídas, compañeras, palabras nuevas), sílabas distractoras
    cuentos.js    etapa 4: preguntas de comprensión y cuentos de ejemplo
  actividades/    comun.js (armarEnsayo sin DOM + renderEnsayo), indice.js, secuencia.js («armo la frase»),
                  P1–P3, L1–L6, F1–F3, S1–S4
  ui/             dom.js (el), candado.js, adulto.js (cabecera, errores, campo), miniatura.js,
                  selector-foto.js, carta.js, boton-audio.js, ajustar-texto.js, grafico-semanal.js
  nino/           inicio.js (con el álbum y el botón de libros), sesion.js, premio.js, libros.js (estante y lectura)
  adulto/         panel.js, asistente.js, perfiles.js, vocabulario.js, editor-palabra.js,
                  frases.js, libros.js, progreso.js, ajustes.js, respaldo.js, cuenta.js (Google y sincronización)
tests/            *.test.js para js/core, drive, sync y auth (node --test) + ayudas.js, escenarios.js, jugar.js,
                  memoria.js (almacén en memoria) y drive-falso.js (Drive simulado) como apoyo
  navegador/      store.html (IndexedDB real) y actividades.html (ver cada actividad con datos de ejemplo:
                  ?a=F3&n=3&ayuda&largo&mayus&grande); se abren en el servidor local
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
             medioImagenId?, medioSimboloId?, arasaacId?, emoji?, medioAudioId?, busquedaPicto?, orden, activa }
             // orden = cola de introducción (la fija el adulto); busquedaPicto = texto para buscar su pictograma
             // medioSimboloId = pictograma «de apoyo» junto a la foto (P2); el emoji sirve de símbolo si no hay pictograma
progreso   { id: `${perfilId}:${elementoId}:${actividad}`, perfilId, elementoId, actividad, estado,
             historial:[{ fecha, correctoAlPrimerIntento, opciones }] (últimos 10), cajaLeitner (1-5),
             proximoRepaso ('AAAA-MM-DD' o null), fallosRepaso }
             // elementoId = id de una palabra (etapas 0, 1 y 3) o de una frase (etapa 2)
nivel      { id: `${perfilId}:${actividad}`, perfilId, actividad, opciones (2-4), ultimos:[true|false] (ventana de 10) }
frase      { id, perfilId, palabraIds:[...] (2 a 6), texto, medioImagenId? (sin ella se usa un collage), orden, activa }
libro      { id, perfilId, titulo, paginas:[{ medioImagenId?, fraseId }] (1 a 10), preguntas?:[{ texto, correctaId, distractorIds }] (0 a 2; con ellas es un cuento), creado }
ajustes    (dentro del perfil) + etapasForzadas:[0-3], etapasBloqueadas:[0-3], habilitarL6; el perfil guarda etapaActual
sesion     { id, perfilId, inicio, fin, fatiga, ensayos:[{ elementoId, actividad, tipo, esFacil, correctoAlPrimerIntento, intentos, ms }] }
calcomania { id, perfilId, codigo, fecha }
medio      { id, tipo:'imagen'|'audio', mime, blob (solo local), driveFileId?, subido }
```

**IndexedDB:** un *object store* por entidad + `colaSync` (una fila por registro cambiado, con su fecha) + `meta`. El borrado es suave (`deleted: true`). `store.js` ya ofrece `guardar`, `guardarVarios` (atómico), `obtener`, `listar`, `borrar`, `importar` (sin tocar `updatedAt` ni la cola: para la sincronización y los respaldos), `pendientesSync`, `limpiarCola` (no pierde ediciones hechas mientras se subía) y `leerMeta`/`escribirMeta`.
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

### Fase 1 — Esqueleto PWA ✔ hecha
- `index.html`, `manifest.webmanifest`, `sw.js`, íconos, `css/app.css` con variables de diseño, fuente Andika local, router por hash con vistas vacías de modo niño y modo adulto, candado de salida del modo niño.
- **Acepta si:** se instala en Android y PC; abre sin conexión; el candado exige 3 s + suma; Lighthouse PWA sin errores.

### Fase 2 — Datos locales y lógica pura ✔ hecha
- `store.js` (IndexedDB con todas las entidades), `core/silabas.js`, `core/progreso.js`, `core/distractores.js`, `core/sesion.js` con pruebas en `tests/` (`npm test`; el almacén se prueba abriendo `/tests/navegador/store.html`).
- **Acepta si:** todas las pruebas pasan, incluyendo: dominio en 2 días distintos, subida y bajada de opciones, Leitner, regla de fatiga, primer y último ensayo fáciles, ninguna palabra repetida seguida, sílabas de las 40 palabras de prueba.

### Fase 3 — Modo adulto: perfiles y vocabulario ✔ hecha
- Asistente de primer uso, perfiles, lista y editor de palabras (foto con cámara, ARASAAC, emoji; grabación de audio; sílabas editables), carga del vocabulario inicial, `audio.js`, `pictos.js`, `hardware.js`.
- **Acepta si:** se crea un perfil con foto; se agrega una palabra con foto propia y voz grabada, y otra con pictograma ARASAAC y voz sintética `es-CL`; todo sigue disponible sin conexión; en un navegador sin cámara o micrófono la app no se rompe y lo explica.
- **Decisiones de implementación (ya en el código):**
  - **Palabras repetidas:** se comparan sin distinguir mayúsculas pero **respetando las tildes** (`clavePalabra`): «bebé» (persona) y «bebe» (verbo) son palabras distintas y conviven. Los distractores, en cambio, sí evitan palabras que solo difieren en la tilde.
  - **Asistente (3 pasos):** nombre y foto del niño → su gente y sus cosas (con foto) → lista inicial. Orden de introducción: el nombre del niño, su gente, y luego el catálogo. Las palabras de **enlace** vienen desmarcadas (se usan en la etapa 2). La foto del niño se guarda dos veces (perfil y palabra) para que borrar una no afecte a la otra. Si un intento falla a medias, el siguiente reutiliza el mismo perfil.
  - **Imágenes:** foto → cuadrado de hasta 512 px en WebP (JPEG si no hay soporte); pictograma → PNG de 500 px descargado a IndexedDB (sin conexión después). Se descartan pictogramas con violencia o contenido sexual. Al reemplazar o quitar una imagen o voz, el medio viejo queda marcado como borrado y **se libera su contenido**.
  - **Voz:** la grabación del adulto tiene prioridad (máx. 8 s); si no hay, voz sintética con la mejor voz en español del dispositivo (es-CL → es-419 → es-US → es-MX → es-ES) y se le dice al adulto cuál es. Si no hay grabación ni voz sintética, el editor avisa que la palabra no tendrá sonido.
  - **Sin hardware:** sin micrófono, sin permiso, con el micrófono ocupado, sin `MediaRecorder`, sin conexión segura, sin voz sintética, sin red para ARASAAC o al cancelar la cámara: cada caso muestra un mensaje claro y la app sigue funcionando.
  - **Rutas del modo adulto:** `#/adulto` (panel), `/asistente`, `/perfiles`, `/vocabulario`, `/palabra/nueva` y `/palabra/<id>`; todas exigen haber pasado el candado.
  - El progreso por palabra en la lista de vocabulario y los ajustes del perfil se hicieron en la fase 5.

### Fase 4 — Modo niño y etapa 1 (L1–L5) ✔ hecha
- Inicio del niño, motor de sesión conectado a la interfaz, actividades L1–L5, ayuda sin error compartida, elogios, fin de sesión con calcomanía, álbum.
- **Acepta si:** una sesión completa de 8 ensayos se juega solo con toques; un error nunca produce sonido ni color de error; toques dobles rápidos no cuentan dos veces; las opciones pasan de 2 a 3 tras buenos resultados; todo se ve bien en celular vertical y tablet horizontal.
- **Decisiones de implementación (ya en el código):**
  - **Arquitectura:** las reglas viven en `core/controlador.js` y `core/intento.js` (sin DOM, probadas en Node); `nino/sesion.js` solo dibuja y ejecuta efectos (voz, vibración, guardado). `crearEnsayo` de cada actividad también es puro; el dibujado (`renderEnsayo`) es común a L1–L5, así la ayuda sin error vive en un solo lugar.
  - **Toques:** se ignora todo toque a menos de 400 ms del anterior y los primeros 400 ms de cada ensayo (el dedo puede venir del anterior); volver a tocar una opción ya atenuada no es otro error. Un segundo dedo se ignora solo si es un puntero real no primario: un clic de teclado, pulsador o lector de pantalla siempre vale.
  - **Ayuda sin error:** la opción equivocada se atenúa (borde neutro, nunca rojo), la correcta se pone amarilla y late (con movimiento reducido, borde grueso fijo), se repite la palabra y no hay sonido de error ni vibración. En **L4** el audio no existe al inicio y aparece recién tras un error.
  - **Consigna y voz:** la consigna se dice solo la primera vez de cada actividad en la sesión; después, solo la palabra. Tocar el modelo o el altavoz repite la palabra. La primera vez que el niño usa la app el ensayo tiene **una sola opción** (aún no ha visto otras palabras) y se resuelve con un toque.
  - **Posición de la correcta:** nunca cae 3 veces seguidas en el mismo lugar.
  - **Celebración (ajuste `intensidadCelebracion`):** `normal` = elogio + ⭐ + salto + vibración de 40 ms, pausa de 1,4 s; `suave` = elogio y resaltado verde, 0,7 s; `ninguna` = sin elogio ni vibración. `sonido: false` silencia consignas y elogios, pero **no** las palabras (L3 y L5 no funcionarían).
  - **Qué se practica:** solo palabras activas con imagen o emoji; las demás no salen (ni como distractores) y la lista de vocabulario las marca «Sin imagen».
  - **Guardado:** progreso y nivel se guardan tras cada ensayo; la sesión se guarda al terminar o si un adulto la interrumpe; la calcomanía solo si la sesión termina (también por fatiga). `ms` = tiempo hasta acertar.
  - **Pantalla:** vertical = modelo arriba y opciones abajo (2 columnas con imágenes, 1 con solo palabras); horizontal ancho = opciones en una fila; celular acostado (<520 px de alto) = modelo a la izquierda y opciones a la derecha, sin desplazar. Las palabras largas se achican hasta 28 px para caber (única excepción al mínimo de 56 px).
  - **Álbum:** 12 calcomanías SVG propias; las no ganadas son un círculo punteado neutro. Una etapa sin actividades hechas todavía usa L1–L5.
  - Los ajustes `mayusculas`, `tamanoLetra`, `altoContraste`, `velocidadVoz` y `vibracion` ya se aplican si existen en el perfil (su pantalla de edición se hizo en la fase 5).

### Fase 5 — Panel de progreso y ajustes ✔ hecha
- Tabla por palabra, gráfico semanal SVG, historial de sesiones, todos los ajustes de §5, desbloqueo y marcado manual, exportar/importar JSON.
- **Acepta si:** cada ajuste cambia de verdad el comportamiento de la sesión siguiente; exportar y luego importar en un perfil vacío deja todo igual.
- **Decisiones de implementación (ya en el código):**
  - **Progreso (`#/adulto/progreso`):** resumen (palabras leídas = dominadas en L4, en práctica, sesiones, última sesión); gráfico de barras de aciertos al primer intento de las últimas 8 semanas (lunes a domingo, hora local; semana sin sesiones = línea punteada) con resumen accesible; tabla palabra × L1–L5 (✓ dominada, `3/5` en práctica = aciertos sin ayuda / ensayos, `·` sin empezar) con filtro por estado; últimas 20 sesiones con duración, ensayos y aciertos sin ayuda. El estado general de cada palabra (Nueva, En práctica, Leída, Completa) también aparece en la lista de Vocabulario.
  - **Marcado manual:** «Ya la sabe» deja la palabra dominada en L1–L5 sin fecha de repaso (se repasa en la próxima sesión) y conserva su historial; «Empezar de nuevo» (con confirmación) borra su progreso y vuelve a ser nueva.
  - **Ajustes (`#/adulto/ajustes`):** ensayos por sesión (4–15), máximo de opciones (2–4), actividades que se usan (al menos una), mayúsculas, tamaño de letra, alto contraste (con vista previa), consignas y felicitaciones habladas, velocidad de la voz (con botón de prueba), vibración y celebración (normal, suave, ninguna). Se guardan en `perfil.ajustes` y rigen desde la sesión siguiente.
  - **Se dejó para la fase 6 a propósito** (no tendrían ningún efecto hoy, serían botones muertos): elegir la etapa inicial, forzar o bloquear etapas (`etapasDesbloqueadas` ya lo soporta) y habilitar L6. *(Hecho en la fase 6.)*
  - **Copia de seguridad (`#/adulto/respaldo`):** un JSON con todos los niños y sus datos, **incluidas fotos y voces** en base64 (sin ellas restaurar dejaría palabras sin imagen ni sonido). Al restaurar no se borra nada: se suma lo que falta y, si un registro está en los dos lados, gana el más reciente (`updatedAt`); restaurar dos veces no cambia nada; un archivo dañado se rechaza **antes** de escribir. No viajan los registros borrados. El inicio de sesión con Google y la sincronización (fase 7) irán en una pantalla «Cuenta».
  - **Almacén más robusto:** si otra pestaña actualiza o borra la base, la conexión se cierra y `contexto.js` la reabre sola en la siguiente llamada (antes quedaba rota hasta recargar).

### Fase 6 — Etapa 0, frases y libros (P1–P3, F1–F3, B1, L6) ✔ hecha
- **Acepta si:** la etapa 2 se desbloquea sola con 10 palabras dominadas en L4; F3 se resuelve solo con toques; un libro de 4 páginas creado por el adulto se lee con resaltado y audio.
- **Decisiones de implementación (ya en el código):**
  - **Etapa que se practica:** la elige el adulto (`perfil.etapaActual`, en Ajustes › Las etapas); el desbloqueo es automático (etapa 2 con 10 palabras dominadas en L4). Se puede **abrir ya** la etapa 2 o **bloquear** cualquiera (`ajustes.etapasForzadas/Bloqueadas`; si una está en las dos listas, se abre). Si la elegida está cerrada o no hay nada que practicar (p. ej. sin frases), se baja a la anterior (`etapaEfectiva` y el respaldo del controlador). La etapa 3 aún no existe (`ETAPAS_HECHAS = [0, 1, 2]`).
  - **Etapa 0:** P1 «toca la imagen igual» (foto con foto/emoji), P2 «misma cosa» (foto con su dibujo: solo palabras con foto **y** símbolo —pictograma de apoyo o emoji—), P3 «¿cuál es…?» (clasificar por categoría; solo palabras de las 6 categorías con pregunta y distractores de otra categoría). Cada actividad puede declarar `aplicaA`, `esOpcionValida` y `reglas`; el motor las respeta.
  - **Etapa 2 (frases):** una frase es un «elemento» del motor igual que una palabra (`frasesComoElementos`; el progreso usa su id). F1 igualar frase, F2 leer la frase y tocar su dibujo, **F3 «armo la frase»**: se tocan las palabras en orden, sin arrastrar; una ficha equivocada se atenúa (nunca rojo ni vibración), se ilumina la siguiente, y las atenuadas vuelven a poder usarse tras el próximo acierto. Con 3 y 4 opciones se suman 1 y 2 palabras de relleno tomadas de otras frases. La frase se dice palabra por palabra (con la voz grabada de cada una si existe).
  - **Frase sin foto propia:** se muestra un collage con los dibujos de hasta 3 de sus palabras. Una frase solo se practica si todas sus palabras existen y hay algo que mostrar.
  - **L6 «Leo en voz alta»:** solo con el interruptor de Ajustes, solo con palabras ya dominadas en L4, como máximo 2 por sesión y nunca primero ni último. El adulto toca ↻ «otra vez» o ✓ «lo leyó» en las esquinas de abajo; la app no evalúa la voz. No mueve el nivel de opciones.
  - **Libros (B1):** el adulto arma libros de 1 a 10 páginas (frase + foto opcional; sin foto se usa la de la frase o el collage). El niño los ve desde un botón junto al ▶ (solo si hay alguno legible), elige uno en el estante y lo lee: tocar la foto o el altavoz lee la frase resaltando cada palabra, tocar una palabra la dice sola; ◀ ▶ con bloqueo de 400 ms. No se evalúa nada.
  - **Editor de palabra:** la foto y el emoji ya son independientes (antes elegir un emoji borraba la foto); se puede guardar un pictograma de ARASAAC como «dibujo para emparejar» (`medioSimboloId`).
  - **Adulto:** `#/adulto/frases` (elegir palabras en orden, foto opcional, editar, pausar, quitar) y `#/adulto/libros` (páginas con frase y foto, subir/bajar, quitar); progreso muestra «Otras actividades» (P1–P3, F1–F3, L6).
  - **Pendiente para la fase 8:** etapa 3 (sílabas) y etapa 4.

### Fase 7 — Login con Google y sincronización con Drive ✔ hecha (falta el `CLIENT_ID` real y probar con Google de verdad)
- `auth.js`, `drive.js`, `sync.js` según el estándar MindSpark (alcance `drive.appdata`), indicador de estado (sincronizado / pendiente / sin conexión), subida y bajada de medios.
- **Acepta si:** una palabra con foto y audio creada en el PC aparece con su foto y audio en el celular; una sesión jugada sin conexión se sube al reconectar; dos cambios al mismo registro se resuelven por el `updatedAt` más reciente; un borrado en un equipo se refleja en el otro.
- **Decisiones de implementación (ya en el código):**
  - **No había código de ZenBan ni de ApiTrack a mano**, así que se siguió la guía del estándar MindSpark. El `CLIENT_ID` de `js/config.js` está **vacío**: mientras no se complete, «Cuenta de Google» avisa que falta configurarlo y la app funciona igual solo en el dispositivo. Hay que agregar `https://mindsparkapps.github.io` y el `localhost` de pruebas como orígenes autorizados del cliente.
  - **Piezas:** `core/sync.js` (fusión y plan de medios, puro), `drive.js` (cliente de Drive con el token en la cabecera y un reintento tras un 401), `auth.js` (Google Identity Services; el token solo vive en memoria; solo se recuerda el correo de la cuenta), `sync.js` (un sincronizador que une almacén y Drive, una ejecución a la vez), `nube.js` (estado observable, acciones y disparadores automáticos) y `adulto/cuenta.js` (pantalla `#/adulto/cuenta`; el panel muestra el estado).
  - **Drive:** `data.json` con todos los registros, **también los borrados** y sin el contenido de imágenes y audios, y un archivo `medio-<id>.<ext>` por cada uno. Se suben primero los archivos y al final `data.json`.
  - **Fusión:** registro por registro gana el `updatedAt` más reciente; lo que solo está en un lado se agrega al otro; nada local se borra al fusionar. Si dos dispositivos suben a la vez, el siguiente sync de cada uno repara la diferencia. Un `data.json` dañado o de una versión más nueva **nunca se pisa**: se avisa.
  - **Seguridad ante fallos y cambios en curso:** la cola solo se limpia al terminar bien y solo lo que no cambió mientras tanto; un registro que cambió aquí durante la sincronización no se pisa con el de Drive. Lo traído de Drive no entra en la cola (no se vuelve a subir).
  - **Medios:** se bajan todos al sincronizar (no «bajo demanda»): el uso sin conexión necesita las fotos y voces en el dispositivo. Si un archivo falta en Drive y en todos los dispositivos, se avisa en la pantalla.
  - **Disparadores:** al abrir la app, al volver la conexión, al volver a la app y cada 15 s si hay cambios por subir; nunca durante una sesión del niño. **En modo niño jamás se abre una ventana de Google**: solo se sincroniza si todavía hay un token vigente; renovar la sesión (que puede abrir una ventana) solo ocurre con el modo adulto abierto o con un toque del adulto.
  - **Estados:** sincronizado, sincronizando, cambios por subir, sin conexión, hay que volver a iniciar sesión, error, sin cuenta y sin configurar (sin rojo). Cerrar sesión revoca el token y olvida la cuenta, pero **los datos del dispositivo se quedan**.
  - **Privacidad:** el panel del adulto explica qué se guarda y dónde (nota de privacidad); la página «Acerca de» completa sigue en la fase 9.
  - **Probado con un Drive y un Google simulados** (`tests/drive-falso.js`, `tests/memoria.js`): sincronización PC ↔ celular con imágenes, ediciones, borrados y conflictos, y en el navegador el flujo completo (iniciar sesión, subir, vaciar el almacén y recuperar todo, sin conexión, sesión vencida, cerrar sesión). **Falta probar con el cliente de Google real** y con dos dispositivos reales.

### Fase 8 — Sílabas y lectura con comprensión (S1–S4, etapa 4) ✔ hecha
- **Acepta si:** S4 solo propone palabras nuevas formadas por sílabas que el niño ya domina; el cuento termina con preguntas de respuesta por imagen.
- **Decisiones de implementación (ya en el código):**
  - **La etapa 3 parte solo de palabras que el niño ya lee** (L4 dominada). `core/silabeo.js` anota cada palabra con `leida`, `vistaAntes`, `conMismaSilaba` (S1) y `paraS4`; esas anotaciones son las que consultan `aplicaA` y `esOpcionValida` de S1–S4. Si no hay ninguna palabra que sirva, se baja a la etapa anterior. Las sílabas se comparan sin tilde («ma» = «má»). Se abre sola con 20 palabras dominadas (o por el adulto) y su progreso va aparte de L1–L5 (`S1`…`S4`).
  - **Opciones desde el primer ensayo:** el motor recibe `vistasPrevias`: las palabras que el niño ya vio en la etapa 1 cuentan como vistas y pueden ser distractores desde el principio (si no, la etapa 3 empezaría con una sola opción).
  - **S1 «descubro la sílaba»:** el modelo es la palabra partida en sílabas de colores con un punto entre ellas (no se depende solo del color), la primera resaltada, y suena **la sílaba**. La correcta es **otra** palabra leída que empieza con esa sílaba; ningún distractor empieza igual (si no, habría dos respuestas). Solo se usa con palabras que tienen una compañera así.
  - **S2 «completo la palabra»:** imagen más la palabra con una sílaba que falta (en cualquier posición); las opciones son sílabas de otras palabras, sin ninguna que se confunda con las de la palabra (ni «ma» junto a «má»). Al tocar el modelo suena la palabra entera. El nombre accesible de la carta no revela la sílaba que falta.
  - **S3 «armo la palabra»:** igual que «armo la frase» (sin arrastrar; ficha equivocada atenuada, se ilumina la siguiente); con 3 y 4 opciones se suman 1 y 2 sílabas de relleno; admite sílabas repetidas (pa·pa).
  - **S4 «palabra nueva»:** como L4 (sin audio al inicio) pero solo con palabras **nunca vistas** (sin ningún progreso en L1–L5), de 2 o más sílabas y hechas solo con sílabas de palabras que ya lee; las opciones son dibujos de palabras que ya lee.
  - **Etapa 4: cuentos con preguntas.** Un cuento es un libro con 1 o 2 preguntas (`libro.preguntas: [{ texto, correctaId, distractorIds }]`, palabras con imagen, hasta 3 opciones más). Tras la última página, el botón de avance lleva a las preguntas: se dice la pregunta y se responde tocando un dibujo, **sin error** (opción equivocada atenuada, correcta iluminada, pregunta repetida, sin vibración; acierto con elogio). **No se evalúa ni se guarda nada**, como en B1. Las preguntas que ya no se pueden contestar (palabra borrada o sin imagen) se saltan.
  - **Adulto:** en Libros, editor de preguntas (texto, respuesta, otras opciones) y **cuentos de ejemplo** (`data/cuentos-iniciales.json`: «La comida», «El perro», «En casa»), que se agregan si el niño ya tiene todas sus palabras y crean sus frases y el libro con las preguntas; se avisa qué palabras faltan. Ajustes ya lista S1–S4 y las etapas 2 y 3 como automáticas con su umbral; Progreso suma S1–S4.
  - **Pendiente:** la prueba con el niño real (fase 10) dirá si hay que afinar los umbrales de la etapa 3 y la cantidad de cuentos.

### Fase 9 — Pulido y publicación ✔ hecha (falta subir el repositorio y las pruebas con Google y dispositivos reales)
- Revisión de accesibilidad (contraste, tamaños, `prefers-reduced-motion`, lector de pantalla en el modo adulto), página «Acerca de» con créditos ARASAAC y Andika y nota de privacidad, ayuda para el adulto (cómo usar la app, cómo fijar la pantalla, recomendaciones: 1–2 sesiones al día, siempre acompañado), repositorio `mindsparkapps/leo-conmigo` con GitHub Pages.
- **Acepta si:** pasa la comprobación final del estándar MindSpark (login, cierre de sesión, renovación del token, sync PC ↔ celular, uso sin conexión, instalación, hardware sin soporte) y las listas de aceptación de todas las fases anteriores.
- **Decisiones de implementación (ya en el código):**
  - **Ayuda y «Acerca de»** (`#/adulto/ayuda`, `#/adulto/acerca`): reemplazan los tres paneles sueltos del panel del adulto. La ayuda explica los primeros pasos, cómo acompañar al niño, las etapas, cómo fijar la pantalla (Android e iPhone/iPad), instalar la app y qué hacer si algo falla. «Acerca de» trae versión, método, privacidad y créditos (ARASAAC con su licencia CC BY-NC-SA y Andika con la SIL OFL); los únicos enlaces externos están en el modo adulto.
  - **Contraste (WCAG AA) medido con la paleta y con el DOM real:** `--azul` pasó de `#2f7fa8` a `#287599` (texto blanco 5,1:1 y enlaces 4,6:1), `--verde` a `#2b7d51`, el gris de «sin empezar» a `#5a6e7a`. Nuevo `--borde-fuerte` (`#6a8fa6`, ≥ 3:1) para los bordes de lo que se toca o se escribe (cartas, fichas, huecos, campos, pestañas); los bordes decorativos de los paneles siguen suaves. El anillo de enfoque pasó de amarillo (1,6:1) a azul oscuro, y los campos ya no lo ocultan.
  - **Tamaños:** en el modo niño todo lo que se toca mide al menos 88 px (se agrandaron los botones de volver y avanzar y las palabras del libro); en el modo adulto, al menos 44 px. El candado de salida se queda en 56 px a propósito.
  - **Movimiento reducido:** una regla global anula las animaciones y las ayudas siguen viéndose por color y atenuado.
  - **Revisión automática** de 18 pantallas en un celular (375 px): sin imágenes sin `alt`, sin botones ni campos sin nombre, sin contraste bajo, sin toques pequeños y sin desborde horizontal.
  - **Sin conexión:** probado de verdad: con el service worker activo se detuvo el servidor y la app abrió desde la caché, recorrió todas las pantallas del adulto y jugó una sesión. Los 105 archivos del precaché estaban guardados.
  - **Publicación preparada, no subida:** `README.md` (probar, publicar, orígenes autorizados de Google, qué hacer en cada versión) y `.nojekyll`. Todas las rutas son relativas, así que funciona en `https://mindsparkapps.github.io/leo-conmigo/`. El usuario crea el repositorio y sube (aquí no se puede hacer `git push`).
- **Comprobación final del estándar MindSpark** (✔ probado aquí; ☐ lo debe probar el adulto con Google y dispositivos reales):
  - ✔ Login, cierre de sesión y renovación del token con un Google simulado (pruebas y navegador). ☐ Con el cliente de Google real (`CLIENT_ID` vacío todavía).
  - ✔ Sincronización PC ↔ celular con un Drive simulado (fotos, voz, ediciones, borrados, conflictos). ☐ Con dos dispositivos reales.
  - ✔ Abre y funciona sin conexión; sincroniza al reconectar (simulado). ☐ En Chrome de Android y Safari de iPhone/iPad (audio, `MediaRecorder` y almacenamiento son lo que más falla).
  - ✔ Manifiesto con íconos normal y «maskable», service worker y aviso de versión nueva. ☐ «Instalar» / «Agregar a pantalla de inicio» en un celular real.
  - ✔ Hardware sin soporte: cámara, micrófono, voz sintética, vibración y almacenamiento detectan la falta de soporte con alternativa (pruebas `dispositivo.test.js` y mensajes en pantalla).
  - ☐ Subir el repositorio a `mindsparkapps/leo-conmigo`, activar Pages y completar el `CLIENT_ID`.

### Fase 10 — Prueba con el niño (la hace el adulto)
- 2 semanas de uso real. Anotar: palabras que confunde, actividades que lo aburren o frustran, si las celebraciones lo distraen. Ajustar umbrales del §4 con esa información y, si es posible, revisarlo con su educadora diferencial o fonoaudióloga.

---

## Ampliación 2 — Fases 11 a 14 (pedidas por el usuario el 2026-11-06)

> **Para quien programa (Sonnet):** estas cuatro fases amplían la app ya terminada. Se hacen **en orden** (11 → 12 → 13 → 14), una por vez, cada una con su lista de aceptación, `npm test` en verde, prueba en el navegador y un commit. Las reglas del §2 siguen valiendo; donde esta ampliación las cambia, lo dice explícitamente (el usuario lo pidió). Si algo no está definido aquí, pregunta.

### Por qué existe esta ampliación (lo que vio el usuario)

1. Completó todas las calcomanías y no pasó nada: el álbum se quedó lleno y siguió dando calcomanías repetidas.
2. «Siguen saliendo las mismas palabras»: con las reglas actuales cada palabra debe dominarse en L1, L2, L3, L4 y L5 **una tras otra** y cada dominio pide aciertos en **2 días distintos**, así que una palabra que el niño ya sabe ocupa como mínimo ~10 días de práctica. Además, las palabras dominadas nunca salen del ciclo de repasos.
3. El adulto no tiene cómo ver qué palabras le cuestan más ni exportar datos para que una IA los analice.
4. Los ajustes son fijos: el adulto tiene que adivinar cuándo subir los ensayos o las opciones.

### Decisiones tomadas (valores por defecto; el usuario puede cambiarlas)

| Tema | Decisión |
|---|---|
| Premio por álbum completo | **10 monedas de oro** (configurable 1–50 por el adulto) |
| Tamaño del álbum | 12 calcomanías (configurable 6–24) |
| Qué calcomanías entran al álbum | Las elige el adulto de un catálogo (mínimo = tamaño del álbum); por defecto todas las del catálogo |
| Premios de la tienda | Premios **reales** que define el adulto (p. ej. «helado», «ir al parque», «15 min de dibujos»): la app solo registra el canje y el adulto lo entrega |
| Monedas en pantalla del niño | Monedas dibujadas (una por moneda, hasta 20) y además el número, chico, para que vaya conociendo los números |
| Las monedas y la regla «sin puntajes» (§1, §2) | Se mantiene: **nunca** se ganan ni se pierden monedas por acertar o fallar. Solo se ganan al completar un álbum (que se llena por terminar sesiones) y solo se gastan en la tienda. Nada de monedas durante la sesión |
| Registro fino | Uno por ensayo, solo en el dispositivo y en el Drive del adulto. **La app no envía nada a ningún servicio de IA**: el adulto exporta un archivo y lo comparte él |
| Avance rápido de palabras que ya sabe | **Activado** por defecto, con interruptor en Ajustes |
| Palabras aprendidas | Salen solas de la práctica y del repaso normal; solo vuelven en un repaso de control cada 30 días |
| Ajustes automáticos | **Activados** por defecto, uno por uno, con aviso al adulto y botón «Deshacer». Nunca cambian durante una sesión |

---

### Fase 11 — Álbum que se renueva, monedas de oro y tienda ✔ hecha

**Decisiones de implementación (ya en el código, con pruebas en `tests/album.test.js` y `tests/albumes.test.js`):**
- **Piezas:** `core/album.js` (álbumes, saldo, canjes y premios: puro), `core/calcomanias.js` (catálogo de 30, códigos `propia:<id>`, `codigosEnJuego`, `elegirCalcomania(enAlbum, azar, enJuego)`), `albumes.js` (une el almacén con la lógica: `cargarMonedas`, `ganarCalcomania`, `acreditarAlbumesPendientes`), `ui/moneda.js` (moneda y cofre), `ui/calcomania.js`, `ui/selector-imagen.js` (foto, pictograma o emoji; lo usan premios y calcomanías propias), pantallas `nino/tienda.js` y `nino/albumes.js`, `adulto/album.js` y `adulto/tienda.js`.
- **Datos:** `VERSION_BD = 2` con los almacenes `calcomaniasPropias`, `premios` y `movimientos`; los tres entran en `ALMACENES_RESPALDO`, y por eso en copia de seguridad y sincronización (una prueba comprueba que todo almacén del `store` viaja en el sync). `perfil.album = { tamano, monedasPorAlbum, codigos }` se normaliza con `normalizarAlbum` (si hay menos códigos elegidos que el tamaño, el tamaño baja).
- **Álbumes calculados:** `calcularAlbumes` recorre las calcomanías por fecha. Los álbumes ya cerrados son los movimientos de tipo `album` (cada uno guarda `fechaFin`, `codigos` y `tamano`): el último fija un corte, así que cambiar el tamaño después **no reabre ni cambia** los completos. Una calcomanía repetida dentro del álbum no cuenta.
- **Monedas sin duplicados:** el premio del álbum N tiene id `album:<perfilId>:<N>`; dos dispositivos que lo creen a la vez producen un solo registro. El saldo es la suma de `movimientos` (los canjes `anulado` y los borrados no cuentan); nunca hay un número guardado.
- **Niños que ya tenían el álbum lleno** (antes de que existieran las monedas): al abrir el inicio, `acreditarAlbumesPendientes` les crea el premio atrasado una sola vez; solo la sesión que de verdad completa el álbum muestra la celebración.
- **Niño:** el inicio muestra el álbum actual con tantos lugares como lleve (vacíos punteados), el cofre (una moneda por moneda, hasta 20, y el número), el botón «Tienda» (solo si hay premios activos, color marrón `#8a5a00` para el contraste) y «Mis álbumes» (solo si ya completó alguno). Al completar el álbum se ven sus calcomanías, las monedas entrando una a una (≤ 2 s, sin animación con movimiento reducido) y se dice «¡Completaste tu álbum!»; la siguiente vez el álbum empieza vacío. En la tienda, un premio que no alcanza muestra las monedas que tiene y las que faltan en punteado y se dice cuántas faltan (sin error, sin rojo); uno que alcanza pide confirmar con ✓ / ← (bloqueo de 400 ms, el toque que eligió no confirma) y deja un canje `pendiente`.
- **Adulto:** `#/adulto/album` (tamaño 6–24, monedas 1–50, calcomanías en juego con casillas —si están todas marcadas se guarda `codigos: null` y las nuevas entran solas—, calcomanías propias) y `#/adulto/tienda` (saldo, regalar y corregir con nota obligatoria, canjes por entregar con «Entregado» / «Anular» —anular devuelve las monedas—, premios con subir/bajar/pausar/editar/quitar, historial). Un canje hecho en dos dispositivos a la vez podría dejar el saldo apenas negativo: se corrige con «Corregir el saldo».
- **Calcomanías:** 18 SVG nuevos (nube, gota, manzana, helado, pelota, auto, tortuga, abeja, conejo, rana, pájaro, cohete, tren, regalo, corona, paraguas, hoja, pastel), sin rojo. Las propias muestran su foto o emoji dentro de un círculo amarillo.
- **Servidor de pruebas:** `tests/servidor.py` (sin caché del navegador y con los tipos MIME correctos) reemplaza al `http.server` de Python en `launch.json`: el navegador reutilizaba módulos viejos después de editarlos.

**Datos (subir `VERSION_BD` a 2 en `store.js`; `crearEsquema` ya crea solo los almacenes que faltan):**

```js
// nuevos almacenes en ALMACENES, todos con índice perfilId
premio      { id, perfilId, nombre, precio (1–100), medioImagenId?, arasaacId?, emoji?, activo, orden }
movimiento  { id, perfilId, fecha, cantidad (+ gana / − gasta), tipo: 'album'|'canje'|'regalo'|'correccion',
              premioId?, albumNumero?, nota?, estado?: 'pendiente'|'entregado'|'anulado' (solo canjes) }
calcomaniaPropia { id, perfilId, nombre, medioImagenId?, arasaacId?, emoji? }  // calcomanías creadas por el adulto
// perfil.album = { tamano: 12, monedasPorAlbum: 10, codigos: null | ['estrella', 'propia:<id>', ...] }
//   (va en perfil.album, no en ajustes; normalizarlo como normalizarAjustes, con pruebas)
// calcomania (existente) no cambia: { id, perfilId, codigo, fecha }
```

- **El saldo nunca se guarda como número**: es la suma de `movimiento.cantidad` (sin los canjes `anulado`). Así la sincronización (gana el `updatedAt` más reciente **por registro**) nunca pierde monedas cuando dos dispositivos suman a la vez.
- **Los álbumes se calculan, no se guardan** (`core/album.js`, puro y con pruebas): se recorren las calcomanías del perfil por `fecha` y se van llenando álbumes de `tamano` calcomanías **distintas**; cuando uno se llena, empieza el siguiente. `albumes(calcomanias, config) → [{ numero, codigos, completo, fechaFin }]` y `albumActual(...)`.
- **Premio del álbum sin duplicados entre dispositivos:** el movimiento de premio tiene id **determinista** `album:<perfilId>:<numero>`. Si dos dispositivos lo crean, es el mismo registro y la fusión deja uno. `movimientosPendientesDeAlbum(albumes, movimientos, config)` devuelve los que faltan crear (pruebas: completar un álbum dos veces en paralelo da 10 monedas, no 20).
- `elegirCalcomania` pasa a recibir el álbum actual y la lista de códigos en juego: elige una que **no esté en el álbum actual**; ya no hay calcomanías repetidas dentro de un álbum.
- Si el adulto achica el álbum o quita calcomanías del juego, los álbumes ya completos no cambian (se recalculan solo desde el último completo: guardar `fechaFin` del último álbum completo en el movimiento del premio y usarla como corte). Escribir la prueba de este caso.

**Catálogo de calcomanías:**
- Pasar de 12 a **30 SVG propios** en `data/calcomanias/` (mismo estilo simple de los actuales: formas planas, colores calmos, sin texto). Agregarlos a `CALCOMANIAS` y al `PRECACHE`.
- Calcomanías **propias del adulto**: con foto, pictograma ARASAAC o emoji (reutilizar `ui/selector-foto.js` y `pictos.js`). Código `propia:<id>`; `rutaCalcomania` resuelve también estas (URL del medio).

**Modo niño:**
- **Fin de sesión** (`nino/premio.js`): igual que hoy, y si esa calcomanía **completa el álbum**: pantalla «¡Completaste tu álbum!» (se dice en voz alta), las 12 calcomanías juntas, y 10 monedas que entran una a una a un cofre (≤ 2 s; con `prefers-reduced-motion` o celebración «ninguna», aparecen sin animación). Luego un toque en ▶ vuelve al inicio con un **álbum vacío nuevo**.
- **Inicio:** debajo del álbum, el **cofre** con su saldo (monedas dibujadas + número) y un botón grande «Tienda» (≥ 88 px) **solo si hay premios activos**. Un botón «Mis álbumes» muestra los álbumes completos (solo mirar).
- **Tienda (`#/nino/tienda`):** tarjetas grandes de premios (imagen + nombre + precio en monedas dibujadas). Tocar un premio lo dice en voz alta.
  - Si le alcanza: pantalla de confirmación con la imagen grande, «¿Lo quieres?» hablado y dos botones grandes: ✓ y ← (sin mantener presionado, con bloqueo de 400 ms). Al confirmar: movimiento `canje` con `estado: 'pendiente'` y cantidad negativa, voz «¡Es tuyo! Pídeselo a un adulto», volver a la tienda.
  - Si no le alcanza: el precio muestra las monedas que tiene llenas y las que faltan como contorno punteado; se dice «Te faltan N monedas». Sin sonido de error, sin rojo, sin bloqueo frustrante: es información.
- El candado y la salida al modo adulto funcionan igual en la tienda.

**Modo adulto:**
- `#/adulto/album`: tamaño del álbum, monedas por álbum, elegir qué calcomanías entran (cuadrícula con casillas; al menos tantas como el tamaño), crear/quitar calcomanías propias, ver el álbum actual y los completos.
- `#/adulto/tienda`: crear, editar, ordenar, pausar y quitar premios (nombre, imagen, precio); **canjes pendientes** con «Entregado» y «Anular» (anular devuelve las monedas); historial de movimientos; «Regalar monedas» y «Corregir saldo» (con nota obligatoria). Mostrar el saldo actual.
- Enlaces nuevos en el panel del adulto. Respaldo (exportar/importar) y sincronización deben incluir los almacenes nuevos: comprobar que `core/respaldo.js` y `core/sync.js` recorren `ALMACENES` y no una lista fija (si es fija, cambiarla) y agregar pruebas.

**Acepta si:**
- Al terminar la sesión que llena el álbum se ve la celebración, el saldo sube exactamente 10 y la siguiente sesión empieza un álbum vacío; los álbumes completos se ven en «Mis álbumes».
- Ninguna calcomanía se repite dentro de un álbum; solo salen las que el adulto dejó en juego (incluidas las propias).
- Un canje deja el saldo bien, aparece como pendiente en el adulto, «Anular» devuelve las monedas; con saldo insuficiente no se puede canjear y no hay ningún gesto de error.
- Pruebas puras: cálculo de álbumes, saldo, premio con id determinista (dos dispositivos → una sola vez), cambio de tamaño del álbum, sincronización y respaldo con los almacenes nuevos.
- Tamaños (88 px niño, 44 px adulto), contraste AA y sin desplazamiento horizontal en 375 px.

---

### Fase 12 — Registro fino de cada respuesta ✔ hecha

**Decisiones de implementación (ya en el código, con pruebas en `tests/registro.test.js`):**
- **Un registro por ensayo terminado**, armado por `construirRespuesta` (`core/registro.js`, puro). Su `id` es `<sesionId>:<numeroEnSesion>` (determinista: guardarlo dos veces no lo duplica). El `sesionId` lo genera `crearControlador` al empezar (`ctl.sesionId`, también se puede inyectar) y el registro de la sesión (`ctl.registro`) ahora lleva ese mismo `id`; `sesion.ensayos` no cambió.
- **`core/intento.js`**: todos los modos guardan `primerToque` (ms hasta el primer toque válido; los toques ignorados por el bloqueo de 400 ms no cuentan). Simple y secuencia guardan además `erroresMs` (un valor por cada elemento de `errores`); secuencia guarda `toques: [{ fichaId, correcto, ms }]`. `errores` sigue siendo la lista de ids de siempre.
- **`ctl.oirOtraVez()`** cuenta `repeticionesAudio` del ensayo actual (se reinicia en cada ensayo; no cuenta después de acertar). `nino/sesion.js` lo llama en `alToqueModelo` (altavoz o modelo, ya con el filtro de toques repetidos); el audio automático tras un error NO cuenta, porque lo dice la app y no el niño.
- **`ctl.avanzar()` devuelve `guardar.respuesta`**; la pantalla la guarda en el almacén `respuestas` por la misma cola `guardar` que el progreso y el nivel. `nivelOpciones` es lo que mandaba el nivel antes del ensayo (`opcionesEfectivas`); `fatigaActiva` es true solo en el ensayo de cierre (que además tiene `tipo: 'cierre'`).
- **Estados**: `estadoAntes/Despues` son los del motor (`nueva` / `practica` / `dominada`; no existe «aprendida»). En L6 y cuentos sin progreso, los estados y cajas quedan en `null`.
- **Frases y L6**: secuencia guarda `ordenEsperado` y `toques` con el texto de cada ficha (`errores[].id` es el id de la palabra, no el de la ficha); lectura guarda `repeticiones` (veces que el adulto tocó ↻), `opciones: []` y `posicionCorrecta: null`.
- **Cuentos (B2)**: `nino/libros.js` registra cada respuesta a una pregunta (`actividad: 'B2'`, `tipo: 'cuento'`, `etapa: 4`, más `libroId` y `pregunta`); sigue sin mover el progreso. Cada lectura de las preguntas es una «sesión» propia (`sesionId` nuevo).
- **`distraido: true`** si `msAcierto` > 60 000 (`MS_DISTRAIDO`); el valor se guarda tal cual.
- **Datos**: `VERSION_BD = 3` (almacén `respuestas`, índices `perfilId` y `elementoId`; la base existente se actualiza sin perder nada). Está en `ALMACENES_RESPALDO` (copia de seguridad y sincronización la recorren, y hay una prueba que falla si se agrega un almacén y se olvida en la copia).
- **Aviso de tamaño**: `sync.js` guarda en `meta` (`syncBytesDatos`) lo que pesa el último `data.json` subido; la pantalla Cuenta avisa desde 8 MB (`LIMITE_AVISO_DATOS_BYTES` en `core/sync.js`). Solo avisa: no recorta nada.

Hoy `sesion.ensayos` guarda `{ elementoId, actividad, tipo, esFacil, correctoAlPrimerIntento, intentos, ms }` y `progreso.historial` solo los últimos 10. Eso no alcanza para saber **con qué** se confunde ni **cuánto duda**.

**Datos:** nuevo almacén `respuestas` (índice `perfilId`; agregar también un índice `elementoId`). Un registro por ensayo terminado, **solo se agrega, nunca se edita**:

```js
respuesta {
  id, perfilId, sesionId,                  // sesionId: generar el id de la sesión al EMPEZAR (hoy se crea al guardar)
  fecha,                                   // ISO completa
  dia, hora, diaSemana,                    // 'AAAA-MM-DD', 0–23, 0–6 (hora local; sirven para ver si rinde mejor en la mañana)
  numeroEnSesion,                          // 1, 2, 3…
  elementoId, texto, esFrase,              // copia del texto: el registro se entiende aunque después borren la palabra
  categoria, silabas,
  etapa, actividad, tipo: 'nueva'|'practica'|'repaso'|'lectura', esFacil,
  opciones: [{ id, texto }],               // en el orden en que se mostraron
  posicionCorrecta,                        // índice 0..n-1
  nivelOpciones,                           // las que mandaba el nivel (puede diferir de opciones.length)
  correctoAlPrimerIntento, intentos,
  errores: [{ id, texto, ms }],            // cada opción equivocada tocada, en orden, con ms desde el inicio
  msPrimerToque,                           // tiempo hasta el primer toque válido (duda)
  msAcierto,                               // tiempo hasta acertar (= el `ms` de hoy)
  repeticionesAudio,                       // veces que tocó el altavoz o el modelo para volver a oír
  conAyudaVisual,                          // true si llegó a verse la correcta iluminada
  estadoAntes, estadoDespues,              // 'nueva'|'practica'|'dominada'|'aprendida' de ese progreso
  cajaLeitnerAntes, cajaLeitnerDespues,
  fatigaActiva,                            // si este ensayo fue el de cierre por fatiga
  // solo secuencias (F3, S3):
  ordenEsperado?: [texto], toques?: [{ texto, correcto, ms }]
  // solo L6: repeticiones? (veces que el adulto tocó ↻)
}
```

**Cómo se captura (sin romper la arquitectura):**
- `core/intento.js`: guardar `primerToque` (ms del primer toque válido) y `ms` en cada error. Las secuencias guardan cada toque. Pruebas.
- `core/controlador.js`: nuevo método `oirOtraVez()` que cuenta `repeticionesAudio` del ensayo actual (la pantalla lo llama en `alToqueModelo`). `avanzar()` devuelve además `guardar.respuesta` armada por una función **pura** nueva `construirRespuesta({ ensayo, visual, intento, progresoAntes, progresoDespues, … })` en `core/registro.js`, con pruebas.
- `nino/sesion.js`: guarda `respuesta` junto al progreso (misma cola de `guardar`). La sesión tiene `id` desde el inicio y `sesion.ensayos` sigue como está (compatibilidad con Progreso).
- Libros y cuentos: registrar también las respuestas a las **preguntas de los cuentos** (`actividad: 'B2'`, `tipo: 'cuento'`) — sigue sin evaluarse ni mover el progreso, pero sirve para el análisis.
- `ms` mayores a 60 s se guardan tal cual pero se marcan `distraido: true` (el análisis los excluye del tiempo).

**Tamaño y sincronización:** ~15 ensayos × 2 sesiones × 365 días ≈ 11 000 registros/año (~3–4 MB en `data.json`). Aceptable. Agregar a `respaldo` y `sync` (como los demás almacenes). Si el `data.json` pasa de 8 MB, avisar en la pantalla Cuenta (no recortar nada sin preguntar).

**Acepta si:** una sesión de 8 ensayos con 2 errores y 3 toques al altavoz deja 8 registros con los errores (qué opción y cuándo), `msPrimerToque`, `repeticionesAudio` y estados antes/después correctos; F3 guarda los toques en orden; los registros viajan por sync y respaldo; pruebas puras de `construirRespuesta` e `intento`.

---

### Fase 13 — Análisis: qué le cuesta, qué le es fácil, exportar para IA ✔ hecha

**Decisiones de implementación (ya en el código, con pruebas en `tests/analisis.test.js`):**
- **Qué cuenta:** `respuestasAnalizables` deja fuera `esFacil`, L6, `tipo: 'lectura'`, las preguntas de cuentos (`tipo: 'cuento'`: no son ensayos del motor), lo borrado y lo anterior a 60 días (el día 60 todavía entra). Las constantes están arriba de `core/analisis.js`.
- **Tiempo relativo:** como una palabra se practica en varias actividades, se divide cada acierto al primer intento (sin `distraido`) por la mediana del niño en **esa** actividad y se toma la mediana de esos cocientes. Sin aciertos válidos no suma al índice.
- **Tendencia:** últimos 5 contra los 5 anteriores; hacen falta al menos 3 anteriores, si no queda «igual».
- **Listas:** «más difíciles» = confiables con índice > 0 (una palabra con índice 0 no es «difícil»); «más fáciles» = confiables que no están en la anterior, por menor índice (empate: más acierto, luego más rápida); «para repetir más» incluye también palabras con pocos datos si fallaron un repaso en los últimos 7 días. Franjas del día: mañana 5–11, tarde 12–18, noche 19–4; solo se muestran con ≥ 20 ensayos cada una y solo si hay al menos dos.
- **Pantalla `#/adulto/analisis`** («Qué le cuesta»; enlaces desde el panel y desde Progreso): las cinco tarjetas más «según el momento del día» cuando hay datos, detalle por palabra (últimos 20 ensayos, «Ya la sabe» / «Empezar de nuevo»), texto de ayuda y exportación. La barra de dificultad es azul. Sin ninguna palabra con 5 ensayos explica que hay pocos datos en vez de mostrar listas vacías.
- **Exportar:** `construirExportacion` trae `esquema`, `metodo` (5 líneas), `perfil` (solo nombre de pila, edad en años —nunca la fecha de nacimiento—, etapa y ajustes), métricas, confusiones, por actividad, por hora, sesiones (resumidas) y **todas** las respuestas. Sin fotos ni audios. «Ocultar el nombre» cambia el nombre por «el niño» en **todos** los textos (incluso si es una de las palabras), sin tocar palabras que solo empiezan igual. «Copiar resumen para IA» da un Markdown de ≤ 4 000 caracteres (si se pasa, recorta las listas).

**Lógica pura (`core/analisis.js`, con pruebas y datos de ejemplo):**

Por palabra (y por frase), con sus respuestas de los **últimos 60 días**, sin contar `esFacil` ni `lectura`:
- `ensayos`, `aciertosPrimerIntento`, `tasa` (= aciertos / ensayos), `errores` totales.
- `tiempoMediano`: mediana de `msAcierto` de los aciertos al primer intento, sin `distraido`. `tiempoRelativo` = `tiempoMediano` ÷ mediana del niño en esa misma actividad (≥ 1 = más lento que su propio promedio; se compara con él mismo, nunca con otros niños).
- `audioPorEnsayo`: promedio de `repeticionesAudio`.
- `tendencia`: tasa de los últimos 5 ensayos menos la de los 5 anteriores (`'mejora' | 'igual' | 'empeora'`, umbral ±0,2).
- `dias`: días distintos practicados; `ultimaVez`.
- **Índice de dificultad (0–100):**
  `round(100 × (0,60 × (1 − tasa) + 0,25 × clamp((tiempoRelativo − 1) / 2, 0, 1) + 0,15 × clamp(audioPorEnsayo / 2, 0, 1)))`.
  Con menos de 5 ensayos: `confiable: false` («pocos datos»). Las constantes van arriba del archivo para poder afinarlas.
- **Confusiones:** pares (palabra objetivo → opción tocada por error) con cuántas veces pasó; `confusionesFrecuentes(respuestas, { minimo: 2 })` ordenadas de más a menos.
- **Listas:** `masDificiles` (top 5 por índice, solo confiables), `masFaciles` (top 5 por menor índice), `paraRepetirMas` (índice ≥ 50, o tendencia «empeora», o falló un repaso en los últimos 7 días), `porActividad` (tasa y tiempo mediano por L1–L5, S1–S4…: dónde se traba), `porHora` (tasa por franja mañana/tarde/noche, solo si hay ≥ 20 ensayos en cada una).

**Pantalla del adulto `#/adulto/analisis` («Qué le cuesta»):**
- Tarjetas: «Le cuestan más», «Le salen fácil», «Para repetir más», «Se confunde entre…» (p. ej. «mamá ↔ mano: 4 veces»), «Actividad más difícil». Cada palabra muestra su imagen, el índice como barra (azul, **nunca rojo**), tasa, tiempo mediano en segundos y tendencia con flecha.
- Tocar una palabra abre su detalle: últimos 20 ensayos (fecha, actividad, ✓ sin ayuda / ↻ con ayuda, con qué se confundió, tiempo), y botones existentes «Ya la sabe» / «Empezar de nuevo».
- Texto de ayuda breve: qué significa cada número y que el tiempo **no** se usa para juzgar al niño ni se le muestra.
- Enlace desde el panel y desde Progreso.

**Exportar para IA:**
- Botón «Exportar para analizar con IA» → descarga `leo-conmigo-analisis-<nombre>-<AAAA-MM-DD>.json` con: `esquema` (descripción en español de cada campo, para que la IA lo entienda sin contexto), `metodo` (resumen de 5 líneas del método y las reglas: aprendizaje sin error, dominio, Leitner), `perfil` (solo nombre de pila, edad si existe, etapa, ajustes), `metricasPorPalabra`, `confusiones`, `porActividad`, `sesiones` y `respuestas` (todas, no solo 60 días). **Sin fotos ni audios.** Casilla «Ocultar el nombre del niño» (lo reemplaza por «el niño»).
- Botón «Copiar resumen para IA»: texto Markdown corto (≤ 4 000 caracteres) con las métricas principales y una pregunta sugerida, listo para pegar en un chat: «Eres especialista en lectura para niños con síndrome de Down (método Troncoso). Con estos datos, dime qué palabras reforzar, qué confusiones trabajar y si conviene cambiar algo de los ajustes».
- Recordatorio visible: «La app no envía estos datos a ningún lado. Tú decides con quién compartirlos.»

**Acepta si:** con un set de respuestas de prueba (fijo, en `tests/`), las listas y el índice salen exactamente como se esperan; la pantalla muestra las cinco tarjetas y el detalle; el JSON exportado se puede volver a leer y trae `esquema`; con «Ocultar el nombre» no aparece el nombre en ningún campo; sin datos suficientes la pantalla lo explica en vez de mostrar listas vacías.

---

### Fase 14 — Avance automático: sacar lo que ya sabe y ajustes que se adaptan ✔ hecha

**Decisiones de implementación (ya en el código, con pruebas en `tests/fase14.test.js`; cambian el §4 por pedido del usuario):**
- **Avance rápido** (`core/progreso.js`, `registrarEnsayo(..., { avanceRapido })`): al registrar el tercer ensayo que cuenta (≥ 2 opciones, no `esFacil`; los demás se anotan pero no cuentan) y ser los tres aciertos al primer intento, y solo si el historial aún no se recortó (son de verdad los primeros), la actividad queda `dominada` con `provisional: true`, caja 1 y repaso al día siguiente. Repaso fallado ⇒ `practica` con un solo error; acertado ⇒ `provisional: false` y sigue la caja normal. La lectura en voz alta (L6) no acelera. El ensayo guarda `esFacil: true` en el historial solo cuando es verdad.
- **Aprendida** (`estaAprendida`, sin campo obligatorio): todas las actividades de la palabra dominadas y no provisionales + al menos una con `aciertosEnCaja5 > 0` (campo opcional que sube con un repaso acertado estando ya en la caja 5 y baja a 0 con cualquier fallo). No cambió la caja de Leitner: el control se calcula como 30 días (`DIAS_CONTROL`) después del último ensayo de la actividad (`diaDeControl`). En `crearSesion` las aprendidas no entran en los repasos normales; hay a lo sumo **1 control por sesión** (el más atrasado); si es lo único que hay, la sesión es de un solo ensayo. Control fallado ⇒ dominada en caja 1 (ya no aprendida). Siguen sirviendo de distractor. «Aprendida» en Progreso y Vocabulario, con «Volver a practicar» (`volverAPracticar`).
- **Prioridad a lo difícil**: `crearSesion({ dificultades })` (un `Map` armado con `dificultadesDe(analizar(respuestas))`; el controlador lo calcula solo). `reajustarPorDificultad`: palabras en práctica con datos confiables y índice ≥ 50 reciben un ensayo que ceden las de índice < 20 (siempre quedan con ≥ 1; sin pasar el tope de la mitad de la sesión; el total no cambia).
- **Confusiones**: la más frecuente de cada palabra no se usa de distractor mientras su tasa sea < 80 % (si excluirla dejara menos opciones, no se excluye); con ≥ 80 % se garantiza una vez por sesión como distractor en un ensayo que no sea fácil (`elegirDistractores({ excluirIds, incluirIds })`).
- **Ajustes** (`normalizarAjustes`): `avanceRapido` (true), `palabrasNuevasPorSesion` (1–2, por defecto 2; `crearSesion` usa `min(2, ese valor)`: el tope del §2 no cambia) y `automaticos` (`ensayosPorSesion`, `maxOpciones`, `etapa`, `palabrasNuevas`; todos true). Pantalla Ajustes › «Lo que la app hace sola»; si el adulto cambia a mano uno que estaba en «Automático», pasa a «Lo elijo yo».
- **Autoajuste** (`core/autoajuste.js`, puro; `js/autoajuste.js` lo aplica al terminar cada sesión completa, nunca a mitad, y un fallo no afecta al niño): últimas 3 sesiones. Ensayos por sesión +2 (tope 12) / −2 (mín. 4); máximo de opciones +1 (todos los niveles con ≥ 10 ensayos, al máximo y ≥ 85 %; nunca baja); palabras nuevas 2→1 con índice promedio ≥ 50 y 1→2 con < 30; etapa +1 desde la 1 hacia la 2 con ≥ 80 % de palabras activas dominadas o aprendidas y la 2 abierta (no baja nunca: con < 50 % en las últimas 3 solo anota una **sugerencia**). Una vez por día por ajuste. Cada cambio queda en `perfil.cambiosAutomaticos` (últimos 30, con `visto`); el panel muestra «La app ajustó…» con **Deshacer** (valor anterior + «Lo elijo yo») y **Entendido**. Las sesiones interrumpidas por el adulto se guardan ahora con `interrumpida: true` y cuentan como motivo para bajar los ensayos.
- **Criterio de aceptación corregido (acordado con el usuario):** el original («10 palabras leídas en L4 en ≤ 4 sesiones») era inalcanzable con 8 ensayos por sesión: 10 palabras × 4 actividades × 3 ensayos son 120 ensayos (unas 20 sesiones como mínimo). Ahora es: con avance rápido, el niño que ya conoce las palabras las tiene leídas en **al menos 20 % menos de sesiones** que sin él. Medido con `tests/simulador.js` (8 semillas): **~38 → ~30 sesiones (≈ 21 %)**; el niño lento **~63 → ~63** (igual). Los tests comprueban eso, que el lento queda a ±6 sesiones y que nunca hay más de 2 nuevas por sesión.
- **Si el avance resulta muy lento con el niño real** (decisión del usuario: se cambia luego): la opción ya estudiada es dejar que una palabra pase a la siguiente actividad dentro de la misma sesión (retargetear en el controlador los ensayos restantes de esa palabra cuando su actividad queda dominada provisional). Mejora el uso de cada ensayo pero cambia cómo se arma la sesión: medir con el simulador antes de adoptarla. Otras palancas: bajar `ENSAYOS_AVANCE_RAPIDO` (3) o subir los ensayos por sesión.
- Ayuda del adulto: sección «Lo que la app hace sola».

**Cambio explícito a §4 (lo pidió el usuario).** Todas las constantes nuevas van en `core/progreso.js` / `core/sesion.js` / `core/autoajuste.js` con sus pruebas, y se documentan en «Decisiones de implementación» al cerrar la fase.

**1. Avance rápido (`ajustes.avanceRapido`, por defecto `true`):**
- En una actividad, si los **primeros 3 ensayos** de una palabra son aciertos al primer intento con **≥ 2 opciones** (no cuentan los de 1 opción ni los `esFacil`), la actividad queda `dominada` **provisional** (`provisional: true`, caja Leitner 1, repaso al día siguiente) y la palabra pasa a la siguiente actividad **en esa misma sesión o la próxima**.
- Si el repaso del día siguiente falla, vuelve a `practica` con **un solo** error (no dos, como las dominadas normales). Si acierta, deja de ser provisional.
- Efecto buscado: una palabra que el niño ya sabe recorre L1–L5 en 1–3 sesiones en vez de ~10 días. Prueba con el simulador (`tests/simulador.js`): un niño que ya conoce 10 palabras las tiene leídas (L4) en al menos 20 % menos de sesiones que sin avance rápido (el «≤ 4 sesiones» original era inalcanzable, ver «Decisiones de implementación»); el niño «lento» sigue igual que hoy (no debe acelerar con suerte).

**2. Palabras aprendidas (salen solas):**
- Nuevo estado `aprendida` por palabra (no por actividad): todas las actividades de la etapa 1 dominadas (no provisionales) **y** un repaso acertado estando en la caja Leitner 5 (16 días). Se calcula en `core/progreso.js` (`estaAprendida(progresosDeLaPalabra)`), sin campo nuevo obligatorio.
- Las aprendidas **no entran** en los repasos normales. Solo un **repaso de control** cada 30 días (`DIAS_CONTROL = 30`), como máximo 1 por sesión. Si falla el control, vuelve a dominada en caja 1.
- Siguen sirviendo como distractores, en frases, libros y sílabas.
- Como liberan lugar, entran palabras nuevas antes. Revisar `MIN_EN_PRACTICA`/`MAX_NUEVAS_POR_SESION`: **no cambian** (máximo 2 nuevas por sesión sigue siendo regla del §2).
- Adulto: Progreso y Vocabulario muestran «Aprendida»; el detalle permite «Volver a practicar».

**3. Prioridad a lo difícil:**
- En `crearSesion`, entre las palabras en práctica, las de **mayor índice de dificultad** (fase 13) reciben un ensayo extra cuando hay lugar (sin pasar el tope de la mitad de la sesión) y las de índice < 20 uno menos.
- **Confusiones:** mientras la precisión de esa palabra sea < 80 %, su confusión más frecuente **no** se usa como distractor (evita reforzar el error); con ≥ 80 % se usa a propósito como distractor una vez por sesión (discriminación fina). Pruebas.

**4. Ajustes automáticos (`core/autoajuste.js`, puro):**
- `ajustes.automaticos = { ensayosPorSesion: true, maxOpciones: true, etapa: true, palabrasNuevas: true }`. Cada uno con su interruptor en Ajustes («Automático» / «Lo elijo yo»). Si el adulto cambia a mano un ajuste automático, ese pasa a «Lo elijo yo».
- Se evalúa **al terminar cada sesión**, mirando las **últimas 3 sesiones** (registro de la fase 12). Cada ajuste cambia como máximo **una vez por día**:
  - **Ensayos por sesión:** +2 (tope 12 en automático) si las 3 terminaron sin fatiga, con ≥ 80 % de aciertos al primer intento y duración mediana < 8 min. −2 (mín. 4) si hubo fatiga en 2 de 3, o duración mediana > 12 min, o una sesión interrumpida por el adulto.
  - **Máximo de opciones:** +1 (hasta 4) si todos los niveles de las actividades en uso están en el máximo actual con precisión ≥ 85 %. Nunca baja solo (el nivel por actividad ya baja por sí mismo).
  - **Palabras nuevas por sesión** (ajuste nuevo `palabrasNuevasPorSesion`, 1–2, por defecto 2): baja a 1 si el promedio de dificultad de las palabras en práctica es ≥ 50; vuelve a 2 si es < 30.
  - **Etapa:** si se abrió la etapa siguiente y ≥ 80 % de las palabras activas de la etapa actual están dominadas o aprendidas, `etapaActual` sube. **Nunca baja sola**: si la precisión de las últimas 3 sesiones es < 50 %, solo se **sugiere** al adulto bajar.
- Cada cambio queda en `perfil.cambiosAutomaticos` (últimos 30: `{ fecha, ajuste, antes, despues, motivo }`) y el panel del adulto muestra un aviso: «La app ajustó: ensayos por sesión 8 → 10 (terminó 3 sesiones seguidas sin cansarse)» con **Deshacer** (vuelve al valor anterior y deja ese ajuste en «Lo elijo yo») y «Entendido».
- El niño nunca ve nada de esto. Nada cambia a mitad de sesión.

**Acepta si:**
- Pruebas puras de avance rápido, provisional que falla, aprendida, control de 30 días, prioridad a lo difícil, confusiones como distractor, y de cada regla de autoajuste (incluido «una vez por día» y «a mano → manual»).
- Simulador: niño que ya sabe 10 palabras → leídas en al menos 20 % menos de sesiones; niño lento → mismo ritmo que hoy (±1 semana); ninguna sesión pasa de 2 palabras nuevas.
- En el navegador: tras 3 sesiones buenas aparece el aviso de ajuste y «Deshacer» funciona; una palabra aprendida deja de salir y aparece como «Aprendida».
- Actualizar «Decisiones de implementación» del §4 y la ayuda del adulto (`#/adulto/ayuda`: qué hace la app sola y cómo apagarlo).

---

## Ampliación 3 — Fases 15 a 19: alumnos con su propia cuenta (pedida el 2026-11-15, aprobada por el usuario el 2026-11-16)

> **Para Sonnet:** lee antes §7 (fase 7: sincronización), `js/sync.js`, `js/core/sync.js`, `js/drive.js`, `js/auth.js`, `js/nube.js` y la guía [docs/google-cloud.md](docs/google-cloud.md). Igual que en las fases anteriores: una fase a la vez, con su lista de aceptación, `graphify update .` y un commit. **La seguridad de las carpetas (ver «Quién puede tocar qué») no se negocia**: si algo del código choca con ella, gana ella; si no sabes cómo cumplirla, pregunta.

### Qué pidió el usuario
- Instalar la app en el dispositivo de un **alumno**, que entra con **su propia cuenta de Gmail** y queda como estudiante: **no puede ver ninguna configuración** y **nunca sale del modo alumno**.
- Ese dispositivo **baja todo lo necesario** (fotos, voces, pictogramas, láminas, portadas) para funcionar sin conexión.
- Desde **su celular**, el adulto configura la versión del alumno (palabras, frases, libros, álbumes, tienda, ajustes, etapas, fondo: todo lo que ve el niño) y **ve sus estadísticas**.
- El alumno aparece **solo** en una sección **«Alumnos habilitados»** al conectarse por primera vez.
- Si el adulto sube algo nuevo (p. ej. un álbum), el dispositivo del alumno **lo detecta y lo baja**.
- **El alumno solo puede escribir sus propios archivos**: no puede modificar el contenido del adulto ni ver datos de otros niños ni del resto del Drive del adulto.

### La idea (cambia poco la estructura actual)
Hoy cada adulto sincroniza **todo** su almacén con `data.json` en la carpeta oculta `appDataFolder` de **su** Drive. Esa carpeta no se puede compartir con otra cuenta, así que se agrega un segundo lugar de sincronización, **el «aula»**, en carpetas normales del Drive del adulto:

```
Mi unidad (del adulto)
└── Leo Conmigo/                         carpeta de trabajo · propiedad leoConmigo='trabajo' · NO se comparte con nadie
    ├── Alumno · Pedro/                  un aula por perfil · leoConmigo='aula', perfilId · compartida como LECTOR con el Gmail del alumno
    │   ├── aula.json                    lo escribe el adulto (perfil, dueño, apariencia, dispositivos desvinculados)
    │   ├── adulto.json                  lo escribe el adulto: los registros de ESE perfil (mismo formato que data.json)
    │   ├── medio-<id>.<ext>             fotos y audios de ese perfil (los sube el adulto)
    │   └── del-alumno/                  leoConmigo='del-alumno' · el alumno es EDITOR solo aquí
    │       ├── alumno.json              lo escribe el alumno: sus sesiones, respuestas, progreso, monedas…
    │       └── dispositivo-<id>.json    uno por dispositivo del alumno (correo, versión, última sincronización)
    └── Alumno · Sofía/                  otra aula, compartida solo con el Gmail de Sofía
```

- **Cada lado escribe solo su archivo y lee el del otro.** La fusión es la de siempre (registro por registro, gana el `updatedAt` más reciente, borrados suaves, «gana lo local si cambió mientras se sincronizaba»), con dos agregados: qué almacenes acepta cada lado del otro y qué almacenes publica.
- **El perfil tiene el mismo `id` en los dos lados**, y las sesiones y respuestas del alumno llegan al almacén del adulto como si se hubieran jugado ahí: **Progreso, Análisis y Álbum del adulto funcionan sin cambios** (no se recalcula nada aparte; se siguen usando `core/estadisticas.js`, `core/analisis.js` y `core/album.js`).
- La sincronización personal del adulto (`appDataFolder` + `data.json`) **sigue igual**. En el dispositivo del alumno **no** se usa: su única nube es el aula.

### Quién puede tocar qué (obligatorio)
La protección la da **Drive** (los permisos de cada carpeta), no solo la app: aunque alguien usara la cuenta del alumno fuera de la app, no podría hacer más que esto.

| Carpeta / archivo | Adulto (dueño) | Alumno invitado | Cualquier otra persona |
|---|---|---|---|
| `Leo Conmigo/` (trabajo) y el resto del Drive del adulto | todo | **no la ve** (nunca se comparte) | no la ve |
| `Alumno · <su niño>/`: `aula.json`, `adulto.json`, `medio-*` | todo | **solo lectura** | no la ve |
| `Alumno · <su niño>/del-alumno/` | todo | **editor** (crea y cambia sus archivos) | no la ve |
| Aulas de otros niños | todo | **no las ve** | no la ve |

Reglas para la implementación:
- El aula se comparte con `role: 'reader'` y solo la subcarpeta `del-alumno/` con `role: 'writer'`. **Nunca** `type: 'anyone'` (nada de «cualquiera con el enlace»), nunca `domain`, nunca `writer` en el aula ni en la carpeta de trabajo, y siempre con `emailAddress` exacto.
- Al crear el aula se comprueba con `permissions.list` que la carpeta de trabajo **no** tenga permisos aparte del dueño; si los tiene (alguien la compartió a mano), se avisa al adulto y no se habilitan alumnos hasta que la deje privada.
- En cada sincronización el adulto revisa los permisos de cada aula: si aparece un permiso que la app no puso (otro correo, `anyone`, un `writer` en la carpeta del aula), lo muestra en «Alumnos» como **«Permiso extraño»** con un botón para quitarlo. No lo quita solo.
- **Del archivo del alumno, el adulto acepta solo** los almacenes `ALMACENES_DEL_ALUMNO` (ver la tabla siguiente), **solo** registros con `perfilId` de esa aula (y en `perfiles`, solo el registro de ese perfil), y valida el formato antes de fusionar. Cualquier otra cosa se descarta y se cuenta en un aviso. `medios` del alumno nunca se aceptan.
- El adulto solo lee archivos de `del-alumno/` cuyo dueño (`owners[0].emailAddress`) sea un correo invitado a esa aula.
- El alumno nunca escribe fuera de `del-alumno/` (si la API lo deja por un error de permisos, la app igual no lo hace: todas las escrituras del alumno pasan por un cliente de Drive atado a esa subcarpeta).

### Decisiones tomadas
| Tema | Decisión |
|---|---|
| Permiso de Google | El aula necesita el alcance `https://www.googleapis.com/auth/drive` (el mismo que ya pide ZenBan con el cliente «MindSpark»). `drive.file` no sirve: con él el alumno no ve una carpeta creada por otra cuenta sin Google Picker. **Se pide aparte y solo cuando hace falta** (al abrir «Alumnos» la primera vez o al configurar un dispositivo de alumno), con `include_granted_scopes`; quien no usa alumnos sigue solo con `drive.appdata`. |
| Modo Prueba / producción | Lo configura el usuario siguiendo [docs/google-cloud.md](docs/google-cloud.md) (publicar la app para que Google no rechace a los alumnos). La app muestra un mensaje claro si Google rechaza la cuenta (`access_denied`: «Esta cuenta no tiene permiso para usar la app; revisa *Público* en Google Cloud»). |
| Alumnos por perfil | Un aula por perfil; se pueden invitar **varios correos** (p. ej. la tablet y el celular del niño con cuentas distintas). Un dispositivo de alumno tiene **un solo** perfil. |
| Qué publica y acepta cada lado | **Solo del adulto** (`ALMACENES_SOLO_ADULTO`): `palabras`, `frases`, `libros`, `calcomaniasPropias`, `premios`, `medios`. El alumno los acepta del adulto y nunca los publica. **De los dos** (`ALMACENES_DEL_ALUMNO`): `perfiles` (ajustes, etapa, álbumes cargados), `progresos`, `niveles`, `sesiones`, `respuestas`, `calcomanias`, `movimientos`; gana el `updatedAt` más reciente. |
| Apariencia | El fondo (`ui/fondo.js`, hoy en `localStorage` de cada equipo) viaja en `aula.json` y el alumno lo aplica. Los colores de desarrollo (`dev.js`) no viajan. |
| Registro del alumno | Automático: al entrar con su Gmail y encontrar un aula compartida con él, el dispositivo escribe su `dispositivo-<id>.json` y el adulto lo ve como **«Conectado»**. Antes figura como **«Invitado, aún no entra»**. |
| Novedades | El alumno revisa cada **60 s** (con conexión, token vigente y sin sesión del niño en curso) si cambió `adulto.json` o `aula.json` (`modifiedTime`, una sola llamada de lista) y, si cambió, sincroniza y baja lo nuevo. **No se le avisa al niño** (pantalla tranquila, §2.8): lo nuevo aparece en su lugar (un álbum nuevo, en Álbumes). |
| Nunca sale del modo alumno | En el dispositivo del alumno **no hay modo adulto**: el candado no se muestra, y cualquier ruta `#/adulto/*` (o el candado, si se llegara a él) **lleva a la pantalla principal del niño** (`#/nino`: ▶, álbum, tienda, libros). No hay pantalla de estado ni de desvincular en el dispositivo. |
| Desvincular un dispositivo | Solo desde el celular del adulto, en «Alumnos»: **Desvincular** agrega su `idDispositivo` a `aula.json`. En su siguiente sincronización ese dispositivo borra sus datos locales y vuelve a la pantalla de primer uso. También sirve desinstalar la app o borrar sus datos en el navegador. |
| Token en el dispositivo del alumno | La regla de la fase 7 prohíbe abrir ventanas de Google en modo niño. Excepción solo para el alumno: si el token venció, se renueva en silencio **al tocar ▶** (es un toque, así que el navegador permite la ventana, que se cierra sola). La sesión empieza igual, sin esperar; la sincronización corre al volver al inicio o al premio. Si la renovación silenciosa falla y lleva **más de 24 h** sin sincronizar, el siguiente toque de ▶ abre la ventana de Google con el correo del alumno ya puesto (lo resuelve quien acompañe al niño); si se cierra, la sesión sigue sin conexión. El adulto ve en «Alumnos» hace cuánto sincronizó cada dispositivo. |
| Dispositivo con datos | Solo se convierte en dispositivo de alumno si no tiene perfiles; si tiene, se ofrece borrar los datos del dispositivo (con confirmación que dice que no se puede deshacer). |
| Quitar acceso | En «Alumnos», **Quitar acceso** borra los permisos de ese correo en el aula y en `del-alumno/` (los datos ya traídos al adulto se quedan). El dispositivo del alumno sigue funcionando sin conexión con lo que tiene. |

### Fase 15 — Núcleo puro del aula (sin red ni DOM) ✔ hecha
**Decisiones de implementación (fase 15):**
- `publicaRol('adulto')` = todos los almacenes (en el orden de `ALMACENES_RESPALDO`, `medios` primero); `publicaRol('alumno')` = `ALMACENES_DEL_ALUMNO`. `aceptaDe(a, b)` = `publicaRol(b)`, y vacío si los dos roles son iguales; un rol desconocido lanza error.
- `filtrarEntrantes` devuelve `descartados: { total, porAlmacen }`. Los `medios` solo pasan si el perfil los usa (se calcula con `mediosDelPerfil` sobre lo ya filtrado) **o si son un borrado** (para que el borrado viaje). Un registro sin `perfilId`, un almacén desconocido o que no es lista, se descartan. Los registros borrados del perfil pasan.
- `mediosDelPerfil` solo cuenta registros **vivos** del perfil. `mediosDeRegistro` (en `borrar-perfil.js`) ahora también recorre `colecciones[]` y `base` (`medioPortadaId`/`medioSobreId`): **`borrarPerfil` olvidaba esas portadas y sobres y los dejaba huérfanos; queda arreglado** (premios y calcomanías propias ya se cubrían por sus `medioImagenId`).
- `estadoDeAlumnos({ invitados, permisos: { aula, delAlumno }, dispositivos, ahora })` → `{ alumnos: [{ email, estado, dispositivos }], permisosExtranos, dispositivosInvalidos }`. Permitido: en el aula, dueño y lectores invitados; en `del-alumno/`, dueño y lectores o editores invitados (el lector es el heredado). Todo lo demás (`anyone`, `domain`, `group`, otro correo, un editor en el aula) es «extraño». Sin `permisos` no se evalúa «sin acceso» ni extraños.
- `fusionarConAjeno({ locales, propios, ajenos, soloLectura })` → `{ resultado, paraLocal, paraPropio }`; en empate gana lo local. `fusionarAlmacen` no cambia. Extras de `aula.js`: `nuevaAula`, `nuevoDispositivo`, `armarArchivoAula` y nombres de archivo. Pruebas en `tests/aula.test.js`.
- **`core/aula.js`** (nuevo, puro, con pruebas):
  - `ALMACENES_SOLO_ADULTO`, `ALMACENES_DEL_ALUMNO`, `publicaRol(rol)` y `aceptaDe(rolLocal, rolRemoto)` → qué almacenes escribe cada lado y cuáles acepta del otro (rol `'adulto'` o `'alumno'`).
  - `filtrarEntrantes({ almacenes, perfilId, aceptados })` → `{ almacenes, descartados }`: deja solo los almacenes aceptados y los registros de ese perfil (en `perfiles`, solo el suyo); cuenta lo descartado.
  - `mediosDelPerfil({ perfil, registros })`: ids de medios que usa el perfil. Reutiliza `mediosDeRegistro` de `core/borrar-perfil.js` **y además** recorre lo anidado que hoy no mira: `perfil.colecciones[].medioPortadaId / medioSobreId`, `perfil.fotoMedioId`, premios, calcomanías propias. (Si `borrarPerfil` también olvida esos medios, arreglarlo en la misma fase y avisarlo.)
  - Formatos y validación de `aula.json` (`{ formato: 'leo-conmigo-aula', version: 1, perfilId, nombre, dueno: { email }, apariencia: { fondo }, desvinculados: [idDispositivo], actualizado }`), de `adulto.json` / `alumno.json` (mismo formato que `data.json` de `core/sync.js`, con `perfilId` y `rol`) y de `dispositivo-<id>.json` (`{ formato: 'leo-conmigo-dispositivo', version: 1, idDispositivo, email, nombre, versionApp, primeraConexion, ultimaSync }`).
  - `estadoDeAlumnos({ invitados, permisos, dispositivos, ahora })` → por correo: `'invitado' | 'conectado' | 'sin acceso'`, sus dispositivos, hace cuánto sincronizó cada uno, y `permisosExtranos` (los que la app no puso, según la tabla de seguridad).
- **`core/sync.js`:** sin cambiar lo de hoy, una función pura que une **tres** fuentes: `fusionarConAjeno({ locales, propios, ajenos })` (lo de aquí, mi archivo en Drive, el archivo del otro lado ya filtrado) → qué escribir aquí y qué publicar en mi archivo. Lo de hoy (`fusionarAlmacen`) queda idéntico: las pruebas actuales siguen pasando sin tocarlas.
- **Acepta si:** pruebas de las listas de almacenes, `filtrarEntrantes` (registro de otro perfil, otro perfil en `perfiles`, almacén de solo adulto enviado por el alumno, `medios` del alumno → todo descartado), `mediosDelPerfil` (incluidas portadas y sobres), validaciones (formato ajeno, versión más nueva, perfil que no coincide), `estadoDeAlumnos` (incluido un permiso `anyone` y un `writer` en el aula como extraños) y `fusionarConAjeno` con borrados y conflictos. `npm test` en verde.

### Fase 16 — Drive en carpetas compartidas y sincronización del aula ✔ hecha
**Decisiones de implementación (fase 16):**
- **Nada de esto está enlazado todavía a la app** (ninguna pantalla importa `aulas.js`): por eso no se tocaron `PRECACHE` ni `VERSION`. La fase 18 debe agregar a `PRECACHE` `js/aulas.js`, `js/sync-aula.js`, `js/store-perfil.js`, `js/core/aula.js` y subir `VERSION`.
- **`aulas.js` es una fábrica** `crearAulas({ store, obtenerToken, fetchFn, emailAdulto, idDispositivo, versionApp, … })` (no funciones sueltas), para poder probarla con dos cuentas. Adulto: `asegurarCarpetaDeTrabajo`, `crearAula(perfil)`, `invitar`, `quitarAcceso`, `desvincularDispositivo`, `cambiarApariencia`, `revisarPermisos`, `quitarPermisoExtrano`, `sincronizarAula(perfilId)` (devuelve `{ resumen, alumnos, permisosExtranos }`). Alumno: `buscarMiAula()` y `sincronizarComoAlumno({ aula, email })`, que **también registra** el dispositivo (no hay `registrarDispositivo` aparte) y devuelve `{ desvinculado: true }` sin sincronizar si el adulto lo desvinculó. `meta.aulas` es un objeto `{ [perfilId]: { perfilId, carpetaId, carpetaAlumnoId, invitados } }`.
- **`drive.js`:** `crearDriveCarpeta` (atado a una carpeta; 403/404 → `ErrorDrive.sinAcceso`) y `crearDriveAulas` (`buscarCarpeta`, `crearCarpeta`, `buscarAulasCompartidasConmigo`, `compartir`, `permisos`, `quitarPermiso`); `compartir` solo acepta `reader`/`writer`, `type: 'user'` y un correo válido. `crearDrive` (appDataFolder) conserva su comportamiento (se extrajo `crearPedidor`). Drive muestra **vacía** una carpeta que no se comparte con la cuenta: sin `aula.json` en el listado, el alumno recibe `ErrorAula` con `sinAcceso`.
- **Cada lado solo recibe del otro métodos de lectura** (`soloLeer`): el alumno no tiene escritura sobre el aula y el adulto no escribe en `del-alumno/`. El adulto lee **todos** los `alumno.json` y `dispositivo-*.json` cuyo dueño es un correo invitado (tablet y celular con cuentas distintas); los de otros dueños se ignoran con un aviso. Los archivos del otro lado inválidos (formato, rol, perfil, JSON roto) se **ignoran con un aviso**, no detienen la sincronización; el archivo propio que no se entiende sí la detiene (`ErrorSync`).
- **`sync-aula.js`:** el adulto sube los medios al aula; el alumno solo los baja (los registros de medios del alumno nunca se aceptan). `armarArchivoAula` es lo único que decide qué publica cada lado. Medios ya sincronizados alguna vez se guardan en `aula:<perfilId>:idsMediosConocidos` y `vistaDePerfil` los sigue viendo, así un borrado viaja y no resucita. La cola y la meta de la sincronización personal no se tocan (la meta del aula lleva prefijo).
- **`estadoDeAlumnos`:** un permiso extraño del aula que se hereda a `del-alumno/` se cuenta una sola vez (el mismo `id`).
- **`auth.js`:** `ALCANCES_AULA`, `pedirPermisoAulas()` (alcance `drive` + `include_granted_scopes`, y si se desmarca la casilla lanza un error que lo explica), `tienePermisoAulas()` (recordado en `localStorage`; las renovaciones lo conservan), `renovarAlTocar({ interactiva })` y `MENSAJE_ACCESO_DENEGADO` para `access_denied`.
- **Pruebas:** `tests/drive-falso.js` ganó `crearNubeFalsa()` (varias cuentas, carpetas anidadas, permisos heredados, `sharedWithMe`, 401/403/404 como Drive); `crearDriveFalso()` quedó igual para las pruebas de la fase 7. Nuevas: `tests/aulas.test.js` y `tests/auth-aula.test.js`. `js/sync.js` y las pruebas de la fase 7 no cambiaron.
- **`auth.js`:** `ALCANCES_AULA` (los de hoy + `drive`) y `pedirPermisoAulas()` (ventana con `scope` + `include_granted_scopes`, desde un toque); `tienePermisoAulas()` revisa con `google.accounts.oauth2.hasGrantedAllScopes` (el usuario puede desmarcar la casilla: avisarlo con claridad). `renovarAlTocar({ interactiva })` para el alumno (ver «Token»). Mensaje propio para `access_denied` (cuenta rechazada por Google: ver «Modo Prueba / producción»).
- **`drive.js`:** `crearDriveCarpeta({ obtenerToken, carpetaId })` con **la misma interfaz** que usa el sincronizador (`listar` con `modifiedTime` y `owners`, `leerJson`, `leerBlob`, `crear`, `actualizar`, `borrar`), atada a **una** carpeta (`'<carpetaId>' in parents`, y `crear` siempre con `parents: [carpetaId]`). Más: `buscarCarpeta({ propiedad, padre })`, `crearCarpeta(nombre, { padre, propiedades })`, `buscarAulasCompartidasConmigo()` (carpetas con la propiedad pública `leoConmigo = 'aula'` y `sharedWithMe`), `compartir(carpetaId, email, rol)` (solo `'reader'` o `'writer'`, `type: 'user'`, con aviso por correo y un mensaje corto; cualquier otro valor lanza error), `permisos(carpetaId)`, `quitarPermiso(carpetaId, permisoId)`. Un 403/404 de una carpeta = «sin acceso al aula» (error propio).
- **`store-perfil.js`** (nuevo, `js/`): `vistaDePerfil(store, perfilId, { idsMediosConocidos })`: solo ve los registros del perfil (`perfiles` → el suyo; `medios` → los de `mediosDelPerfil` **más** los ya sincronizados alguna vez, guardados en meta, para que un medio borrado no «resucite»); `importar` **rechaza** registros de otro perfil; la meta lleva prefijo `aula:<perfilId>:`; `pendientesSync` filtra la cola por los registros del perfil y `limpiarCola` no la toca (la cola es de la sincronización personal).
- **`sync-aula.js`** (nuevo, `js/`): `crearSincronizadorDeAula({ store, rol, aula, carpetaAula, carpetaAlumno })`, armado con las mismas piezas y protecciones que `js/sync.js` (una ejecución a la vez, primero los medios y al final el JSON, gana lo local si cambió durante la sincronización, nunca pisa un JSON que no entiende). Adulto: lee `del-alumno/alumno.json` (filtrado), escribe `adulto.json` y sube medios al aula. Alumno: lee `adulto.json`, baja medios del aula, escribe solo en `del-alumno/` (`alumno.json` y su `dispositivo-<id>.json`). `js/sync.js` no cambia.
- **`aulas.js`** (nuevo, `js/`): `asegurarCarpetaDeTrabajo()` (busca o crea `Leo Conmigo/` y comprueba que sea privada), `crearAula(store, perfil)` (carpeta del aula + `del-alumno/` + `aula.json`; guarda `{ perfilId, carpetaId, carpetaAlumnoId, invitados: [] }` en `meta` `aulas`), `invitar(perfilId, email)` (lector en el aula + editor en `del-alumno/`), `quitarAcceso`, `desvincularDispositivo`, `revisarPermisos`, `sincronizarAula(perfilId)` (adulto); `buscarMiAula()`, `sincronizarComoAlumno()` y `registrarDispositivo()` (alumno).
- **Pruebas:** ampliar `tests/drive-falso.js` a **varias cuentas** (dueño, alumno A, alumno B, un tercero) con carpetas anidadas, propiedades, `owners`, permisos heredados (lector en el aula → lector en `del-alumno/`, más el editor directo) y `sharedWithMe`; el Drive falso **debe rechazar** (403) lo que Drive real rechazaría. Escenarios:
  - el adulto crea dos aulas e invita a A y a B; A solo encuentra la suya; B solo la suya; el tercero ninguna;
  - A baja todo (palabra con foto y voz, libro, álbum cargado con portada y sobre) y se registra;
  - A **no puede** actualizar `adulto.json`, `aula.json` ni un `medio-*`, ni crear archivos en el aula, en la carpeta de trabajo ni en el aula de B (403 del Drive falso, y la app no lo intenta);
  - A juega sin conexión y al volver sube sesión y respuestas, que aparecen en el almacén del adulto con el mismo `perfilId`;
  - un `alumno.json` manipulado (con una palabra, un medio, un registro del perfil de B o un perfil ajeno) no cambia nada de eso en el adulto y deja un aviso;
  - el adulto agrega un álbum y A lo recibe; un medio borrado por el adulto desaparece en A y no vuelve;
  - un permiso `anyone` agregado a mano aparece como «Permiso extraño»; quitar acceso y desvincular funcionan.
- **Acepta si:** todo lo anterior en `npm test`, y las pruebas de la sincronización personal (fase 7) siguen pasando sin cambios.

### Fase 17 — Pantalla «Alumnos habilitados» del adulto ✔ hecha
**Decisiones de implementación (fase 17):**
- **Archivos:** `js/adulto/alumnos.js` (ruta `#/adulto/alumnos`, enlace «Alumnos (n conectados)» en el panel), cambios en `js/nube.js`, `js/aulas.js` (`listarAulas`, `huboCambios`), `js/app.js`, `css/app.css`. `PRECACHE` ya incluye los módulos de las fases 15 a 17 y `VERSION` pasó a 0.34.0.
- **`nube.js`:** `sincronizarAhora()` hace primero la sincronización personal (ahora `sincronizarPersonal`, sin cambios de comportamiento) y después `sincronizarAulas()`, una aula tras otra y sin lanzar nunca: el error de un aula queda en su estado y no frena a las demás ni a la personal. Estado por aula observable con `observarAulas`; `obtenerAulas()` da las operaciones (crear, invitar, quitar…). La revisión cada 60 s (`revisarAlumnos`) hace **una llamada de lista** de `del-alumno/` y solo sincroniza el aula si cambió el `modifiedTime` de algún `.json` del alumno (o de sus dispositivos); se salta con la app oculta, sin conexión, sin token vigente (y sin modo adulto) o durante `#/nino/sesion`.
- **«Cambios por subir al aula»:** la cola de sincronización pertenece a la sincronización personal y se vacía con ella; para el aula se cuentan los elementos de la cola de ese perfil con fecha posterior a `aula:<perfilId>:syncUltimo`. Es un aviso orientativo.
- **Habilitar:** pide el permiso de Drive si falta (desde el toque), crea el aula con el fondo actual (`leerFondo()`) y hace la primera sincronización con barra «Subiendo imágenes y audios (n de m)…». `aula.json` solo se reescribe al desvincular o con `cambiarApariencia(perfilId, fondo)` (ya existe; **falta llamarlo cuando el adulto cambia el fondo**: pendiente para la fase 18, que es cuando el alumno lo aplica).
- **Seguridad extra encontrada al probar:** `sync-aula.js` filtra también **el archivo propio** con `filtrarEntrantes` (antes solo el ajeno): un `alumno.json` manipulado con la cuenta del alumno hacía fallar la sincronización de ese dispositivo al llegar un registro de otro perfil a `importar`. Ahora se ignora lo ajeno, se avisa y el archivo se limpia en la misma sincronización.
- **Prueba en el navegador:** `tests/navegador/simular-aulas.js` instala un Google falso y la nube de varias cuentas (`crearNubeFalsa`) en la página del adulto; el alumno se simula en la misma página con `js/aulas.js` y un almacén en memoria (no hay aún dispositivo de alumno: la prueba con dos orígenes `localhost` / `127.0.0.1` es de la fase 18, porque la nube falsa vive en la memoria de una sola página).
- Ruta adulta `#/adulto/alumnos` (botón en el panel, con el número de conectados). Por cada perfil: «Habilitar alumno» → pide permiso de Drive si falta → crea la carpeta de trabajo si no existe, el aula y la primera sincronización (con barra «Subiendo imágenes y audios (n de m)…»; puede tardar con cientos de voces).
- Agregar correo (validación simple), lista de alumnos con su estado (**Invitado, aún no entra** / **Conectado** · hace cuánto sincronizó cada dispositivo · versión de la app / **Sin acceso**), **Quitar acceso** y **Desvincular dispositivo** (con confirmación), **Sincronizar ahora**, **Ver estadísticas** (fija el perfil activo y abre `#/adulto/progreso`; desde ahí, Análisis como siempre) y los avisos de **Permiso extraño** y de datos descartados del alumno.
- Un recuadro «Qué puede ver el alumno» con la tabla de seguridad en palabras simples, y las instrucciones: «En el dispositivo del niño: instala la app, toca *Este dispositivo es de un alumno* y entra con el Gmail que invitaste».
- **`nube.js`:** tras la sincronización personal, sincroniza cada aula del adulto con las reglas de disparo de la fase 7 (al abrir, al volver la conexión, al volver a la app) más la revisión de 60 s del `modifiedTime` de `alumno.json`, para traer las sesiones nuevas. Un fallo en un aula no detiene las demás ni la personal; el estado de cada aula se ve en «Alumnos». Al editar cualquier cosa del perfil, el aula queda «con cambios por subir».
- `aula.json` se reescribe cuando cambia el fondo o se desvincula un dispositivo.
- **Acepta si:** en el navegador con el Google y Drive simulados (o reales si ya están los orígenes autorizados): habilitar, invitar, ver «Invitado» → «Conectado» cuando un segundo origen (`127.0.0.1:8080` como alumno) entra, quitar acceso, desvincular; una sesión jugada en el alumno aparece en Progreso del adulto; no aparece el texto «null» (ver CLAUDE.md).

### Fase 18 — Dispositivo del alumno ✔ hecha
**Decisiones de implementación (fase 18):**
- **Archivos:** `js/core/dispositivo-alumno.js` (reglas puras, con `tests/dispositivo-alumno.test.js`), `js/nube-alumno.js` (la nube del alumno), `js/nino/primer-uso.js` (primer uso y descarga), cambios en `js/acceso.js`, `js/contexto.js`, `js/nube.js`, `js/nino/inicio.js`, `js/app.js`, `js/aulas.js` (`huboCambiosDelAdulto`), `css/app.css`. `PRECACHE` al día y `VERSION` 0.35.0.
- **Rol:** `localStorage.leo_rol = 'alumno'` (lo lee `esAlumno()` al instante). Se pone al **empezar** la configuración (al tocar «Entrar con Google»), no al terminar, para que la sincronización personal no corra con la cuenta del alumno; si no se llegó a descargar nada, se quita. `meta.rol = 'alumno'` se escribe al terminar la descarga. `adultoHabilitado()` es `false` en modo alumno aunque `sessionStorage` diga lo contrario y `habilitarAdulto()` no hace nada; el candado no se dibuja y toda `#/adulto/*` termina en `#/nino`. `nube.js` no sincroniza lo personal (`refrescarEstado`, `sincronizarAhora`, `revisar`, `revisarAlumnos`) si `esAlumno()`. `perfilActivo()` no completa voces en el alumno (son del adulto y no las publica).
- **Primer uso:** «Soy el adulto» (candado + instalar, como antes) y «Este dispositivo es de un alumno» → «Entrar con Google» (un solo toque: `pedirPermisoAulas` con el permiso del aula) → aulas compartidas con ese correo (ninguna: «Pídele a tu adulto que invite a *correo*» + «Buscar otra vez»; una: se toma; varias: se elige por nombre) → descarga con barra «Bajando imágenes y audios (n de m)…» → recarga y queda como alumno. Si se corta, `meta.alumnoAula` guarda el aula y al volver aparece «Seguir descargando» (la sincronización es segura de repetir; probado). Cuenta de Google y permisos: `localStorage` (`leo_cuenta_google`, `leo_permiso_aulas`).
- **Sincronización del alumno (`nube-alumno.js`):** solo el aula; nunca durante `#/nino/sesion`, sin conexión, con la app oculta o sin token vigente, y nunca abre ventanas por su cuenta (el token de las llamadas de Drive no se renueva solo). Se intenta al abrir (si hay token), al volver la conexión o a la app, al llegar a `#/nino` o `#/nino/premio` (1,5 s después), y cada 60 s si cambió el `modifiedTime` de `adulto.json` o `aula.json` (una llamada de lista). Al tocar ▶ (`alTocarJugar`) se renueva el token sin esperar (silenciosa; interactiva solo si ya falló y lleva más de 24 h). Como el token vive en memoria, tras recargar la app no hay sincronización hasta el primer ▶; es el comportamiento pedido en «Token en el dispositivo del alumno».
- **Aplicar lo que llega:** el fondo de `aula.json` se aplica en cada sincronización. Perfil y ajustes se escriben en el almacén y los toma la siguiente pantalla que se monte. Si el `idDispositivo` está en `desvinculados`, borra la base, `localStorage`, `sessionStorage` y la cuenta, y vuelve al primer uso con un `idDispositivo` nuevo (si no, volvería a quedar desvinculado).
- **Convertir un dispositivo con datos (cerrado en 0.35.1):** botón «Convertir este dispositivo en celular de alumno» en `#/adulto/cuenta`. La confirmación (`textoConfirmarConversion`, pura) dice que se borran perfiles, palabras, fotos, voces y progreso, que no se puede deshacer, sugiere copia de seguridad o comprobar la sincronización y avisa de los cambios sin subir (o de que no hay cuenta). Luego `convertirEnDispositivoDeAlumno()` = `olvidarTodo()` + `leo_rol = 'alumno'` + recarga: el primer uso aparece ya en «Entrar con Google» del alumno.
- **Fondo en `aula.json` (cerrado en 0.35.1):** `adulto/fondo.js` llama a `publicarFondoEnAulas()` (`nube.js`), con una pausa de 1,5 s (el selector avisa muchas veces seguidas) y para cada aula; no escribe si el fondo no cambió ni sin cuenta, permiso o conexión, y un fallo en un aula no detiene las demás. El alumno lo recibe por la revisión de 60 s (el `modifiedTime` de `aula.json` cambió).
- **Pruebas en el navegador con dos orígenes:** `tests/servidor.py` guarda el estado de la nube simulada (`/__nube/estado`) y `tests/navegador/simular-aulas.js` lo comparte entre `localhost:8080` (adulto) y `127.0.0.1:8080` (alumno); `crearNubeFalsa` ganó `exportar()` / `importar()`. Si tras recargar el adulto el Google falso no entra a tiempo, quitar `leo_modo_adulto` antes de recargar y volver a ponerlo tras `instalar()`.
- **Primer uso:** si no hay perfiles, la pantalla inicial ofrece dos botones grandes: «Soy el adulto» (lo de hoy) y **«Este dispositivo es de un alumno»**. El segundo: iniciar sesión con Google (con el permiso del aula) → buscar aulas compartidas con ese Gmail → si hay una, se toma; si hay varias, se elige por nombre; si no hay ninguna: «Pídele a tu adulto que invite a *correo*» con «Buscar otra vez».
- **Descarga completa** con barra de progreso («Bajando imágenes y audios (n de m)…») y aviso de que no cierre la app; al terminar, `meta.rol = 'alumno'` (copiado también en `localStorage` para que el router lo sepa al instante), perfil activo fijado, `registrarDispositivo()` y `pedirAlmacenamientoPersistente()`. Si se corta, al volver retoma (la sincronización es segura de repetir).
- **Nunca sale del modo alumno:** el candado no se dibuja; el router manda **todas** las rutas `#/adulto/*` a `#/nino` (`guardia` = `adultoHabilitado() && !esAlumno()`, `siNoPasa: '/nino'`), y si algo llama a `habilitarAdulto()` en modo alumno no tiene efecto. No se ofrece cambiar de perfil. Lo único que ve el niño es su pantalla principal y lo que sale de ella (sesión, premio, álbumes, tienda, libros).
- **Sincronización del alumno:** solo el aula (nunca `appDataFolder`); al abrir, al volver la conexión, al terminar cada sesión (en el premio o el inicio) y la revisión de 60 s; **nunca durante** `#/nino/sesion`. Al tocar ▶ con el token vencido, `renovarAlTocar()` sin hacer esperar al niño (ver «Token»). Cada sincronización actualiza `ultimaSync` en su `dispositivo-<id>.json`.
- **Aplicar lo que llega:** fondo de `aula.json`; perfil y ajustes nuevos entran en la siguiente pantalla que se monte (nunca a mitad de sesión: §4 y fase 14). Si su `idDispositivo` está en `desvinculados`, borra la base (`indexedDB.deleteDatabase`), olvida la cuenta y vuelve al primer uso. Si el adulto quitó el acceso, la app sigue andando sin conexión.
- **`sw.js`:** agregar a `PRECACHE` los archivos nuevos y subir `VERSION` en `js/config.js` (regla de CLAUDE.md).
- **Acepta si**, en el navegador (dos orígenes: adulto en `localhost:8080`, alumno en `127.0.0.1:8080`, con espías de voz y vibración):
  - el alumno se configura, baja todo, y **sin conexión** juega una sesión completa con fotos, voces y su álbum;
  - no hay forma de llegar a una pantalla adulta: `location.hash = '#/adulto/ajustes'` (con y sin `leo_modo_adulto` en `sessionStorage`) termina en `#/nino`, y no hay candado en pantalla;
  - al reconectar, la sesión aparece en Progreso y Análisis del adulto;
  - el adulto carga un álbum nuevo y cambia un ajuste → el alumno los tiene a los ≤ 60 s (o al volver a la app) sin tocar nada, y nunca a mitad de una sesión;
  - desvincular desde el adulto deja el dispositivo del alumno como recién instalado.

### Fase 19 — Pulido, ayuda y prueba real ✔ hecha (queda la lista del usuario)
**Decisiones de implementación (fase 19, 0.36.0):**
- **Ayuda** (`#/adulto/ayuda`): apartado «Alumnos con su propio celular» con cómo habilitar (y por qué se pide el permiso de Drive), qué ve y qué no el alumno, quitar acceso / desvincular / convertir un dispositivo, el aviso «Google no verificó esta app» (Configuración avanzada → Ir a Leo Conmigo) y la referencia a `docs/google-cloud.md`. **Acerca de** suma lo del aula y el enlace a la política.
- **`privacidad.html`** en la raíz (modelo: la de ZenBan): datos que usa (fotos, voces y progreso, correo de Google, `appDataFolder` y carpetas de aula), para qué, sin analítica ni terceros salvo Google y ARASAAC, aulas compartidas solo con los correos invitados en solo lectura (salvo `del-alumno/`), cómo quitar acceso y borrar. Está en `PRECACHE`. **Corrección en `sw.js`:** toda navegación se servía con la clave `index.html`, así que abrir `privacidad.html` habría mostrado la app y, peor, habría pisado `index.html` en la caché; ahora esa página se sirve como su propio archivo.
- **`docs/google-cloud.md`** revisada: los permisos (`drive.appdata`, `drive`, `openid`, `email`, `profile`), la URL de privacidad (`.../leo-conmigo/privacidad.html`, ya existe) y el mensaje de `access_denied` coinciden con `js/auth.js`. `README.md` explica cómo habilitar alumnos y enlaza la guía.
- **Pruebas en el navegador:** `tests/servidor.js` (servidor de Node, con la nube compartida) es la alternativa a `tests/servidor.py` cuando hace falta el service worker: el de Python resetea conexiones al precachear ~1200 archivos y el worker no se instala. Con el service worker activo, `tests/navegador/simular-aulas.js` marca cada lectura de `/__nube/estado` con una URL distinta (si no, el worker sirve el estado viejo).

**Lista para el usuario (NO hecha; no marcar hasta que la haga):**
1. [ ] Seguir [docs/google-cloud.md](docs/google-cloud.md): orígenes autorizados del cliente «MindSpark» (`https://mindsparkapps.github.io`, `http://localhost:8080`, `http://127.0.0.1:8080`).
2. [ ] En Google Cloud: permisos `drive.appdata`, `drive`, `openid`, `email`, `profile` y la API de Drive habilitada.
3. [ ] Marca: página principal, política de privacidad `https://mindsparkapps.github.io/leo-conmigo/privacidad.html` y dominio autorizado (la página tiene que estar publicada para esto).
4. [ ] Publicar la app (Público → En producción) y elegir la opción A (sin verificar, hasta 100 usuarios) o B (verificación con CASA).
5. [ ] Subir el repositorio y publicar en GitHub Pages (`git push`: lo hace el usuario).
6. [ ] Probar con dos teléfonos reales: Android (Chrome) y, si hay, iPhone (Safari); con un Gmail que no sea usuario de prueba. Revisar sobre todo: la ventana de Google al tocar ▶ con el token vencido, el audio y el almacenamiento persistente.
- Ayuda del adulto (`#/adulto/ayuda`): cómo habilitar un alumno, el permiso de Drive (por qué se pide), qué ve y qué no ve el alumno (la tabla de seguridad), cómo quitar el acceso y desvincular, y un enlace a la guía de Google Cloud.
- Página pública de privacidad `privacidad.html` (la pide Google para publicar la app; ver la guía) y «Acerca de»: las fotos y voces del niño también están en una carpeta del Drive del adulto **compartida solo con los correos que él invitó, en solo lectura**; el alumno escribe únicamente su propia subcarpeta.
- `README.md` y el estado en `CLAUDE.md`.
- Lista para el usuario (no la hace Sonnet): seguir [docs/google-cloud.md](docs/google-cloud.md) (alcance `drive`, orígenes autorizados, publicar la app) y probar con dos teléfonos reales (Android Chrome y, si hay, iPhone Safari).
- **Acepta si:** `npm test` en verde, la prueba de punta a punta de la fase 18 repetida tras `location.reload()` y con el service worker nuevo, y la ayuda revisada.

### Fuera de alcance (preguntar antes si hace falta)
- Que un alumno tenga varios perfiles, o que un adulto gestione alumnos de otro adulto (co-terapeutas).
- Avisos al niño de «hay algo nuevo», notificaciones push o correo propio de la app (Drive ya manda el aviso de carpeta compartida).
- Pasar la verificación completa de Google (con evaluación de seguridad CASA) o rediseñar con `drive.file` + Google Picker: ver la guía.
- Optimización opcional (solo si la primera subida resulta muy lenta): las voces del catálogo (`origen: 'catalogo'`) podrían bajarse desde los mp3 de la app en vez de Drive, guardando su ruta en el medio.

## Ampliación 4 — Fases 20 a 26: cursos, biblioteca común, contenido de la familia y limpieza de Drive (pedida el 2026-11-16, aprobada por el usuario el 2026-11-16 con los cambios de «Lo que agregó el usuario al aprobar»)

> **Para Sonnet:** lee antes la Ampliación 3 completa (sobre todo «Quién puede tocar qué», que sigue siendo obligatoria y aquí se amplía), `js/core/aula.js`, `js/aulas.js`, `js/sync-aula.js`, `js/nube.js`, `js/nube-alumno.js`, `js/medios.js` y `js/core/borrar-perfil.js`. Una fase a la vez, con su lista de aceptación, `graphify update .` y un commit. Si algo choca con la tabla de seguridad, gana la tabla; si no está definido aquí, pregunta.

### Qué pidió el usuario (al probar la Ampliación 3 con un celular real)
1. **Los audios son iguales para todos y son de solo lectura:** no deben duplicarse por cada perfil ni por cada aula. No existen audios propios de un curso.
2. **Las imágenes de los álbumes tampoco** deben duplicarse.
3. **«Niño» y «alumno» es redundante:** un niño es un alumno. El **perfil** es algo como un **curso**: define qué se ve (palabras, frases, libros, álbumes, ajustes). **Varios alumnos** pueden usar el mismo perfil y **cada uno tiene su propio avance y sus propias estadísticas**.
4. Si la **familia** del alumno configura en **su celular** audios, libros o álbumes propios, eso **no sube al Drive del adulto**: queda en el **Drive del alumno**. Al adulto solo le interesan **las estadísticas**.

### Lo que agregó el usuario al aprobar (obligatorio; manda sobre cualquier otra parte de esta ampliación)
1. **El celular del alumno sí descarga y guarda en local** todos los audios e imágenes de su perfil (también las voces del catálogo, las láminas, portadas, sobres y calcomanías de los álbumes) y todas las configuraciones del perfil (ajustes, álbumes, etapas, fondo), para funcionar sin conexión. «Sin copias» se refiere solo al **Drive del adulto**, nunca al almacenamiento del celular.
2. **Las estadísticas del contenido de la familia sí le llegan al adulto**, a través de los archivos que el alumno escribe con su cuenta (su carpeta `alumnos/<correo>/`). El adulto **no** baja el material de la familia (fotos, voces) salvo que lo pida con un **botón** («Traer el material de la familia»), y puede **quitarlo de su celular** con otro botón sin borrarlo del Drive del alumno ni del celular del alumno.
3. **Limpieza de lo redundante:** las sincronizaciones de las versiones anteriores dejaron copias repetidas en el Drive del adulto. El adulto debe poder **ver qué quedó** (qué archivos, cuántos, cuánto pesan, dónde) y **eliminarlo** con confirmación. Es la fase 26.
4. **(Corrección del usuario a la fase 24; manda sobre el resto)** «Además de poder crear álbumes completos puede crear premios para la tienda y dar monedas: las funciones de tienda y álbumes deben estar completas para la familia.» En el celular del alumno, **Tienda y Álbum están completos para la familia**: crear álbumes completos (portada, sobre y láminas), crear premios en la Tienda y dar monedas. Todo se guarda con `origen: 'familia'`, sus medios van a `familia/` en el Drive del alumno (nunca al Drive del adulto ni a la Biblioteca), entra en el respaldo del alumno y se recupera al reinstalar. **Lo del curso sigue de solo lectura** para la familia. Al adulto le llegan, como estadística en la ficha del alumno: el **saldo**, las **monedas dadas por la familia**, los **premios canjeados** y el **avance en los álbumes de la familia**; sus imágenes solo con «Traer el material de la familia». Las monedas y los álbumes de la familia usan `core/album.js` y `js/albumes.js` (sin recalcular saldos aparte): el saldo del alumno es **uno solo** = monedas ganadas jugando + monedas dadas por la familia − lo canjeado.
   - **Respuesta del usuario sobre el orden («Todo mezclado»):** los álbumes y los premios del curso y de la familia van **en un solo orden por fecha de creación**, sin separarlos en grupos; lo de la familia lleva la etiqueta «De la familia». Aprobado también: los álbumes de la familia viven en un almacén nuevo `colecciones` (con `origen: 'familia'`; su portada y sobre son medios de la familia y sus láminas son `calcomaniasPropias` con `coleccionId`), y las monedas de la familia son movimientos `regalo` en el saldo único.
   - **Regla de fecha (confirmada por el usuario vía su sesión):** lo que ya existe sin `creado` (el álbum de la app, los álbumes cargados del curso y los premios actuales) cuenta como lo más antiguo y conserva su orden de siempre: primero el álbum de la app, después los álbumes cargados en su orden, los premios por su `orden`. Todo lo **nuevo**, del curso o de la familia, lleva `creado` y se ordena por fecha detrás de eso.
5. **En el celular del alumno no hay un «modo familia» aparte:** el candado lleva a una **pantalla principal de adulto igual a la del adulto, pero con el menú reducido** (ver la fila «Menú adulto en el celular del alumno»).

### Lo que se encontró al revisar el código
- Los **audios del catálogo** (las ~900 voces en `data/voces/*.mp3`) **ya vienen dentro de la app** (están en `PRECACHE`). Aun así, `ponerVocesIniciales` (`js/medios.js`) los **copia como un medio nuevo por cada perfil**: por eso, al crear un perfil, la app «bajaba los audios otra vez», y después cada copia se sube a Drive (a la carpeta personal y a cada aula).
- Los registros `medios` **no** tienen `perfilId` (son de todo el almacén); lo que se duplica son las **copias en Drive**: una en `appDataFolder` y otra en **cada** aula (`medio-*` dentro de `Alumno · <perfil>/`).
- Hoy un aula es de **un** perfil, y todos los correos invitados escriben el **mismo** avance (el del perfil) en la misma carpeta `del-alumno/`: dos alumnos del mismo perfil mezclarían su progreso.

### La idea
```
Mi unidad (del adulto)
└── Leo Conmigo/                               carpeta de trabajo · NO se comparte con nadie
    ├── Biblioteca/                            leoConmigo='biblioteca' · LECTOR: todos los alumnos invitados a algún curso
    │   └── medio-<id>.<ext>                   UNA copia de cada imagen o audio propio del adulto (fotos, láminas, portadas, sobres, calcomanías, grabaciones)
    ├── Curso · Lectura inicial/               leoConmigo='aula', perfilId · LECTOR: los alumnos de ESTE curso
    │   ├── aula.json                          (versión 2) curso, dueño, apariencia, desvinculados, lista de alumnos
    │   ├── adulto.json                        el contenido del curso (palabras, frases, libros, álbumes, ajustes del curso)
    │   └── alumnos/
    │       ├── victor@gmail.com/              leoConmigo='del-alumno' · EDITOR: solo victor@gmail.com
    │       │   ├── alumno.json                avance y estadísticas de Víctor (también de lo de su familia) + la lista del contenido de la familia (sin medios)
    │       │   ├── dispositivo-<id>.json
    │       │   └── familia/medio-*            fotos y voces de la familia: los crea el celular de Víctor, son de SU cuenta (ocupan su espacio); el adulto los baja solo con un botón
    │       └── sofia@gmail.com/               EDITOR: solo sofia@gmail.com
    └── Curso · Grupo 2/ …

Drive del alumno (su propia cuenta)
└── appDataFolder (oculta, solo la app)        data.json + medio-*: TODO lo de su celular, incluido el contenido de su familia
```
- **Nota (fase 23):** en Drive las carpetas `alumnos/<correo>/` quedan **hermanas** del curso (`Leo Conmigo/Alumnos · X/<correo>/`), no dentro de él, para que ningún alumno herede lectura de la de otro (ver «Decisiones de implementación (fase 23)»). Todo lo demás del dibujo sigue igual.
- **Audios del catálogo: cero copias.** Un medio del catálogo guarda la **ruta** del mp3 de la app (`ruta: 'data/voces/mama.mp3'`) y **no** su blob en Drive. Hay **un solo** medio por ruta para todos los perfiles. Cualquier dispositivo, también el del alumno, lo toma de la app (que ya lo trae precacheado).
- **Imágenes y grabaciones propias del adulto: una sola copia** en `Biblioteca/`, compartida en solo lectura con todos los alumnos invitados. Cada curso solo dice **qué** medios usa (`adulto.json`). Las aulas ya no guardan `medio-*`. (La copia personal en `appDataFolder` sigue igual: es el respaldo del adulto.)
- **Perfil = curso.** El adulto edita el curso como hoy. Cada alumno invitado tiene en el adulto una **ficha de alumno** (un registro nuevo, ver «Datos») con su propio avance. Las pantallas Progreso, «Qué le cuesta» y Álbum del adulto se abren **por ficha** y leen el contenido del curso.
- **El avance viaja en un solo sentido: del alumno al adulto.** El adulto ya no publica avance en el aula (solo contenido del curso). Si un alumno reinstala, recupera su avance desde **su propio Drive** (`appDataFolder` de su cuenta), no desde el del adulto.
- **El celular del alumno guarda todo en local:** baja de la Biblioteca los medios de su curso, saca de la app las voces del catálogo y guarda sus blobs en su almacén, junto con la configuración del perfil. Juega sin conexión como hoy.
- **Contenido de la familia:** en el celular del alumno, el candado abre la **pantalla principal de adulto con el menú reducido**, donde la familia agrega palabras, fotos, voces, frases, libros y álbumes **propios**. Se guarda en el celular y en el Drive del alumno (su `appDataFolder` y su carpeta `alumnos/<correo>/familia/`, que es de su cuenta). El contenido del curso se ve pero **no** se puede cambiar. Las estadísticas de todo (curso y familia) le llegan al adulto; el material de la familia, solo si el adulto lo pide.

### Quién puede tocar qué (obligatorio; reemplaza la tabla de la Ampliación 3)
| Carpeta / archivo | Adulto (dueño) | Alumno invitado (su cuenta) | Otro alumno | Cualquier otra persona |
|---|---|---|---|---|
| `Leo Conmigo/` y el resto del Drive del adulto | todo | **no la ve** | no la ve | no la ve |
| `Biblioteca/` (`medio-*`) | todo | **solo lectura** | solo lectura (también es invitado) | no la ve |
| `Curso · X/`: `aula.json`, `adulto.json` | todo | **solo lectura** si está invitado a X | no la ve si no está invitado a X | no la ve |
| `Curso · X/alumnos/<su correo>/` (incluida `familia/`) | lee todo; **no** borra ni cambia los archivos del alumno | **editor** (solo la suya) | **no la ve** | no la ve |
| `appDataFolder` del alumno | **no la ve** | todo (solo la app) | no la ve | no la ve |

Reglas para la implementación (además de las de la Ampliación 3, que siguen):
- `Biblioteca/` se comparte con `role: 'reader'` a cada correo invitado a **algún** curso, y ese permiso se quita cuando el correo ya no está en **ningún** curso. Nunca `writer`, nunca `anyone`.
- En `Biblioteca/` solo van medios **del adulto**. Nunca la foto de un alumno ni nada que venga de un celular de alumno (los `medios` del alumno siguen sin aceptarse). **Consecuencia que acepta el usuario:** un alumno invitado puede, fuera de la app, abrir cualquier archivo de la Biblioteca (también los que usa otro curso); la app solo le muestra los de su curso. La ayuda y `privacidad.html` lo dicen.
- `alumnos/<correo>/` se comparte como `writer` **solo** con ese correo (el permiso de lector del curso se hereda, y está bien). El adulto solo lee de cada subcarpeta los archivos cuyo dueño sea **ese** correo.
- Del archivo del alumno, el adulto acepta solo `ALMACENES_DEL_ALUMNO`, los guarda bajo **la ficha de ese correo** (nunca bajo el curso ni bajo otra ficha) y descarta lo demás con aviso, como hoy.
- El celular del alumno **nunca** publica en el aula contenido **del curso**, y el contenido de la familia solo en su propia subcarpeta: en `alumno.json` como la lista `contenidoFamilia` (palabras, frases, libros y álbumes con `origen: 'familia'`, sin blobs) y sus medios en `familia/`. El adulto guarda esa lista aparte (solo para mostrar estadísticas: nombres de palabras y frases), **nunca** la mezcla con el contenido del curso ni la publica en el aula. `filtrarEntrantes` y `armarArchivoAula` lo garantizan, con pruebas.
- El adulto **nunca borra** archivos de `alumnos/<correo>/` (son del alumno): «Quitar de mi celular» solo borra la copia local del adulto.

### Decisiones tomadas (por defecto; el usuario puede cambiarlas al aprobar)
| Tema | Decisión |
|---|---|
| Nombres en la interfaz | **«Perfil»** sigue siendo la palabra para lo que el adulto configura (en «Alumnos» se aclara: «perfil (curso)»). **«Alumno»** es quien juega con su cuenta. Se quita «niño» donde se refiere al perfil (p. ej. «Alumno · Pedro» → «Curso · Pedro»; «el alumno de Pedro» → «los alumnos del perfil Pedro»). El modo de juego sigue llamándose «modo niño» en el código; en pantalla no cambia. |
| Ficha de alumno | Almacén nuevo **`alumnos`**: `{ id, cursoId (= perfilId del curso), email, nombre, creado }`. Se crea sola cuando el alumno se conecta por primera vez (o al invitar). Los registros del alumno (`progresos`, `niveles`, `sesiones`, `respuestas`, `calcomanias`, `movimientos`, y su estado de perfil) se guardan en el adulto con **`perfilId = id de la ficha`**. Las claves armadas con el perfil (`progreso.id = perfil:elemento:actividad`, `nivel.id = perfil:actividad`) se rearman con el id de la ficha al importar. |
| Pantallas del adulto con una ficha | Progreso, «Qué le cuesta», exportar para IA y Álbum reciben un «perfil de estadísticas» que puede ser un perfil o una ficha. Una función pura **`contenidoDe(perfilOFicha)`** devuelve el `perfilId` del que se leen palabras, frases y libros (para una ficha, su `cursoId`). No se duplica ningún cálculo (`core/estadisticas.js`, `core/analisis.js`, `core/album.js` siguen siendo los únicos). |
| Qué es del curso y qué del alumno en el perfil | **Del curso** (lo pone el adulto, gana siempre en el alumno): nombre, foto del curso, `album` (tamaño, monedas, colecciones disponibles), y en `ajustes` todo lo que **no** es automático (`mayusculas`, `tamanoLetra`, `velocidadVoz`, `sonido`, `vibracion`, `intensidadCelebracion`, `altoContraste`, `habilitarL6`, `actividadesHabilitadas`, `etapasForzadas`, `etapasBloqueadas`, `avanceRapido`, `automaticos`). **Del alumno** (lo calcula su celular): `etapaActual`, los ajustes marcados como automáticos mientras estén en «Automático» (`ensayosPorSesion`, `maxOpciones`, `palabrasNuevasPorSesion`), el estado de sus álbumes (cuál está cargado) y su saldo (ya va en `movimientos`). Si el adulto pone un ajuste en «Lo elijo yo», su valor llega a todos los alumnos del curso. Fase 20 confirma esta lista recorriendo dónde se escribe el perfil (`autoajuste.js`, `album.js`, `albumes.js`, ajustes) y la deja en `core/curso.js` con pruebas. |
| Avance de un alumno en el celular del adulto | El adulto **no** juega como un alumno: su celular juega el perfil (curso) con su propio avance, como hoy. Una ficha es de solo lectura (estadísticas). |
| Varios dispositivos de un mismo alumno | Comparten su carpeta `alumnos/<correo>/`; cada dispositivo escribe su propio `dispositivo-<id>.json` y el `alumno.json` se fusiona como hoy (gana el `updatedAt` más reciente). |
| Respaldo del alumno | El celular del alumno **sí** usa la sincronización personal (`appDataFolder` + `data.json`) **con la cuenta del alumno** (es la misma `js/sync.js` de la fase 7). Ahí va todo lo del celular: avance, contenido de la familia y sus medios. Los medios del curso (Biblioteca) y del catálogo **no** se suben ahí (se marcan como «de otro origen»). Esto cambia la regla de la Ampliación 3 «en el dispositivo del alumno no se usa `appDataFolder`». |
| Menú adulto en el celular del alumno | El candado (mantener 3 s y la suma) lleva a la **misma pantalla principal de adulto** (`#/adulto`, el panel de siempre) con el **menú reducido**. Una lista blanca en `acceso.js` dice qué rutas `#/adulto/*` existen en el rol alumno: **sí** Palabras, Frases, Libros, Álbumes (editores de siempre; lo del curso se ve con la etiqueta «Del curso» y sin editar ni borrar; lo nuevo se guarda con `origen: 'familia'`), Progreso y «Qué le cuesta» del alumno, Ayuda y «Volver al juego». **No**: Alumnos, Cuenta (ni iniciar otra sesión ni «Convertir»), Ajustes del perfil, Apariencia, Copia de seguridad, Perfiles (crear, cambiar o borrar). Cualquier otra ruta adulta lleva al panel reducido. Esto cambia la regla «el alumno nunca sale del modo alumno» de la Ampliación 3: **sale solo con el candado, y solo a este panel reducido**. |
| Contenido de la familia en el motor | Sus registros llevan `origen: 'familia'` y el `perfilId` del curso (así el motor los usa sin cambios). Al fusionar el `adulto.json` del curso, nunca se borran ni se pisan. |
| Estadísticas del contenido de la familia | **Sí le llegan al adulto**: el alumno publica todo su avance (curso y familia) y la lista `contenidoFamilia` (sin medios), así Progreso y «Qué le cuesta» muestran el nombre de cada palabra o frase de la familia, marcada «De la familia». En el adulto esa lista se guarda en un almacén aparte (`contenidoFamilia`, con `fichaId`), nunca en `palabras`/`frases`/`libros`. |
| Material de la familia en el adulto | No se baja solo. En la ficha del alumno: **«Traer el material de la familia»** baja sus `familia/medio-*` (para ver las fotos y oír las voces en las estadísticas) y **«Quitarlo de mi celular»** borra solo esas copias locales del adulto. Ninguno de los dos toca el Drive ni el celular del alumno. Ese material nunca entra a la sincronización personal del adulto ni a la Biblioteca. |
| Medios en el celular del alumno | Todo en local: los de la Biblioteca que usa su curso, los del catálogo (blob sacado de la app) y los de su familia. «Sin copias» vale solo para el Drive del adulto. |
| Aulas ya creadas con la versión 0.36 | Se **actualizan solas** desde el celular del adulto la primera vez que abre «Alumnos» con la versión nueva: la app crea `Biblioteca/`, **mueve** (sin volver a subir) los `medio-*` del aula a la Biblioteca, quita los repetidos, crea `alumnos/<correo>/` por cada invitado, pasa los datos de `del-alumno/` a la ficha de cada dueño y deja `aula.json` en versión 2. Un celular de alumno con versión vieja que vea un `aula.json` v2 muestra «Actualiza la aplicación» (ya lo hace `validarAula` con una versión más nueva). |

### Datos
```js
medio   { …lo de hoy, ruta? }        // ruta = mp3 de la app (catálogo): sin blob en Drive, uno por ruta para todos los perfiles
alumno  { id, cursoId, email, nombre, creado, updatedAt, deleted }   // almacén nuevo `alumnos` (sube VERSION de la base)
palabra / frase / libro / calcomaniaPropia / premio / medio   { …, origen?: 'familia' }   // solo en el celular del alumno
contenidoFamilia { id, fichaId, almacen, registro, updatedAt, deleted }   // almacén nuevo en el adulto: lo que la familia agregó (sin blobs), solo para las estadísticas
alumno.json   { …lo de hoy, contenidoFamilia: { palabras, frases, libros, calcomaniasPropias, premios } }
aula.json v2  { formato, version: 2, perfilId, nombre, dueno, apariencia, desvinculados, alumnos: [{ email, carpetaId }], bibliotecaId }
```

### Fase 20 — Núcleo puro: curso, fichas y origen (sin red ni DOM) ✔ hecha
- **`core/curso.js`** (nuevo, con pruebas): `CAMPOS_DEL_CURSO` / `CAMPOS_DEL_ALUMNO` del perfil, `combinarPerfil(curso, propio)` (lo que ve el celular del alumno) y `perfilPublicable(perfil)` (lo que el alumno manda: solo sus campos); `nuevaFicha({ cursoId, email })`; `aFicha(almacenes, { cursoId, fichaId })` (cambia `perfilId` y rearma los ids de `progresos` y `niveles`); `contenidoDe(perfilOFicha)`; `separarFamilia(almacenes)` → `{ delCurso, contenidoFamilia }` (lo que el alumno publica como contenido de la familia, sin blobs) y la validación de `contenidoFamilia` al llegar al adulto.
- **`core/aula.js`:** formato v2 de `aula.json` (con `alumnos` y `bibliotecaId`; la v1 se sigue leyendo para migrar), `ALMACENES_SOLO_ADULTO` ya no incluye `medios` en el aula (van a la Biblioteca), `filtrarEntrantes` descarta todo registro con `origen: 'familia'` fuera de `contenidoFamilia` (en ambas direcciones), y `armarArchivoAula({ rol: 'adulto' })` ya no publica almacenes del alumno.
- **`estadoDeAlumnos`** con la estructura nueva: permisos de `Biblioteca/` (lector para invitados de cualquier curso), del curso y de cada `alumnos/<correo>/` (editor solo ese correo; otro editor = «Permiso extraño»).
- **Acepta si:** pruebas de la división de campos (un cambio automático del alumno no lo pisa un ajuste manual del curso y al revés), de `aFicha` (dos alumnos del mismo curso no chocan en `progresos` ni `niveles`), de `separarFamilia` (el avance de una palabra de la familia sí se publica; la palabra viaja solo en `contenidoFamilia`, sin blob; nunca entra a `palabras` del adulto), del filtro de `origen: 'familia'`, de la lectura de `aula.json` v1 y v2, y de los permisos extraños nuevos. `npm test` en verde.

**Decisiones de implementación (fase 20)** — 614 pruebas en verde (eran 590); versión 0.37.0; `js/core/curso.js` en `PRECACHE`:
- **División de campos del perfil (confirmada recorriendo todo lo que escribe `perfiles`):** `js/autoajuste.js`/`core/autoajuste.js` (ajustes automáticos, `etapaActual`, `cambiosAutomaticos`), `adulto/ajustes.js` (todos los `ajustes` y `etapaActual`), `adulto/album.js` (`album`, `colecciones`, `base`), `adulto/perfiles.js` y `adulto/asistente.js` (`nombre`, `fotoMedioId`) y `adulto/panel.js`. Resultado en `core/curso.js`: **del curso** = `id, nombre, fotoMedioId, fechaNacimiento, creado, album, colecciones, base` y todos los `ajustes` salvo tres (`AJUSTES_DEL_CURSO`, incluye `automaticos`); **del alumno** = `etapaActual`, `cambiosAutomaticos` y `ensayosPorSesion`, `maxOpciones`, `palabrasNuevasPorSesion` (`AJUSTES_DEL_ALUMNO`), y solo mientras su marca en `ajustes.automaticos` siga en «Automático» (`etapaActual` ↔ la marca `etapa`; `palabrasNuevasPorSesion` ↔ `palabrasNuevas`). Una prueba falla si aparece un campo nuevo en el perfil sin repartir.
- **Cambio respecto a la tabla de «Decisiones tomadas»:** no existe ningún «estado de sus álbumes (cuál está cargado)» guardado en el perfil: los álbumes se **calculan** de `calcomanias` y `movimientos` (`core/album.js`), que ya son del alumno. `album.codigos` (calcomanías en juego) es del curso. No se añadió ningún campo.
- `combinarPerfil(curso, propio)` devuelve el perfil del curso con los valores automáticos del alumno y **solo** los avisos `cambiosAutomaticos` del alumno (los del perfil del curso son del adulto). `perfilPublicable` publica `{ id, ajustes (solo los automáticos), etapaActual (solo si es automática), cambiosAutomaticos, updatedAt }`; nada del curso. Lo que no se indica en `ajustes` está en «Automático» por defecto (`normalizarAjustes`), así que un alumno nuevo publica los tres.
- **Pendiente para fases posteriores (anotado, no resuelto aquí):** `deshacerCambio`/`marcarVisto` (`core/autoajuste.js`) escriben sobre el perfil; en el adulto, una ficha es de solo lectura, así que los avisos de ajustes automáticos de cada alumno se verán en su ficha pero no se «deshacen» desde allí (se ajusta el curso).
- **Ficha:** `nuevaFicha` → `{ id, cursoId, email, nombre, creado, estado }`. El **id es determinista** (`ficha:<cursoId>:<correo en minúscula>`): dos dispositivos del adulto crean la misma ficha y no se repite. `estado` guarda el `perfilPublicable` del alumno (así no hace falta un registro falso en `perfiles`). `fichaDeCorreo`, `idDeFicha`.
- **`aFicha(almacenes, { cursoId, fichaId })`** devuelve `{ almacenes, estado, descartados }`: pasa a la ficha `progresos, niveles, sesiones, respuestas, calcomanias, movimientos` (cambia `perfilId`; rearma los ids de `progresos`, `niveles` y del premio de cada álbum, `album:<ficha>:<n>`, con los campos del registro; los demás conservan su id, que ya es único), descarta lo de otro perfil y los almacenes que no son del alumno, y no toca lo recibido. Se revisó que ningún código separa los ids por «:».
- **`contenidoDe(perfilOFicha)`** = `cursoId ?? id`. **`separarFamilia`** devuelve además `mediosFamilia` (ids de medios con `origen: 'familia'`, que no van ni en el curso ni en `contenidoFamilia`: sus blobs viajan a `familia/`). Los borrados de la familia (`deleted`) sí viajan en `contenidoFamilia` para que el borrado se propague. **`limpiarContenidoFamilia(c, { cursoId })`** valida lo que llega (solo las 5 claves, registros con `origen: 'familia'` y del curso, sin blobs) y cuenta lo descartado; **`filasDeContenidoFamilia({ fichaId, contenido })`** arma las filas `{ id, fichaId, almacen, registro, updatedAt, deleted }` del almacén `contenidoFamilia` del adulto (el almacén en sí y la subida de la versión de la base se hacen en la fase 22).
- **`core/aula.js`:** `VERSION_AULA = 2`; `nuevaAula` acepta `alumnos` y `bibliotecaId`; `validarAula` revisa los dos solo si `version >= 2` (la v1 se lee igual) y `aulaComoV2` migra en memoria. `ALMACENES_SOLO_ADULTO` sin `medios`; nuevo `ALMACENES_DEL_CURSO` (= `perfiles` + los de solo adulto) que es lo que el adulto publica y el alumno acepta (`publicaRol`/`aceptaDe`): **el adulto ya no publica avance de alumnos ni medios**. `filtrarEntrantes` descarta todo registro (y medio) con `origen: 'familia'`. `armarArchivoAula` del alumno agrega `contenidoFamilia` limpio (nunca en el del adulto) y `validarArchivoAula` lo comprueba.
- **Puente transitorio (se quita en la fase 22):** `js/sync-aula.js` sigue siendo la sincronización de las aulas versión 1, así que usa `publicaRolV1`/`aceptaDeV1` (la lista de antes, con avance y medios dentro del aula) y pasa `publica` a `armarArchivoAula`. Sin esto la app y las pruebas de la fase 16 dejarían de funcionar hasta reescribirla. Efecto: mientras tanto, un aula nueva se crea ya con `aula.json` v2 (con `alumnos: []`) pero se sincroniza como antes.
- **`estadoDeAlumnos`:** nuevos `invitadosDeTodos` y `permisos: { biblioteca, aula, alumnos: { <correo>: [permisos] } }`. Biblioteca: solo lector y solo correos invitados a algún curso; curso: solo lector y solo sus invitados; `alumnos/<correo>/`: lector, o editor solo si es ese correo. El permiso extraño heredado del curso se cuenta una sola vez; se compara por **id y rol** (en Drive el id de un permiso es el de la persona y se repite entre carpetas). `carpeta` vale `biblioteca`, `aula` o `alumnos/<correo>`; `delAlumno` (aulas v1) se sigue revisando como antes.
- **Pruebas:** `tests/curso.test.js` (nuevo) y ampliado `tests/aula.test.js`; se actualizaron 5 pruebas de la fase 15 que fijaban el comportamiento v1 (listas de almacenes, `publicaRol`/`aceptaDe`, medios en el filtro, versión, `armarArchivoAula`).

### Fase 21 — Audios del catálogo sin copias ✔ hecha
- `ponerVocesIniciales` y la puesta «una sola vez por perfil» buscan primero un medio con esa `ruta`; si existe, lo **reutilizan** (sin bajar nada); si no, lo crean **una vez** con `ruta` y `origen: 'catalogo'`. El blob local se sigue guardando para funcionar sin red, pero se puede volver a sacar de la app.
- **Sincronización personal (`js/sync.js`) y del aula:** un medio con `ruta` viaja solo como registro (sin `medio-*`). Al recibirlo, el dispositivo toma el blob de la app (`fetch(ruta)`, que sirve el service worker) y **lo guarda en su almacén** (el celular del alumno tiene todo en local); si falla, queda la voz sintética y se reintenta en la siguiente sincronización.
- **Migración (una vez, en el adulto):** los medios `origen: 'catalogo'` sin `ruta` se emparejan con el catálogo por el texto de su palabra; los repetidos se unen en uno (se reescriben `medioAudioId` de las palabras) y los sobrantes se borran del almacén local (borrado suave). **Sus archivos en Drive no se borran solos:** quedan para la pantalla de limpieza de la fase 26, donde el adulto los ve y decide.
- **Acepta si:** crear un perfil nuevo no baja ni crea audios que ya existían (prueba con el almacén en memoria); dos perfiles comparten el mismo medio de «mamá»; tras la migración ningún medio nuevo del catálogo se sube a Drive (Drive falso); un alumno recibe la voz sin que exista su `medio-*` en Drive y la tiene guardada en local (juega sin red).

**Decisiones de implementación (fase 21)** — 626 pruebas en verde (eran 614); versión 0.38.0; no hay archivos nuevos en la app (`PRECACHE` sin cambios):
- **Un medio por ruta, con id determinista:** `idMedioDeCatalogo(ruta)` = `catalogo:<ruta>`. Así dos dispositivos que crean la misma voz a la vez producen el mismo registro y la fusión no deja repetidos. `medioDeCatalogo(store, ruta)` (en `js/medios.js`) lo reutiliza si existe (si le falta el contenido lo saca de la app y lo guarda con `importar`, sin tocar `updatedAt` ni la cola) y, si no, lo crea una vez con `{ origen: 'catalogo', ruta, subido: true }`. `ponerVocesIniciales` (y por tanto `completarVocesIniciales`, el asistente y el vocabulario) usa esto: crear un perfil nuevo no baja ni crea nada que ya exista.
- **`blobDeApp(ruta)`** hace el `fetch` (lo sirve el service worker); todas las funciones que lo usan reciben `traerDeApp` para probarlas en Node sin red. El blob **se guarda siempre en local** (también en el celular del alumno): «sin copias» vale solo para Drive.
- **`planDeMedios` (`core/sync.js`):** un medio con `ruta` nunca va a `subir`, `bajar` ni `borrarRemotos`; si no tiene contenido local sale en el nuevo `deApp`. `js/sync.js` y `js/sync-aula.js` (parámetro `traerDeApp`, que `crearAulas` también acepta) sacan esos blobs de la app y los escriben en local; si falla queda la voz sintética y se reintenta en la siguiente sincronización. Las pruebas de la fase 7 no cambiaron.
- **Migración (`migrarMediosDelCatalogo`, una vez por dispositivo con `migrarCatalogoUnaVez`, llamada desde `perfilActivo` solo si no es alumno):** para cada palabra de cualquier perfil cuyo `medioAudioId` sea un medio `origen: 'catalogo'` sin `ruta` y cuyo texto esté en el catálogo, la reapunta al medio `catalogo:<ruta>` (creado con el mismo contenido que ya estaba en local, sin bajar nada). Un medio viejo se borra del almacén (borrado suave, `blob: null`) solo si se reapuntó alguna palabra suya y ya ninguna palabra viva lo usa; lo que no se puede emparejar (texto cambiado, sin contenido, grabaciones del adulto) no se toca. La marca `catalogoSinCopias1` se guarda solo si no hubo error (p. ej. sin red para leer el catálogo: se reintenta). Limitación: un medio viejo que llegue después de otro dispositivo con versión anterior no se migra (la marca ya está puesta).
- **Drive no se limpia:** los medios viejos borrados llevan `conservarEnDrive: true` y `planDeMedios` no los pone en `borrarRemotos`, así sus archivos `medio-*` quedan en Drive (y en las aulas) para la pantalla de limpieza de la fase 26, que debe buscar medios borrados con esa marca (y los archivos huérfanos de `medio-*` del catálogo).
- **Pruebas:** `tests/catalogo.test.js` (nuevo): perfil nuevo sin crear ni bajar audios, dos perfiles comparten «mamá», migración y su segunda pasada, `planDeMedios`, sincronización personal con Drive falso (nada del catálogo se sube, el otro dispositivo toma la voz de su app, reintento) y un alumno con la nube de varias cuentas (recibe la voz sin `medio-*` en Drive y la deja en local).

### Fase 22 — Biblioteca común en Drive ✔ hecha
- `aulas.js`: `asegurarBiblioteca()` (dentro de `Leo Conmigo/`, privada salvo los lectores invitados), compartir/quitar el lector de la Biblioteca al invitar/quitar acceso (según los cursos de cada correo), y revisión de permisos extraños también en la Biblioteca.
- `sync-aula.js`: el adulto sube a la Biblioteca los medios que usan sus cursos habilitados y que no estén ya ahí (una sola vez por medio, aunque lo usen varios cursos); borra de la Biblioteca un medio solo cuando ya no lo usa **ningún** curso. El alumno baja de la Biblioteca solo los medios que usa su curso.
- **Migración de aulas v1:** mover los `medio-*` del aula a la Biblioteca con `files.update` (`addParents` / `removeParents`, sin volver a subir) y dejar `aula.json` en v2 (ver «Decisiones»). Los que ya estaban en la Biblioteca (repetidos) **no se borran solos**: quedan para la fase 26.
- **Acepta si** (Drive falso con varias cuentas): dos cursos que usan la misma foto la tienen **una** vez en la Biblioteca; A (curso 1) y B (curso 2) bajan su contenido; A no puede escribir en la Biblioteca (403); quitar a A de su único curso le quita también la Biblioteca; un aula v1 con datos queda migrada sin volver a subir medios y sin perder lo que mandó el alumno.

**Decisiones de implementación (fase 22)** — 635 pruebas en verde (eran 626); versión 0.39.0; sin archivos nuevos en la app (PRECACHE igual):
- **Se quitó el puente V1** (publicaRolV1/ceptaDeV1 y el parámetro publica): sync-aula.js usa publicaRol/ceptaDe de verdad. El adulto publica en dulto.json solo ALMACENES_DEL_CURSO (el perfil del curso, palabras, frases, libros, calcomanías propias y premios); el alumno acepta solo eso. Lo que las aulas v1 traían dentro de dulto.json (medios y avance de alumnos) se ignora **sin aviso** y se limpia en la primera sincronización del adulto.
- **Dónde están los medios:** Biblioteca/ (carpeta leoConmigo='biblioteca' dentro de Leo Conmigo/, segurarBiblioteca() en ulas.js, id en el meta ibliotecaId y en cada aula de listarAulas()). Los registros medios ya no viajan en el aula: **el curso solo dice qué medios usa** (mediosDelPerfil sobre el contenido recibido) y de ahí el alumno arma sus registros: busca en la Biblioteca el archivo medio-<id>.* cuyo dueño es el adulto (el tipo sale del mimeType del archivo), lo baja y lo **guarda en local**; un id catalogo:<ruta> se saca de la app (	raerDeApp, fase 21). Si falta un archivo o la app no responde, cuenta en mediosSinArchivo y se reintenta en la siguiente sincronización.
- **El adulto** sube a la Biblioteca solo los medios que usa ese curso y que no están ya por nombre (una vez por medio aunque lo usen varios cursos; los del catálogo nunca). Borra un archivo solo si su medio está **borrado** localmente (no conservarEnDrive), ya no lo usa este curso **ni ningún otro** (usadosPorOtros, calculado con los demás cursos del adulto) y el archivo existe. Un medio sin usar pero sin borrar se queda (lo verá la limpieza de la fase 26).
- **Permisos (tabla obligatoria):** invitar da lector (nunca editor ni nyone) en la Biblioteca además del aula y editor solo en del-alumno/; quitarAcceso le quita la Biblioteca solo si el correo ya no está en **ningún** curso. evisarPermisos/sincronizarAula revisan también la Biblioteca (permisos.biblioteca, invitadosDeTodos) y quitarPermisoExtrano acepta carpeta: 'biblioteca'; la pantalla Alumnos dice «la Biblioteca». ula.json v2 lleva ibliotecaId y lumnos: [{ email, carpetaId: null }] (los correos; carpetaId queda 
ull hasta la fase 23).
- **Migración de aulas v1 (migrarAula, automática en crearAula, invitar y sincronizarAula):** crea la Biblioteca, **mueve** los medio-* del aula con iles.update (ddParents/emoveParents; drive.mover; mismo id de archivo, sin subir nada), comparte la Biblioteca con los invitados de todos los cursos y deja ula.json en v2. Un medio que ya estaba en la Biblioteca (repetido) **se queda donde está**: nada se borra solo (fase 26). Un celular de alumno que aún vea un aula v1 sin migrar baja los medios del aula (carpetaMedios cae a la carpeta del aula).
- **Lo que queda para la fase 23 (anotado para que la app siga funcionando):** se mantiene la carpeta única del-alumno/ y el adulto sigue mezclando lo que manda cualquier invitado en el perfil del curso (usionarConAjeno con ceptaDe('adulto','alumno')); perfiles sigue viajando en los dos sentidos con el último updatedAt (la división combinarPerfil/perfilPublicable y las fichas se enlazan en la fase 23). Consecuencia hasta entonces: el adulto ya no republica el avance en dulto.json, así que un alumno que reinstala no lo recupera de ahí (su respaldo propio llega en la fase 24).
- **Límites conocidos:** el celular del alumno no borra los medios locales que su curso dejó de usar (no tiene cómo borrar sin encolarlos en su sincronización personal); y los permisos de la Biblioteca de aulas ya existentes se completan la primera vez que el adulto abre «Alumnos»/sincroniza con la versión nueva.
- **Pruebas:** 	ests/biblioteca.test.js (nuevo, Drive falso con varias cuentas): una copia compartida por dos cursos, A y B bajan lo suyo y no pueden escribir (403), permisos de lectura y su retirada, borrado solo si ningún curso lo usa, permisos extraños, migración v1 sin subir nada ni perder lo del alumno, repetidos que no se borran y alumno con aula v1. 	ests/aulas.test.js y 	ests/aula.test.js se adaptaron (los medios ahora están en la Biblioteca). **Navegador, dos orígenes** (localhost:8080 adulto y 127.0.0.1:8080 alumno, Google y nube simulados): el adulto habilita e invita, la nube queda con los 13 medios solo en Biblioteca/ y el aula sin medios; el alumno entra, baja su curso, guarda los 13 medios con su contenido en local y abre una sesión **sin conexión** con las imágenes (blobs) cargadas y 0 peticiones a Google; al volver la conexión el adulto lo ve «Conectado». No se probó el service worker (el servidor de Python no deja instalarlo) ni audio real.

### Fase 23 — Varios alumnos por perfil (fichas) ✔ hecha
- `aulas.js` / `sync-aula.js`: `alumnos/<correo>/` por invitado (editor solo él); el adulto lee cada subcarpeta y guarda lo del alumno bajo su ficha (`aFicha`); la ficha se crea al invitar y se completa al conectarse. El alumno escribe en su subcarpeta, publica solo `perfilPublicable` y sus almacenes, y combina el perfil del curso con el suyo (`combinarPerfil`).
- **«Alumnos» (`js/adulto/alumnos.js`):** por cada perfil (curso), su lista de alumnos, cada uno con estado, dispositivos, **Ver estadísticas** (abre Progreso de **su ficha**), Quitar acceso y Desvincular. Textos sin «niño» para el perfil.
- **Progreso, «Qué le cuesta», exportar y Álbum del adulto:** aceptan una ficha (con `contenidoDe`) y muestran arriba de quién son («Víctor · perfil Lectura inicial»). El selector de perfil del adulto **no** mezcla fichas con perfiles: a las fichas se llega desde «Alumnos».
- `borrarPerfil` también borra las fichas del curso y sus registros; quitar acceso **no** borra la ficha (las estadísticas se quedan).
- **Acepta si**, en el navegador con dos orígenes y la nube simulada: dos alumnos del mismo perfil juegan y sus estadísticas aparecen **separadas** en el adulto; un cambio de ajuste del curso llega a los dos sin pisar su etapa ni sus ajustes automáticos; el alumno A no puede leer ni escribir la carpeta de B (403).

**Decisiones de implementación (fase 23)** — 638 pruebas en verde (eran 635); versión 0.40.0; sin archivos nuevos en la app (`PRECACHE` igual); la base sube a la versión 4 (almacén `alumnos`):
- **CAMBIO respecto al dibujo de la idea (manda la tabla «Quién puede tocar qué»):** las carpetas de los alumnos **no están dentro del aula**. En Drive el lector de una carpeta hereda lectura de todo lo de dentro, así que con `Curso · X/alumnos/<correo>/` un alumno habría podido leer la carpeta de su compañero (la tabla dice «Otro alumno: no la ve» y la prueba pide 403). Queda: `Leo Conmigo/Curso · X/` (aula, lectores) y, **hermana** de ella, `Leo Conmigo/Alumnos · X/` (privada, `leoConmigo='alumnos'`, nunca se comparte) con una carpeta `<correo>/` por invitado (`leoConmigo='del-alumno'`, propiedades `perfilId` y `email`, **editor solo ese correo**). El alumno encuentra la suya porque se la compartieron directamente (`carpetaPropia` en `aulas.js`: solo vale una cuyo dueño es el del aula) y `aula.json` v2 guarda su `carpetaId`. Verificado: Sofía ve 0 archivos en la carpeta de Pedro y leer, escribir o crear allí da 404 (Drive falso: 403/404; en las pruebas de Node y en el navegador).
- **`core/aula.js`:** `permisosExtranos` revisa `alumnos/<correo>` (solo su dueño como editor; **cualquier** otro correo, incluso lector u otro invitado del mismo curso, es «Otro correo con acceso a la carpeta de un alumno»), el contenedor `alumnos` (solo el dueño) y la carpeta `del-alumno/` de antes (solo se compara con el aula, que es de donde hereda). Ya no se descuenta un permiso extraño de una carpeta de alumno contra el del aula (no hereda).
- **`sync-aula.js`:** el **adulto** lee `alumno.json` y los dispositivos de la carpeta de cada invitado (solo archivos cuyo dueño es ese correo; un `alumno.json` de otro dueño dentro de la carpeta de un alumno se ignora con aviso), lo pasa por `filtrarEntrantes` + `aFicha` y lo guarda **solo** bajo su ficha con `vistaDeFichas` (`js/store-perfil.js`, nueva: solo ve y escribe fichas y registros de fichas **de ese curso**; rechaza todo lo demás con `ErrorVistaPerfil`). Nunca mezcla lo del alumno en el perfil del curso: el avance, `progresos` y `niveles` llevan el id de la ficha (dos alumnos con la misma palabra no chocan), y el perfil del alumno (`perfilPublicable`) queda en `ficha.estado`. El adulto publica en `adulto.json` solo el curso, sin recibir nada del alumno. El **alumno** publica solo `perfilPublicable(perfil)` (etapa, ajustes automáticos y avisos; nada del curso) y combina cada vez el perfil del curso con el suyo (`combinarPerfil`, escribe el resultado en su perfil local solo si cambió): un ajuste manual del curso llega a todos; los automáticos y la etapa de cada alumno se conservan; si el adulto pone un ajuste en «Lo elijo yo», su valor llega a todos.
- **Fichas:** almacén `alumnos` (`{ id: 'ficha:<curso>:<correo>', cursoId, email, nombre, creado, estado }`, índice `cursoId`), en `ALMACENES_RESPALDO` y por tanto en la copia de seguridad y en la sincronización personal del adulto (no viaja por el aula). Se crea al invitar (`asegurarFicha`) y al sincronizar; quitar acceso **no** la borra (en «Alumnos» sale como «Antiguos alumnos», con sus estadísticas). `borrarPerfil` borra las fichas del curso y su avance (`planDeBorradoDePerfil({ fichas })`).
- **Migración de aulas de la fase 22** (automática en `aulaLista`: crear aula, invitar o sincronizar): crea `Alumnos · X/` y la carpeta de cada invitado (editor solo él), crea las fichas, **retira a todos como editores** de la `del-alumno/` de antes (se queda como solo lectura, dentro del aula) y pone en `aula.json` el `carpetaId` de cada alumno. Mientras un alumno no vuelva a sincronizar con la versión nueva, el adulto aún lee su `alumno.json` y sus dispositivos de la carpeta de antes (su avance pasa a su ficha). Nada se borra de Drive (fase 26). Un celular de alumno con la versión nueva busca su carpeta **cada vez** (`sincronizarComoAlumno`): si el adulto migró, deja de escribir en la de antes aunque la recordara.
- **Pantallas del adulto:** `sujetoDeEstadisticas(ruta)` (`js/contexto.js`) devuelve el perfil activo o, si la ruta termina en `/ficha/<id>`, la ficha y su curso (`contenidoDe`). Progreso, «Qué le cuesta» (con exportar y copiar para IA) y Álbum aceptan `#/adulto/progreso/ficha/<id>` (igual para `analisis` y `album`): leen palabras y frases del curso y el avance de la ficha, muestran «Víctor · perfil Lectura inicial», no tienen los botones que cambian el avance («Ya la sabe», «Empezar de nuevo»…) y llevan un «← Alumnos». El Álbum de una ficha es una vista nueva y de solo lectura (monedas, calcomanías, álbumes completos y el actual; el tamaño es del curso). El selector de perfil no mezcla fichas. En «Alumnos» cada alumno tiene sus botones **Ver estadísticas / Qué le cuesta / Álbum / Quitar acceso**; «Ver lo jugado en este celular» queda para el avance del propio adulto con el perfil.
- **Límites conocidos:** (1) los avisos de ajustes automáticos de cada alumno se ven en su `ficha.estado` pero no hay pantalla que los muestre ni los «deshaga» (anotado en la fase 20): se ajusta el curso; (2) la fusión del perfil en el alumno compara por `updatedAt` el perfil resultante, no campo a campo (suficiente: cada campo tiene un solo dueño); (3) el servidor de pruebas `tests/servidor.py` ahora también escucha en `127.0.0.2` (solo loopback) para tener un tercer origen y probar dos alumnos reales; si ya hay otro servidor viejo en `127.0.0.1:8080`, hay que pararlo antes (si no, cada origen ve una «nube» distinta); (4) el texto de ayuda, `privacidad.html` y el README siguen hablando de «aula» y «subcarpeta» en lo que no cambió: se repasa en las fases 25 y 26.
- **Pruebas:** en `tests/aulas.test.js`: dos alumnos del mismo perfil (carpetas, fichas y avance separados, ids distintos de `progresos`/`niveles`, nada bajo el curso; A no lee, escribe ni crea en la carpeta de B y al revés; la app de A solo escribe en la suya), un ajuste del curso que llega a los dos sin pisar su etapa ni sus automáticos, el alumno que publica solo su parte del perfil, migración de un aula de la fase 22 (carpetas por alumno, fichas, sin editores en la de antes, avance de antes en la ficha, el alumno con la carpeta vieja recordada escribe en la nueva), `vistaDeFichas`; adaptadas `aulas`, `aula`, `biblioteca`, `borrar-perfil` y `respaldo`. **Navegador con tres orígenes** (adulto `localhost:8080`, Pedro `127.0.0.1:8080`, Sofía `127.0.0.2:8080`, Google y nube simulados): el adulto habilita, invita a los dos y migración/ficha se crean; los dos descargan el curso, juegan (avance distinto: Pedro 33 %, Sofía 83 %) y publican; en el adulto las estadísticas aparecen **separadas** en Progreso, «Qué le cuesta» y Álbum de cada ficha, el curso no recibe nada (0 sesiones, 0 progresos); un cambio de ajustes del curso (letra grande, mayúsculas) llega a los dos y cada uno conserva su etapa (1 y 2) y su ensayos por sesión (6 y 12); Sofía no ve ni toca la carpeta de Pedro (0 archivos, 404). Se encontró y arregló de paso un `null` visible en Progreso cuando no había panel «Otras actividades» (el `replaceChildren` nativo). No se probó: el service worker (el servidor de pruebas no lo instala) ni el juego real por la interfaz (el avance se sembró con las funciones del motor).

### Fase 24 — Menú adulto reducido en el celular del alumno, contenido de la familia y respaldo en su Drive ✔ hecha
- **Candado en el celular del alumno:** vuelve a dibujarse; al pasarlo abre **el mismo panel `#/adulto`** con el menú reducido (lista blanca de rutas del rol alumno en `acceso.js`; ver «Menú adulto en el celular del alumno»). Los editores de palabras, frases, libros y álbumes se **reutilizan**: lo del curso se ve con la etiqueta «Del curso» y sin editar ni borrar; lo nuevo se guarda con `origen: 'familia'`. Una ruta adulta fuera de la lista lleva al panel reducido.
- **Publicar lo de la familia:** el alumno publica en `alumno.json` todo su avance y `contenidoFamilia` (sin blobs), y sube los medios de la familia a `alumnos/<correo>/familia/` (archivos de su cuenta).
- **En el adulto:** `contenidoFamilia` se guarda aparte por ficha; Progreso y «Qué le cuesta» de la ficha muestran esas palabras y frases con la marca «De la familia». En la ficha, los botones **«Traer el material de la familia»** (baja `familia/medio-*` a un almacén local aparte, fuera de la sincronización personal) y **«Quitarlo de mi celular»** (borra solo esas copias locales; confirma; no toca Drive).
- **Respaldo:** en el celular del alumno corre también la sincronización personal (`js/sync.js`) con su cuenta (`drive.appdata`, que ya pidió al entrar con el permiso del aula; si no, se pide desde el panel reducido). Sube todo lo del celular **menos** los medios de la Biblioteca y del catálogo. Al reinstalar y entrar con su Gmail: primero baja su `appDataFolder` (su avance y lo de la familia) y después el curso.
- **Acepta si:** la familia agrega una palabra con foto y voz y el alumno la juega; sus **estadísticas sí** aparecen en la ficha del adulto con el nombre de la palabra y la marca «De la familia»; su foto y su voz **no** están en el celular del adulto hasta tocar «Traer el material de la familia», y desaparecen de él con «Quitarlo de mi celular» sin cambiar nada en el Drive del alumno (Drive falso); nada de la familia entra a `palabras` del adulto, a su `appDataFolder` ni a la Biblioteca; el contenido del curso no se puede editar desde el panel reducido; las rutas Alumnos, Cuenta, Ajustes, Apariencia, Copia de seguridad y Perfiles no se abren en el rol alumno; borrar la base del alumno y volver a entrar recupera su avance y lo de la familia.

**Decisiones de implementación (fase 24)** — 647 pruebas en verde (eran 638); versión 0.41.0; `js/store-familia.js` y `js/material-familia.js` nuevos en `PRECACHE`; la base sube a la versión 5 (almacén `contenidoFamilia`):
- **Menú reducido:** `rutaPermitidaAlumno` (`core/dispositivo-alumno.js`, pura) es la lista blanca: `/adulto` (el panel de siempre), `vocabulario`, `palabra/<id>`, `frases`, `libros`, `album`, `progreso`, `analisis` y `ayuda`. `acceso.js` ya no bloquea al alumno: `habilitarAdulto()`/`adultoHabilitado()` valen igual y `puedeAbrirRutaAdulta(ruta)` + `destinoSiNoPasa()` (con `guardia(ruta)` y `siNoPasa` como función en `router.js`) llevan cualquier otra ruta adulta al panel reducido (Alumnos, Cuenta, Ajustes, Fondo, Tienda, Perfiles, Asistente, Copia de seguridad y «Acerca de»). El candado «Config» vuelve a dibujarse en el inicio del alumno. `adulto/panel.js` oculta en el alumno la cuenta de Google, los avisos de ajustes automáticos, Tienda, Ajustes, Fondo, Perfiles, Alumnos y Copia de seguridad.
- **Lo del curso no se toca, lo nuevo es de la familia — en un solo lugar:** `obtenerStore()` envuelve el almacén con `envolverParaFamilia` (`js/store-familia.js` + `aplicarOrigenDeFamilia` en `core/curso.js`). En un dispositivo de alumno, `guardar`/`guardarVarios`/`borrar` sobre `palabras, frases, libros, calcomaniasPropias, premios` y `medios` marcan lo nuevo con `origen: 'familia'` (también sus fotos y voces: el `origen` anterior del medio, `foto`/`grabacion`, no lo usa nadie más) y lanzan `ErrorCurso` si el registro ya existe y es del curso. La sincronización escribe con `importar` y no pasa por ahí. Los editores reutilizados solo se ajustaron en lo visible: etiqueta «Del curso» / «De la familia» y sin Editar, Pausar, orden ni borrar en lo del curso (`vocabulario`, `editor-palabra`, `frases`, `libros`); `borrarMedio` ignora un `ErrorCurso` (no borra una voz del catálogo ni un medio del curso).
- **~~Álbumes~~ (CORREGIDO por el punto 4 de «Lo que agregó el usuario al aprobar»):** la primera versión de la fase 24 limitaba a la familia a láminas sueltas y sin Tienda porque los álbumes cargados viven en el perfil (del curso). El usuario pidió que Tienda y Álbum estén **completos** para la familia (álbumes con portada, sobre y láminas; premios; monedas). Se resuelve en el segundo commit de la fase 24 (ver más abajo).
- **Publicar la familia (`sync-aula.js`, alumno):** `alumno.json` lleva `contenidoFamilia` (`separarFamilia`, sin blobs) y todo su avance (también el de las palabras de la familia, en `progresos`); la palabra viaja solo en `contenidoFamilia`. Las fotos y voces de la familia suben a `familia/` **dentro de su propia carpeta** (`alumnos/<correo>/` → `familia/`, `leoConmigo='familia'`, archivos de su cuenta): la carpeta se crea solo cuando hay material (`aulas.js`), cada medio se sube una vez y un medio borrado se quita de `familia/`. Si cambia la lista, el archivo se reescribe.
- **El adulto (`sync-aula.js`, `aulas.js`, `alumnos.js`):** `limpiarContenidoFamilia` + `filasDeContenidoFamilia` guardan la lista por ficha en el almacén `contenidoFamilia` (`vistaDeFichas` lo acepta solo con `fichaId` del curso; entra a la copia de seguridad y a la sincronización personal del adulto porque lleva solo nombres, sin fotos ni voces). Nunca entra a `palabras`/`frases`/`libros`, ni al aula, ni a la Biblioteca. Progreso y «Qué le cuesta» de una ficha suman esas palabras y frases con la marca «De la familia» (`registrosDeFamilia`). En «Alumnos», bajo cada alumno con material, se cuenta lo que agregó y están los botones **«Traer el material de la familia»** (`traerMaterialDeFamilia`: lee `familia/medio-*` cuyo dueño es ese correo y los guarda en `meta` con `js/material-familia.js`, **no** en `medios`: así nunca van a su sincronización personal ni a su copia de seguridad; se pueden ver y oír ahí mismo y se usan como miniaturas en «Qué le cuesta») y **«Quitarlo de mi celular»** (confirma; borra solo esa copia local). `borrarPerfil` borra también esas filas y el material traído.
- **Respaldo del alumno (`nube-alumno.js`):** `respaldarAlumno()` corre la sincronización personal de siempre (`js/sync.js`, `appDataFolder` con la cuenta del alumno) después de cada sincronización del aula y, al entrar o reinstalar (`descargarAula`), **antes** del aula (recupera avance, lo de la familia y sus fotos y voces) y otra vez al final. Un fallo ahí solo se avisa en la consola y nunca frena el aula. `planDeMedios` no sube los medios con `origen: 'biblioteca'` (los del curso se vuelven a bajar de la Biblioteca); los del catálogo ya no se subían.
- **Límites conocidos:** (1) un medio de la familia que se borra y deja de usarse sale de `familia/` solo mientras su id siga en la lista de «ya sincronizados» (se anota al subirlo; un borrado hecho antes de la primera subida no deja archivo); (2) el material traído guarda todo el contenido de `familia/` de esa carpeta, aunque ya no lo use ninguna palabra; (3) la familia no puede agregar álbumes con portada ni premios (ver arriba); (4) el permiso `drive.appdata` del respaldo lo pide ya el inicio de sesión del alumno; si faltara, el respaldo falla en silencio y se reintenta; (5) el servidor de pruebas con varios orígenes se vuelve lento cuando la «nube» simulada pesa cientos de KB (las fotos en base64): a veces hay que repetir «Seguir descargando»; (6) la ayuda, `privacidad.html` y el README aún no hablan del menú reducido ni del material de la familia (fase 25).
- **Pruebas:** `tests/familia.test.js` (nuevo): la lista blanca de rutas, `aplicarOrigenDeFamilia` y el almacén envuelto (nuevo = familia, el curso intacto, en el adulto no hace nada), `planDeMedios`, el plan de borrado, `vistaDeFichas` con `contenidoFamilia`, y de punta a punta con el Drive falso: la familia agrega una palabra con foto y voz → queda en `familia/` con archivos del alumno, su lista y su avance llegan a la ficha del adulto sin entrar a `palabras`, `medios`, el aula ni la Biblioteca; el adulto no escribe en carpetas de alumnos; «Traer» lo baja aparte de `medios`; «Quitar» solo borra la copia local; otro alumno del curso no recibe ni ve nada; el borrado se propaga; y el respaldo en el `appDataFolder` del alumno y su recuperación al reinstalar (sin los medios del curso). `acceso` y `aula`/`respaldo`/`borrar-perfil` adaptadas; `tests/drive-falso.js` entiende el `appDataFolder` de cada cuenta. **Navegador (adulto `localhost:8080` y alumno `127.0.0.1:8080`, Google y nube simulados):** el candado «Config» está en el inicio del alumno; con el modo adulto abierto aparece el panel con solo Vocabulario, Frases, Libros, Progreso, Qué le cuesta, Álbum y Ayuda; Ajustes, Alumnos, Cuenta, Perfiles, Respaldo, Tienda, Fondo, Asistente y Acerca de lo devuelven al panel; el vocabulario marca «Del curso» sin Editar; el alumno agrega «abuela» **por el editor, con foto y voz** (foto y micrófono falsos) y queda «De la familia» con foto y audio como medios de la familia; tras sincronizar, `familia/` tiene los 2 archivos de su cuenta y su `appDataFolder` el respaldo (`data.json` y esos 2 medios, ninguno del curso); en el adulto la ficha muestra «abuela · De la familia · 2/3», `palabras` y `medios` del adulto siguen con lo del curso, «Traer el material» baja 2 archivos (1 foto y 1 voz, visibles y audibles; `medios` sigue en 13) y «Quitarlo» deja 0 sin tocar el Drive; al borrar los datos del alumno y volver a entrar recuperó su avance, su sesión, la palabra «abuela» y sus 2 medios con contenido. No se probó: el candado real (mantener 3 s y la suma: se probó abriendo el modo adulto con la marca de sesión, como en fases anteriores), el service worker ni el juego real de una sesión con la palabra de la familia (el avance se sembró con las funciones del motor); la bajada de los medios del curso tras reinstalar quedó a medias por la lentitud del servidor de pruebas (esa parte no cambió respecto de la fase 22).

**Corrección de la fase 24 — Tienda y Álbum completos para la familia (segundo commit; 650 pruebas en verde; versión 0.42.0; la base sube a la versión 6)** — por el punto 4 de «Lo que agregó el usuario al aprobar»; reemplaza la decisión «Álbumes» de arriba:
- **Álbumes de la familia:** almacén nuevo `colecciones` (`{ id, perfilId, nombre, medioPortadaId, medioSobreId, colorPortada?, creado, origen: 'familia' }`), porque `perfil.colecciones` es del curso y no se toca. Sus láminas son `calcomaniasPropias` con `coleccionId` (también `origen: 'familia'`). `listarColecciones({ perfil, propias, familiares })` (`core/colecciones.js`) los mezcla con el álbum de la app y los del curso y marca `esFamilia`; `js/colecciones.js` (`cargarColecciones`) y `js/albumes.js` (`comprarSobre`, `ganarCalcomania`) los leen, así que el niño los ve, gana láminas y compra sobres de ellos con la lógica de siempre. La pantalla Álbum del alumno (`adulto/album.js`) usa el mismo panel de álbumes cargados: crea, edita (nombre, portada, sobre, color, láminas) y quita los de la familia en `colecciones`; los del curso (y el de la app) se ven con «Del curso», sin Editar ni Quitar; no tiene ajustes del álbum ni pruebas/reinicio (del adulto del curso).
- **Premios y monedas:** la Tienda del alumno (`adulto/tienda.js`, ya en la lista blanca de rutas) crea, edita, pausa y quita premios de la familia (`origen: 'familia'`; los del curso, «Del curso», solo se ven), entrega o anula canjes y **da monedas** (`regalo`). «Corregir el saldo» queda solo para el adulto del curso. **Un solo saldo:** `cargarMonedas`/`saldo` de siempre sumando los movimientos del alumno (jugando + `regalo` − `canje` − sobres): ningún cálculo aparte.
- **Orden (respuesta del usuario: «todo mezclado», regla de fecha confirmada):** `ordenarPorCreacion` (`core/colecciones.js`) y `ordenarPremios`/`premiosVisibles` (`core/album.js`): lo que no tiene `creado` (el álbum de la app, los álbumes cargados anteriores y los premios anteriores) va primero y conserva su orden (los premios por `orden`); todo lo nuevo, del curso o de la familia, lleva `creado` (`nuevaColeccion`, `nuevoPremio`; al editar se conserva) y va detrás por fecha. En la Tienda del adulto, las flechas de orden solo cambian el `orden` de lo anterior a esta regla.
- **Publicar y respaldar:** `colecciones` entra a `CLAVES_FAMILIA` (así a `contenidoFamilia` y a `separarFamilia`), a `ALMACENES_RESPALDO` (respaldo del alumno y copia de seguridad) y a `ALMACENES_DEL_PERFIL` (sus portadas y sobres cuentan como medios del curso/perfil para subirlos a `familia/`); `sync-aula.js` del alumno la lee. Sus medios (portada, sobre, láminas, foto del premio) van a `alumnos/<correo>/familia/` y nunca al Drive del adulto ni a la Biblioteca; los movimientos (monedas, canjes) viajan como todo el avance del alumno. Al reinstalar, `respaldarAlumno` los recupera.
- **Al adulto, en la ficha del alumno (Álbum de la ficha):** `resumenDeMonedas` (`core/album.js`): **saldo**, **monedas dadas por la familia** (movimientos `regalo`), **premios canjeados** (con su nombre y si ya se entregó) y **avance en los álbumes de la familia** (láminas pegadas de cada uno; la lista llega en `contenidoFamilia`, sin imágenes). Sus imágenes solo con «Traer el material de la familia»; «Alumnos» cuenta también álbumes y premios agregados.
- **Límites:** (1) la familia no puede cambiar el tamaño del álbum ni las monedas por lección (son del curso) ni las láminas del álbum de la app; (2) un álbum de la familia sin láminas no cuenta (como los del curso); (3) las láminas sueltas de la familia entran al álbum de la app solo si ese álbum no tiene lista de láminas fijada por el adulto; (4) «Corregir el saldo» no está para la familia.
- **Pruebas:** `tests/familia.test.js` (+3): el orden mezclado y su regla de fecha (álbumes y premios), y de punta a punta con el Drive falso: la familia crea álbum (portada, sobre, 2 láminas), premio con foto, da 100 monedas, compra un sobre del álbum de la familia y canjea → un solo saldo (ganado + dado − sobre − canje), todo `origen: 'familia'`, lista en `contenidoFamilia`, los 5 medios en `familia/` y ninguno en la Biblioteca ni en el celular del adulto, estadística de la ficha igual al saldo del alumno, y respaldo/recuperación al reinstalar de `colecciones`, premios y monedas. **Navegador** (alumno en `127.0.0.1:8080` con datos locales y adulto en `localhost:8080` con una ficha sembrada): la Tienda del alumno muestra «Dar monedas», el premio del curso «Del curso» sin botones y el nuevo «De la familia» con Editar/Quitar; dar 20 monedas y crear el premio (con emoji) por la pantalla; crear un álbum de la familia por la pantalla con 4 imágenes (portada, sobre y 2 láminas → 4 medios `familia`; `perfil.colecciones` intacto); la pantalla del niño lista «Mi álbum, Dinos, Los abuelos» y compra un sobre del álbum de la familia (saldo 20 → 15); y la ficha en el adulto muestra saldo 75, 100 monedas dadas por la familia, 1 premio canjeado («Paseo con los abuelos · entregado») y «Los abuelos · 1 de 3 láminas pegadas». **No se repitió** en el navegador la sincronización con la nube simulada de estos nuevos almacenes (cubierta con el Drive falso en Node; la del resto de la familia sí se hizo en el primer commit de la fase).

### Fase 25 — Migración real, ayuda y textos
- Actualización automática de aulas v1 (fase 22) probada con un aula creada por la 0.36 en la nube simulada, con un alumno ya conectado.
- Ayuda del adulto, `privacidad.html`, «Acerca de», `README.md` y `docs/google-cloud.md` con la Biblioteca, los cursos con varios alumnos, el menú adulto reducido del celular del alumno, el contenido de la familia (sus estadísticas llegan; su material solo con el botón) y el Drive del alumno (y el aviso de que un alumno invitado puede abrir cualquier archivo de la Biblioteca fuera de la app). Repaso de textos: «perfil» y «alumno», sin «niño» para el perfil.
- `PRECACHE` y `VERSION` al día; estado en `CLAUDE.md`.
- **Acepta si:** `npm test` en verde, la prueba de punta a punta (dos alumnos en un curso, uno con contenido de la familia) repetida tras `location.reload()` y con el service worker activo, y la ayuda revisada.

### Fase 26 — Ver y limpiar lo redundante en el Drive del adulto
- **Pantalla nueva** en el modo adulto: **«Espacio en Drive»** (en Cuenta, solo con sesión iniciada). Botón «Revisar mi Drive»: recorre `appDataFolder` y `Leo Conmigo/` (Biblioteca y aulas) **solo leyendo**, y muestra por grupo cuántos archivos son, cuánto pesan (`size` de Drive) y dónde están:
  - **Voces del catálogo copiadas:** `medio-*` de medios con `origen: 'catalogo'` (o unidos en la fase 21) en `appDataFolder`, en aulas o en la Biblioteca. Ya vienen en la app.
  - **Copias repetidas:** el mismo medio (mismo `id`, o mismo contenido: igual `md5Checksum` y tamaño) en más de un lugar (p. ej. un aula v1 y la Biblioteca).
  - **Medios sin uso:** `medio-*` cuyo medio ya no existe, está borrado o no lo usa ningún perfil ni curso.
  - **Restos de aulas viejas:** `medio-*` que quedaron dentro de un aula v1 después de migrar.
- Cada grupo se puede abrir para ver la lista (nombre, lugar, tamaño) y tiene su botón **«Eliminar estos archivos»**, con una confirmación que dice cuántos archivos, cuánto espacio y que **no se puede deshacer**. Se borran con la API de Drive solo los archivos de esa lista, y nunca: archivos de `alumnos/<correo>/` (son del alumno), `data.json`, `adulto.json`, `aula.json`, ni un medio que hoy use algún perfil, curso o alumno (se vuelve a comprobar justo antes de borrar). Al terminar, se muestra cuánto se liberó.
- La lógica que clasifica los archivos es pura (`core/limpieza.js`, con pruebas): recibe las listas de Drive y los registros del almacén y devuelve los grupos.
- **Acepta si:** con el Drive falso lleno como lo habría dejado la 0.36 (voces del catálogo en `appDataFolder` y en un aula, un aula v1 migrada, un medio borrado con su archivo aún en Drive), la pantalla muestra cada grupo con su número y tamaño; eliminar un grupo borra exactamente esos archivos y nada más; un medio en uso o un archivo de un alumno nunca aparece en ningún grupo; después de limpiar, la sincronización personal y la del aula siguen funcionando y el alumno sigue jugando.

### Fuera de alcance (preguntar antes)
- Que el adulto pase contenido de la familia a un curso, o que la familia lo comparta con otros alumnos.
- Que el adulto juegue «como» un alumno o edite el avance de una ficha.
- Audios propios por curso (el usuario dijo que no existen).

---

## 10. Notas para el desarrollo

- **Git:** commit al cerrar cada fase con un mensaje claro. **No hacer `git push`** (no puede autenticarse desde este equipo): el usuario sube los cambios.
- **Pruebas locales:** servir la carpeta en `http://localhost:<puerto>` (por ejemplo `npx serve .` o `python -m http.server 8080`); ese origen debe estar autorizado en el cliente OAuth «MindSpark» para la fase 7.
- **`CLIENT_ID`:** tomarlo del código de ZenBan o ApiTrack, o pedírselo al usuario. Recordarle agregar `https://mindsparkapps.github.io` y el `localhost` usado como orígenes autorizados.
- Sin frameworks ni librerías externas salvo que una fase lo justifique y el usuario lo apruebe.
- Todo el texto de la interfaz, el código (nombres de funciones y variables) y los comentarios en español.
- Probar en Chrome de Android y en Safari de iPhone/iPad: son los que más fallan con audio, `MediaRecorder` y almacenamiento.
