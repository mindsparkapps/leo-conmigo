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
  'data/vocabulario-inicial.json',
  'data/calcomanias/estrella.svg',
  'data/calcomanias/corazon.svg',
  'data/calcomanias/sol.svg',
  'data/calcomanias/luna.svg',
  'data/calcomanias/flor.svg',
  'data/calcomanias/pez.svg',
  'data/calcomanias/globo.svg',
  'data/calcomanias/casa.svg',
  'data/calcomanias/arcoiris.svg',
  'data/calcomanias/mariposa.svg',
  'data/calcomanias/barco.svg',
  'data/calcomanias/arbol.svg',
  'data/calcomanias/nube.svg',
  'data/calcomanias/gota.svg',
  'data/calcomanias/manzana.svg',
  'data/calcomanias/helado.svg',
  'data/calcomanias/pelota.svg',
  'data/calcomanias/auto.svg',
  'data/calcomanias/tortuga.svg',
  'data/calcomanias/abeja.svg',
  'data/calcomanias/conejo.svg',
  'data/calcomanias/rana.svg',
  'data/calcomanias/pajaro.svg',
  'data/calcomanias/cohete.svg',
  'data/calcomanias/tren.svg',
  'data/calcomanias/regalo.svg',
  'data/calcomanias/corona.svg',
  'data/calcomanias/paraguas.svg',
  'data/calcomanias/hoja.svg',
  'data/calcomanias/pastel.svg',
  'js/albumes.js',
  'js/core/album.js',
  'js/ui/moneda.js',
  'js/ui/calcomania.js',
  'js/ui/selector-imagen.js',
  'js/nino/tienda.js',
  'js/nino/albumes.js',
  'js/adulto/album.js',
  'js/adulto/tienda.js',
  'js/actividades/comun.js',
  'js/actividades/indice.js',
  'js/actividades/L1.js',
  'js/actividades/L2.js',
  'js/actividades/L3.js',
  'js/actividades/L4.js',
  'js/actividades/L5.js',
  'js/actividades/L6.js',
  'js/actividades/P1.js',
  'js/actividades/P2.js',
  'js/actividades/P3.js',
  'js/actividades/F1.js',
  'js/actividades/F2.js',
  'js/actividades/F3.js',
  'js/actividades/secuencia.js',
  'js/core/frases.js',
  'js/core/sync.js',
  'js/core/silabeo.js',
  'js/core/cuentos.js',
  'js/actividades/S1.js',
  'js/actividades/S2.js',
  'js/actividades/S3.js',
  'js/actividades/S4.js',
  'data/cuentos-iniciales.json',
  'js/auth.js',
  'js/drive.js',
  'js/sync.js',
  'js/nube.js',
  'js/adulto/cuenta.js',
  'js/adulto/ayuda.js',
  'js/adulto/acerca.js',
  'js/nino/libros.js',
  'js/adulto/frases.js',
  'js/adulto/libros.js',
  'js/core/intento.js',
  'js/core/registro.js',
  'js/core/elogios.js',
  'js/core/calcomanias.js',
  'js/core/controlador.js',
  'js/ui/carta.js',
  'js/ui/boton-audio.js',
  'js/ui/ajustar-texto.js',
  'js/core/estadisticas.js',
  'js/core/respaldo.js',
  'js/respaldo.js',
  'js/ui/grafico-semanal.js',
  'js/adulto/progreso.js',
  'js/adulto/ajustes.js',
  'js/adulto/respaldo.js',
  'js/nino/sesion.js',
  'js/nino/premio.js',
  'js/store.js',
  'js/contexto.js',
  'js/medios.js',
  'js/hardware.js',
  'js/imagenes.js',
  'js/audio.js',
  'js/pictos.js',
  'js/ui/adulto.js',
  'js/ui/miniatura.js',
  'js/ui/selector-foto.js',
  'js/adulto/asistente.js',
  'js/adulto/perfiles.js',
  'js/adulto/vocabulario.js',
  'js/adulto/editor-palabra.js',
  'js/core/vocabulario.js',
  'js/core/suma.js',
  'js/core/azar.js',
  'js/core/id.js',
  'js/core/silabas.js',
  'js/core/modelos.js',
  'js/core/progreso.js',
  'js/core/etapas.js',
  'js/core/distractores.js',
  'js/core/sesion.js',
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
  if (url.pathname.includes('/tests/')) return; // las pruebas siempre se leen frescas de la red

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
