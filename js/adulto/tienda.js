// Tienda y monedas (modo adulto, fase 11): premios configurables, canjes pendientes de entregar, saldo del niño
// y su historial. Los premios son cosas reales (un helado, ir al parque): la app solo anota el canje y el adulto lo entrega.

import { el } from '../ui/dom.js';
import { cabecera, campo, cargando, describirError, mostrarError } from '../ui/adulto.js';
import { crearSelectorImagen } from '../ui/selector-imagen.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { crearCofre } from '../ui/moneda.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { borrarMedio, guardarMedio, liberarUrls, urlDeMedio } from '../medios.js';
import { cargarMonedas } from '../albumes.js';
import { crearPaginacion } from '../ui/paginacion.js';
import { filtrarMovimientos, paginar } from '../core/listas.js';
import { PRECIO_MAX, PRECIO_MIN, canjesPendientes, crearRegalo, nuevoPremio } from '../core/album.js';

export const titulo = 'Tienda y monedas · Leo Conmigo';

const TIPOS = { album: 'Álbum completo', canje: 'Canje', regalo: 'Regalo', correccion: 'Corrección', leccion: 'Lección terminada', sobre: 'Sobre de láminas', venta: 'Venta de repetida' };
const ESTADOS = { pendiente: 'por entregar', entregado: 'entregado', anulado: 'anulado' };
const fechaCorta = (iso) => {
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? '' : f.toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const textoMonedas = (n) => `${n} ${Math.abs(n) === 1 ? 'moneda' : 'monedas'}`;

export function montar(contenedor) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Tienda y monedas'), cargando());
  contenedor.append(raiz);
  let vivo = true;
  let selector = null;
  let editandoId = null; // id del premio que se está editando (null = agregar uno nuevo)
  const filtros = { tipo: 'todos', signo: 'todos', desde: '', hasta: '', texto: '', pagina: 1, abierto: false }; // se conservan al repintar

  async function pintar() {
    const store = await obtenerStore();
    const perfil = await perfilActivo();
    if (!vivo) return;
    if (!perfil) {
      raiz.replaceChildren(cabecera('Tienda y monedas'), el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.'), el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el perfil')));
      return;
    }
    const datos = await cargarMonedas(store, perfil);
    const premios = datos.premios.filter((p) => !p.deleted).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const premiosPorId = new Map(premios.map((p) => [p.id, p]));
    const urls = new Map(await Promise.all(premios.map(async (p) => [p.id, await urlDeMedio(store, p.medioImagenId)])));
    const pendientes = canjesPendientes(datos.movimientos);
    if (!vivo) return;

    const accion = (fn, mensajeEl) => async () => {
      try {
        await fn();
        await pintar();
      } catch (error) {
        mensajeEl.textContent = describirError(error);
      }
    };

    // ----- saldo, regalos y correcciones -----
    const mensajeSaldo = el('p', { class: 'ayuda', role: 'status' });
    const entradaCantidad = el('input', { type: 'number', step: 1, inputmode: 'numeric', value: '1' });
    const entradaNota = el('input', { type: 'text', maxlength: 80, autocomplete: 'off' });
    const mover = (tipo) => accion(async () => {
      const cantidad = Number(entradaCantidad.value);
      if (tipo === 'regalo' && cantidad <= 0) throw new Error('Para regalar, la cantidad debe ser mayor que cero. Para quitar monedas usa «Corregir el saldo».');
      await store.guardar('movimientos', crearRegalo({ perfilId: perfil.id, cantidad, nota: entradaNota.value, tipo }));
    }, mensajeSaldo);

    // ----- canjes pendientes -----
    const mensajeCanjes = el('p', { class: 'ayuda', role: 'status' });
    const filasPendientes = pendientes.map((m) =>
      el(
        'li',
        { class: 'fila-contenido' },
        el('div', { class: 'fila-texto' }, el('strong', {}, m.nota || premiosPorId.get(m.premioId)?.nombre || 'Premio'), el('span', { class: 'ayuda' }, `${fechaCorta(m.fecha)} · ${textoMonedas(-m.cantidad)}`)),
        el('div', { class: 'acciones' },
          el('button', { type: 'button', class: 'boton chico', onclick: accion(() => store.guardar('movimientos', { ...m, estado: 'entregado' }), mensajeCanjes) }, 'Entregado'),
          el('button', { type: 'button', class: 'boton secundario chico', onclick: () => {
            if (window.confirm('¿Anular este canje? Las monedas vuelven al niño.')) accion(() => store.guardar('movimientos', { ...m, estado: 'anulado' }), mensajeCanjes)();
          } }, 'Anular'),
        ),
      ),
    );

    // ----- premios -----
    const mensajePremio = el('p', { class: 'ayuda', role: 'status' });
    const editado = editandoId ? premiosPorId.get(editandoId) ?? null : null;
    if (editandoId && !editado) editandoId = null;
    const entradaNombre = el('input', { type: 'text', maxlength: 40, autocomplete: 'off', value: editado?.nombre ?? '' });
    const entradaPrecio = el('input', { type: 'number', min: PRECIO_MIN, max: PRECIO_MAX, inputmode: 'numeric', value: String(editado?.precio ?? 5) });
    selector?.liberar();
    selector = crearSelectorImagen({ texto: editado?.nombre ?? '', urlInicial: editado ? urls.get(editado.id) : null, emojiInicial: editado?.emoji ?? null });

    async function guardarPremio() {
      const nombre = entradaNombre.value.trim();
      const imagen = selector.leer();
      if (!nombre) { mensajePremio.textContent = 'Ponle un nombre al premio.'; return; }
      const precio = Number(entradaPrecio.value);
      if (!Number.isInteger(precio) || precio < PRECIO_MIN || precio > PRECIO_MAX) { mensajePremio.textContent = `El precio va de ${PRECIO_MIN} a ${PRECIO_MAX} monedas.`; return; }
      if (!imagen.blob && !imagen.emoji && !(editado?.medioImagenId && !imagen.quitar)) { mensajePremio.textContent = 'Elige una foto, un pictograma o un emoji: el niño elige mirando la imagen.'; return; }
      try {
        let medioImagenId = editado?.medioImagenId ?? null;
        let arasaacId = editado?.arasaacId ?? null;
        if (imagen.blob) {
          const medio = await guardarMedio(store, { tipo: 'imagen', blob: imagen.blob, mime: imagen.mime, origen: imagen.origen, arasaacId: imagen.arasaacId });
          await borrarMedio(store, medioImagenId);
          medioImagenId = medio.id;
          arasaacId = imagen.arasaacId;
        } else if (imagen.quitar) {
          await borrarMedio(store, medioImagenId);
          medioImagenId = null;
          arasaacId = null;
        }
        const base = nuevoPremio({ perfilId: perfil.id, nombre, precio, medioImagenId, arasaacId, emoji: imagen.emoji, activo: editado?.activo ?? true, orden: editado?.orden ?? premios.length });
        await store.guardar('premios', editado ? { ...editado, ...base, id: editado.id } : base);
        editandoId = null;
        await pintar();
      } catch (error) {
        mensajePremio.textContent = describirError(error);
      }
    }

    const reordenar = (premio, delta) => accion(async () => {
      const i = premios.findIndex((p) => p.id === premio.id);
      const j = i + delta;
      if (j < 0 || j >= premios.length) return;
      const lista = [...premios];
      [lista[i], lista[j]] = [lista[j], lista[i]];
      const cambiados = lista.map((p, orden) => ({ ...p, orden })).filter((p, orden) => premios[orden].id !== p.id || premios[orden].orden !== p.orden);
      await store.guardarVarios('premios', cambiados);
    }, mensajePremio);

    const filasPremios = premios.map((p, i) =>
      el(
        'li',
        { class: 'fila-contenido' },
        crearMiniatura({ url: urls.get(p.id), emoji: p.emoji, texto: p.nombre }),
        el('div', { class: 'fila-texto' }, el('strong', {}, p.nombre), el('span', { class: 'ayuda' }, `${textoMonedas(p.precio)}${p.activo === false ? ' · en pausa' : ''}`)),
        el('div', { class: 'acciones' },
          el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': `Subir ${p.nombre}`, disabled: i === 0, onclick: reordenar(p, -1) }, '↑'),
          el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': `Bajar ${p.nombre}`, disabled: i === premios.length - 1, onclick: reordenar(p, 1) }, '↓'),
          el('button', { type: 'button', class: 'boton secundario chico', onclick: accion(() => store.guardar('premios', { ...p, activo: p.activo === false }), mensajePremio) }, p.activo === false ? 'Activar' : 'Pausar'),
          el('button', { type: 'button', class: 'boton secundario chico', onclick: () => { editandoId = p.id; pintar(); } }, 'Editar'),
          el('button', { type: 'button', class: 'boton secundario chico', 'aria-label': `Quitar ${p.nombre}`, onclick: () => {
            if (window.confirm(`¿Quitar el premio «${p.nombre}»?`)) accion(async () => { await store.borrar('premios', p.id); await borrarMedio(store, p.medioImagenId); }, mensajePremio)();
          } }, 'Quitar'),
        ),
      ),
    );

    // ----- historial -----
    // Filtros (tipo, ganadas/gastadas, fechas, texto) y páginas de 15 movimientos
    const historialCaja = el('div');
    const f = filtros;
    const selTipo = el('select', { class: 'selector', 'aria-label': 'Tipo de movimiento' },
      el('option', { value: 'todos' }, 'Todos los tipos'),
      Object.entries(TIPOS).map(([valor, nombre]) => el('option', { value: valor, selected: f.tipo === valor }, nombre)));
    const selSigno = el('select', { class: 'selector', 'aria-label': 'Ganadas o gastadas' },
      [['todos', 'Ganadas y gastadas'], ['ganadas', 'Solo ganadas (+)'], ['gastadas', 'Solo gastadas (−)']].map(([valor, nombre]) => el('option', { value: valor, selected: f.signo === valor }, nombre)));
    const entDesde = el('input', { type: 'date', value: f.desde });
    const entHasta = el('input', { type: 'date', value: f.hasta });
    const entTexto = el('input', { type: 'search', placeholder: 'Buscar en la nota', value: f.texto, autocomplete: 'off' });
    const pintarHistorial = () => {
      const filtrados = filtrarMovimientos(datos.movimientos, f);
      const info = paginar(filtrados, f.pagina, 15);
      f.pagina = info.pagina;
      const total = filtrados.reduce((s, m) => s + (m.estado === 'anulado' ? 0 : m.cantidad), 0);
      historialCaja.replaceChildren(
        el('p', { class: 'ayuda' }, `${filtrados.length} movimiento${filtrados.length === 1 ? '' : 's'}${filtrados.length ? ` · suman ${total > 0 ? '+' : ''}${total}` : ''}`),
        info.items.length
          ? el('ul', { class: 'lista-simple' }, info.items.map((m) =>
            el('li', { class: 'fila-movimiento' },
              el('span', {}, `${fechaCorta(m.fecha)} · ${TIPOS[m.tipo] ?? m.tipo}${m.nota ? `: ${m.nota}` : ''}${m.estado ? ` (${ESTADOS[m.estado] ?? m.estado})` : ''}`),
              el('strong', {}, `${m.cantidad > 0 ? '+' : ''}${m.cantidad}`),
            )))
          : el('p', { class: 'ayuda' }, datos.movimientos.length ? 'Ningún movimiento coincide con el filtro.' : 'Todavía no hay movimientos.'),
        crearPaginacion(info, (p) => { f.pagina = p; pintarHistorial(); }),
      );
    };
    const alFiltrar = () => {
      Object.assign(f, { tipo: selTipo.value, signo: selSigno.value, desde: entDesde.value, hasta: entHasta.value, texto: entTexto.value, pagina: 1 });
      pintarHistorial();
    };
    for (const control of [selTipo, selSigno, entDesde, entHasta]) control.addEventListener('change', alFiltrar);
    entTexto.addEventListener('input', alFiltrar);
    const limpiar = el('button', { type: 'button', class: 'boton secundario chico', onclick: () => {
      Object.assign(f, { tipo: 'todos', signo: 'todos', desde: '', hasta: '', texto: '', pagina: 1 });
      selTipo.value = 'todos'; selSigno.value = 'todos'; entDesde.value = ''; entHasta.value = ''; entTexto.value = '';
      pintarHistorial();
    } }, 'Quitar filtros');
    pintarHistorial();

    raiz.replaceChildren(
      cabecera('Tienda y monedas'),
      el('div', { class: 'panel' },
        el('h2', {}, 'Monedas del niño'),
        el('div', { class: 'fila-contenido' }, crearCofre({ saldo: datos.saldo, compacto: true }), el('a', { class: 'boton secundario', href: '#/adulto/album' }, 'Álbum')),
        el('p', { class: 'ayuda' }, 'El niño gana monedas al completar un álbum; nunca por acertar ni se le quitan por fallar. Las gasta en la tienda.'),
        el('div', { class: 'fila' }, campo('Cantidad', entradaCantidad, 'Para corregir puede ser negativa'), campo('Nota', entradaNota, 'Obligatoria al corregir')),
        el('div', { class: 'acciones' },
          el('button', { type: 'button', class: 'boton', onclick: mover('regalo') }, 'Regalar monedas'),
          el('button', { type: 'button', class: 'boton secundario', onclick: mover('correccion') }, 'Corregir el saldo'),
        ),
        mensajeSaldo,
      ),
      el('div', { class: 'panel' },
        el('h2', {}, `Por entregar (${pendientes.length})`),
        filasPendientes.length ? el('ul', { class: 'lista-simple' }, filasPendientes) : el('p', { class: 'ayuda' }, 'No hay canjes esperando. Cuando el niño elija un premio en la tienda, aparecerá aquí para que se lo entregues.'),
        mensajeCanjes,
      ),
      el('div', { class: 'panel' },
        el('h2', {}, 'Premios de la tienda'),
        filasPremios.length ? el('ul', { class: 'lista-simple' }, filasPremios) : el('p', { class: 'ayuda' }, 'Todavía no hay premios: el niño no verá la tienda hasta que crees uno.'),
        el('h3', {}, editado ? `Editar «${editado.nombre}»` : 'Agregar un premio'),
        campo('Nombre', entradaNombre, 'Por ejemplo: helado, ir al parque, 15 minutos de dibujos'),
        campo('Precio en monedas', entradaPrecio, `De ${PRECIO_MIN} a ${PRECIO_MAX}`),
        selector.elemento,
        mensajePremio,
        el('div', { class: 'acciones' },
          el('button', { type: 'button', class: 'boton', onclick: guardarPremio }, editado ? 'Guardar cambios' : 'Agregar premio'),
          editado ? el('button', { type: 'button', class: 'boton secundario', onclick: () => { editandoId = null; pintar(); } }, 'Cancelar') : null,
        ),
      ),
      el('div', { class: 'panel' },
        el('details', { open: filtros.abierto, ontoggle: (e) => { filtros.abierto = e.currentTarget.open; } }, el('summary', {}, 'Historial de monedas'),
          el('div', { class: 'barra-herramientas' },
            el('label', {}, 'Tipo', selTipo),
            el('label', {}, 'Monedas', selSigno),
            el('label', {}, 'Desde', entDesde),
            el('label', {}, 'Hasta', entHasta),
            el('label', {}, 'Buscar', entTexto),
            limpiar),
          historialCaja,
        ),
      ),
    );
  }

  pintar().catch((error) => mostrarError(raiz, error));
  return () => {
    vivo = false;
    selector?.liberar();
    liberarUrls();
  };
}
