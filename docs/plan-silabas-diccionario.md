# Plan: grabar todas las sílabas del español

**Estado:** propuesta, pendiente de aprobación del usuario. No ejecutar nada hasta que la apruebe.

**Objetivo:** que cualquier palabra del español, incluidas las que agregue el adulto, tenga grabada con la voz de Catalina cada una de sus sílabas, para que Lectura (S1) y Escritura nunca caigan en la voz sintética al decir una sílaba.

**Quién la ejecuta:** una sesión de Sonnet, por fases. Al final de cada fase hace un commit y se detiene donde el plan marca «⏸ el usuario decide». Antes de empezar debe leer, enteros, `CLAUDE.md`, este plan y `docs/voces-elevenlabs.md`.

---

## Situación actual (21 de noviembre de 2026)

| Dato | Valor |
|---|---|
| Sílabas grabadas | 801 (`SILABAS` en `js/silabas-voz.js`) |
| Peso de las sílabas | 9,78 MB, unos 12,5 KB por mp3 (de 10 a 17 KB) |
| Peso de todas las voces | 24,7 MB en 1.585 archivos (todas en `PRECACHE`) |
| Sílabas de las palabras y frases de la app | 446, todas grabadas |

### Estimación de lo que falta

Esto se calcula, no se adivina: la fase 1 entrega el número exacto.

- Las palabras del diccionario (lemas y sus formas conjugadas) usan entre **2.000 y 3.000 sílabas escritas distintas**, contando como sílabas distintas las que llevan tilde (`pá` ≠ `pa`).
- Faltarían entre **1.200 y 2.200**.
- **Peso:** entre 1.200 × 12,5 KB ≈ **15 MB** y 2.200 × 12,5 KB ≈ **27 MB**. La carpeta de sílabas quedaría en 25 a 37 MB y todas las voces en 40 a 52 MB.
- **Costo en ElevenLabs:** se cobra por carácter del texto. Unos 4 caracteres por sílaba dan entre 5.000 y 9.000 caracteres, más los reintentos de las que salgan mal. Antes de la fase 3 hay que confirmar en la cuenta cuánto saldo queda y si `previous_text` también se cobra.

Si se quiere menos peso, un umbral de frecuencia (fase 1) deja fuera las sílabas que solo aparecen en palabras rarísimas.

---

## Fase 1. Lista de palabras y sílabas (sin generar audio)

1. **Fuente.** Se propone el **listado de frecuencias del CREA (RAE)**, que es público: todas las formas escritas del corpus, con su frecuencia. Si no se puede descargar, la alternativa es el diccionario `es_ES` de Hunspell (LibreOffice), expandido con sus afijos.
   - Al descargar, se dice antes el nombre, la fuente y el tamaño, y se espera el sí del usuario.
   - Va a una carpeta propia y vacía, fuera del repositorio (en el scratchpad). Es un dato no confiable: se lee con un script escrito en otra carpeta y nunca se ejecuta nada de ella.
   - Al repositorio solo entra la lista de sílabas que se deriva de ella, nunca el diccionario. Hay que revisar sus condiciones de uso.
2. **Filtro de palabras:**
   - Solo letras del español (`a–z`, `ñ`, vocales con tilde, `ü`), en minúscula.
   - Fuera siglas (todo mayúsculas), palabras con dígitos y extranjerismos evidentes (con `k`, `w`, `sh` o terminadas en consonante doble). Esto último se marca, no se borra: el usuario decide.
   - Se guarda la frecuencia de cada palabra.
3. **Silabeo.** Se usa el de la app (`silabear` en `js/core/silabas.js`, el mismo que usa `silabasDe`), para que las sílabas coincidan con las que pedirá la app. Antes de usarlo se agregan pruebas con casos difíciles y se corrige lo que falle:
   - hiatos: «ríe», «país», «leer», «poeta»
   - diptongos y triptongos: «buey», «guau», «averiguáis»
   - grupos que no se separan: «atleta», «tl», «pr», «bl»
   - «ch», «ll», «rr», «qu», «gu», «gü»
   - «x»: «taxi», «examen», «México»
   - «y» final: «rey»
   - prefijos: «subrayar», «transporte»
   - «h» intercalada: «ahí», «búho»

   Si un caso cambia cómo la app ya separa una palabra del catálogo, se pregunta antes de tocarlo.
4. **Salida:** el script `herramientas/silabas-diccionario.mjs` escribe `data/voces/silabas-diccionario.json`. Cada sílaba que falta lleva: `texto` (en minúscula), `frecuencia` (la suma de las frecuencias de las palabras que la usan), `ejemplos` (hasta 3 palabras), `riesgo` y `enviado` (de la fase 2). Excluye lo que ya está en `SILABAS`.
5. **Informe para el usuario:**
   - cuántas sílabas faltan en total;
   - cuántas faltan para cubrir el 99 %, el 99,9 % y el 100 % de las palabras del corpus;
   - el peso estimado de cada opción (número × 12,5 KB);
   - el costo en caracteres de cada opción;
   - 30 ejemplos con su palabra.

**⏸ El usuario decide** el umbral de frecuencia, qué hacer con los extranjerismos y si se descarga el diccionario.

## Fase 2. Qué texto enviar por cada sílaba (reglas de generación)

Todas las peticiones van con estos datos fijos:

| Dato | Valor |
|---|---|
| Voz | Catalina, `5yNXxdAaHAkq8N8bGqwQ` |
| Modelo | `eleven_v4` |
| Idioma | `language_code: "es"` |
| Normalización | `apply_text_normalization: "off"` (sin esto se leen abreviaturas: «doc» → «docente», «nos» → «números») |
| Formato | `mp3_44100_128` |
| `similarity_boost` | 0,75 |

El archivo es siempre el de `archivoDe` en `js/silabas-voz.js`: sin tildes, `-t` si la sílaba lleva tilde y `ny` en lugar de `ñ`. Solo cambia el **texto enviado**.

En el script se asigna a cada sílaba una «receta» según su forma. La primera regla que calza manda:

| N.º | Forma de la sílaba | Ejemplos ya vistos | Texto enviado | Contexto¹ | stability |
|---|---|---|---|---|---|
| 1 | Empieza con «h» (muda) | hi, her, hor, ham, hier, hí | sin la «h», con acento: `í`, `ér`, `ór`, `ám`, `iér` | sí | 0,9 |
| 2 | Termina en «-er» | ber, der (con acento sonaban «beegg», «deegg») | **sin** acento: `ber`, `der` | sí | 0,9 |
| 3 | Empieza con «j» | ja, jun (con acento sonaban «ya», «yun») | **sin** acento: `ja`, `jun` | sí | 0,9 |
| 4 | Lleva «x» | xi (taxi) | `ks` en lugar de `x`: `ksí` | sí | 0,9 |
| 5 | «eu», «ei» u «oi» seguido de «r» | ceur (sonaba francés) | acento en la vocal cerrada: `seúr` | sí | 0,9 |
| 6 | Interjección o sonido de animal | guau, miau, bua | sin acento ni signos | sí | 0,9 |
| 7 | Ya lleva tilde | miér, nú, tá | igual | sí | 0,9 |
| 8 | Cualquier otra | so, mar, far, go, cor, doc, nos, lle, ca | acento en la vocal fuerte (en «ui», la segunda: `uí`; en «qu» o «gu» con e/i, la «u» no cuenta): `só`, `már`, `dóc`, `llé` | sí | 0,9 |

¹ Contexto: `previous_text: "Ahora repite la sílaba en español, con voz tranquila y neutra: "`. No se pronuncia.

La receta 8 es la que mejor resultado dio en las tandas 3 y 4. Las recetas 2 y 3 salen de los fallos de esa misma receta. Por la experiencia de las tandas anteriores, se espera que entre el 5 % y el 10 % de las sílabas igual necesiten un segundo intento.

**Orden de los intentos** cuando una sílaba suena mal. Se anota en el JSON (`intento`, `problema`) y se pasa al siguiente:

1. la receta de la tabla;
2. quitar el acento, o ponerlo si no lo tenía, manteniendo el contexto;
3. mover el acento a la otra vocal;
4. cambiar la grafía por una que suene igual en español («ks», sin «h»);
5. generarla dentro de una palabra española y recortarla (todavía no hizo falta).

No usar espacios ni guiones, porque meten pausas.

**Vocabulario del usuario:** «anglo» quiere decir que suena en inglés. «Dice X» quiere decir que leyó otra palabra (una abreviatura o una letra cambiada). «La deletrea» quiere decir que dijo las letras una por una.

## Fase 3. Generar por tandas

1. Generar con `node herramientas/regenerar-silabas.mjs --lista=data/voces/silabas-diccionario.json`, ampliado para aceptar `--desde`/`--hasta` y así hacer tandas de 200. Va en orden alfabético, con 3 peticiones en paralelo y reintentos ante el error 429. Las sílabas se anotan en `SILABAS`.
2. **Sin precarga.** Estas sílabas **no** van a `PRECACHE`, porque duplicarían la descarga inicial. El service worker ya guarda en caché todo lo que se pide (`cacheYActualizar` en `sw.js`), así que cada sílaba queda disponible sin conexión después de oírla una vez. Esto es una excepción a la regla de `CLAUDE.md` sobre `PRECACHE` y debe anotarse ahí.
   - Si el usuario prefiere que todo funcione sin conexión desde el primer uso, la alternativa es precargar solo las sílabas de las palabras que el adulto agregue, cuando las agrega.
3. Subir `VERSION` y hacer un commit por tanda.

**⏸ El usuario confirma** el saldo de ElevenLabs y la decisión sobre la precarga antes de la primera tanda.

## Fase 4. Revisión a oído

1. En el revisor, un botón por tanda: «Probar sílabas del diccionario 1 a 200», y así. Cada tanda va en orden alfabético.
2. Mientras una tanda no esté aprobada, sus sílabas no salen en «Probar sílabas». Al aprobarla, pasan a «Probar sílabas» y su botón desaparece (como se hizo con la tanda 1 de Escritura).
3. El usuario marca las malas y copia la lista. Se corrigen con el orden de intentos de la fase 2 y se oyen en un botón «Revisión» de esa tanda. Cuando el usuario lo pida, todo pasa a «Probar sílabas».

## Fase 5. Cierre

- Pruebas en `npm test`:
  - toda sílaba de `silabas-diccionario.json` está en `SILABAS` y tiene su mp3;
  - lo que devuelve `silabear` para las palabras del catálogo no cambió, salvo lo aprobado.
- `docs/voces-elevenlabs.md`: agregar las recetas que resultaron mejores, las fallidas y una tabla de correcciones.
- `CLAUDE.md`: anotar la excepción de precarga y dónde está la lista.
- Volver a correr el control de cobertura (todas las sílabas de todas las palabras tienen mp3) y dejarlo como script: `herramientas/cobertura-silabas.mjs`.

## Lo que este plan no cambia

- Las reglas pedagógicas y las actividades.
- Las 801 sílabas que ya están aprobadas.
- El catálogo de palabras.
