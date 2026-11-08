// Tienda del niño: gasta sus monedas de oro en los premios que el adulto creó (fase 11).
// Sin sonido de error, sin rojo, sin bloqueos frustrantes: si no le alcanza, se le dice cuántas monedas le faltan.
// Solo toques simples (sin mantener ni arrastrar), con 400 ms de bloqueo entre toques.

import { el } from '../ui/dom.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { crearPrecio } from '../ui/moneda.js';
import { fijarSaldo } from '../ui/saldo.js';
import { crearSobreChico, presentarSobre } from '../ui/sobre.js';
import { deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { liberarUrls, urlDeMedio } from '../medios.js';
import { desbloquearAudio, detener, hablarTexto } from '../audio.js';
import { cargarMonedas, comprarSobre, venderRepetida } from '../albumes.js';
import { mapaDePropias, nodoDeCalcomania } from '../ui/calcomania.js';
import { LAMINAS_POR_SOBRE, VALOR_VENTA, precioDeSobre, repetidas } from '../core/sobres.js';
import { saltarLeccionActivo } from '../dev.js';
import { crearCanje, crearRegalo, faltan, premiosVisibles, puedeCanjear } from '../core/album.js';
import { normalizarAjustes } from '../core/modelos.js';

export const titulo = NOMBRE_APP;

const BLOQUEO_MS = 400;

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

  const imagenDe = async (premio, grande = true) =>
    crearMiniatura({ url: await urlDeMedio(store, premio.medioImagenId), emoji: premio.emoji, texto: premio.nombre }, { grande });

  async function lista() {
    const datos = await cargarMonedas(store, perfil);
    if (!estaVivo()) return;
    const premios = premiosVisibles(datos.premios);
    const cartas = await Promise.all(
      premios.map(async (premio) => {
        const alcanza = puedeCanjear(datos.saldo, premio);
        const boton = el(
          'button',
          {
            type: 'button',
            class: alcanza ? 'premio-carta' : 'premio-carta premio-lejos',
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
    if (!estaVivo()) return;
    const precioSobre = precioDeSobre(datos.album);
    const alcanzaSobre = datos.saldo >= precioSobre;
    const sobre = el(
      'button',
      {
        type: 'button',
        class: alcanzaSobre ? 'premio-carta sobre-carta' : 'premio-carta sobre-carta premio-lejos',
        'aria-label': `Sobre de láminas, ${textoMonedas(precioSobre)}`,
        onclick: () => {
          if (ocupado || !toqueValido()) return;
          if (alcanzaSobre) comprar();
          else decir(`Sobre de láminas. Te faltan ${textoMonedas(precioSobre - datos.saldo)}`, { siempre: true });
        },
      },
      crearSobreChico(LAMINAS_POR_SOBRE),
      el('span', { class: 'premio-nombre' }, 'Sobre de láminas'),
      crearPrecio(precioSobre),
    );
    const propiasPorId = mapaDePropias(datos.propias);
    const sobrantes = repetidas(datos.calcomanias);
    const cartasRepetidas = (
      await Promise.all(
        sobrantes.map(async ({ codigo, sobran }) => {
          const dibujo = await nodoDeCalcomania(store, codigo, propiasPorId, { clase: 'calcomania', decorativo: true });
          if (!dibujo) return null;
          return el(
            'button',
            {
              type: 'button',
              class: 'premio-carta repetida-carta',
              'aria-label': `Vender una lámina repetida por ${textoMonedas(VALOR_VENTA)}. Te sobran ${sobran}`,
              onclick: async () => {
                if (ocupado || !toqueValido()) return;
                ocupado = true;
                try {
                  const r = await venderRepetida(store, perfil, codigo);
                  if (r.vendida) {
                    fijarSaldo(r.saldo);
                    aviso = `¡Vendida! Ganaste ${textoMonedas(r.valor)}.`;
                    decir(`Ganaste ${textoMonedas(r.valor)}`);
                  }
                  await lista();
                } finally {
                  ocupado = false;
                }
              },
            },
            dibujo,
            el('span', { class: 'repetida-sobran' }, `×${sobran}`),
            crearPrecio(VALOR_VENTA, { prefijo: '+' }),
          );
        }),
      )
    ).filter(Boolean);
    if (!estaVivo()) return;
    zona.replaceChildren(
      ...[
        aviso ? el('p', { class: 'mensaje-nino mensaje-premio', role: 'status' }, aviso) : null,
        el('div', { class: 'tienda-grilla' }, sobre),
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
        cartasRepetidas.length ? el('h2', { class: 'tienda-titulo' }, 'Láminas repetidas') : null,
        cartasRepetidas.length ? el('div', { class: 'tienda-grilla' }, cartasRepetidas) : null,
        premios.length ? el('h2', { class: 'tienda-titulo' }, 'Premios') : null,
        premios.length ? el('div', { class: 'tienda-grilla' }, cartas) : el('p', { class: 'mensaje-nino' }, 'Todavía no hay premios.'),
      ].filter(Boolean),
    );
    aviso = null;
  }

  async function comprar() {
    ocupado = true;
    try {
      const r = await comprarSobre(store, perfil);
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
