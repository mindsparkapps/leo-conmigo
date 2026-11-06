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
