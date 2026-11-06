// Configuración global de la app.

// Al cambiar VERSION se registra un service worker nuevo (sw.js?v=...) y se
// crea una caché nueva. Súbela en cada publicación que cambie archivos.
export const VERSION = '0.8.0';

export const NOMBRE_APP = 'Leo Conmigo';

// Cliente OAuth compartido "MindSpark" (Google Identity Services). Mientras esté vacío, la pantalla
// «Cuenta de Google» avisa que falta configurarlo y la app funciona igual, solo en el dispositivo.
// En Google Cloud Console el cliente debe tener como orígenes de JavaScript autorizados
// https://mindsparkapps.github.io y el localhost que se use para probar (p. ej. http://localhost:8080).
export const CLIENT_ID = '';
