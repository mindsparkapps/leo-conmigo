// Configuración global de la app.

// Al cambiar VERSION se registra un service worker nuevo (sw.js?v=...) y se
// crea una caché nueva. Súbela en cada publicación que cambie archivos.
export const VERSION = '0.29.2';

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
