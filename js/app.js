import { crearRouter } from './router.js';
import { iniciarPWA } from './pwa.js';
import { adultoHabilitado } from './acceso.js';
import { pedirAlmacenamientoPersistente } from './hardware.js';
import { iniciarNube } from './nube.js';

iniciarPWA();
iniciarNube(); // sincroniza en segundo plano si hay una cuenta de Google vinculada
pedirAlmacenamientoPersistente(); // que el navegador no borre las fotos, voces y progreso

const adulto = (ruta, modulo) => ({
  ruta,
  cargar: () => import(modulo),
  guardia: adultoHabilitado,
  siNoPasa: '/nino',
});

crearRouter({
  contenedor: document.getElementById('vista'),
  rutaInicial: '/nino',
  // Las rutas más específicas van primero: '/adulto' también coincide con '/adulto/...'
  rutas: [
    { ruta: '/nino/sesion', cargar: () => import('./nino/sesion.js') },
    { ruta: '/nino/premio', cargar: () => import('./nino/premio.js') },
    { ruta: '/nino/tienda', cargar: () => import('./nino/tienda.js') },
    { ruta: '/nino/albumes', cargar: () => import('./nino/albumes.js') },
    { ruta: '/nino/libros', cargar: () => import('./nino/libros.js') },
    { ruta: '/nino/libro', cargar: () => import('./nino/libros.js') },
    { ruta: '/nino', cargar: () => import('./nino/inicio.js') },
    adulto('/adulto/asistente', './adulto/asistente.js'),
    adulto('/adulto/perfiles', './adulto/perfiles.js'),
    adulto('/adulto/vocabulario', './adulto/vocabulario.js'),
    adulto('/adulto/palabra', './adulto/editor-palabra.js'),
    adulto('/adulto/frases', './adulto/frases.js'),
    adulto('/adulto/libros', './adulto/libros.js'),
    adulto('/adulto/progreso', './adulto/progreso.js'),
    adulto('/adulto/analisis', './adulto/analisis.js'),
    adulto('/adulto/ajustes', './adulto/ajustes.js'),
    adulto('/adulto/album', './adulto/album.js'),
    adulto('/adulto/tienda', './adulto/tienda.js'),
    adulto('/adulto/respaldo', './adulto/respaldo.js'),
    adulto('/adulto/cuenta', './adulto/cuenta.js'),
    adulto('/adulto/ayuda', './adulto/ayuda.js'),
    adulto('/adulto/acerca', './adulto/acerca.js'),
    adulto('/adulto', './adulto/panel.js'),
  ],
});
