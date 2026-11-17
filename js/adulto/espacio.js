// «Espacio en Drive» (modo adulto, PLAN.md, Ampliación 4, fase 26): qué copias repetidas o sobrantes dejaron las sincronizaciones de las
// versiones anteriores en TU Drive, cuánto pesan, y la opción de eliminarlas. Revisar solo LEE. La lógica que clasifica está en
// core/limpieza.js y la que lee y borra en js/aulas.js; aquí solo se muestra y se llama.

import { el } from '../ui/dom.js';
import { cabecera, describirError } from '../ui/adulto.js';
import { textoDeTamano } from '../core/limpieza.js';
import { FASES, nubeConfigurada, observarNube, obtenerAulas, tienePermisoAulas } from '../nube.js';

export const titulo = 'Espacio en Drive · Leo Conmigo';

const cuantos = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function montar(contenedor) {
  const zona = el('div');
  contenedor.append(el('section', { class: 'vista-adulto' }, cabecera('Espacio en Drive', { atras: '#/adulto/cuenta', textoAtras: '← Cuenta' }), zona));

  let vivo = true;
  let nube = null;
  let resultado = null; // lo que devolvió «Revisar»
  let trabajando = '';
  let mensaje = null; // { texto, error }
  const marcados = new Map(); // grupo -> Set de ids marcados

  const cuentaLista = () => nube?.email && nube.fase !== FASES.SIN_CUENTA && nube.fase !== FASES.SIN_CONFIGURAR;

  async function revisar() {
    trabajando = 'Mirando tu Drive…';
    mensaje = null;
    pintar();
    try {
      const aulas = await obtenerAulas();
      resultado = await aulas.revisarEspacio({ alProgreso: (t) => { trabajando = t; pintar(); } });
      marcados.clear();
      for (const g of resultado.grupos) marcados.set(g.id, new Set(g.archivos.map((a) => a.id)));
    } catch (error) {
      console.error(error);
      mensaje = { texto: textoDeError(error), error: true };
    } finally {
      trabajando = '';
    }
    pintar();
  }

  async function eliminar(grupo) {
    const elegidos = grupo.archivos.filter((a) => marcados.get(grupo.id)?.has(a.id));
    if (!elegidos.length) return;
    const visibles = elegidos.filter((a) => a.espacio === 'drive');
    const ocultos = elegidos.filter((a) => a.espacio === 'appdata');
    const bytes = elegidos.reduce((s, a) => s + a.size, 0);
    const lineas = [`¿Eliminar ${cuantos(elegidos.length, 'archivo', 'archivos')} (${textoDeTamano(bytes)})?`, ''];
    if (visibles.length) lineas.push(`• ${cuantos(visibles.length, 'archivo o carpeta', 'archivos o carpetas')} de tu Drive van a la PAPELERA de Google Drive: puedes recuperarlos desde allí.`);
    if (ocultos.length) lineas.push(`• ${cuantos(ocultos.length, 'archivo', 'archivos')} del respaldo oculto de la app se BORRAN de verdad: no se pueden recuperar (no hay papelera para esa carpeta).`);
    lineas.push('', 'No se toca nada de lo que hoy usa un perfil, un curso o un alumno, ni las carpetas de los alumnos. Antes de eliminar se vuelve a comprobar.');
    if (!globalThis.confirm(lineas.join('\n'))) return;

    trabajando = 'Eliminando…';
    mensaje = null;
    pintar();
    try {
      const aulas = await obtenerAulas();
      const r = await aulas.eliminarDelEspacio(grupo.id, elegidos.map((a) => a.id));
      const partes = [`Listo: se eliminaron ${cuantos(r.eliminados, 'archivo', 'archivos')} y se liberaron ${textoDeTamano(r.liberado)}.`];
      if (r.omitidos) partes.push(`${cuantos(r.omitidos, 'archivo ya no se podía eliminar', 'archivos ya no se podían eliminar')} (por ejemplo, porque empezó a usarse) y se dejó${r.omitidos === 1 ? '' : 'aron'}.`);
      if (r.fallidos) partes.push(`${cuantos(r.fallidos, 'no se pudo eliminar', 'no se pudieron eliminar')}: vuelve a intentarlo.`);
      mensaje = { texto: partes.join(' '), error: r.fallidos > 0 };
    } catch (error) {
      console.error(error);
      mensaje = { texto: textoDeError(error), error: true };
    }
    trabajando = '';
    const aviso = mensaje;
    await revisar().catch(() => {}); // vuelve a mirar para mostrar lo que queda (y conserva el aviso de lo que se hizo)
    if (!mensaje?.error) mensaje = aviso;
    pintar();
  }

  function panelGrupo(grupo) {
    if (!grupo.archivos.length) {
      return el('div', { class: 'panel' }, el('h2', {}, `${grupo.titulo} (0)`), el('p', { class: 'ayuda' }, 'No hay nada de esto.'));
    }
    const elegidos = marcados.get(grupo.id) ?? new Set();
    const lista = el('ul', { class: 'lista-simple' }, grupo.archivos.map((a) => {
      const casilla = el('input', { type: 'checkbox', checked: elegidos.has(a.id), 'aria-label': `Eliminar ${a.name}` });
      casilla.addEventListener('change', () => { if (casilla.checked) elegidos.add(a.id); else elegidos.delete(a.id); pintar(); });
      return el('li', {}, el('label', { class: 'casilla' }, casilla, ` ${a.esCarpeta ? 'Carpeta ' : ''}${a.name} · ${a.lugar} · ${textoDeTamano(a.size)}`));
    }));
    const n = grupo.archivos.filter((a) => elegidos.has(a.id)).length;
    const bytes = grupo.archivos.filter((a) => elegidos.has(a.id)).reduce((s, a) => s + a.size, 0);
    return el('div', { class: 'panel', 'data-grupo': grupo.id },
      el('h2', {}, `${grupo.titulo} (${grupo.archivos.length} · ${textoDeTamano(grupo.bytes)})`),
      el('p', { class: 'ayuda' }, grupo.ayuda),
      el('details', { class: 'detalle-numeros' }, el('summary', {}, 'Ver los archivos y elegir cuáles'), lista),
      el('div', { class: 'acciones' },
        el('button', { type: 'button', class: 'boton', disabled: Boolean(trabajando) || n === 0, onclick: () => eliminar(grupo) }, `Eliminar estos archivos (${n} · ${textoDeTamano(bytes)})`)));
  }

  function pintar() {
    if (!vivo) return;
    const puede = nubeConfigurada() && cuentaLista() && tienePermisoAulas();
    const piezas = [];
    piezas.push(el('div', { class: 'panel' },
      el('h2', {}, 'Qué quedó repetido en tu Drive'),
      el('p', {}, 'Las versiones anteriores de la app dejaron copias repetidas o sobrantes: voces que ya vienen dentro de la app, fotos y voces que quedaron en los cursos después de pasarlas a la Biblioteca, la carpeta «del-alumno» de antes y archivos que ya nadie usa.'),
      el('p', { class: 'ayuda' }, 'Revisar solo mira: no cambia nada. Después tú eliges qué eliminar. Lo que está a la vista en tu Drive va a la papelera de Google Drive (se puede recuperar); el respaldo oculto de la app no tiene papelera y se borra. Nunca se toca lo que usa un perfil, un curso o un alumno, ni las carpetas de los alumnos.'),
      !puede ? el('p', { class: 'aviso', role: 'note' }, 'Para revisar hace falta haber iniciado sesión con Google y dado el permiso de Drive: se hace en «Cuenta» y en «Alumnos».') : null,
      trabajando ? el('p', { class: 'ayuda', role: 'status' }, trabajando) : null,
      el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton', disabled: !puede || Boolean(trabajando), onclick: revisar }, resultado ? 'Revisar de nuevo' : 'Revisar mi Drive')),
      mensaje ? el('p', { class: mensaje.error ? 'error-texto' : 'ayuda', role: mensaje.error ? 'alert' : 'status' }, mensaje.texto) : null));
    if (resultado) {
      piezas.push(el('div', { class: 'panel' },
        el('h2', {}, resultado.cantidad ? `Se pueden eliminar ${cuantos(resultado.cantidad, 'archivo', 'archivos')} (${textoDeTamano(resultado.bytes)})` : 'No hay nada que eliminar'),
        resultado.sinMigrar.length ? el('p', { class: 'ayuda' }, 'Hay cursos de una versión anterior que todavía no se actualizaron: abre «Alumnos» para que se actualicen y vuelve a revisar. Mientras tanto no se toca nada de ellos.') : null));
      for (const g of resultado.grupos) piezas.push(panelGrupo(g));
    }
    zona.replaceChildren(...piezas);
  }

  const dejarDeObservar = observarNube((e) => { nube = e; pintar(); });
  pintar();
  return () => { vivo = false; dejarDeObservar(); };
}

function textoDeError(error) {
  if (error?.name === 'ErrorDrive' && error.sinConexion) return 'Sin conexión con Google Drive. Inténtalo de nuevo cuando haya internet.';
  return error?.name === 'ErrorAula' || error?.name === 'ErrorDrive' || error?.name === 'ErrorCuenta' ? error.message : describirError(error);
}
