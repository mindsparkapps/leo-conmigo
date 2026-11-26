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
- **Sílabas:** `data/voces/silabas/<sílaba sin tildes>.mp3`, con sufijo `-t` si la sílaba llevaba tilde (`pá` → `pa-t.mp3`, para que `pa` y `pá` no choquen). La `ñ` se escribe `ny` y la `ü` `uu` (`güe` → `guue.mp3`, para que no choque con `gué` → `gue-t.mp3`). Anotada en `SILABAS` de `js/silabas-voz.js` y en `PRECACHE`.
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

Las 265 sílabas de S1 se generaron el 15 de noviembre **sin** `apply_text_normalization: "off"`, por eso varias leían la palabra abreviada. Se regeneraron con `herramientas/regenerar-silabas.mjs`, que lee `data/voces/correcciones-silabas.json` (sílaba, texto enviado, problema y, si hace falta, `contexto: true`). Ya revisadas, están en «Probar sílabas» del revisor (los botones aparte se quitaron).

**Vocabulario del usuario:** cuando dice que una sílaba suena **«anglo»** quiere decir que suena en inglés (anglosajona). Se trata como la fila «Suena inglesa» de arriba: acento en la vocal y normalización off.

| Problema oído | Casos | Qué se envió (1.er intento) |
|---|---|---|
| Anglo | so, man, can, to, glo («glow»), fru, fra, tor, cor, jar, far, car, sar, go, mar, or, lar, guar, por, do, per | acento en la vocal: `só`, `mán`, `cán`, `tó`, `gló`… |
| Anglo con «h» muda | her, hor, ham | sin la «h» y con acento: `ér`, `ór`, `ám` |
| Se lee la palabra abreviada | ca («circa»), jue («jueves»), doc («docente»), cal («calle»), lim («límites»), nos («números»), jun («junio»), gen («general») | acento y normalización off: `cá`, `jué`, `dóc`, `cál`, `lím`, `nós`, `jún`, `gén` |
| Abreviada aunque ya tenía tilde | miér («miércoles»), nú («número») | mismo texto + contexto (`previous_text`) + stability 0.9 |
| Otra letra | ja («ya»), mie («nie») | `já`, `mié` |
| La deletrea | lle | `llé` |

**2.º intento** (las que el acento no arregló): doc («dos»), ja («ya»), jun («yun»: la «j» se lee como «y»), y anglo cor, hor, go, or, sar, far. Se enviaron sin acento, con contexto y stability 0.9 (`hor` como `or`). En el JSON llevan `"intento": 2`.

**3.er intento** (siguieron anglo tras el 2.º: hor, go, or, far): acento **y** contexto + stability 0.9 a la vez (`ór`, `gó`, `ór`, `fár`); `"intento": 3`. Resultado del 2.º intento: doc, ja, jun, cor y sar quedaron bien con contexto sin acento.

**Receta que mejor funcionó para las anglo:** acento en la vocal **y** contexto + stability 0.9 a la vez. Por eso en la tanda 3 (21 de noviembre, `"tanda": 3` en el JSON) se usó directamente en due, her, ár, cue, hier (`iér`), sir, vein, bar, ar, bor, er, fre, gre, ber, bin, bir, bre, bri, clu, coin y dain. Varias (ar, bor, er, her) ya habían fallado solo con acento. `dain` se generó de nuevo como `dáin`; `dein` sigue siendo el audio intercambiado de la tanda 1.

**ber** sonaba «beegg» con `bér` + contexto (como «ceur» → «seeerg»): se probó `ber` sin acento con contexto, la receta que arregló cor y sar.

### Sílabas nuevas: todas las sílabas de todas las palabras y frases (21 de noviembre de 2026)

Lectura solo dice la primera sílaba de cada palabra (S1), pero Escritura puede usar cualquiera. Se generaron las 72 que faltaban de las palabras del catálogo, el banco de Escritura (palabras, frases y textos) y los cuentos (por ejemplo «riz», «ción», «món», «tá», «toy» y «llue»). Están en `data/voces/silabas-nuevas.json`, con el mismo formato que las correcciones, y se generaron con `node herramientas/regenerar-silabas.mjs --lista=data/voces/silabas-nuevas.json`, que también las anota en `SILABAS` y `PRECACHE`. La receta usada para todas fue acento en la vocal fuerte + contexto + stability 0.9, con dos excepciones: `xi` se envió como `ksí` y `hí` como `í`. En el mismo archivo van las 12 de «calienta» (lien y sus distractoras).

Primero se oyeron en un botón aparte, «Probar sílabas nuevas». Después se pasaron a «Probar sílabas» y el botón se quitó. `silabas-nuevas.json` queda solo como registro de qué se envió. `der` sonaba «deegg» con `dér` + contexto, igual que `ber`, y se regeneró como `der` sin acento con contexto.

Para ver si falta alguna, se juntan las sílabas de todas las palabras y frases (con `silabasDe` de `core/silabeo.js` para los textos sin sílabas marcadas), en minúscula, y se comparan con `rutaDeSilaba`.

Para una que siga mal: cambiar `enviado` (o agregar `"contexto": true` o `"stability"`) en el JSON y correr `node herramientas/regenerar-silabas.mjs <sílaba>`; subir `VERSION`.

Orden sugerido para una sílaba que sigue mal: (1) normalización off; (2) acento en la vocal fuerte; (3) sin acento + contexto + stability 0.9; (4) mover el acento a la otra vocal; (5) generarla dentro de una palabra española y recortarla (no hizo falta todavía). Los espacios y guiones meten pausas: evitarlos.


- La API no deja transcribir (la clave no tiene `speech_to_text`), así que lo único que comprueba el resultado es oírlo en el revisor. Si una sigue mal, probar otra grafía y volver a oírla.

`herramientas/generar-voces.mjs` ya manda `apply_text_normalization: "off"` y `stability: 0.6` para las sílabas. Para las que están en `data/voces/tanda-escritura.json` con `"revisar": true`, el revisor las saca de su tanda y las ofrece aparte en el botón «Revisión tanda 1».

### Correcciones de la tanda 2 de Escritura (21 de noviembre de 2026)

Tras oír las voces nuevas 201 a 400 el usuario marcó 37 sílabas. Se regeneraron con `node herramientas/regenerar-silabas.mjs --lista=data/voces/correcciones-tanda2.json` (todas con contexto + stability 0.9, `"intento": 1`) y salieron de su tanda (`"revisar": 2` en `data/voces/tanda-escritura.json`): se oyen en el botón «Revisión tanda 2».

| Problema oído | Casos | Qué se envió |
|---|---|---|
| Acento francés | flur, peur, poir, puz, teun, puir | acento en la vocal cerrada: `flúr`, `peúr`, `poír`, `púz`, `teún`, `puír` |
| Anglo | for, plon, mor, pair, peir, mur, od, liz, gren, grin, rai, sor, tin, tion, tram, sun, tain, tein, sur, gro, grun, gun | acento en la vocal fuerte: `fór`, `plón`, `mór`, `páir`… |
| Suena agotada | fua | sin acento: `fua` |
| La deletrea | ie | `ié` |
| Dice otra palabra | lun («lunes»), min («minutos»), oz («onza»), pos y poz («posición»), pun («punto»), sen («senador») | acento: `lún`, `mín`, `óz`, `pós`, `póz`, `pún`, `sén` |

Las 37 salieron bien y pasaron a «Probar sílabas» (`"aprobada": true` en `tanda-escritura.json`). Segunda ronda de la misma tanda, 25 sílabas (`data/voces/correcciones-tanda2b.json`, también «Revisión tanda 2»; `pue` va como entrada `"extra": true` porque no es de ninguna tanda):

| Problema oído | Casos | Qué se envió |
|---|---|---|
| Anglo con «h» muda | hei, hia, hie, hio, hoi, hui, huo | sin la «h» y con acento (receta 1): `éi`, `iá`, `ié`, `ió`, `ói`, `uí`, `uó` |
| Anglo | is, gais, tau, toin, tim, tis, plun, il | acento: `ís`, `gáis`, `táu`, `tóin`, `tím`, `tís`, `plún`, `íl` |
| «g» suave leída como «y» (debe sonar «j») | ge, gia, gias, gie, gio | con «j» y sin acento: `je`, `jia`, `jias`, `jie`, `jio` |
| Dice «lii» | gli | `glí` |
| «güi» sonaba «gui» (debe oírse la u y luego la i) | güi | acento en la «u»: `gúi` |
| La deletrea en inglés | id | `íd` |
| Tono de paz | paz | `páz` |
| Francesa | pue | `pué` |

Tercera ronda (`data/voces/correcciones-tanda2c.json`, `"intento": 2`): de las 25, quedaron aprobadas 21 y seguían mal 4, más `peu` (francesa). `je` y `jia`/`jie` sin acento seguían leyéndose «ye»: se probó con acento (`jé`, `jiá`, `jié`). `gúi` sonaba «gi»: se probó `güí` (diéresis y acento).

`güi` (cuarta ronda, `correcciones-tanda2d.json`, `"intento": 3`): `güí` seguía sonando «gi»; se probó la grafía `guuí`.

**`güi` quedó bien** con la receta de la tanda 1 de Escritura: `güi` **sin contexto**, stability 0,5 (se eligió entre cuatro pruebas: `gwí`, `guwí` y `guúi` con contexto, y esta). Es la excepción: para las sílabas con diéresis no usar contexto ni acento. Todas las corregidas de la tanda 2 pasaron a «Probar sílabas» y el resto de la tanda 2 se vuelve a oír completo.

Al volver a oír la tanda 2 (25 de noviembre) solo `fro` sonaba muy anglo: va en `correcciones-tanda2e.json` con la receta de las anglo (`fró` + contexto + stability 0.9) y `"revisar": 2` («Revisión tanda 2»). Las otras 137 pasaron a «Probar sílabas» y el botón «Probar voces nuevas de Escritura 201 a 400» se quitó (el revisor esconde el botón de una tanda que ya no tiene nada por oír). `fró` con contexto salió bien y pasó a «Probar sílabas».

### Correcciones de «Probar sílabas del diccionario 1 a 200» (25 de noviembre de 2026)

Se oyeron mal `ahu` (decía «aju»: la «h» muda se leía como «j»), `bér` («berggg», francesa) y `cher` («cherrgg»). `correcciones-diccionario1.json`: `ahu` → `aú` (sin la «h», acento en la «u» para mantener el hiato) y `cher` → `chér`, con contexto + stability 0.9. `bér`: se copió `ber.mp3` (aprobada, la receta «sin acento + contexto») a `ber-t.mp3`; aislada, `bér` y `ber` suenan igual. Las tres van como entradas `"extra": true` con `"revisar": 4` en `tanda-escritura.json` (botón «Revisión tanda 4») y el revisor las saca de su lista del diccionario mientras estén en revisión. Los mp3 del diccionario NO van a `PRECACHE`: `regenerar-silabas.mjs` los anota ahí aunque no estén en la lista del diccionario; revertir `sw.js` después.

`ahu` y `bér` salieron bien y se aprobaron; con ellas la tanda 1 del diccionario quedó aprobada (`TANDAS_DEL_DICCIONARIO_APROBADAS` en el revisor) y su botón se quitó. `cher` con `chér` siguió francesa: tercer intento `chérr` (`correcciones-diccionario1b.json`). De «diccionario 201 a 400» se corrigieron `dér` (francesa, «g» final: se copió `der.mp3`, aprobada, a `der-t.mp3`, igual que `bér`) y `flec` (decía «fles»: `fléc` → `flék`, la «k» fuerza el sonido duro). Las tres salieron bien: `chérr`, la copia de `der.mp3` y `flék` quedaron aprobadas, y con ellas la tanda 2 del diccionario (201 a 400); su botón y «Revisión tanda 4» se quitaron.

**Diccionario 401 a 600** (`correcciones-diccionario3.json`): las 18 sílabas con «j» (jac, jan, ján, jé, jen, jez, jí, jia, jie, jié, jim, jin, jis, jon, jón, jou, jus, jús) sonaban con la «j» como «y» porque la receta 3 del diccionario (sin acento) falla con «j» seguida de e/i/a; sirvió la de `ge`/`gia`/`gie` de la tanda 2: **acento en la vocal + contexto + stability 0.9** (`jác`, `jén`, `jiá`, `jié`, `jóu`…; las dos grafías de una misma sílaba, con y sin tilde, se enviaron con el mismo texto). `lac` y `lác` sonaban «las» (la «c» final como «s»): se envió `lák`, igual que `flec`. Van como extras con `"revisar": 5` («Revisión tanda 5»). Las 20 salieron bien y se aprobaron, con toda la tanda 3 del diccionario (401 a 600); sus botones se quitaron.

**Diccionario 601 a 1000** (26 de noviembre, `correcciones-diccionario4.json`, «Revisión tanda 6»), 16 sílabas que el usuario marcó mientras oía las tandas 4 a 7 del diccionario:

| Problema oído | Casos | Qué se envió (contexto + stability 0.9) |
|---|---|---|
| «c» final suena «s» o «ts» | lic, nec, néc, rac, vic, xac | con «k»: `lík`, `nék`, `rák`, `vík`; `xac` como `ksák` (igual que `xi` → `ksí`) |
| «h» muda suena «j» | prohi, rahu, rehi, rehir, sahi, sahu, truha | sin la «h» y con acento en la vocal débil (marca el hiato): `proí`, `raú`, `reí`, `reír`, `saí`, `saú`, `trúa` |
| Francesa (acabada en «r»/«s») | nér, reins | `nér` → `ner` sin acento (receta 2, como `ber` y `der`); `reins` → `reíns` (acento en la vocal cerrada) |
| Dice «tien» | tián | `tiyán` (la «y» deja el hiato como semivocal) |

Segunda ronda (`correcciones-diccionario4b.json`): `raú` sonaba «raul» → `ráu`; `tiyán` sonaba «tiyan» → `tian` sin acento + contexto (el paso 3 del orden sugerido).

Tercera ronda de `tián` (`correcciones-diccionario4c.json`): `tian` con contexto seguía diciendo «tien»; se probó `tián` **sin contexto**, stability 0.5 (como `güi`).

Cuarta ronda (`correcciones-diccionario4d.json`): `mohi` y `zahi` sonaban con «j» → `moí`, `zaí` (igual que las otras con «h» muda); `toim` sonaba «toin» → `tóimm` (la «m» doble final marca más la «m»); `tián` seguía «tien», algo asiático, también sin contexto → `tiáan`.

Las 19 corregidas de esta ronda salieron bien y se aprobaron, y con ellas las 7 tandas del diccionario (1301 sílabas): todo pasó a «Probar sílabas» y se quitaron todos los botones del diccionario y de revisión.

(Mientras estuvieron en revisión) las que estaban en una tanda sin aprobar siguen saliendo de su lista del diccionario mientras están en revisión. Con la «k» se evita la «s»: probar primero `lík`-like antes de acentuar.

### Correcciones de la tanda 3 de Escritura (25 de noviembre de 2026)

De las voces nuevas 401 a 600 el usuario marcó 10. Van en `data/voces/correcciones-tanda3.json`, todas con contexto + stability 0.9 (`"intento": 1`), y salieron de su tanda con `"revisar": 3` («Revisión tanda 3»). Tres son **palabras** (`tractor`, `guau`, `miau`): llevan `ruta` (el mp3 de la palabra, que `regenerar-silabas.mjs` sobrescribe sin anotarla como sílaba) y `contexto` con la frase «Ahora repite la palabra en español…» en vez de «la sílaba».

| Problema oído | Casos | Qué se envió |
|---|---|---|
| Anglo | tric, trim, tuin, tur, ur, tractor | acento: `tríc`, `trím`, `tuín`, `túr`, `úr`, `tractór` |
| Se lee la palabra abreviada | ul («calle») | `úl` |
| Otra vocal | vau («vao») | `váu` |
| Entonación de asombro / de maullido | guau, miau (palabras) | sin acento, como se arreglaron las sílabas `guau` y `miau` en la tanda 1 |

`guau` y `miau` siguieron con el mismo problema (algo menos) con contexto de palabra. Como la sílaba y la palabra suenan igual, se copiaron los mp3 de las sílabas ya aprobadas (`silabas/guau.mp3` → `guau.mp3`, `silabas/miau.mp3` → `miau.mp3`) en vez de seguir probando: es gratis y ya se sabe que suenan bien. Si una palabra suena igual que una sílaba aprobada (o al revés), copiar antes de regenerar.

## Revisar a oído

La app tiene en Ajustes (modo adulto) el panel **«Revisar las voces»**: reproduce todas las grabaciones seguidas, con pausa, retroceso de 10 s y barra, y permite marcar las malas y copiar la lista («N.º 139 de 280 (tramo) · Sílaba: go»). Para regenerar una mala: borrar su mp3 (o sobrescribirlo) y pedirla otra vez con `language_code: "es"`. Una sílaba suelta puede sonar rara; si pasa, probar escribiéndola de otra forma (por ejemplo con una vocal de apoyo) y regenerar.

El estado de las palabras del catálogo de lectura está en `data/voces/PENDIENTES.md`.
