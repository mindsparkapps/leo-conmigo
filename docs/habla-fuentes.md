# Fuentes del modo «Hablar» (Ampliación 6)

Fuentes consultadas el 2026-11-25 para diseñar el modo Hablar. «Acerca de», la ayuda y las fases 33 a 39 las toman de aquí. Si se agrega una fuente, va en esta lista con lo que aporta.

## Reconocimiento de voz y habla del síndrome de Down
- [Reconocimiento de voz con usuarios con síndrome de Down (Springer, *Universal Access in the Information Society*, 2025)](https://link.springer.com/article/10.1007/s10209-025-01197-4): el reconocimiento es mucho peor que con habla típica; el mejor sistema llegó a ~67 % de palabras. Por eso no se usa un reconocedor de palabras para la dicción.
- [Modelos personalizados para habla con trastornos (JSLHR 2024)](https://pubs.asha.org/doi/10.1044/2024_JSLHR-24-00045): personalizar al hablante mejora mucho la precisión. Base de la calibración por persona.
- [Un solo modelo que generaliza a habla atípica (Google, arXiv 2024)](https://arxiv.org/pdf/2412.19315): agregar habla atípica cierra el 64 % de la brecha con los modelos personalizados.
- [Evaluación automática de la inteligibilidad en trastornos motores del habla del desarrollo, incluido el SD (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12345943/)

## Motores y modelos
- [ZIPA: modelos eficientes de reconocimiento de fonemas multilingüe (ACL 2025, arXiv)](https://arxiv.org/abs/2505.23170v1): plan A. La versión de 64 M parámetros supera a modelos previos de 300 M.
  - [Repositorio `lingjzhu/zipa`](https://github.com/lingjzhu/zipa) (código MIT): `inference/inference.py` y `inference/utils.py` muestran la entrada (fbank lhotse de 80 bandas, `dither=0`, `snip_edges=False`, 16 kHz), las entradas `x`/`x_lens` y la decodificación CTC voraz; `ipa_simplified/tokens.txt` tiene los 127 tokens (`<blk>` = 0).
  - [ONNX oficial `anyspeech/zipa-small-crctc-300k`](https://huggingface.co/anyspeech/zipa-small-crctc-300k) (**CC BY 4.0**): `model.int8.onnx` 70,7 MB, `model.fp16.onnx` 132 MB, `model.onnx` 260 MB, `tokens.txt`. Las variantes `ns` son CC BY-NC-SA (no usar).
  - [Checkpoint PyTorch `anyspeech/zipa-cr-s`](https://huggingface.co/anyspeech/zipa-cr-s).
- [Wav2Vec2 Large «CommonPhone» (Klumpp, CC0)](https://huggingface.co/pklumpp/Wav2Vec2_CommonPhone): plan B. Seis idiomas con español, 101 fonemas IPA, error de fonemas de 8,8 % en español.
- [speako-phoneme-recognizer](https://huggingface.co/robg/speako-phoneme-recognizer): precedente de un reconocedor de fonemas wav2vec2 en ONNX int8 (~355 MB) en el navegador; solo cuantizar MatMul porque las Conv cuantizadas fallan en onnxruntime.
- [Wav2Vec2-XLSR-53 espeak (Facebook)](https://huggingface.co/facebook/wav2vec2-xlsr-53-espeak-cv-ft): otro reconocedor de fonemas multilingüe; no tiene ONNX oficial.
- [Parseh, alineador forzado para español](https://huggingface.co/parseh/aligner-es): wav2vec2 español en ONNX int8, solo para alineación.
- [OpenPronounce](https://github.com/Halleck45/OpenPronounce): puntuación de pronunciación por fonemas (servidor en Python; español experimental).
- [Puntuación de pronunciación con un modelo pequeño (GOP desde posteriores CTC)](https://dev.to/fabiosuizu/17mb-vs-12gb-how-a-tiny-model-beats-human-experts-at-pronunciation-scoring-5588)
- [vosk-browser](https://github.com/ccoreilly/vosk-browser): plan C, palabras con confianza y gramática cerrada (~40 MB en español).
- [MDN: `SpeechRecognition.processLocally`](https://developer.mozilla.org/docs/Web/API/SpeechRecognition/processLocally), [MDN: `SpeechRecognition.install()`](https://developer.mozilla.org/docs/Web/API/SpeechRecognition/install_static), [Chromium: reconocimiento en el dispositivo desde Chrome 139](https://groups.google.com/a/chromium.org/g/chrome-ai-dev-preview-discuss/c/Rlyc2uAsFCY), [Edge: idiomas del reconocimiento local](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/speech-recognition-api): la Web Speech API se descartó (corrige a palabras; español local no confirmado en Chrome).
- [sherpa-onnx](https://cdn.jsdelivr.net/gh/k2-fsa/sherpa-onnx@master/README.md): motor alternativo con WebAssembly (sin modelo español listo).
- [ONNX Runtime: WebGPU](https://www.mintlify.com/microsoft/onnxruntime/execution-providers/webgpu), [Chrome: acelerar la IA en la web](https://developer.chrome.com/docs/ai/platform), [banco de pruebas WebGPU vs WASM en Android](https://huggingface.co/spaces/Xenova/webgpu-embedding-benchmark/discussions/67): WebGPU en Android es limitado; hay que medir en los equipos reales.

## Fonología del español y del síndrome de Down
- [Vergara, Heredia, Parada, Vega y Diez-Itza: trayectorias fonológicas en SD (Rev. de Investigación en Logopedia 16(1), 2026)](https://revistas.ucm.es/index.php/RLOG/article/download/104526/4564456576556/4564456782585): simplificación estructural y sustituciones sistemáticas.
- [Vergara Ponce: tesis doctoral, patrones fonológicos en desarrollo típico, prolongado y SD (U. de Oviedo)](https://digibuo.uniovi.es/dspace/bitstream/handle/10651/63316/TD_PatricioVergaraPonce.pdf?sequence=2): el método de elicitación (nombrar vs. repetir) cambia el perfil.
- [Hidalgo y Garayzábal 2019: procesos de simplificación en SD, Williams y Smith-Magenis (RLOG)](https://revistas.ucm.es/index.php/RLOG/es/article/view/62942)
- [Diptongos en niños chilenos con SD (Rev. Chilena de Fonoaudiología)](https://revfono.uchile.cl/index.php/RCDF/article/download/75807/79426/314903): omisión del primer segmento en diptongos crecientes y del segundo en decrecientes.
- [Vergara, Cerón y Díez-Itza 2023: vocabulario y fonología no lineal en SD chilenos (Dialnet)](https://dialnet.unirioja.es/descarga/articulo/7149034.pdf)
- [Adquisición de lateral y róticas en niños de 3 a 4;11 (Rev. Chilena de Fonoaudiología)](https://cyberhumanitatis.uchile.cl/index.php/RCDF/article/download/44149/46241/155672): las róticas son de adquisición tardía; en niños chilenos la /r/ múltiple aparece poco y la **rótica asibilada** es frecuente (por eso se acepta como variante).
- [Grupos consonánticos en niños chilenos (Dialnet)](https://dialnet.unirioja.es/descarga/articulo/3097247.pdf) y [tesis UNAM sobre vibrantes y grupos](https://ru.dgb.unam.mx/jspui/bitstream/20.500.14330/TES01000754599/3/0754599.pdf): los grupos consonánticos son lo último en adquirirse.
- [Reseña del TEPROSIF-R (Pavez, Maggiolo y Coloma 2008; Onomázein)](https://revistas.uchile.cl/index.php/RCDF/article/download/29926/31703) y [procesos de simplificación en niños de 4 a 6 años con dificultades fonológicas](https://revistaschilenas.uchile.cl/handle/2250/32020): referencia chilena de los procesos (estructura de la sílaba, sustitución, asimilación). Solo como guía de cobertura: no se copian sus ítems.

## Adolescentes con SD e intervención
- [Wilson et al. 2019: trastorno motor del habla e inteligibilidad en 45 adolescentes con SD (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6604063): la baja inteligibilidad se explica sobre todo por un componente **motor** del habla, no solo por errores de sonidos.
- [Darling-White y McHugh 2025: habla clara y fuerte en adolescentes con SD](https://palslab.arizona.edu/sites/default/files/2025-01/Darling-White-McHugh-2025-PDF.pdf): pedir hablar **claro y fuerte** subió la inteligibilidad; trabajar solo la precisión de los sonidos no la mejora de forma fiable. Base del recorrido «Habla clara».
- [Wood et al. 2018: electropalatografía en niños y jóvenes con SD de 8 a 18 años (ensayo controlado)](https://strathprints.strath.ac.uk/64380/1/Wood_etal_IJLCD2018_The_use_of_electropalatography_in_the_treatment_of_speech.pdf): mejoran con retroalimentación **visual**; las dificultades suelen seguir en la adultez.
- [DSE, foro de investigación 2024: desarrollo del habla](https://www.down-syndrome.org/en-us/research/forum/2024/programme/session-3-speech-development)
- [Revisión de intervención del habla en SD (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10279874)
