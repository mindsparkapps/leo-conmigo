'use strict';

// Service worker de Leo Conmigo.
// - La versión llega en la URL de registro (sw.js?v=X) desde js/config.js.
// - Precachea el shell y responde desde caché actualizando en segundo plano.
// - Solo intercepta peticiones del mismo origen: googleapis.com, accounts.google.com,
//   api.arasaac.org, etc. pasan directo a la red y NUNCA se cachean.
// - La versión nueva queda "en espera": solo se activa cuando el adulto lo acepta.

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `leo-conmigo-${VERSION}`;
const INDEX = new URL('index.html', self.registration.scope).href;

// Mantener esta lista al día cuando se agreguen archivos (el resto se cachea al usarse).
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'fonts/Andika-Regular.woff2',
  'fonts/Andika-Bold.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png',
  'js/app.js',
  'js/config.js',
  'js/acceso.js',
  'js/router.js',
  'js/pwa.js',
  'js/ui/dom.js',
  'js/ui/candado.js',
  'js/core/suma.js',
  'js/nino/inicio.js',
  'js/adulto/panel.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      // cache:'reload' evita que la caché HTTP del servidor deje archivos viejos en el precaché
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((n) => n.startsWith('leo-conmigo-') && n !== CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'SALTAR_ESPERA') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return; // otros orígenes: directo a la red

  if (peticion.mode === 'navigate') {
    evento.respondWith(cacheYActualizar(peticion, evento, INDEX));
  } else {
    evento.respondWith(cacheYActualizar(peticion, evento, peticion));
  }
});

async function cacheYActualizar(peticion, evento, clave) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(clave);

  const red = fetch(peticion)
    .then((respuesta) => {
      // Solo respuestas completas del propio sitio (las parciales 206 no se pueden guardar)
      if (respuesta.status === 200 && respuesta.type === 'basic') {
        cache.put(clave, respuesta.clone());
      }
      return respuesta;
    })
    .catch(() => null);

  if (guardado) {
    evento.waitUntil(red); // actualiza la caché sin hacer esperar a la página
    return guardado;
  }
  const respuesta = await red;
  if (respuesta) return respuesta;
  if (peticion.mode === 'navigate') {
    const inicio = await cache.match(INDEX);
    if (inicio) return inicio;
  }
  return Response.error();
}
