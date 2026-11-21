# Cómo generar las voces de la app (ElevenLabs)

Guía para generar voces nuevas desde cualquier chat o sesión futura sin tener que redescubrirlo.

## Datos fijos

| Dato | Valor |
|---|---|
| Personaje (voz) | **Catalina**, ID `5yNXxdAaHAkq8N8bGqwQ`. Usar siempre la misma. |
| Modelo | `eleven_v4` (no existen `eleven_v4_alpha` ni `eleven_multilingual_v4`) |
| Ajustes | `stability: 0.5`, `similarity_boost: 0.75` |
| Idioma | **Forzar español**: `language_code: "es"`. Sin él, las palabras cortas se detectan mal (`mar` suena «march», `doctor` en inglés, `ríe` como risa). |
| Formato | `mp3_44100_128` |
| Clave | Variable de entorno de usuario **`ELEVENLABS_API_KEY`** (empieza con `sk_`, 51 caracteres). No es el «ID de la clave». La clave solo tiene permiso de texto a voz (no puede listar modelos). Nunca se guarda en el repositorio. |
| Plan | Starter. Usar pocas peticiones en paralelo (el script usa 3) y reintentar ante 429. |

Petición: `POST https://api.elevenlabs.io/v1/text-to-speech/5yNXxdAaHAkq8N8bGqwQ?output_format=mp3_44100_128`
con cabecera `xi-api-key` y cuerpo `{ "text", "model_id": "eleven_v4", "language_code": "es", "voice_settings": {...} }`.

Si falla con 401 o 400 «invalid key»: la variable tiene un valor incompleto o es el ID de la clave. Hay que crear otra clave en ElevenLabs y guardar el `sk_...` completo en la variable (en PowerShell: `[Environment]::SetEnvironmentVariable('ELEVENLABS_API_KEY','sk_...','User')` y abrir un terminal nuevo).

## Dónde va cada audio

- **Palabras:** `data/voces/<palabra sin tildes>.mp3`, anotada en `data/voces/indice.json` y en `PRECACHE` de `sw.js`. (Las del catálogo de lectura además llevan `voz` en `data/vocabulario-inicial.json`; casos especiales: `bebe-verbo.mp3`, `con-palabra.mp3`.)
- **Sílabas:** `data/voces/silabas/<sílaba sin tildes>.mp3`, con sufijo `-t` si la sílaba llevaba tilde (`pá` → `pa-t.mp3`, para que `pa` y `pá` no choquen). Anotada en `SILABAS` de `js/silabas-voz.js` y en `PRECACHE`.
- **Frases fijas:** `data/voces/frases/<texto normalizado>.mp3`, anotada en `FRASES` de `js/frases-voz.js` (texto exacto → archivo) y en `PRECACHE`. Las frases de la app deben ser genéricas (sin cantidades variables).
- Los mp3 nuevos de `PRECACHE` obligan a subir `VERSION` en `js/config.js`.

## Flujo para el modo Escritura (lo automatizado)

```bash
node herramientas/listar-voces-escritura.mjs     # escribe data/escritura/faltan-voces.txt con lo que falta
node herramientas/generar-voces.mjs              # genera todo lo que falta e integra los índices
node herramientas/generar-voces.mjs --probar     # solo cuenta lo pendiente
node herramientas/generar-voces.mjs --solo=1,3,4 # solo algunas secciones del archivo
node herramientas/generar-voces.mjs --max=20     # solo las primeras N
node herramientas/listar-voces-escritura.mjs     # otra vez, para confirmar que no queda nada
npm test
```

`generar-voces.mjs` salta lo que ya tiene mp3, así que se puede repetir sin gastar créditos. No sube `VERSION` ni hace commit.

Para una sola voz suelta basta una petición como la de arriba y guardar el mp3 en la ruta que corresponda.

## Sílabas sueltas: fallos conocidos y cómo se corrigen

Una sílaba aislada sin contexto se lee mal de varias formas. Qué pasaba y qué sirvió (tanda 1 de Escritura, noviembre 2026):

- **Se lee la palabra que abrevia** («dra» → «doctora», «ed» → «edición», «vi» → «seis», «cli» → «ce-ele-i», «fla» → «Florida», «flia» → «familia», «bul» → «bulevar»): mandar `"apply_text_normalization": "off"`.
- **Suena inglés o francés** («dri» → «drai», «craz», «cur», «blun», «ceur», «doir»): escribirla con acento en la vocal fuerte (`drí`, `cráz`, `cúr`, `blún`…), que fuerza la lectura española. Mismo archivo de destino (`dri.mp3`), solo cambia el texto enviado.
- **Entonación de sorpresa, cansancio o maullido** («guau», «bua», «miau»): sin signos, con acento (`guáu`, `buá`, `miáu`) y `stability` 0.6.
- **Segundo intento** (cuando el acento no bastó: «guau», «miau», «bua», «ceur», «fler», «flie»): grafía sin acento, `previous_text` con una frase en español que no se pronuncia («Ahora repite la sílaba en español, con voz tranquila y neutra: »), `stability` 0.9 y normalización off. Las que terminan en «r» (`ceur`, `fler`) suenan francesas incluso con acento; `ceur` se probó como «seur».
### Tabla: qué se hizo en cada caso (todas son sílabas; el archivo no cambia, solo el texto que se envía)

Todas con `language_code: "es"`, `eleven_v4`, `apply_text_normalization: "off"`.

| Problema oído | Casos | Qué se envió |
|---|---|---|
| Se lee la palabra abreviada | dra, ed, vi, cli, fla, flia, bul | acento en la vocal fuerte: `drá`, `éd`, `ví`, `clí`, `flá`, `fliá`, `búl` (la clave es sobre todo la normalización off) |
| Suena inglesa o francesa | dri, craz, cur, cuz, blun, coir, doir, deur, fleu, flue, flie | acento: `drí`, `cráz`, `cúr`, `cúz`, `blún`, `cóir`, `dóir`, `déur`, `fléu`, `flué` |
| Inglesa en sílabas con «r» o consonantes dobles | ar, bor, bro, dre, dro, er, bur, clo, dior, doin, flir | acento: `ár`, `bór`, `bró`, `dré`, `dró`, `ér`, `búr`, `cló`, `diór`, `dóin`, `flír` |
| «dain» y «dein» sonaban cambiadas | dain, dein | no se regeneraron: se intercambiaron los dos archivos |
| «h» muda leída como «j» | hi | enviar solo la vocal: `í` |
| Se lee como la palabra inglesa | tle («tell») | `tlé` |
| Entonación de sorpresa, maullido o cansancio | guau, miau, bua, jo | acento (`guáu`, `miáu`, `buá`, `jó`) no bastó del todo para guau/miau/bua; sirvió: sin acento, `previous_text` (contexto en español que no se pronuncia) y `stability` 0.9 |
| Francesa con «r» final | ceur, fler | `fler` se arregló con contexto + stability 0.9 sin acento; `ceur` no con `ceur`, `céur` ni `seur`; tampoco `séur` con contexto (sonaba «seeerg»); `sé ur` (con espacio) sonó peor por la pausa; **sirvió `seúr`** (acento en la «u», no en la «e») con contexto + stability 0.9. Idea general para sílabas con «eu»/«ei»/«oi» + «r» que suenan francesas o inglesas: probar el acento en la vocal cerrada o en la otra vocal antes de recurrir a espacios o recortes |

### Tanda 2 de correcciones (sílabas de S1, 21 de noviembre de 2026)

Las 265 sílabas de S1 se generaron el 15 de noviembre **sin** `apply_text_normalization: "off"`, por eso varias leían la palabra abreviada. Se regeneraron con `herramientas/regenerar-silabas.mjs`, que lee `data/voces/correcciones-silabas.json` (sílaba, texto enviado, problema y, si hace falta, `contexto: true`). El revisor las ofrece aparte en el botón **«Sílabas corregidas»**.

**Vocabulario del usuario:** cuando dice que una sílaba suena **«anglo»** quiere decir que suena en inglés (anglosajona). Se trata como la fila «Suena inglesa» de arriba: acento en la vocal y normalización off.

| Problema oído | Casos | Qué se envió (1.er intento) |
|---|---|---|
| Anglo | so, man, can, to, glo («glow»), fru, fra, tor, cor, jar, far, car, sar, go, mar, or, lar, guar, por, do, per | acento en la vocal: `só`, `mán`, `cán`, `tó`, `gló`… |
| Anglo con «h» muda | her, hor, ham | sin la «h» y con acento: `ér`, `ór`, `ám` |
| Se lee la palabra abreviada | ca («circa»), jue («jueves»), doc («docente»), cal («calle»), lim («límites»), nos («números»), jun («junio»), gen («general») | acento y normalización off: `cá`, `jué`, `dóc`, `cál`, `lím`, `nós`, `jún`, `gén` |
| Abreviada aunque ya tenía tilde | miér («miércoles»), nú («número») | mismo texto + contexto (`previous_text`) + stability 0.9 |
| Otra letra | ja («ya»), mie («nie») | `já`, `mié` |
| La deletrea | lle | `llé` |

**2.º intento** (las que el acento no arregló): doc («dos»), ja («ya»), jun («yun»: la «j» se lee como «y»), y anglo cor, hor, go, or, sar, far. Se enviaron sin acento, con contexto y stability 0.9 (`hor` como `or`). En el JSON llevan `"intento": 2` y el revisor las ofrece en «Sílabas corregidas, intento 2».

**3.er intento** (siguieron anglo tras el 2.º: hor, go, or, far): acento **y** contexto + stability 0.9 a la vez (`ór`, `gó`, `ór`, `fár`); `"intento": 3`. Resultado del 2.º intento: doc, ja, jun, cor y sar quedaron bien con contexto sin acento.

Para una que siga mal: cambiar `enviado` (o agregar `"contexto": true` o `"stability"`) en el JSON y correr `node herramientas/regenerar-silabas.mjs <sílaba>`; subir `VERSION`.

Orden sugerido para una sílaba que sigue mal: (1) normalización off; (2) acento en la vocal fuerte; (3) sin acento + contexto + stability 0.9; (4) mover el acento a la otra vocal; (5) generarla dentro de una palabra española y recortarla (no hizo falta todavía). Los espacios y guiones meten pausas: evitarlos.


- La API no deja transcribir (la clave no tiene `speech_to_text`), así que lo único que comprueba el resultado es oírlo en el revisor. Si una sigue mal, probar otra grafía y volver a oírla.

`herramientas/generar-voces.mjs` ya manda `apply_text_normalization: "off"` y `stability: 0.6` para las sílabas. Para las que están en `data/voces/tanda-escritura.json` con `"revisar": true`, el revisor las saca de su tanda y las ofrece aparte en el botón «Revisión tanda 1».

## Revisar a oído

La app tiene en Ajustes (modo adulto) el panel **«Revisar las voces»**: reproduce todas las grabaciones seguidas, con pausa, retroceso de 10 s y barra, y permite marcar las malas y copiar la lista («N.º 139 de 280 (tramo) · Sílaba: go»). Para regenerar una mala: borrar su mp3 (o sobrescribirlo) y pedirla otra vez con `language_code: "es"`. Una sílaba suelta puede sonar rara; si pasa, probar escribiéndola de otra forma (por ejemplo con una vocal de apoyo) y regenerar.

El estado de las palabras del catálogo de lectura está en `data/voces/PENDIENTES.md`.
