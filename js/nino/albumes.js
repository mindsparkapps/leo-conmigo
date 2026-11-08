// «Mi álbum»: un libro 3D con todas sus láminas.
//  - Cada hueco que falta muestra su lugar (letra de página y número, por ejemplo «A-7») en gris y translúcido.
//  - Una lámina recién ganada NO se pega sola: aparece suelta sobre el libro. Con doble toque se voltea y dice a qué
//    página y número corresponde; luego se arrastra al libro y, si cae en su hueco, queda pegada a color.
//  - Abajo hay una letra por página: tocarla pasa las hojas del libro hasta esa página.
//  - La portada dice «Mi álbum  N de M» (láminas pegadas).

import { el } from '../ui/dom.js';
import { deshabilitarAdulto } from '../acceso.js';
import { NOMBRE_APP } from '../config.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { liberarUrls } from '../medios.js';
import { cargarMonedas } from '../albumes.js';
import {
  armarLibro, codigosDelLibro, lugarDeLamina, registrosAlPegar, separarCalcomanias,
} from '../core/libro-album.js';
import { caraDePagina, dibujarCaraDePagina, dibujarCaras, dibujarPortadaDeLibro, lugaresDePagina } from '../ui/laminas.js';
import { mapaDePropias, nodoDeCalcomania } from '../ui/calcomania.js';
import { crearLaminasSueltas } from '../ui/laminas-sueltas.js';

export const titulo = NOMBRE_APP;

const ICONO_CASA = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 8L6 32h8v22h14V40h8v14h14V32h8z" fill="currentColor"/></svg>`;
const ICONO_ATRAS = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M40 10L18 32l22 22" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONO_ADELANTE = `
<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M24 10l22 22-22 22" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Qué tan cerca del centro de su hueco hay que soltar la lámina (en veces la mitad del lado del hueco). */
const TOLERANCIA_SOLTAR = 1.3;

export function montar(contenedor, { ir }) {
  deshabilitarAdulto();
  const casa = el('button', { type: 'button', class: 'boton-casa boton-casa-chico', 'aria-label': 'Volver al inicio', onclick: () => ir('/nino') });
  casa.innerHTML = ICONO_CASA;
  const zona = el('div', { class: 'libro-zona' });
  contenedor.append(el('section', { class: 'vista-nino libro-nino' }, zona, casa));

  const estado = { vivo: true, libro: null, sueltas: null };
  pintar(zona, estado).catch((error) => {
    console.error(error);
    zona.replaceChildren(el('p', { class: 'mensaje-nino' }, 'Algo no funcionó. Toca la casa para volver.'));
  });
  return () => {
    estado.vivo = false;
    estado.sueltas?.destruir();
    estado.libro?.destruir();
    liberarUrls();
  };
}

function flecha(clase, etiqueta, icono, alTocar) {
  const b = el('button', { type: 'button', class: `libro-flecha ${clase}`, 'aria-label': etiqueta, onclick: alTocar });
  b.innerHTML = icono;
  return b;
}

async function pintar(zona, estado) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!perfil || !estado.vivo) return;
  const datos = await cargarMonedas(store, perfil);
  const propias = datos.propias.filter((p) => !p.deleted);
  const propiasPorId = mapaDePropias(propias);
  let calcomanias = datos.calcomanias.filter((c) => !c.deleted);
  const codigos = codigosDelLibro({ album: datos.album, propias });

  const calcular = () => {
    const { pegadas, sueltas } = separarCalcomanias(calcomanias);
    return { libro: armarLibro({ codigos, pegadas }), sueltas };
  };
  let { libro, sueltas } = calcular();

  // Pegar una lámina: la guarda, y redibuja su página y la portada (el conteo)
  async function pegar(codigo, controlador) {
    const cambios = registrosAlPegar(calcomanias, codigo);
    if (!cambios.length) return;
    const guardados = await store.guardarVarios('calcomanias', cambios);
    const porId = new Map(guardados.map((g) => [g.id, g]));
    calcomanias = calcomanias.map((c) => porId.get(c.id) ?? c);
    ({ libro } = calcular());
    if (!controlador) return;
    const lugar = lugarDeLamina(libro, codigo);
    controlador.actualizarCara(caraDePagina(lugar.pagina), await dibujarCaraDePagina({ store, libro, propias, indice: lugar.pagina }));
    controlador.actualizarCara(0, await dibujarPortadaDeLibro(libro));
  }

  const lienzo = el('div', { class: 'libro-lienzo-zona', role: 'img', 'aria-label': `Mi álbum: ${libro.pegadas} de ${libro.total} láminas pegadas` });
  zona.replaceChildren(lienzo);

  let controlador = null;
  try {
    const { crearLibro3D } = await import('../ui/libro3d.js');
    if (!estado.vivo) return;
    const caras = await dibujarCaras({ store, libro, propias });
    if (!estado.vivo) return;

    const atras = flecha('libro-atras', 'Página anterior', ICONO_ATRAS, () => controlador?.pasar(-1));
    const adelante = flecha('libro-adelante', 'Página siguiente', ICONO_ADELANTE, () => controlador?.pasar(1));
    // Una letra por página: tocarla pasa las hojas hasta esa página
    const letras = libro.paginas.map((pagina, i) =>
      el('button', {
        type: 'button',
        class: 'libro-letra',
        'aria-label': `Página ${pagina.letra}`,
        onclick: () => controlador?.irACara(caraDePagina(i)),
      }, pagina.letra));
    const marcarLetras = (visibles) => {
      letras.forEach((b, i) => b.classList.toggle('actual', visibles.includes(caraDePagina(i))));
    };

    controlador = crearLibro3D(lienzo, caras, {
      alCambiar: ({ puedeAtras, puedeAdelante, carasVisibles }) => {
        atras.disabled = !puedeAtras;
        adelante.disabled = !puedeAdelante;
        marcarLetras(carasVisibles);
      },
    });
    estado.libro = controlador;
    atras.disabled = !controlador.puedeAtras();
    adelante.disabled = !controlador.puedeAdelante();
    marcarLetras(controlador.carasVisibles());
    zona.append(
      el('div', { class: 'libro-controles' },
        el('div', { class: 'libro-letras', role: 'group', 'aria-label': 'Páginas' }, letras),
        el('div', { class: 'libro-flechas' }, atras, adelante)),
    );

    // Las láminas sueltas encima del libro
    const lugares = lugaresDePagina();
    const laminas = [];
    for (const codigo of sueltas) {
      const lugar = lugarDeLamina(libro, codigo);
      const nodo = await nodoDeCalcomania(store, codigo, propiasPorId, { clase: 'lamina-img', decorativo: true });
      if (lugar && nodo) laminas.push({ codigo, letra: lugar.letra, numero: lugar.numero, nodo });
    }
    if (!estado.vivo) return;
    estado.sueltas = crearLaminasSueltas({
      contenedor: zona,
      laminas,
      // mientras se arrastra una lámina, la letra de su página late para ayudar a encontrarla
      alArrastrar: (lamina) => {
        letras.forEach((b) => b.classList.remove('pista'));
        if (lamina) letras[lugarDeLamina(libro, lamina.codigo).pagina]?.classList.add('pista');
      },
      alSoltar: async (lamina, punto) => {
        // Solo vale con la página de la lámina a la vista y el libro quieto, y soltándola sobre su hueco
        const lugar = lugarDeLamina(libro, lamina.codigo);
        const cara = caraDePagina(lugar.pagina);
        if (!controlador.quieto() || !controlador.carasVisibles().includes(cara)) return false;
        const hueco = lugares[lugar.posicion];
        const centro = controlador.proyectar(cara, hueco.u, hueco.v);
        const borde = controlador.proyectar(cara, hueco.u + lugares.semiLadoU, hueco.v);
        const caja = lienzo.getBoundingClientRect();
        const distancia = Math.hypot(punto.x - caja.left - centro.x, punto.y - caja.top - centro.y);
        if (distancia > Math.hypot(borde.x - centro.x, borde.y - centro.y) * TOLERANCIA_SOLTAR) return false;
        await pegar(lamina.codigo, controlador);
        lienzo.setAttribute('aria-label', `Mi álbum: ${libro.pegadas} de ${libro.total} láminas pegadas`);
        return true;
      },
    });
  } catch (error) {
    // Sin WebGL (o sin poder cargar three.js): no se puede arrastrar, así que las láminas sueltas se pegan solas
    // y se muestran las páginas una debajo de otra
    console.warn('No se pudo mostrar el libro 3D', error);
    estado.sueltas?.destruir();
    estado.sueltas = null;
    estado.libro?.destruir();
    estado.libro = null;
    zona.querySelector('.libro-controles')?.remove();
    for (const codigo of sueltas) await pegar(codigo, null);
    ({ libro, sueltas } = calcular());
    const caras = await dibujarCaras({ store, libro, propias });
    if (!estado.vivo) return;
    lienzo.replaceChildren(...caras.slice(2).map((c) => { c.classList.add('libro-cara-plana'); return c; }));
    lienzo.classList.add('libro-plano');
  }
}
