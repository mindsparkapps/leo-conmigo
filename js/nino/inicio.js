// Inicio del modo niño. En la fase 1 es solo el esqueleto: título y candado.
// (El botón ▶, el nombre del niño y el álbum llegan en las fases 3 y 4.)

import { el } from '../ui/dom.js';
import { crearCandado } from '../ui/candado.js';
import { habilitarAdulto, deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';

export const titulo = NOMBRE_APP;

export function montar(contenedor, { ir }) {
  deshabilitarAdulto(); // al volver al modo niño, el modo adulto vuelve a quedar bloqueado

  contenedor.append(
    el(
      'section',
      { class: 'vista-nino' },
      el('h1', { class: 'titulo-nino' }, NOMBRE_APP),
      crearCandado({
        alDesbloquear: () => {
          habilitarAdulto();
          ir('/adulto');
        },
      }),
    ),
  );
}
