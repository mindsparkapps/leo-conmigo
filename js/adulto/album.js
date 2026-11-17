// Álbum y monedas (modo adulto, fase 11): tamaño del álbum, monedas por álbum, 
// calcomanías propias y los álbumes ya completos.

import { el } from '../ui/dom.js';
import { cabecera, campo, cargando, describirError, mostrarError } from '../ui/adulto.js';
import { crearSelectorImagen } from '../ui/selector-imagen.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { crearCofre } from '../ui/moneda.js';
import { mapaDePropias, nodoDeCalcomania } from '../ui/calcomania.js';
import { obtenerStore, perfilActivo, sujetoDeEstadisticas } from '../contexto.js';
import { esAlumno } from '../acceso.js';
import { borrarMedio, guardarMedio, liberarUrls, urlDeMedio } from '../medios.js';
import { cargarMonedas, reiniciarAlbumes } from '../albumes.js';
import { MONEDAS_LECCION_MAX, MONEDAS_LECCION_MIN, MONEDAS_MAX, MONEDAS_MIN, TAMANO_MAX, TAMANO_MIN, calcularAlbumes, crearRegalo, normalizarAlbum, resumenDeMonedas, saldo } from '../core/album.js';
import { registrosDeFamilia } from '../core/curso.js';
import { CALCOMANIAS, codigoDePropia, rutaCalcomania } from '../core/calcomanias.js';
import { faltantesPorPegar, laminasDeColeccion, listarColecciones, normalizarBase, normalizarColecciones, nuevaColeccion } from '../core/colecciones.js';
import { elegirImagenes } from '../hardware.js';
import { prepararImagen } from '../imagenes.js';
import { RUTA_PORTADA } from '../ui/laminas.js';

export const titulo = 'Álbum y monedas · Leo Conmigo';

const sinExtension = (nombre) => nombre.replace(/\.[^.]+$/, '');

/** El álbum que se está editando (sobrevive a repintar la pantalla). */
let editandoId = null;

/**
 * Editor de un álbum (el de la app, con las láminas de GTA 6, o uno cargado): cambiar su nombre, la imagen de su
 * portada y la de sus sobres, ver todas sus láminas y quitar las que se quiera.
 * En el álbum de la app «quitar» la saca del juego (se puede volver a poner desde «Láminas quitadas»).
 */
function editorDeAlbum({ store, perfil, coleccion, propias, repintar, registrar }) {
  const esBase = coleccion.esBase;
  const entradaNombre = el('input', { type: 'text', maxlength: 40, autocomplete: 'off', value: coleccion.nombre });
  const estado = el('p', { class: 'ayuda', role: 'status' });
  const previaPortada = el('img', { class: 'carga-previa', alt: '' });
  const previaSobre = el('img', { class: 'carga-previa', alt: '' });
  const rejilla = el('div', { class: 'editor-album-laminas' });
  const quitadasCaja = el('div');

  // guarda el cambio en el perfil: en `perfil.base` (álbum de la app) o dentro de `perfil.colecciones`
  async function guardarCambio(cambios) {
    if (coleccion.esFamilia) {
      // un álbum de la familia vive en su propio almacén (el del curso, en el perfil, no se toca)
      const registro = await store.obtener('colecciones', coleccion.id);
      await store.guardar('colecciones', { ...registro, ...cambios });
    } else if (esBase) {
      await store.guardar('perfiles', { ...perfil, base: { ...normalizarBase(perfil.base), ...cambios } });
    } else {
      const lista = normalizarColecciones(perfil.colecciones).map((c) => (c.id === coleccion.id ? { ...c, ...cambios } : c));
      await store.guardar('perfiles', { ...perfil, colecciones: lista });
    }
  }
  async function guardarNombre() {
    const nombre = entradaNombre.value.trim();
    if (!nombre) { estado.textContent = 'Ponle un nombre al álbum.'; return; }
    try {
      await guardarCambio({ nombre });
      await repintar();
    } catch (error) {
      estado.textContent = describirError(error);
    }
  }
  // color de fondo de la tapa: con un color, la portada se ve entera y el color rellena lo que la imagen no cubre
  const entradaColor = el('input', { type: 'color', value: coleccion.colorPortada ?? '#1f5f82', 'aria-label': 'Color de fondo de la tapa' });
  async function guardarColor(color) {
    try {
      await guardarCambio({ colorPortada: color });
      await repintar();
    } catch (error) {
      estado.textContent = describirError(error);
    }
  }
  async function cambiarImagen(campo) {
    const [archivo] = await elegirImagenes({ carpeta: false });
    if (!archivo) return;
    try {
      estado.textContent = 'Preparando la imagen…';
      const { blob, mime } = await prepararImagen(archivo, { lado: 1024, conservarProporcion: true });
      const medio = await guardarMedio(store, { tipo: 'imagen', blob, mime, origen: 'foto' });
      const otro = campo === 'medioPortadaId' ? coleccion.medioSobreId : coleccion.medioPortadaId;
      const viejo = coleccion[campo];
      await guardarCambio({ [campo]: medio.id });
      if (viejo && viejo !== otro) await borrarMedio(store, viejo);
      await repintar();
    } catch (error) {
      estado.textContent = describirError(error);
    }
  }
  async function quitarLamina(lamina) {
    if (coleccion.codigos.length <= 1) {
      estado.textContent = esBase ? 'El álbum necesita al menos una lámina.' : 'Es la última lámina: para quitarla borra el álbum entero con «Quitar».';
      return;
    }
    const aviso = esBase
      ? `¿Sacar «${lamina.nombre}» del álbum? Podrás volver a ponerla desde «Láminas quitadas».`
      : `¿Quitar la lámina «${lamina.nombre}»? Si el niño ya la ganó, desaparece de su álbum.`;
    if (!window.confirm(aviso)) return;
    try {
      if (esBase) {
        const codigos = coleccion.codigos.filter((c) => c !== lamina.codigo);
        await store.guardar('perfiles', { ...perfil, album: normalizarAlbum({ ...perfil.album, codigos }) });
      } else {
        const propia = propias.find((p) => codigoDePropia(p.id) === lamina.codigo);
        for (const c of (await store.listar('calcomanias', { perfilId: perfil.id })).filter((x) => x.codigo === lamina.codigo)) await store.borrar('calcomanias', c.id);
        if (propia) {
          await store.borrar('calcomaniasPropias', propia.id);
          await borrarMedio(store, propia.medioImagenId);
        }
      }
      await repintar();
    } catch (error) {
      estado.textContent = describirError(error);
    }
  }

  async function ponerLamina(codigo, totalPosible) {
    try {
      const codigos = [...new Set([...coleccion.codigos, codigo])];
      await store.guardar('perfiles', { ...perfil, album: normalizarAlbum({ ...perfil.album, codigos: codigos.length >= totalPosible ? null : codigos }) });
      await repintar();
    } catch (error) {
      estado.textContent = describirError(error);
    }
  }

  // las imágenes se leen aparte para que el editor aparezca de una vez
  (async () => {
    previaPortada.src = (await urlDeMedio(store, coleccion.medioPortadaId)) ?? RUTA_PORTADA;
    previaSobre.src = (await urlDeMedio(store, coleccion.medioSobreId)) ?? previaPortada.src;
    const porCodigo = new Map(propias.map((p) => [codigoDePropia(p.id), p]));
    const nodos = [];
    for (const codigo of coleccion.codigos) {
      const propia = porCodigo.get(codigo);
      const nombre = propia ? propia.nombre : (CALCOMANIAS.find((c) => c.codigo === codigo)?.nombre ?? codigo);
      const url = propia ? await urlDeMedio(store, propia.medioImagenId) : rutaCalcomania(codigo);
      nodos.push(el('div', { class: 'editor-album-lamina' },
        url ? el('img', { src: url, alt: '', loading: 'lazy' }) : el('span', { class: 'calcomania-emoji' }, propia?.emoji ?? '★'),
        el('span', {}, nombre),
        el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': `Quitar la lámina ${nombre}`, onclick: () => quitarLamina({ codigo, nombre }) }, 'Quitar')));
    }
    rejilla.replaceChildren(...nodos);
    if (esBase) {
      const propiasBase = propias.filter((p) => !p.coleccionId);
      const todas = [...CALCOMANIAS.map((c) => ({ codigo: c.codigo, nombre: c.nombre })), ...propiasBase.map((p) => ({ codigo: codigoDePropia(p.id), nombre: p.nombre, propia: p }))];
      const quitadas = todas.filter((c) => !coleccion.codigos.includes(c.codigo));
      const nodosQuitadas = [];
      for (const q of quitadas) {
        const url = q.propia ? await urlDeMedio(store, q.propia.medioImagenId) : rutaCalcomania(q.codigo);
        nodosQuitadas.push(el('div', { class: 'editor-album-lamina' },
          url ? el('img', { src: url, alt: '', loading: 'lazy' }) : el('span', { class: 'calcomania-emoji' }, q.propia?.emoji ?? '★'),
          el('span', {}, q.nombre),
          el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': `Volver a poner la lámina ${q.nombre}`, onclick: () => ponerLamina(q.codigo, todas.length) }, 'Poner')));
      }
      quitadasCaja.replaceChildren(...(nodosQuitadas.length ? [el('h3', {}, `Láminas quitadas (${nodosQuitadas.length})`), el('div', { class: 'editor-album-laminas' }, nodosQuitadas)] : []));
    }
  })().catch((error) => { estado.textContent = describirError(error); });

  return el('div', { class: 'editor-album' },
    el('h3', {}, `Editar «${coleccion.nombre}»`),
    campo('Nombre del álbum', entradaNombre),
    el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton chico', onclick: guardarNombre }, 'Guardar el nombre')),
    el('div', { class: 'fila' }, campo('Portada del álbum', previaPortada), el('button', { type: 'button', class: 'boton secundario chico', onclick: () => cambiarImagen('medioPortadaId') }, 'Cambiar la portada')),
    el('div', { class: 'fila' },
      campo('Color de fondo de la tapa', entradaColor, 'Para cuando la imagen de la portada no la llena: se ve la portada entera y este color rellena el resto.'),
      el('button', { type: 'button', class: 'boton secundario chico', onclick: () => guardarColor(entradaColor.value) }, 'Usar este color'),
      coleccion.colorPortada ? el('button', { type: 'button', class: 'boton secundario chico', onclick: () => guardarColor(null) }, 'Quitar el color') : null),
    el('div', { class: 'fila' }, campo('Imagen de los sobres', previaSobre), el('button', { type: 'button', class: 'boton secundario chico', onclick: () => cambiarImagen('medioSobreId') }, 'Cambiar el sobre')),
    el('h3', {}, `Láminas (${coleccion.codigos.length})`),
    rejilla,
    quitadasCaja,
    estado,
    el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton secundario chico', onclick: () => { editandoId = null; repintar(); } }, 'Cerrar el editor')),
  );
}

/**
 * Panel «Álbumes cargados»: cargar una carpeta de imágenes como un álbum nuevo (el adulto elige cuál es la portada del
 * álbum y cuál la del sobre; todas las demás son láminas) y quitar los que ya no se quieran.
 * @param registrar  guarda las URLs de vista previa para soltarlas al salir de la pantalla
 */
function panelAlbumesCargados({ store, perfil, propias, familiares = [], miniaturas, repintar, registrar }) {
  const colecciones = normalizarColecciones(perfil.colecciones);
  const enElCelularDelAlumno = esAlumno(); // ahí lo del curso solo se ve y lo nuevo es de la familia
  const nombre = el('input', { type: 'text', maxlength: 40, autocomplete: 'off', placeholder: 'Por ejemplo: Animales' });
  const estado = el('p', { class: 'ayuda', role: 'status' });
  const selPortada = el('select', { 'aria-label': 'Imagen de la portada del álbum' });
  const selSobre = el('select', { 'aria-label': 'Imagen de los sobres' });
  const previaPortada = el('img', { class: 'carga-previa', alt: '' });
  const previaSobre = el('img', { class: 'carga-previa', alt: '' });
  const resumen = el('p', { class: 'ayuda' });
  const eleccion = el('div', { hidden: true }, resumen,
    el('div', { class: 'fila' }, campo('Portada del álbum', selPortada), previaPortada),
    el('div', { class: 'fila' }, campo('Portada de los sobres', selSobre), previaSobre));
  const botonCrear = el('button', { type: 'button', class: 'boton', hidden: true }, 'Crear el álbum');
  let archivos = [];

  const urlDe = (i) => {
    const url = URL.createObjectURL(archivos[i]);
    registrar(url);
    return url;
  };
  function actualizarVista() {
    const p = Number(selPortada.value);
    const s = Number(selSobre.value);
    previaPortada.src = urlDe(p);
    previaSobre.src = urlDe(s);
    const laminas = archivos.length - (p === s ? 1 : 2);
    resumen.textContent = `${archivos.length} imágenes. Las ${laminas} que no son portada ni sobre serán láminas.`;
    botonCrear.disabled = laminas < 1;
  }
  async function elegir(carpeta) {
    estado.textContent = '';
    const nuevos = await elegirImagenes({ carpeta });
    if (!nuevos.length) return;
    archivos = nuevos;
    const opciones = () => archivos.map((f, i) => el('option', { value: String(i) }, f.name));
    selPortada.replaceChildren(...opciones());
    selSobre.replaceChildren(...opciones());
    const buscar = (patron) => archivos.findIndex((f) => patron.test(f.name));
    const iPortada = Math.max(0, buscar(/portada|cover|tapa/i));
    const iSobre = buscar(/sobre|pack|envelope/i);
    selPortada.value = String(iPortada);
    selSobre.value = String(iSobre >= 0 ? iSobre : iPortada);
    if (!nombre.value.trim()) nombre.value = (nuevos[0].webkitRelativePath || '').split('/')[0] || '';
    eleccion.hidden = false;
    botonCrear.hidden = false;
    actualizarVista();
  }
  selPortada.addEventListener('change', actualizarVista);
  selSobre.addEventListener('change', actualizarVista);

  async function crear() {
    const nombreAlbum = nombre.value.trim();
    if (!nombreAlbum) { estado.textContent = 'Ponle un nombre al álbum.'; return; }
    const iPortada = Number(selPortada.value);
    const iSobre = Number(selSobre.value);
    const laminas = archivos.filter((_, i) => i !== iPortada && i !== iSobre);
    if (!laminas.length) { estado.textContent = 'Hace falta al menos una lámina además de las dos portadas.'; return; }
    botonCrear.disabled = true;
    const creados = []; // para deshacer si algo falla a la mitad
    const medios = [];
    try {
      const subirPortada = async (archivo) => {
        const { blob, mime } = await prepararImagen(archivo, { lado: 1024, conservarProporcion: true });
        const medio = await guardarMedio(store, { tipo: 'imagen', blob, mime, origen: 'foto' });
        medios.push(medio.id);
        return medio;
      };
      estado.textContent = 'Preparando las portadas…';
      const portada = await subirPortada(archivos[iPortada]);
      const sobre = iSobre === iPortada ? portada : await subirPortada(archivos[iSobre]);
      const coleccion = { ...nuevaColeccion({ nombre: nombreAlbum, medioPortadaId: portada.id, medioSobreId: sobre.id }), perfilId: perfil.id };
      for (let k = 0; k < laminas.length; k++) {
        estado.textContent = `Cargando láminas: ${k + 1} de ${laminas.length}…`;
        const { blob, mime } = await prepararImagen(laminas[k]);
        const medio = await guardarMedio(store, { tipo: 'imagen', blob, mime, origen: 'foto' });
        medios.push(medio.id);
        creados.push(await store.guardar('calcomaniasPropias', {
          perfilId: perfil.id, nombre: sinExtension(laminas[k].name), medioImagenId: medio.id, arasaacId: null, emoji: null, coleccionId: coleccion.id,
        }));
      }
      if (enElCelularDelAlumno) await store.guardar('colecciones', coleccion); // la familia: su propio almacén, con `origen: 'familia'`
      else await store.guardar('perfiles', { ...perfil, colecciones: [...colecciones, coleccion] });
      await repintar();
    } catch (error) {
      for (const c of creados) await store.borrar('calcomaniasPropias', c.id).catch(() => {});
      for (const id of medios) await borrarMedio(store, id).catch(() => {});
      estado.textContent = describirError(error);
      botonCrear.disabled = false;
    }
  }
  botonCrear.addEventListener('click', crear);

  async function quitar(coleccion) {
    if (!window.confirm(`¿Quitar el álbum «${coleccion.nombre}» con todas sus láminas? Si el niño ya ganó láminas de él, desaparecen.`)) return;
    try {
      const sueltas = laminasDeColeccion(propias, coleccion.id);
      const codigos = new Set(sueltas.map((p) => codigoDePropia(p.id)));
      for (const c of (await store.listar('calcomanias', { perfilId: perfil.id })).filter((x) => codigos.has(x.codigo))) await store.borrar('calcomanias', c.id);
      for (const p of sueltas) {
        await store.borrar('calcomaniasPropias', p.id);
        await borrarMedio(store, p.medioImagenId);
      }
      await borrarMedio(store, coleccion.medioPortadaId);
      if (coleccion.medioSobreId !== coleccion.medioPortadaId) await borrarMedio(store, coleccion.medioSobreId);
      if (coleccion.esFamilia) await store.borrar('colecciones', coleccion.id);
      else await store.guardar('perfiles', { ...perfil, colecciones: colecciones.filter((c) => c.id !== coleccion.id) });
      await repintar();
    } catch (error) {
      estado.textContent = describirError(error);
    }
  }

  // ----- editar un álbum: nombre, portada, imagen del sobre y sus láminas (se pueden quitar una por una) -----
  const todos = listarColecciones({ perfil, propias, familiares });
  const editor = el('div', { hidden: true });
  const abrirEditor = (coleccion) => {
    editandoId = coleccion.id;
    editor.hidden = false;
    editor.replaceChildren(editorDeAlbum({ store, perfil, coleccion, propias, repintar, registrar }));
  };

  const base = normalizarBase(perfil.base);
  async function quitarBase() {
    if (!todos.some((c) => !c.esBase)) { estado.textContent = 'Es el único álbum: carga otro antes de quitar este.'; return; }
    if (!window.confirm('¿Quitar el álbum de la app? Dejará de verse y de dar láminas. Podrás restaurarlo cuando quieras.')) return;
    try {
      if (editandoId === 'base') editandoId = null;
      await store.guardar('perfiles', { ...perfil, base: { ...base, quitado: true } });
      await repintar();
    } catch (error) {
      estado.textContent = describirError(error);
    }
  }
  async function restaurarBase() {
    try {
      await store.guardar('perfiles', { ...perfil, base: { ...base, quitado: false } });
      await repintar();
    } catch (error) {
      estado.textContent = describirError(error);
    }
  }

  const lista = todos.map((c) =>
    el(
      'li',
      { class: 'fila-contenido' },
      crearMiniatura({ url: miniaturas.get(c.medioPortadaId) ?? (c.esBase ? RUTA_PORTADA : null), texto: c.nombre }),
      el('div', { class: 'fila-texto' }, el('strong', {}, c.nombre),
        el('span', { class: 'ayuda' }, `${c.codigos.length} láminas${c.esBase ? ' · el álbum de la app' : ''}`),
        enElCelularDelAlumno ? el('span', { class: 'insignias' }, el('span', { class: 'insignia' }, c.esFamilia ? 'De la familia' : 'Del curso')) : null),
      // en el celular del alumno lo del curso solo se ve; lo de la familia se edita y se quita
      enElCelularDelAlumno && !c.esFamilia ? null : el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': `Editar el álbum ${c.nombre}`, onclick: () => abrirEditor(c) }, 'Editar'),
      enElCelularDelAlumno && !c.esFamilia ? null : el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': `Quitar el álbum ${c.nombre}`, onclick: () => (c.esBase ? quitarBase() : quitar(c)) }, 'Quitar'),
    ));
  const abierto = todos.find((c) => c.id === editandoId && (!enElCelularDelAlumno || c.esFamilia));
  if (abierto) abrirEditor(abierto);

  return el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'Álbumes'),
    el('p', { class: 'ayuda' }, 'Carga una carpeta de imágenes como un álbum nuevo: tú eliges cuál es la portada del álbum y cuál la de los sobres, y todas las demás son láminas. El niño elige de cuál álbum quiere su premio (hasta 3 al azar) y la tienda tiene un sobre de cada álbum.'),
    el('ul', { class: 'lista-simple' }, lista),
    base.quitado && !todos.some((c) => c.esBase) && !enElCelularDelAlumno
      ? el('div', { class: 'fila-contenido' }, el('p', { class: 'ayuda' }, 'El álbum de la app está quitado.'), el('button', { type: 'button', class: 'boton secundario chico', onclick: restaurarBase }, 'Restaurar el álbum de la app'))
      : null,
    editor,
    el('h3', {}, 'Cargar un álbum nuevo'),
    campo('Nombre del álbum', nombre),
    el('div', { class: 'acciones' },
      el('button', { type: 'button', class: 'boton secundario', onclick: () => elegir(true) }, 'Elegir una carpeta'),
      el('button', { type: 'button', class: 'boton secundario', onclick: () => elegir(false) }, 'Elegir imágenes sueltas')),
    eleccion,
    estado,
    el('div', { class: 'acciones' }, botonCrear),
  );
}

/**
 * El álbum de UN alumno (su ficha): solo se mira. Las calcomanías y las monedas son suyas (de su ficha); el tamaño del álbum
 * es del curso. Para cambiar el álbum del curso se vuelve al perfil.
 */
async function pintarFicha(raiz, ruta, estaVivo) {
  const store = await obtenerStore();
  const sujeto = await sujetoDeEstadisticas(ruta);
  const atras = { atras: '#/adulto/alumnos', textoAtras: '← Alumnos' };
  if (!sujeto?.ficha) {
    raiz.replaceChildren(cabecera('Álbum y monedas', atras), el('div', { class: 'panel' }, el('p', {}, 'Esa ficha de alumno ya no existe.')));
    return;
  }
  const [calcomanias, movimientos, premiosDelCurso, propiasDelCurso, filasFamilia] = await Promise.all([
    store.listar('calcomanias', { perfilId: sujeto.id }),
    store.listar('movimientos', { perfilId: sujeto.id }),
    store.listar('premios', { perfilId: sujeto.contenidoId }),
    store.listar('calcomaniasPropias', { perfilId: sujeto.contenidoId }),
    store.listar('contenidoFamilia'),
  ]);
  if (!estaVivo()) return;
  const album = normalizarAlbum(sujeto.perfil.album);
  const estado = calcularAlbumes({ calcomanias, movimientos, tamano: album.tamano });
  const dato = (valor, etiqueta) => el('div', { class: 'dato' }, el('strong', {}, String(valor)), el('span', {}, etiqueta));
  // lo que agregó su familia (la lista llega con su archivo, sin imágenes): premios y álbumes con su avance
  const suyas = filasFamilia.filter((f) => f.fichaId === sujeto.id);
  const premiosFamilia = registrosDeFamilia(suyas, 'premios');
  const monedas = resumenDeMonedas({ movimientos, premios: [...premiosDelCurso, ...premiosFamilia] });
  const albumesFamilia = listarColecciones({
    perfil: sujeto.perfil,
    propias: [...propiasDelCurso, ...registrosDeFamilia(suyas, 'calcomaniasPropias')],
    familiares: registrosDeFamilia(suyas, 'colecciones'),
  }).filter((c) => c.esFamilia);
  raiz.replaceChildren(
    cabecera('Álbum y monedas', atras),
    el('div', { class: 'panel' },
      el('h2', {}, `Álbum de ${sujeto.titulo}`),
      el('p', { class: 'ayuda' }, `Es el álbum de ${sujeto.ficha.nombre} (${sujeto.ficha.email}). Solo se puede ver: sus monedas y calcomanías son de su propio celular. El tamaño y los álbumes disponibles son los del perfil.`),
      el('div', { class: 'datos' },
        dato(saldo(movimientos), 'monedas'),
        dato(calcomanias.filter((c) => !c.deleted).length, 'calcomanías'),
        dato(estado.completos.length, estado.completos.length === 1 ? 'álbum completo' : 'álbumes completos'),
        dato(`${estado.actual.codigos.length} de ${album.tamano}`, 'en el álbum actual'),
      ),
    ),
    el('div', { class: 'panel' },
      el('h2', {}, 'Monedas y tienda'),
      el('div', { class: 'datos' },
        dato(monedas.saldo, 'saldo (un solo saldo: jugando + lo que dio la familia − lo canjeado)'),
        dato(monedas.dadasPorLaFamilia, 'monedas dadas por la familia'),
        dato(monedas.canjes.length, monedas.canjes.length === 1 ? 'premio canjeado' : 'premios canjeados')),
      monedas.canjes.length
        ? el('ul', { class: 'lista-simple' }, monedas.canjes.map((c) => el('li', {}, `${c.nombre} · ${c.precio} ${c.precio === 1 ? 'moneda' : 'monedas'} · ${c.estado === 'entregado' ? 'entregado' : 'por entregar'}`)))
        : el('p', { class: 'ayuda' }, 'Todavía no canjeó ningún premio.')),
    el('div', { class: 'panel' },
      el('h2', {}, 'Álbumes de la familia'),
      albumesFamilia.length
        ? el('ul', { class: 'lista-simple' }, albumesFamilia.map((c) => {
          const pegadas = c.codigos.length - faltantesPorPegar(c, calcomanias);
          return el('li', {}, el('strong', {}, c.nombre), ` · ${pegadas} de ${c.codigos.length} láminas pegadas`, el('span', { class: 'insignia' }, 'De la familia'));
        }))
        : el('p', { class: 'ayuda' }, 'La familia todavía no agregó álbumes. Sus imágenes no se bajan salvo con «Traer el material de la familia» en Alumnos.')),
  );
}

export function montar(contenedor, { ruta = '' } = {}) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Álbum y monedas'), cargando());
  contenedor.append(raiz);
  if (/\/ficha\//.test(ruta)) {
    let vivoFicha = true;
    pintarFicha(raiz, ruta, () => vivoFicha).catch((error) => mostrarError(raiz, error));
    return () => { vivoFicha = false; };
  }
  let vivo = true;
  let selector = null;
  const urlsTemporales = []; // vistas previas de las imágenes elegidas para un álbum nuevo

  async function pintar() {
    const store = await obtenerStore();
    const perfil = await perfilActivo();
    if (!vivo) return;
    if (!perfil) {
      raiz.replaceChildren(cabecera('Álbum y monedas'), el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.'), el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el perfil')));
      return;
    }
    const datos = await cargarMonedas(store, perfil);
    const familiares = await store.listar('colecciones', { perfilId: perfil.id }); // los álbumes que agregó la familia (solo en el celular del alumno)
    const propias = mapaDePropias(datos.propias);
    const actualesNodos = (await Promise.all(datos.actual.codigos.map((c) => nodoDeCalcomania(store, c, propias)))).filter(Boolean);
    const miniaturasPropias = new Map(await Promise.all([...propias.values()].filter((p) => !p.coleccionId).map(async (p) => [p.id, await urlDeMedio(store, p.medioImagenId)])));
    const portadasCargadas = new Map(await Promise.all([normalizarBase(perfil.base), ...normalizarColecciones(perfil.colecciones), ...normalizarColecciones(familiares)].map(async (c) => [c.medioPortadaId, await urlDeMedio(store, c.medioPortadaId)])));
    if (!vivo) return;

    // ----- ajustes del álbum -----
    const config = datos.album;
    const entradaTamano = el('input', { type: 'number', min: TAMANO_MIN, max: TAMANO_MAX, value: config.tamano, inputmode: 'numeric' });
    const entradaLeccion = el('input', { type: 'number', min: MONEDAS_LECCION_MIN, max: MONEDAS_LECCION_MAX, value: config.monedasPorLeccion, inputmode: 'numeric' });
    const entradaMonedas = el('input', { type: 'number', min: MONEDAS_MIN, max: MONEDAS_MAX, value: config.monedasPorAlbum, inputmode: 'numeric' });
    // las láminas de los álbumes cargados (con `coleccionId`) tienen su propio panel: aquí solo las sueltas
    const propiasBase = [...propias.values()].filter((p) => !p.coleccionId);
    const mensaje = el('p', { class: 'ayuda', role: 'status' });

    async function guardarAjustes() {
      const tamano = Number(entradaTamano.value);
      const monedas = Number(entradaMonedas.value);
      if (!Number.isInteger(tamano) || tamano < TAMANO_MIN || tamano > TAMANO_MAX) {
        mensaje.textContent = `El tamaño del álbum va de ${TAMANO_MIN} a ${TAMANO_MAX}.`;
        return;
      }
      if (!Number.isInteger(monedas) || monedas < MONEDAS_MIN || monedas > MONEDAS_MAX) {
        mensaje.textContent = `Las monedas por álbum van de ${MONEDAS_MIN} a ${MONEDAS_MAX}.`;
        return;
      }
      const porLeccion = Number(entradaLeccion.value);
      if (!Number.isInteger(porLeccion) || porLeccion < MONEDAS_LECCION_MIN || porLeccion > MONEDAS_LECCION_MAX) {
        mensaje.textContent = `Las monedas por lección van de ${MONEDAS_LECCION_MIN} a ${MONEDAS_LECCION_MAX}.`;
        return;
      }
      try {
        await store.guardar('perfiles', { ...perfil, album: normalizarAlbum({ tamano, monedasPorAlbum: monedas, monedasPorLeccion: porLeccion, codigos: config.codigos }) });
        mensaje.textContent = 'Guardado. Rige desde la próxima calcomanía; los álbumes ya completos no cambian.';
        await pintar();
      } catch (error) {
        mensaje.textContent = describirError(error);
      }
    }

    // ----- pruebas y reinicio -----
    const mensajePrueba = el('p', { class: 'ayuda', role: 'status' });
    async function cargarPrueba() {
      try {
        await store.guardar('movimientos', crearRegalo({ perfilId: perfil.id, cantidad: 9999, nota: 'Carga de prueba' }));
        await pintar();
      } catch (error) {
        mensajePrueba.textContent = describirError(error);
      }
    }
    async function reiniciar() {
      if (!window.confirm('¿Reiniciar los álbumes? Se borran todas las láminas del niño y no se puede deshacer.')) return;
      try {
        await reiniciarAlbumes(store, perfil);
        await pintar();
      } catch (error) {
        mensajePrueba.textContent = describirError(error);
      }
    }

    // ----- calcomanías propias -----
    const entradaNombre = el('input', { type: 'text', maxlength: 30, autocomplete: 'off' });
    selector?.liberar();
    selector = crearSelectorImagen({ texto: '' });
    const mensajePropia = el('p', { class: 'ayuda', role: 'status' });

    async function agregarPropia() {
      const nombre = entradaNombre.value.trim();
      const imagen = selector.leer();
      if (!nombre) { mensajePropia.textContent = 'Ponle un nombre.'; return; }
      if (!imagen.blob && !imagen.emoji) { mensajePropia.textContent = 'Elige una foto, un pictograma o un emoji.'; return; }
      try {
        const medio = imagen.blob ? await guardarMedio(store, { tipo: 'imagen', blob: imagen.blob, mime: imagen.mime, origen: imagen.origen, arasaacId: imagen.arasaacId }) : null;
        const nueva = await store.guardar('calcomaniasPropias', { perfilId: perfil.id, nombre, medioImagenId: medio?.id ?? null, arasaacId: imagen.arasaacId, emoji: imagen.emoji });
        // si el álbum de la app tiene una lista de láminas, la nueva entra a ella
        // (el álbum del curso lo ordena el adulto: la familia no cambia la lista de láminas)
        if (config.codigos && !esAlumno()) await store.guardar('perfiles', { ...perfil, album: normalizarAlbum({ ...config, codigos: [...config.codigos, codigoDePropia(nueva.id)] }) });
        await pintar();
      } catch (error) {
        mensajePropia.textContent = describirError(error);
      }
    }

    async function quitarPropia(propia) {
      if (!window.confirm(`¿Quitar la calcomanía «${propia.nombre}»? Si el niño ya la ganó, desaparece de sus álbumes.`)) return;
      try {
        await store.borrar('calcomaniasPropias', propia.id);
        await borrarMedio(store, propia.medioImagenId);
        await pintar();
      } catch (error) {
        mensajePropia.textContent = describirError(error);
      }
    }

    const listaPropias = propiasBase.map((p) =>
      el(
        'li',
        { class: 'fila-contenido' },
        crearMiniatura({ url: miniaturasPropias.get(p.id), emoji: p.emoji, texto: p.nombre }),
        el('div', { class: 'fila-texto' }, el('strong', {}, p.nombre), esAlumno() ? el('span', { class: 'insignia' }, p.origen === 'familia' ? 'De la familia' : 'Del curso') : null),
        esAlumno() && p.origen !== 'familia' ? null : el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': `Quitar la calcomanía ${p.nombre}`, onclick: () => quitarPropia(p) }, 'Quitar'),
      ),
    );

    // En el celular de un alumno: el álbum actual (solo se ve) y las láminas propias de la familia; nada del curso se cambia
    if (esAlumno()) {
      raiz.replaceChildren(
        cabecera('Álbum'),
        el('div', { class: 'panel' },
          el('h2', {}, `Álbum ${datos.actual.numero} (${datos.actual.codigos.length} de ${config.tamano})`),
          actualesNodos.length
            ? el('div', { class: 'album album-adulto', 'aria-label': 'Calcomanías del álbum actual' }, actualesNodos)
            : el('p', { class: 'ayuda' }, 'Aún no tiene calcomanías en este álbum.'),
          el('p', { class: 'ayuda' }, `Álbumes completos: ${datos.completos.length}. El tamaño y las monedas por álbum los pone el adulto del curso.`),
          el('div', { class: 'fila-contenido' }, crearCofre({ saldo: datos.saldo, compacto: true }), el('a', { class: 'boton secundario', href: '#/adulto/tienda' }, 'Ir a la tienda'))),
        // los álbumes del curso se ven (sin Editar ni Quitar); la familia carga, edita y quita los suyos, con portada, sobre y láminas
        panelAlbumesCargados({ store, perfil, propias: [...propias.values()], familiares, miniaturas: portadasCargadas, repintar: pintar, registrar: (url) => urlsTemporales.push(url) }),
        el('div', { class: 'panel' },
          el('h2', {}, 'Láminas sueltas de la familia'),
          el('p', { class: 'ayuda' }, 'Crea láminas con una foto, un pictograma o un emoji. Se quedan en este celular y en el Drive del alumno. Las del curso solo se ven.'),
          listaPropias.length ? el('ul', { class: 'lista-simple' }, listaPropias) : el('p', { class: 'ayuda' }, 'Todavía no hay ninguna.'),
          campo('Nombre', entradaNombre),
          selector.elemento,
          mensajePropia,
          el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton', onclick: agregarPropia }, 'Agregar lámina'))),
      );
      return;
    }

    raiz.replaceChildren(
      cabecera('Álbum y monedas'),
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, `Álbum ${datos.actual.numero} (${datos.actual.codigos.length} de ${config.tamano})`),
        actualesNodos.length
          ? el('div', { class: 'album album-adulto', 'aria-label': 'Calcomanías del álbum actual' }, actualesNodos)
          : el('p', { class: 'ayuda' }, 'Aún no tiene calcomanías en este álbum.'),
        el('p', { class: 'ayuda' }, `Álbumes completos: ${datos.completos.length}. Cada sesión terminada da una calcomanía; al llenar el álbum el niño gana ${config.monedasPorAlbum} monedas de oro y empieza otro álbum vacío.`),
        el('div', { class: 'fila-contenido' }, crearCofre({ saldo: datos.saldo, compacto: true }), el('a', { class: 'boton secundario', href: '#/adulto/tienda' }, 'Ir a la tienda')),
      ),
      panelAlbumesCargados({ store, perfil, propias: [...propias.values()], familiares, miniaturas: portadasCargadas, repintar: pintar, registrar: (url) => urlsTemporales.push(url) }),
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Cómo es el álbum'),
        el('div', { class: 'fila' }, campo('Calcomanías por álbum', entradaTamano, `De ${TAMANO_MIN} a ${TAMANO_MAX}`), campo('Monedas de oro por álbum', entradaMonedas, `De ${MONEDAS_MIN} a ${MONEDAS_MAX}`)),
        el('div', { class: 'fila' }, campo('Monedas por lección terminada', entradaLeccion, `De ${MONEDAS_LECCION_MIN} a ${MONEDAS_LECCION_MAX}. Un sobre de láminas cuesta 5 lecciones.`)),
        mensaje,
        el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton', onclick: guardarAjustes }, 'Guardar')),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Pruebas y reinicio'),
        el('p', { class: 'ayuda' }, 'Cargar monedas suma un regalo de 9999 al saldo. Reiniciar borra todas las láminas y los premios de álbum del niño (no devuelve las monedas gastadas en sobres ni los regalos).'),
        mensajePrueba,
        el(
          'div',
          { class: 'acciones' },
          el('button', { type: 'button', class: 'boton secundario', onclick: cargarPrueba }, 'Cargar 9999 monedas'),
          el('button', { type: 'button', class: 'boton secundario', onclick: reiniciar }, 'Reiniciar álbumes'),
        ),
      ),
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Mis calcomanías propias'),
        el('p', { class: 'ayuda' }, 'Crea calcomanías con una foto (su mascota, un familiar), un pictograma o un emoji. Las nuevas entran solas al álbum de la app; para sacarlas, usa «Editar» en el álbum.'),
        listaPropias.length ? el('ul', { class: 'lista-simple' }, listaPropias) : el('p', { class: 'ayuda' }, 'Todavía no hay ninguna.'),
        campo('Nombre', entradaNombre),
        selector.elemento,
        mensajePropia,
        el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton', onclick: agregarPropia }, 'Agregar calcomanía')),
      ),
    );
  }

  pintar().catch((error) => mostrarError(raiz, error));
  return () => {
    vivo = false;
    for (const url of urlsTemporales) URL.revokeObjectURL(url);
    selector?.liberar();
    liberarUrls();
  };
}
