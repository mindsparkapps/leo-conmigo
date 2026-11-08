// Registro del service worker, estado de instalación/conexión y avisos de versión nueva.
// El aviso de actualización solo lo muestra el modo adulto; el niño nunca lo ve.

import { VERSION } from './config.js';

const estado = {
  enLinea: navigator.onLine,
  instalada: false,
  puedeInstalar: false,
  offlineListo: false,
  actualizacionLista: false,
};

const oyentes = new Set();
let eventoInstalacion = null;
let registro = null;
let aplicandoActualizacion = false;

function notificar() {
  for (const oyente of oyentes) oyente({ ...estado });
}

/** Suscribe a los cambios de estado. Devuelve la función para cancelar. */
export function observar(oyente) {
  oyentes.add(oyente);
  oyente({ ...estado });
  return () => oyentes.delete(oyente);
}

function esStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function iniciarPWA() {
  estado.instalada = esStandalone();

  window.addEventListener('online', () => { estado.enLinea = true; notificar(); });
  window.addEventListener('offline', () => { estado.enLinea = false; notificar(); });

  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    eventoInstalacion = evento;
    estado.puedeInstalar = true;
    notificar();
  });
  window.addEventListener('appinstalled', () => {
    eventoInstalacion = null;
    estado.puedeInstalar = false;
    estado.instalada = true;
    notificar();
  });

  if (!('serviceWorker' in navigator)) return;

  // La versión viaja en la URL: así config.js es la única fuente de la versión.
  navigator.serviceWorker
    .register(`sw.js?v=${encodeURIComponent(VERSION)}`)
    .then((reg) => {
      registro = reg;
      if (navigator.serviceWorker.controller) estado.offlineListo = true;

      if (reg.waiting && navigator.serviceWorker.controller) {
        estado.actualizacionLista = true;
      }
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
            estado.actualizacionLista = true;
            notificar();
          }
        });
      });
      notificar();
    })
    .catch((error) => console.warn('No se pudo registrar el service worker', error));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (aplicandoActualizacion) { location.reload(); return; }
    estado.offlineListo = true; // el service worker tomó el control por primera vez
    notificar();
  });
}

/** Activa la versión nueva que está esperando y recarga la app. */
export function aplicarActualizacion() {
  const esperando = registro?.waiting;
  if (!esperando) return;
  aplicandoActualizacion = true;
  esperando.postMessage({ tipo: 'SALTAR_ESPERA' });
}

/**
 * Pregunta al servidor (sin caché) qué versión hay publicada: { version, commit } o null si no se pudo.
 * El número que muestra la app sale del código que ya está cargado, que puede ser viejo.
 */
export async function versionPublicada() {
  try {
    const respuesta = await fetch(new URL('js/config.js', document.baseURI).href, { cache: 'no-store' });
    if (!respuesta.ok) return null;
    const texto = await respuesta.text();
    const version = /VERSION\s*=\s*'([^']+)'/.exec(texto)?.[1];
    const commit = /COMMIT\s*=\s*'([^']+)'/.exec(texto)?.[1];
    return version ? { version, commit: commit ?? '' } : null;
  } catch {
    return null;
  }
}

/**
 * Fuerza la última versión: borra las cachés de esta app (no los datos), quita su service worker y recarga.
 * Solo toca `leo-conmigo-*`; las cachés de otras apps del mismo sitio se dejan.
 */
export async function forzarActualizacion() {
  if ('caches' in globalThis) {
    for (const nombre of await caches.keys()) {
      if (nombre.startsWith('leo-conmigo-')) await caches.delete(nombre);
    }
  }
  if ('serviceWorker' in navigator) {
    const registros = await navigator.serviceWorker.getRegistrations();
    for (const r of registros) {
      if (r.scope === new URL('./', document.baseURI).href) await r.unregister();
    }
  }
  location.reload();
}

/** Lanza el diálogo nativo de instalación (si el navegador lo permite). */
export async function instalar() {
  if (!eventoInstalacion) return null;
  eventoInstalacion.prompt();
  const { outcome } = await eventoInstalacion.userChoice;
  eventoInstalacion = null;
  estado.puedeInstalar = false;
  notificar();
  return outcome;
}
