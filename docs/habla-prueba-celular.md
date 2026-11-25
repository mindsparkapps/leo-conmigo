# Prueba del modo «Hablar» en celulares reales (fase 33b)

Esto lo hace **el usuario**, con el banco de pruebas `tests/navegador/habla-banco.html`. La fase 33a (en el PC) ya dejó medidas y un modelo que funciona; falta saber si **corre bien en un celular**. Toma unos 45 minutos con dos celulares Android (uno de gama media o baja). Ningún audio sale del celular.

## Lo que se quiere saber (criterios de la fase 33b)
1. **RTF < 0,5** en el celular de gama media (RTF = tiempo de cálculo ÷ duración del audio; 0,5 es «calcula en la mitad del tiempo que dura»).
2. **Menos de 3 s por palabra** desde que se termina de hablar hasta ver los fonemas.
3. La decodificación **detecta al menos 8 de cada 10 errores provocados** a propósito.

Referencia del PC (Chrome, 8 núcleos): RTF 0,09 con 1 hilo y 0,05 con 4 hilos; carga del modelo 2 a 4 s; 190 MB de memoria WASM. Un celular de gama media suele ser 5 a 10 veces más lento: si da RTF 0,5 o menos, pasa.

## Qué necesitas
- El PC y el celular en la **misma red Wi‑Fi**, o un cable USB.
- Chrome en el celular (Android). Opcional: Firefox, para comparar.
- El modelo en el PC, en `.modelos/model.int8.onnx` (ya está si se hizo la 33a; si no, ver «Si falta el modelo»).
- Una habitación silenciosa y un adulto que hable normal. El adolescente solo si se puede (el punto 6 es opcional).

## 1. Abrir el banco en el celular

El micrófono solo funciona en una página «segura» (`https` o `localhost`). Hay dos caminos:

**A) Con cable USB y `adb reverse` (el más simple; sirve `http`)**
1. En el celular: Ajustes → Acerca del teléfono → toca 7 veces «Número de compilación»; luego Opciones de desarrollador → activa «Depuración por USB».
2. Conecta el cable y, en el PC, en PowerShell (con `adb` de las «platform-tools» de Android):
   ```powershell
   adb reverse tcp:8080 tcp:8080
   ```
3. En el PC arranca el servidor desde la carpeta del proyecto:
   ```powershell
   python tests/servidor.py 8080
   ```
   (con `AISLAR=1` antes del comando, `$env:AISLAR='1'`, la página queda «aislada entre orígenes» y sirve para probar **varios hilos**; sin eso solo hay 1 hilo.)
4. En Chrome del celular abre `http://localhost:8080/tests/navegador/habla-banco.html`.

**B) Por Wi‑Fi, sin cable**
1. En el PC averigua su IP (`ipconfig`, «IPv4», por ejemplo `192.168.0.15`) y arranca `python tests/servidor.py 8080`. Si Windows pregunta por el cortafuegos, permite redes privadas.
2. En Chrome del celular entra a `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, escribe `http://192.168.0.15:8080` (tu IP), pon «Enabled» y reinicia Chrome. Así el micrófono funciona con `http`.
3. Abre `http://192.168.0.15:8080/tests/navegador/habla-banco.html`.

(La app publicada en GitHub Pages **todavía no sirve** para esto: `pages.yml` no copia ni `tests/` ni `vendor/`.)

## 2. Cargar el modelo y medir
1. En «2 · Modelo y motor» deja **Motor: WASM**, **Hilos: 1** y **Modelo: Servidor de pruebas** y toca **Cargar el modelo**. (Con la opción «Descargar de Hugging Face» baja los 67 MB desde internet y comprueba el SHA-256: sirve para probar la descarga real por datos o Wi‑Fi del celular.)
2. Anota del **Registro** (abajo): *tiempo de la sesión*, *primera inferencia*, *memoria WASM* y si dice «SHA-256 COINCIDE».
3. En «3 · Audio de prueba» toca los botones **perro**, **plato**, **casa**, **tres**… (voces del repositorio) y mira la columna **RTF**. Luego toca **Repetir el último análisis 5 veces** y anota el RTF (es la mediana).
4. Repite con **Hilos: 4** si el celular tiene 6 u 8 núcleos (solo funciona con `AISLAR=1`; la página dirá «aislado: true»). Anota cuánto mejora.
5. Repite con **Motor: WebGPU** (recarga la página al cambiar de motor). Con el modelo int8 en el PC fue **más lento** (RTF 1,1 a 1,6) porque las operaciones cuantizadas no corren en la GPU; si en el celular también, no hace falta seguir. Anota igual el RTF y si falla al cargar.
6. Si algo falla o va lento, copia el texto del Registro y mándalo.

## 3. Grabar el set de prueba
Con el motor que mejor haya ido (normalmente WASM):

1. **Palabras dichas bien (adulto), ~20.** Para cada palabra: escribe la palabra en «Palabra» (si está en la lista interna, los fonemas esperados se llenan solos; si no, escríbelos en «Esperado» separados por espacio: `p l a t o`), deja «Cómo la dijo: bien», toca **● Grabar**, di la palabra, toca **■ Parar y analizar**, y luego **Guardar la última grabación en el set**. Palabras sugeridas (de la batería del plan): perro, carro, pera, loro, tren, brazo, fresa, plato, blanco, flor, sol, mesa, luna, casa, nieve, peine, huevo, bicicleta, mariposa, computador.
2. **Las mismas dichas con errores a propósito, ~20.** Dilas mal a propósito, por ejemplo «pato» por «plato», «pelo» por «perro», «tes» por «tres», «caza» sin la r, «brazo» → «bazo»… En «Palabra» escribe la palabra **objetivo** (la correcta: `plato`), elige «Cómo la dijo: **con un error a propósito**» y en «Lo que dijo en realidad» escribe lo que dijiste (`p a t o`). La app compara lo que oye el modelo con la palabra **correcta**: si difiere, «vio el error».
3. **Opcional: ~20 dichas por el adolescente** (como en el punto 1, con «Cómo la dijo: la dice el adolescente»; y en «Lo que dijo en realidad» lo que el adulto oyó). Es lo más valioso para saber si el modelo sirve con su voz, pero **no es obligatorio** y no hay que forzarlo.
4. Prueba también las casillas de **supresión de ruido**, **cancelación de eco** y **control automático de ganancia** (por defecto apagadas): graba 5 palabras con cada una encendida y compara. La duda es si el supresor de ruido de Android borra consonantes suaves como /s/ o /f/.
5. Toca **Analizar todo el set**: en «Resumen» verás «Bien dichas que coinciden: X/Y» y «Errores provocados que se notaron: X/Y» (el criterio es **X/Y ≥ 0,8** en los errores provocados).
6. Toca **Exportar el set (.json)**: baja un archivo con las grabaciones (WAV de 16 kHz), las medidas y los resultados. Pásalo al PC (cable, Drive o WhatsApp a ti mismo) y déjalo en `.modelos/`. No lo subas al repositorio (son voces de personas).

## 4. Qué anotar y mandar a Claude
Para **cada celular**: modelo del teléfono, versión de Android y de Chrome, memoria RAM, y:

| Medida | WASM 1 hilo | WASM 4 hilos | WebGPU |
|---|---|---|---|
| Carga de la sesión (ms) | | | |
| Primera inferencia (ms) | | | |
| RTF (mediana de 5, palabra de ~1 s) | | | |
| Segundos desde que se suelta el botón hasta ver los fonemas | | | |
| Memoria WASM (MB) | | | |
| ¿Falló o se cerró la pestaña por memoria? | | | |

Y del set: **errores provocados que se notaron (X/Y)**, **bien dichas que coinciden (X/Y)**, y si la supresión de ruido cambió algo.

## Si falta el modelo en el PC
```powershell
New-Item -ItemType Directory -Force .modelos | Out-Null
Invoke-WebRequest "https://huggingface.co/anyspeech/zipa-small-crctc-300k/resolve/2f458a4dd4102d49d2c7e54d9ccf69c660866256/model.int8.onnx" -OutFile .modelos/model.int8.onnx
(Get-FileHash .modelos/model.int8.onnx -Algorithm SHA256).Hash   # debe empezar con 8F0505173E46…
```

## Cómo se decide después
- **Pasa los tres criterios** → se sigue con el plan A (ZIPA int8 en WASM) y la fase 35 en adelante.
- **RTF alto o se cierra por memoria** → se prueba `model.fp16.onnx` (132 MB, descargable del mismo repositorio) con WebGPU, y si tampoco, el **plan B** (wav2vec2 «CommonPhone», que sí hay que exportar y subir a la cuenta de Hugging Face del usuario).
- **Detecta menos de 8 de cada 10 errores** → se revisa el mapeo de `data/habla/simbolos.json` y el decodificador antes de descartar el modelo; si el problema es el modelo, plan B.
La decisión final (peso, velocidad, precisión, licencia) queda escrita en «Decisiones de implementación» del plan.
