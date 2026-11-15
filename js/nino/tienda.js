// Tienda del niño: gasta sus monedas de oro en los premios que el adulto creó (fase 11).
// Sin sonido de error, sin rojo, sin bloqueos frustrantes: si no le alcanza, se le dice cuántas monedas le faltan.
// Solo toques simples (sin mantener ni arrastrar), con 400 ms de bloqueo entre toques.

import { el } from '../ui/dom.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { crearPrecio } from '../ui/moneda.js';
import { fijarSaldo, sincronizarSaldo } from '../ui/saldo.js';
import { crearSobreChico, presentarSobre } from '../ui/sobre.js';
import { deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { liberarUrls, urlDeMedio } from '../medios.js';
import { desbloquearAudio, detener, hablarTexto } from '../audio.js';
import { cargarMonedas, comprarSobre, venderRepetida } from '../albumes.js';
import { mapaDePropias, nodoDeCalcomania } from '../ui/calcomania.js';
import { LAMINAS_POR_SOBRE, precioDeSobre, repetidas, valorDeVenta } from '../core/sobres.js';
import { lanzarMonedas } from '../ui/monedas-vuelo.js';
import { cargarColecciones, urlDeSobre } from '../colecciones.js';
import { COLORES_CAJAS_PREDETERMINADOS, coloresDeCajas, fijarColoresDeCajas, saltarLeccionActivo } from '../dev.js';
import { crearCanje, crearRegalo, faltan, premiosVisibles, puedeCanjear } from '../core/album.js';
import { normalizarAjustes } from '../core/modelos.js';

export const titulo = NOMBRE_APP;

const BLOQUEO_MS = 400;
const MS_APLASTAR = 650; // lo que dura el aplastar y estirar del sobre antes de comprarlo

const ICONO_CASA = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 8L6 32h8v22h14V40h8v14h14V32h8z" fill="currentColor"/></svg>`;
const ICONO_SI = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M12 34l14 14 26-30" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONO_ATRAS = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M40 10L18 32l22 22" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const textoMonedas = (n) => `${n} ${n === 1 ? 'moneda' : 'monedas'}`;

export function montar(contenedor, { ir }) {
  deshabilitarAdulto();
  const casa = el('button', { type: 'button', class: 'boton-casa boton-casa-chico', 'aria-label': 'Volver al inicio', onclick: () => ir('/nino') });
  casa.innerHTML = ICONO_CASA;
  const zona = el('div', { class: 'tienda-zona' });
  const vista = el('section', { class: 'vista-nino tienda-nino' }, zona, casa);
  contenedor.append(vista);

  let vivo = true;
  iniciar(zona, () => vivo).catch((error) => {
    console.error(error);
    zona.replaceChildren(el('p', { class: 'mensaje-nino' }, 'Algo no funcionó. Toca la casa para volver.'));
  });
  return () => {
    vivo = false;
    detener();
    liberarUrls();
    // las ventas ya están guardadas: aunque queden monedas volando, el monedero se muestra completo
    sincronizarSaldo();
  };
}

async function iniciar(zona, estaVivo) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!estaVivo()) return;
  if (!perfil) {
    zona.replaceChildren(el('p', { class: 'mensaje-nino' }, 'Un adulto debe preparar la aplicación.'));
    return;
  }
  const ajustes = normalizarAjustes(perfil.ajustes);
  const decir = (texto, { siempre = false } = {}) => {
    if (!siempre && !ajustes.sonido) return;
    desbloquearAudio();
    hablarTexto(texto, { velocidad: ajustes.velocidadVoz });
  };
  let ultimoToque = -Infinity;
  const toqueValido = () => {
    const t = performance.now();
    if (t - ultimoToque < BLOQUEO_MS) return false;
    ultimoToque = t;
    return true;
  };
  let aviso = null;
  let ocupado = false;
  let quitarEscena = null;
  let enVuelo = 0; // ventas cuyas monedas aún van hacia el monedero
  let secuencia = 0; // solo se pinta la lista pedida más recientemente

  const imagenDe = async (premio, grande = true) =>
    crearMiniatura({ url: await urlDeMedio(store, premio.medioImagenId), emoji: premio.emoji, texto: premio.nombre }, { grande });

  /** Herramienta de desarrollador: color de fondo y de borde de las cajas de la tienda. */
  function selectorDeColores() {
    const actual = coloresDeCajas() ?? COLORES_CAJAS_PREDETERMINADOS;
    const fondo = el('input', { type: 'color', value: actual.fondo, 'aria-label': 'Color de las cajas' });
    const borde = el('input', { type: 'color', value: actual.borde, 'aria-label': 'Color de los bordes' });
    const cambiar = () => fijarColoresDeCajas({ fondo: fondo.value, borde: borde.value });
    fondo.addEventListener('input', cambiar);
    borde.addEventListener('input', cambiar);
    const restablecer = el('button', {
      type: 'button',
      class: 'boton secundario chico',
      onclick: () => {
        fijarColoresDeCajas(null);
        fondo.value = COLORES_CAJAS_PREDETERMINADOS.fondo;
        borde.value = COLORES_CAJAS_PREDETERMINADOS.borde;
      },
    }, 'Restablecer');
    return el('div', { class: 'caja-colores' }, el('label', {}, 'Cajas', fondo), el('label', {}, 'Bordes', borde), restablecer);
  }

  /** La lámina vendida sube hasta salir por arriba y, desde donde estaba, salen las monedas hacia el total. */
  async function animarVenta(item, caja, cajaRepetidas, r) {
    const reducido = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!enVuelo) fijarSaldo(r.saldo - r.valor); // el total sube moneda a moneda al llegar cada una
    enVuelo += 1;
    let clon = null;
    let origen = { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 };
    if (!reducido && item.animate) {
      // La lámina (con su cantidad y su precio) sube hasta quedar sobre la caja de las repetidas; allí desaparece entera
      // y de ese punto salen las monedas hacia el total.
      const arriba = Math.max(96, (cajaRepetidas?.getBoundingClientRect().top ?? caja.top) - caja.height - 12);
      const dy = Math.round(arriba - caja.top);
      clon = item.cloneNode(true);
      clon.setAttribute('aria-hidden', 'true');
      clon.style.cssText = `position:fixed;margin:0;z-index:55;pointer-events:none;left:${caja.left}px;top:${caja.top}px;width:${caja.width}px;height:${caja.height}px`;
      document.body.append(clon);
      item.style.visibility = 'hidden';
      origen = { x: caja.left + caja.width / 2, y: arriba + caja.height / 2 };
      await clon.animate([{ transform: 'translateY(0) scale(1)' }, { transform: `translateY(${dy}px) scale(1.15)` }], { duration: 650, easing: 'ease-in-out', fill: 'forwards' }).finished.catch(() => {});
      clon.animate([{ transform: `translateY(${dy}px) scale(1.15)`, opacity: 1 }, { transform: `translateY(${dy}px) scale(0.4)`, opacity: 0 }], { duration: 350, easing: 'ease-in', fill: 'forwards' });
    }
    const monedas = lanzarMonedas({
      cantidad: r.valor,
      origen,
      desdeOrigen: true,
      sonido: ajustes.sonido,
      movimientoReducido: reducido,
      activo: estaVivo,
    });
    await monedas;
    clon?.remove();
    enVuelo -= 1;
  }

  async function lista() {
    const mia = ++secuencia;
    const datos = await cargarMonedas(store, perfil);
    if (!estaVivo() || mia !== secuencia) return;
    const premios = premiosVisibles(datos.premios);
    const cartas = await Promise.all(
      premios.map(async (premio) => {
        const alcanza = puedeCanjear(datos.saldo, premio);
        const boton = el(
          'button',
          {
            type: 'button',
            class: alcanza ? 'premio-carta' : 'premio-carta premio-lejos',
            'data-flip': `p-${premio.id ?? premio.nombre}`,
            'aria-label': `${premio.nombre}, ${textoMonedas(premio.precio)}`,
            onclick: () => {
              if (ocupado || !toqueValido()) return;
              if (alcanza) confirmar(premio);
              else decir(`${premio.nombre}. Te faltan ${textoMonedas(faltan(datos.saldo, premio))}`, { siempre: true });
            },
          },
          await imagenDe(premio),
          el('span', { class: 'premio-nombre' }, premio.nombre),
          crearPrecio(premio.precio),
        );
        return boton;
      }),
    );
    if (!estaVivo() || mia !== secuencia) return;
    const precioSobre = precioDeSobre(datos.album);
    const alcanzaSobre = datos.saldo >= precioSobre;
    // Un sobre por álbum (el de la app y cada álbum cargado), cada uno con su imagen
    const { colecciones } = await cargarColecciones(store, perfil);
    const sobres = await Promise.all(colecciones.map(async (coleccion) => {
      const nombreSobre = coleccion.esBase ? 'Sobre de láminas' : `Sobre: ${coleccion.nombre}`;
      return el(
        'button',
        {
          type: 'button',
          class: alcanzaSobre ? 'premio-carta sobre-carta' : 'premio-carta sobre-carta premio-lejos',
          'aria-label': `${nombreSobre}, ${textoMonedas(precioSobre)}`,
          onclick: (e) => {
            if (ocupado || !toqueValido()) return;
            if (alcanzaSobre) {
              // el sobre se aplasta y se estira y recién entonces se abre la compra, para que se alcance a ver
              const carta = e.currentTarget;
              ocupado = true;
              if (matchMedia?.('(prefers-reduced-motion: reduce)').matches) { ocupado = false; comprar(coleccion); return; }
              carta.classList.add('aplastar');
              setTimeout(() => {
                carta.classList.remove('aplastar');
                ocupado = false;
                if (estaVivo()) comprar(coleccion);
              }, MS_APLASTAR);
            }
            else decir(`${nombreSobre}. Te faltan ${textoMonedas(precioSobre - datos.saldo)}`, { siempre: true });
          },
        },
        crearSobreChico(LAMINAS_POR_SOBRE, await urlDeSobre(store, coleccion)),
        el('span', { class: 'premio-nombre' }, nombreSobre),
        crearPrecio(precioSobre),
      );
    }));
    if (!estaVivo() || mia !== secuencia) return;
    const propiasPorId = mapaDePropias(datos.propias);
    const sobrantes = repetidas(datos.calcomanias);
    const valorVenta = valorDeVenta(datos.album);
    const cartasRepetidas = (
      await Promise.all(
        sobrantes.map(async ({ codigo, sobran }) => {
          const dibujo = await nodoDeCalcomania(store, codigo, propiasPorId, { clase: 'calcomania', decorativo: true });
          if (!dibujo) return null;
          return el(
            'button',
            {
              type: 'button',
              class: 'repetida-item repetida-carta',
              'data-flip': `r-${codigo}`,
              'aria-label': `Vender una lámina repetida por ${textoMonedas(valorVenta)}. Te sobran ${sobran}`,
              onclick: async (e) => {
                // Vender no espera a nadie: la lámina sube y la lista se reacomoda al instante; las monedas siguen su camino
                if (ocupado) return;
                ocupado = true;
                let r;
                const item = e.currentTarget;
                const caja = item.getBoundingClientRect();
                try {
                  r = await venderRepetida(store, perfil, codigo);
                } finally {
                  ocupado = false;
                }
                if (r.vendida) {
                  aviso = `¡Vendida! Ganaste ${textoMonedas(r.valor)}.`;
                  decir(`Ganaste ${textoMonedas(r.valor)}`);
                  animarVenta(item, caja, item.closest('.repetidas-caja'), r).catch((error) => console.error(error));
                }
                await lista();
              },
            },
            dibujo,
            el('span', { class: 'repetida-sobran' }, `×${sobran}`),
            crearPrecio(valorVenta, { prefijo: '+' }),
          );
        }),
      )
    ).filter(Boolean);
    if (!estaVivo() || mia !== secuencia) return;
    // Para mover con suavidad lo que cambia de sitio (al vender una lámina las demás se acomodan sin saltar)
    const antes = new Map([...zona.querySelectorAll('[data-flip]')].map((n) => [n.dataset.flip, n.getBoundingClientRect()]));
    zona.replaceChildren(
      ...[
        aviso ? el('p', { class: 'mensaje-nino mensaje-premio', role: 'status' }, aviso) : null,
        // Productos (sobre y premios) a la izquierda y láminas repetidas a la derecha cuando la pantalla es ancha (CSS)
        el('div', { class: 'tienda-productos' },
          el('div', { class: 'tienda-grilla' }, sobres),
          premios.length ? el('h2', { class: 'tienda-titulo' }, 'Premios') : null,
          premios.length ? el('div', { class: 'tienda-grilla' }, cartas) : el('p', { class: 'mensaje-nino' }, 'Todavía no hay premios.'),
        ),
        cartasRepetidas.length
          ? el('div', { class: 'tienda-repetidas' },
            el('h2', { class: 'tienda-titulo' }, 'Láminas repetidas'),
            el('div', { class: 'repetidas-caja' }, cartasRepetidas))
          : null,
        // Herramienta de desarrollador (Ajustes → modo adulto): regala mil monedas
        saltarLeccionActivo()
          ? el(
            'button',
            {
              type: 'button',
              class: 'boton secundario chico',
              onclick: async () => {
                if (ocupado) return;
                ocupado = true;
                try {
                  await store.guardar('movimientos', crearRegalo({ perfilId: perfil.id, cantidad: 1000, nota: 'Carga de prueba (desarrollador)' }));
                  fijarSaldo((await cargarMonedas(store, perfil)).saldo);
                  await lista();
                } finally {
                  ocupado = false;
                }
              },
            },
            '🛠 +1000 monedas',
          )
          : null,
        saltarLeccionActivo() ? selectorDeColores() : null,
      ].filter(Boolean),
    );
    aviso = null;
    if (antes.size && !matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      zona.querySelectorAll('[data-flip]').forEach((n) => {
        const viejo = antes.get(n.dataset.flip);
        if (!viejo || !n.animate) return;
        const nuevo = n.getBoundingClientRect();
        const dx = viejo.left - nuevo.left;
        const dy = viejo.top - nuevo.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 550, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
      });
    }
  }

  async function comprar(coleccion) {
    ocupado = true;
    try {
      const r = await comprarSobre(store, perfil, { coleccionId: coleccion.esBase ? null : coleccion.id });
      if (!estaVivo()) return;
      if (!r.comprado) {
        aviso = `Te faltan ${textoMonedas(r.faltan)}.`;
        await lista();
        return;
      }
      fijarSaldo(r.saldo); // el total de la esquina baja al comprar
      const propiasPorId = mapaDePropias(await store.listar('calcomaniasPropias', { perfilId: perfil.id }));
      const dibujos = (await Promise.all(r.codigos.map((c) => nodoDeCalcomania(store, c, propiasPorId, { clase: 'calcomania-grande', decorativo: true })))).filter(Boolean);
      if (!estaVivo()) return;
      const seguir = el('button', { type: 'button', class: 'boton-respuesta boton-si', 'aria-label': 'Seguir en la tienda', onclick: () => { if (!ocupado && toqueValido()) { quitarEscena?.(); quitarEscena = null; lista(); } } });
      seguir.innerHTML = ICONO_SI;
      const album = el('a', { class: 'boton-respuesta boton-no', href: '#/nino/albumes', 'aria-label': 'Ir a pegar las láminas al álbum' }, '📖');
      ultimoToque = performance.now();
      quitarEscena = presentarSobre(zona.closest('.vista-nino') ?? zona, dibujos, {
        imagen: await urlDeSobre(store, coleccion),
        mensaje: 'Arrastra el dedo por arriba del sobre para abrirlo.',
        acciones: [album, seguir],
        alAbrir: () => decir('¡Tus láminas nuevas! Pégalas en el álbum'),
      });
      decir('Arrastra el dedo por arriba del sobre para abrirlo');
    } finally {
      ocupado = false;
    }
  }

  async function confirmar(premio) {
    const imagen = await imagenDe(premio);
    if (!estaVivo()) return;
    ultimoToque = performance.now(); // el dedo que eligió el premio no confirma por accidente
    const si = el('button', {
      type: 'button',
      class: 'boton-respuesta boton-si',
      'aria-label': 'Sí, lo quiero',
      onclick: async () => {
        if (ocupado || !toqueValido()) return;
        ocupado = true;
        try {
          await store.guardar('movimientos', crearCanje({ perfilId: perfil.id, premio }));
          aviso = '¡Es tuyo! Pídeselo a un adulto.';
          decir('¡Es tuyo! Pídeselo a un adulto');
          await lista();
        } finally {
          ocupado = false;
        }
      },
    });
    si.innerHTML = ICONO_SI;
    const no = el('button', {
      type: 'button',
      class: 'boton-respuesta boton-no',
      'aria-label': 'No, volver',
      onclick: () => {
        if (ocupado || !toqueValido()) return;
        lista();
      },
    });
    no.innerHTML = ICONO_ATRAS;
    zona.replaceChildren(
      imagen,
      el('p', { class: 'premio-nombre premio-nombre-grande' }, premio.nombre),
      crearPrecio(premio.precio),
      el('div', { class: 'acciones-inicio' }, no, si),
    );
    decir(`${premio.nombre}. ¿Lo quieres?`, { siempre: true });
  }

  await lista();
}
