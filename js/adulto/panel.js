// Panel del modo adulto. En la fase 1 solo muestra el estado de la app
// (versión, conexión, instalación) y el aviso de versión nueva.

import { el } from '../ui/dom.js';
import { VERSION } from '../config.js';
import { observar, instalar, aplicarActualizacion } from '../pwa.js';

export const titulo = 'Modo adulto · Leo Conmigo';

export function montar(contenedor, { ir }) {
  const zonaAviso = el('div');
  const zonaEstado = el('div', { class: 'panel' });

  contenedor.append(
    el(
      'section',
      { class: 'vista-adulto' },
      el(
        'header',
        { class: 'encabezado-adulto' },
        el('h1', {}, 'Modo adulto'),
        el('button', { type: 'button', class: 'boton', onclick: () => ir('/nino') }, 'Volver al modo niño'),
      ),
      zonaAviso,
      zonaEstado,
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Lo que viene'),
        el('p', { class: 'ayuda' }, 'Aquí estarán los perfiles, el vocabulario y el progreso de cada niño.'),
      ),
    ),
  );

  return observar((estado) => {
    zonaAviso.replaceChildren(...(estado.actualizacionLista ? [avisoActualizacion()] : []));
    zonaEstado.replaceChildren(...panelEstado(estado));
  });
}

function avisoActualizacion() {
  return el(
    'div',
    { class: 'aviso', role: 'status' },
    el('p', {}, 'Hay una versión nueva de la aplicación.'),
    el('button', { type: 'button', class: 'boton', onclick: aplicarActualizacion }, 'Actualizar ahora'),
  );
}

function panelEstado(estado) {
  const fila = (nombre, valor) => el('li', {}, el('span', {}, nombre), el('strong', {}, valor));

  const nodos = [
    el('h2', {}, 'Estado de la aplicación'),
    el(
      'ul',
      { class: 'lista-estado' },
      fila('Versión', VERSION),
      fila('Conexión', estado.enLinea ? 'En línea' : 'Sin conexión'),
      fila('Funciona sin conexión', estado.offlineListo ? 'Sí' : 'Preparando…'),
      fila('Instalada en este dispositivo', estado.instalada ? 'Sí' : 'No'),
    ),
  ];

  if (estado.puedeInstalar) {
    nodos.push(
      el('p', {}, el('button', { type: 'button', class: 'boton', onclick: () => instalar() }, 'Instalar en este dispositivo')),
    );
  } else if (!estado.instalada) {
    nodos.push(
      el(
        'p',
        { class: 'ayuda' },
        'Para instalarla: en Android/Chrome abre el menú ⋮ y elige «Instalar aplicación»; en iPhone o iPad usa Compartir → «Agregar a pantalla de inicio».',
      ),
    );
  }
  return nodos;
}
