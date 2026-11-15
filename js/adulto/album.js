// Álbum y monedas (modo adulto, fase 11): tamaño del álbum, monedas por álbum, qué calcomanías están en juego,
// calcomanías propias y los álbumes ya completos.

import { el } from '../ui/dom.js';
import { cabecera, campo, cargando, describirError, mostrarError } from '../ui/adulto.js';
import { crearSelectorImagen } from '../ui/selector-imagen.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { crearCofre } from '../ui/moneda.js';
import { mapaDePropias, nodoDeCalcomania } from '../ui/calcomania.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { borrarMedio, guardarMedio, liberarUrls, urlDeMedio } from '../medios.js';
import { cargarMonedas, reiniciarAlbumes } from '../albumes.js';
import { MONEDAS_LECCION_MAX, MONEDAS_LECCION_MIN, MONEDAS_MAX, MONEDAS_MIN, TAMANO_MAX, TAMANO_MIN, crearRegalo, normalizarAlbum } from '../core/album.js';
import { CALCOMANIAS, codigoDePropia, rutaCalcomania } from '../core/calcomanias.js';
import { laminasDeColeccion, normalizarColecciones, nuevaColeccion } from '../core/colecciones.js';
import { elegirImagenes } from '../hardware.js';
import { prepararImagen } from '../imagenes.js';

export const titulo = 'Álbum y monedas · Leo Conmigo';

const sinExtension = (nombre) => nombre.replace(/\.[^.]+$/, '');

/**
 * Panel «Álbumes cargados»: cargar una carpeta de imágenes como un álbum nuevo (el adulto elige cuál es la portada del
 * álbum y cuál la del sobre; todas las demás son láminas) y quitar los que ya no se quieran.
 * @param registrar  guarda las URLs de vista previa para soltarlas al salir de la pantalla
 */
function panelAlbumesCargados({ store, perfil, propias, miniaturas, repintar, registrar }) {
  const colecciones = normalizarColecciones(perfil.colecciones);
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
      const coleccion = nuevaColeccion({ nombre: nombreAlbum, medioPortadaId: portada.id, medioSobreId: sobre.id });
      for (let k = 0; k < laminas.length; k++) {
        estado.textContent = `Cargando láminas: ${k + 1} de ${laminas.length}…`;
        const { blob, mime } = await prepararImagen(laminas[k]);
        const medio = await guardarMedio(store, { tipo: 'imagen', blob, mime, origen: 'foto' });
        medios.push(medio.id);
        creados.push(await store.guardar('calcomaniasPropias', {
          perfilId: perfil.id, nombre: sinExtension(laminas[k].name), medioImagenId: medio.id, arasaacId: null, emoji: null, coleccionId: coleccion.id,
        }));
      }
      await store.guardar('perfiles', { ...perfil, colecciones: [...colecciones, coleccion] });
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
      await store.guardar('perfiles', { ...perfil, colecciones: colecciones.filter((c) => c.id !== coleccion.id) });
      await repintar();
    } catch (error) {
      estado.textContent = describirError(error);
    }
  }

  const lista = colecciones.map((c) =>
    el(
      'li',
      { class: 'fila-contenido' },
      crearMiniatura({ url: miniaturas.get(c.medioPortadaId), texto: c.nombre }),
      el('div', { class: 'fila-texto' }, el('strong', {}, c.nombre), el('span', { class: 'ayuda' }, `${laminasDeColeccion(propias, c.id).length} láminas`)),
      el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': `Quitar el álbum ${c.nombre}`, onclick: () => quitar(c) }, 'Quitar'),
    ));

  return el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'Álbumes cargados'),
    el('p', { class: 'ayuda' }, 'Carga una carpeta de imágenes como un álbum nuevo: tú eliges cuál es la portada del álbum y cuál la de los sobres, y todas las demás son láminas. El niño elige de cuál álbum quiere su premio (hasta 3 al azar) y la tienda tiene un sobre de cada álbum.'),
    lista.length ? el('ul', { class: 'lista-simple' }, lista) : el('p', { class: 'ayuda' }, 'Todavía no hay álbumes cargados (siempre está el álbum de la app).'),
    campo('Nombre del álbum', nombre),
    el('div', { class: 'acciones' },
      el('button', { type: 'button', class: 'boton secundario', onclick: () => elegir(true) }, 'Elegir una carpeta'),
      el('button', { type: 'button', class: 'boton secundario', onclick: () => elegir(false) }, 'Elegir imágenes sueltas')),
    eleccion,
    estado,
    el('div', { class: 'acciones' }, botonCrear),
  );
}

export function montar(contenedor) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Álbum y monedas'), cargando());
  contenedor.append(raiz);
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
    const propias = mapaDePropias(datos.propias);
    const actualesNodos = (await Promise.all(datos.actual.codigos.map((c) => nodoDeCalcomania(store, c, propias)))).filter(Boolean);
    const miniaturasPropias = new Map(await Promise.all([...propias.values()].filter((p) => !p.coleccionId).map(async (p) => [p.id, await urlDeMedio(store, p.medioImagenId)])));
    const portadasCargadas = new Map(await Promise.all(normalizarColecciones(perfil.colecciones).map(async (c) => [c.medioPortadaId, await urlDeMedio(store, c.medioPortadaId)])));
    if (!vivo) return;

    // ----- ajustes del álbum -----
    const config = datos.album;
    const entradaTamano = el('input', { type: 'number', min: TAMANO_MIN, max: TAMANO_MAX, value: config.tamano, inputmode: 'numeric' });
    const entradaLeccion = el('input', { type: 'number', min: MONEDAS_LECCION_MIN, max: MONEDAS_LECCION_MAX, value: config.monedasPorLeccion, inputmode: 'numeric' });
    const entradaMonedas = el('input', { type: 'number', min: MONEDAS_MIN, max: MONEDAS_MAX, value: config.monedasPorAlbum, inputmode: 'numeric' });
    // las láminas de los álbumes cargados (con `coleccionId`) tienen su propio panel: aquí solo las sueltas
    const propiasBase = [...propias.values()].filter((p) => !p.coleccionId);
    const enJuego = new Set(config.codigos ?? [...CALCOMANIAS.map((c) => c.codigo), ...propiasBase.map((p) => codigoDePropia(p.id))]);
    const mensaje = el('p', { class: 'ayuda', role: 'status' });

    const todos = [
      ...CALCOMANIAS.map((c) => ({ codigo: c.codigo, nombre: c.nombre, url: rutaCalcomania(c.codigo) })),
      ...propiasBase.map((p) => ({ codigo: codigoDePropia(p.id), nombre: p.nombre, url: miniaturasPropias.get(p.id), emoji: p.emoji })),
    ];
    const casillas = new Map();
    const cuadricula = el(
      'div',
      { class: 'casillas-calcomanias' },
      todos.map((c) => {
        const casilla = el('input', { type: 'checkbox', checked: enJuego.has(c.codigo) });
        casillas.set(c.codigo, casilla);
        const dibujo = c.url ? el('img', { src: c.url, alt: '', draggable: 'false' }) : el('span', { class: 'calcomania-emoji' }, c.emoji ?? '★');
        return el('label', { class: 'casilla-calcomania' }, casilla, dibujo, el('span', {}, c.nombre));
      }),
    );
    const marcar = (valor) => casillas.forEach((c) => { c.checked = valor; });

    async function guardarAjustes() {
      const elegidas = todos.filter((c) => casillas.get(c.codigo).checked).map((c) => c.codigo);
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
      if (elegidas.length < tamano) {
        mensaje.textContent = `Elige al menos ${tamano} calcomanías (ahora hay ${elegidas.length}) o achica el álbum.`;
        return;
      }
      const porLeccion = Number(entradaLeccion.value);
      if (!Number.isInteger(porLeccion) || porLeccion < MONEDAS_LECCION_MIN || porLeccion > MONEDAS_LECCION_MAX) {
        mensaje.textContent = `Las monedas por lección van de ${MONEDAS_LECCION_MIN} a ${MONEDAS_LECCION_MAX}.`;
        return;
      }
      const todasMarcadas = elegidas.length === todos.length;
      try {
        await store.guardar('perfiles', { ...perfil, album: normalizarAlbum({ tamano, monedasPorAlbum: monedas, monedasPorLeccion: porLeccion, codigos: todasMarcadas ? null : elegidas }) });
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
        await store.guardar('calcomaniasPropias', { perfilId: perfil.id, nombre, medioImagenId: medio?.id ?? null, arasaacId: imagen.arasaacId, emoji: imagen.emoji });
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
        el('div', { class: 'fila-texto' }, el('strong', {}, p.nombre)),
        el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': `Quitar la calcomanía ${p.nombre}`, onclick: () => quitarPropia(p) }, 'Quitar'),
      ),
    );

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
        el('div', { class: 'fila-contenido' }, crearCofre({ saldo: datos.saldo }), el('a', { class: 'boton secundario', href: '#/adulto/tienda' }, 'Ir a la tienda')),
      ),
      panelAlbumesCargados({ store, perfil, propias: [...propias.values()], miniaturas: portadasCargadas, repintar: pintar, registrar: (url) => urlsTemporales.push(url) }),
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Cómo es el álbum'),
        el('div', { class: 'fila' }, campo('Calcomanías por álbum', entradaTamano, `De ${TAMANO_MIN} a ${TAMANO_MAX}`), campo('Monedas de oro por álbum', entradaMonedas, `De ${MONEDAS_MIN} a ${MONEDAS_MAX}`)),
        el('div', { class: 'fila' }, campo('Monedas por lección terminada', entradaLeccion, `De ${MONEDAS_LECCION_MIN} a ${MONEDAS_LECCION_MAX}. Un sobre de láminas cuesta 5 lecciones.`)),
        el('h3', {}, 'Calcomanías en juego'),
        el('p', { class: 'ayuda' }, 'Solo salen las marcadas. Tiene que haber al menos tantas como calcomanías por álbum.'),
        el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton secundario chico', onclick: () => marcar(true) }, 'Marcar todas'), el('button', { type: 'button', class: 'boton secundario chico', onclick: () => marcar(false) }, 'Quitar todas')),
        cuadricula,
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
        el('p', { class: 'ayuda' }, 'Crea calcomanías con una foto (su mascota, un familiar), un pictograma o un emoji. Si arriba están todas las calcomanías marcadas, las nuevas entran solas al juego; si no, márcalas arriba y guarda.'),
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
