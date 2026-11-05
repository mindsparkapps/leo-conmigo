import { crearRouter } from './router.js';
import { iniciarPWA } from './pwa.js';
import { adultoHabilitado } from './acceso.js';

iniciarPWA();

crearRouter({
  contenedor: document.getElementById('vista'),
  rutaInicial: '/nino',
  rutas: [
    { ruta: '/nino', cargar: () => import('./nino/inicio.js') },
    {
      ruta: '/adulto',
      cargar: () => import('./adulto/panel.js'),
      guardia: adultoHabilitado,
      siNoPasa: '/nino',
    },
  ],
});
