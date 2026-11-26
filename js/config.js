// Configuración global de la app.

// Al cambiar VERSION se registra un service worker nuevo (sw.js?v=...) y se
// crea una caché nueva. Súbela en cada publicación que cambie archivos.
export const VERSION = '0.53.29';

// Commit publicado. Lo reemplaza el flujo .github/workflows/pages.yml al publicar en GitHub Pages;
// en el computador queda «local».
export const COMMIT = 'local';

/** Texto corto para saber qué versión está cargada, p. ej. «v0.14.1 · 3999c4c». */
export const TEXTO_VERSION = `v${VERSION} · ${COMMIT}`;

export const NOMBRE_APP = 'Leo Conmigo';

// Cliente OAuth compartido "MindSpark" (Google Identity Services). Mientras esté vacío, la pantalla
// «Cuenta de Google» avisa que falta configurarlo y la app funciona igual, solo en el dispositivo.
// En Google Cloud Console el cliente debe tener como orígenes de JavaScript autorizados
// https://mindsparkapps.github.io y el localhost que se use para probar (p. ej. http://localhost:8080).
export const CLIENT_ID = '949516612285-5f7c7rsgb0u64rgk20k866to3ij0egq0.apps.googleusercontent.com';

// Modo «Hablar» (Ampliación 6): reconocedor de fonemas ZIPA-CR pequeño, int8 oficial de
// anyspeech/zipa-small-crctc-300k (licencia CC BY 4.0: hay que atribuir a sus autores, ver
// docs/habla-fuentes.md). La URL va fijada a un commit del repositorio de Hugging Face, así que el
// archivo no cambia aunque ellos actualicen el modelo. NO va en el repositorio ni en PRECACHE:
// la app lo descarga una vez, comprueba el SHA-256 y lo guarda en su propia caché.
export const MODELO_HABLA = Object.freeze({
  commit: '2f458a4dd4102d49d2c7e54d9ccf69c660866256',
  url: 'https://huggingface.co/anyspeech/zipa-small-crctc-300k/resolve/2f458a4dd4102d49d2c7e54d9ccf69c660866256/model.int8.onnx',
  sha256: '8f0505173e4606b4afe041f19477b38d6a72a98a19863562749066dc496e86ae',
  bytes: 70677672,
});