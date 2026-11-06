// Panel del modo adulto: el niño activo, accesos a perfiles y vocabulario, estado de la app y créditos.

import { el } from '../ui/dom.js';
import { VERSION } from '../config.js';
import { observar, instalar, aplicarActualizacion } from '../pwa.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { describirError } from '../ui/adulto.js';
import { urlDeMedio, liberarUrls } from '../medios.js';
import { FASES, clasePunto, observarNube, refrescarEstado, textoDeEstado } from '../nube.js';

export const titulo = 'Modo adulto · Leo Conmigo';

export function montar(contenedor, { ir }) {
  const zonaAviso = el('div');
  const zonaNino = el('div', { class: 'panel' }, el('p', { class: 'ayuda' }, 'Cargando…'));
  const zonaEstado = el('div', { class: 'panel' });
  const zonaNube = el('div', { class: 'panel' });
  let vivo = true;
  let protegido = null; // true / false / null (sin soporte)

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
      zonaNino,
      zonaNube,
      zonaEstado,
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Ayuda e información'),
        el(
          'div',
          { class: 'acciones' },
          el('a', { class: 'boton secundario', href: '#/adulto/ayuda' }, 'Ayuda'),
          el('a', { class: 'boton secundario', href: '#/adulto/acerca' }, 'Acerca de, privacidad y créditos'),
        ),
        el('p', { class: 'ayuda' }, 'Para volver aquí desde la pantalla del niño: mantén presionado el candado 3 segundos y resuelve la suma.'),
      ),
    ),
  );

  pintarNino(zonaNino, () => vivo).catch((error) => {
    zonaNino.replaceChildren(el('h2', {}, 'El niño'), el('p', { class: 'error-texto' }, describirError(error)));
  });

  let ultimoEstado = null;
  const pintarEstado = () => {
    if (ultimoEstado) zonaEstado.replaceChildren(...panelEstado(ultimoEstado, protegido));
  };
  navigator.storage?.persisted?.().then((valor) => {
    protegido = Boolean(valor);
    pintarEstado();
  }).catch(() => {});

  const dejarDeObservar = observar((estado) => {
    ultimoEstado = estado;
    zonaAviso.replaceChildren(...(estado.actualizacionLista ? [avisoActualizacion()] : []));
    pintarEstado();
  });

  const dejarDeObservarNube = observarNube((e) => {
    const punto = el('span', { class: `punto-estado ${clasePunto(e.fase)}`, 'aria-hidden': 'true' });
    zonaNube.replaceChildren(
      el('h2', {}, 'Cuenta de Google'),
      el('p', { class: 'estado-nube', role: 'status' }, punto, el('strong', {}, textoDeEstado(e)), e.email ? el('span', { class: 'ayuda' }, ` · ${e.email}`) : null),
      e.mensaje ? el('p', { class: 'error-texto', role: 'alert' }, e.mensaje) : null,
      el('div', { class: 'acciones' }, el('a', { class: 'boton secundario', href: '#/adulto/cuenta' }, e.fase === FASES.SIN_CUENTA ? 'Iniciar sesión' : 'Abrir la cuenta')),
    );
  });
  refrescarEstado().catch(() => {});

  return () => {
    vivo = false;
    dejarDeObservar();
    dejarDeObservarNube();
    liberarUrls();
  };
}

async function pintarNino(zona, estaVivo) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!estaVivo()) return;
  if (!perfil) {
    zona.replaceChildren(
      el('h2', {}, 'Empecemos'),
      el('p', {}, 'Todavía no hay ningún niño. Crea su perfil y sus primeras palabras con fotos de su gente.'),
      el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el primer perfil'),
    );
    return;
  }
  const palabras = await store.listar('palabras', { perfilId: perfil.id });
  const url = await urlDeMedio(store, perfil.fotoMedioId);
  if (!estaVivo()) return;
  const activas = palabras.filter((p) => p.activa !== false).length;
  zona.replaceChildren(
    el('h2', {}, 'El niño'),
    el(
      'div',
      { class: 'fila-contenido' },
      crearMiniatura({ url, texto: perfil.nombre }, { grande: true }),
      el(
        'div',
        { class: 'fila-texto' },
        el('strong', {}, perfil.nombre),
        el('span', { class: 'ayuda' }, `${palabras.length} palabra${palabras.length === 1 ? '' : 's'} · ${activas} activa${activas === 1 ? '' : 's'}`),
      ),
    ),
    el(
      'div',
      { class: 'acciones' },
      el('a', { class: 'boton', href: '#/adulto/vocabulario' }, 'Vocabulario'),
      el('a', { class: 'boton', href: '#/adulto/frases' }, 'Frases'),
      el('a', { class: 'boton', href: '#/adulto/libros' }, 'Libros'),
      el('a', { class: 'boton', href: '#/adulto/progreso' }, 'Progreso'),
      el('a', { class: 'boton secundario', href: '#/adulto/ajustes' }, 'Ajustes'),
      el('a', { class: 'boton secundario', href: '#/adulto/perfiles' }, 'Perfiles'),
    ),
    el('p', { class: 'ayuda' }, el('a', { href: '#/adulto/respaldo' }, 'Copia de seguridad')),
  );
}

function avisoActualizacion() {
  return el(
    'div',
    { class: 'aviso', role: 'status' },
    el('p', {}, 'Hay una versión nueva de la aplicación.'),
    el('button', { type: 'button', class: 'boton', onclick: aplicarActualizacion }, 'Actualizar ahora'),
  );
}

function panelEstado(estado, protegido) {
  const fila = (nombre, valor) => el('li', {}, el('span', {}, nombre), el('strong', {}, valor));
  const textoProtegido = protegido === null ? 'No disponible' : protegido ? 'Sí' : 'No';

  const nodos = [
    el('h2', {}, 'Estado de la aplicación'),
    el(
      'ul',
      { class: 'lista-estado' },
      fila('Versión', VERSION),
      fila('Conexión', estado.enLinea ? 'En línea' : 'Sin conexión'),
      fila('Funciona sin conexión', estado.offlineListo ? 'Sí' : 'Preparando…'),
      fila('Instalada en este dispositivo', estado.instalada ? 'Sí' : 'No'),
      fila('Datos protegidos contra borrado', textoProtegido),
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
