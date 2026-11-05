import { crearRouter } from './router.js';
import { iniciarPWA } from './pwa.js';
import { adultoHabilitado } from './acceso.js';
import { pedirAlmacenamientoPersistente } from './hardware.js';

iniciarPWA();
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
    { ruta: '/nino', cargar: () => import('./nino/inicio.js') },
    adulto('/adulto/asistente', './adulto/asistente.js'),
    adulto('/adulto/perfiles', './adulto/perfiles.js'),
    adulto('/adulto/vocabulario', './adulto/vocabulario.js'),
    adulto('/adulto/palabra', './adulto/editor-palabra.js'),
    adulto('/adulto/progreso', './adulto/progreso.js'),
    adulto('/adulto/ajustes', './adulto/ajustes.js'),
    adulto('/adulto/respaldo', './adulto/respaldo.js'),
    adulto('/adulto', './adulto/panel.js'),
  ],
});
