// Progreso del niño activo: resumen, precisión por semana, tabla por palabra (con marcado manual)
// e historial de sesiones (PLAN.md §5).

import { el } from '../ui/dom.js';
import { cabecera, cargando, mostrarError, describirError } from '../ui/adulto.js';
import { crearGraficoSemanal } from '../ui/grafico-semanal.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { ACTIVIDADES } from '../actividades/indice.js';
import {
  ACTIVIDADES_ETAPA_1, formatearDuracion, historialDeSesiones, idsDeProgresoDe, marcarDominada, precisionSemanal,
  resumenGeneral, tablaDePalabras,
} from '../core/estadisticas.js';
import { UMBRAL_ETAPA_2, etapasDesbloqueadas } from '../core/etapas.js';

export const titulo = 'Progreso · Leo Conmigo';

const FILTROS = [
  ['todas', 'Todas'],
  ['practica', 'En práctica'],
  ['leida', 'Leídas'],
  ['nueva', 'Nuevas'],
];
const NOMBRE_ESTADO = { nueva: 'Nueva', practica: 'En práctica', leida: 'Leída', completa: 'Completa' };

export function montar(contenedor) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Progreso'), cargando());
  contenedor.append(raiz);
  let vivo = true;
  pintar(raiz, () => vivo).catch((error) => mostrarError(raiz, error));
  return () => { vivo = false; };
}

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
/** 'AAAA-MM-DD' -> '9 nov' */
const dia = (clave) => {
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
};

async function pintar(raiz, estaVivo, { filtro = 'todas', abierta = null } = {}) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!perfil) {
    raiz.replaceChildren(
      cabecera('Progreso'),
      el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.')),
      el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el primer perfil'),
    );
    return;
  }
  const [palabras, progresos, sesiones] = await Promise.all([
    store.listar('palabras', { perfilId: perfil.id }),
    store.listar('progresos', { perfilId: perfil.id }),
    store.listar('sesiones', { perfilId: perfil.id }),
  ]);
  if (!estaVivo()) return;

  const repintar = (opciones) => pintar(raiz, estaVivo, opciones).catch((error) => mostrarError(raiz, error));
  const aviso = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const fallar = (error) => {
    console.error(error);
    aviso.textContent = describirError(error);
    aviso.hidden = false;
  };

  const filas = tablaDePalabras({ palabras, progresos });
  const resumen = resumenGeneral({ filas, sesiones });

  // ---- resumen ----
  const dato = (valor, etiqueta) => el('div', { class: 'dato' }, el('strong', {}, String(valor)), el('span', {}, etiqueta));
  const etapa2Abierta = etapasDesbloqueadas({ progresos }).includes(2);
  const panelResumen = el(
    'div',
    { class: 'panel' },
    el('h2', {}, `Resumen de ${perfil.nombre}`),
    el(
      'div',
      { class: 'datos' },
      dato(`${resumen.leidas} de ${resumen.palabras}`, 'palabras leídas'),
      dato(resumen.enPractica, 'en práctica'),
      dato(resumen.sesiones, resumen.sesiones === 1 ? 'sesión' : 'sesiones'),
      dato(resumen.ultimaSesion ? fechaCorta(resumen.ultimaSesion) : '—', 'última sesión'),
    ),
    el(
      'p',
      { class: 'ayuda' },
      'Una palabra está «leída» cuando el niño la reconoce escrita y toca su dibujo sin ayuda (actividad L4). ',
      etapa2Abierta
        ? 'Ya llegó a las 10 palabras leídas que abren la etapa de frases. Puedes elegirla en Ajustes › Las etapas.'
        : `Con ${UMBRAL_ETAPA_2} palabras leídas se abre la etapa de frases.`,
    ),
  );

  // ---- etapas 0 y 2: cuántas cosas domina en cada actividad ----
  const dominadasEn = (actividad) =>
    new Set(progresos.filter((p) => !p.deleted && p.actividad === actividad && p.estado === 'dominada').map((p) => p.elementoId)).size;
  const practicadasEn = (actividad) => new Set(progresos.filter((p) => !p.deleted && p.actividad === actividad).map((p) => p.elementoId)).size;
  const otras = ['P1', 'P2', 'P3', 'F1', 'F2', 'F3', 'S1', 'S2', 'S3', 'S4', 'L6'].filter((id) => practicadasEn(id) > 0);
  const panelOtras = otras.length
    ? el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Otras actividades'),
        el(
          'ul',
          { class: 'lista-estado' },
          otras.map((id) =>
            el(
              'li',
              {},
              el('span', {}, `${id} · ${ACTIVIDADES[id].nombre}`),
              el('strong', {}, id === 'L6' ? `${practicadasEn(id)} leída${practicadasEn(id) === 1 ? '' : 's'} en voz alta` : `${dominadasEn(id)} de ${practicadasEn(id)} dominada${dominadasEn(id) === 1 ? '' : 's'}`),
            )),
        ),
      )
    : null;

  // ---- gráfico ----
  const semanas = precisionSemanal(sesiones);
  const hayDatos = semanas.some((s) => s.precision !== null);
  const detalleSemanas = el(
    'details',
    { class: 'detalle-numeros' },
    el('summary', {}, 'Ver los números'),
    el(
      'ul',
      { class: 'lista-ayuda' },
      semanas.map((s) =>
        el('li', {}, `Semana del ${dia(s.inicio)}: ${s.precision === null ? 'sin datos' : `${Math.round(s.precision * 100)} % (${s.aciertos} de ${s.ensayos} sin ayuda)`}`),
      ),
    ),
  );
  const panelGrafico = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'Aciertos sin ayuda, por semana'),
    el('p', { class: 'ayuda' }, 'Porcentaje de ensayos que el niño acertó a la primera, de las últimas 8 semanas. Abajo, día/mes del lunes en que empieza cada semana.'),
    hayDatos ? crearGraficoSemanal(semanas) : el('p', { class: 'ayuda' }, 'Todavía no hay sesiones: el gráfico aparecerá cuando juegue.'),
    hayDatos ? detalleSemanas : null,
  );

  // ---- tabla por palabra ----
  const selFiltro = el(
    'select',
    { class: 'selector', 'aria-label': 'Mostrar palabras' },
    FILTROS.map(([valor, nombre]) => el('option', { value: valor, selected: valor === filtro }, nombre)),
  );
  selFiltro.addEventListener('change', () => repintar({ filtro: selFiltro.value }));

  const visibles = filas.filter(
    (f) => filtro === 'todas' || (filtro === 'leida' ? f.estado === 'leida' || f.estado === 'completa' : f.estado === filtro),
  );

  const cuerpo = el('tbody', {});
  for (const fila of visibles) {
    const { palabra } = fila;
    const detalle = el('tr', { class: 'fila-detalle', hidden: abierta !== palabra.id });
    const boton = el('button', {
      type: 'button',
      class: 'boton secundario chico',
      'aria-expanded': String(abierta === palabra.id),
      'aria-label': `Detalles de ${palabra.texto}`,
      onclick: () => {
        detalle.hidden = !detalle.hidden;
        boton.setAttribute('aria-expanded', String(!detalle.hidden));
      },
    }, '⋯');

    cuerpo.append(
      el(
        'tr',
        {},
        el('td', {}, el('strong', {}, palabra.texto), el('span', { class: `insignia suave estado-${fila.estado}` }, NOMBRE_ESTADO[fila.estado])),
        fila.celdas.map((c) => {
          const texto = c.estado === 'dominada' ? '✓' : c.estado === 'practica' ? `${c.aciertos}/${c.ensayos}` : '·';
          const lectura = c.estado === 'dominada' ? 'dominada' : c.estado === 'practica' ? `en práctica, ${c.aciertos} de ${c.ensayos} sin ayuda` : 'aún no empieza';
          return el('td', { class: `celda celda-${c.estado}`, 'aria-label': `${c.actividad}: ${lectura}` }, texto);
        }),
        el('td', {}, boton),
      ),
    );

    // detalle: una línea por actividad y las acciones manuales
    const lineas = fila.celdas.map((c) => {
      let texto;
      if (c.estado === 'dominada') {
        texto = `dominada · ${c.proximoRepaso ? `próximo repaso el ${dia(c.proximoRepaso)}` : 'se repasa en la próxima sesión'}`;
      } else if (c.estado === 'practica') {
        texto = `en práctica · ${c.aciertos} de ${c.ensayos} sin ayuda`;
      } else {
        texto = 'aún no empieza';
      }
      return el('li', {}, el('strong', {}, `${c.actividad} · ${ACTIVIDADES[c.actividad]?.nombre ?? ''}: `), texto);
    });
    const sabe = el('button', { type: 'button', class: 'boton chico', disabled: fila.estado === 'completa' }, 'Ya la sabe');
    sabe.addEventListener('click', async () => {
      sabe.disabled = true;
      try {
        await store.guardarVarios('progresos', marcarDominada({ perfilId: perfil.id, elementoId: palabra.id, existentes: progresos }));
        repintar({ filtro, abierta: palabra.id });
      } catch (e) {
        fallar(e);
        sabe.disabled = false;
      }
    });
    const reiniciar = el('button', { type: 'button', class: 'boton secundario chico', disabled: fila.estado === 'nueva' }, 'Empezar de nuevo');
    reiniciar.addEventListener('click', async () => {
      if (!globalThis.confirm(`¿Empezar de nuevo con «${palabra.texto}»? Se borra su progreso y vuelve a ser una palabra nueva.`)) return;
      reiniciar.disabled = true;
      try {
        for (const id of idsDeProgresoDe(progresos, palabra.id)) await store.borrar('progresos', id);
        repintar({ filtro, abierta: palabra.id });
      } catch (e) {
        fallar(e);
        reiniciar.disabled = false;
      }
    });
    detalle.append(
      el(
        'td',
        { colspan: String(ACTIVIDADES_ETAPA_1.length + 2) },
        el('ul', { class: 'lista-ayuda' }, lineas),
        el('div', { class: 'acciones' }, sabe, reiniciar),
        el('p', { class: 'ayuda' }, '«Ya la sabe» deja la palabra como aprendida y se repasa en la próxima sesión.'),
      ),
    );
    cuerpo.append(detalle);
  }

  const tabla = el(
    'table',
    { class: 'tabla-progreso' },
    el('caption', { class: 'solo-lectura' }, 'Progreso por palabra y actividad'),
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        el('th', { scope: 'col' }, 'Palabra'),
        ACTIVIDADES_ETAPA_1.map((a) => el('th', { scope: 'col', title: ACTIVIDADES[a]?.nombre ?? a }, a)),
        el('th', { scope: 'col' }, el('span', { class: 'solo-lectura' }, 'Detalles')),
      ),
    ),
    cuerpo,
  );

  const panelPalabras = el(
    'div',
    { class: 'panel' },
    el('div', { class: 'fila' }, el('h2', {}, 'Palabras'), selFiltro),
    visibles.length
      ? el('div', { class: 'tabla-contenedor' }, tabla)
      : el('p', { class: 'ayuda' }, palabras.length ? 'No hay palabras en este grupo.' : 'Aún no hay palabras. Agrégalas en «Vocabulario».'),
    el('p', { class: 'ayuda leyenda' }, '✓ dominada · 3/5 = en práctica (aciertos sin ayuda / ensayos) · · = aún no empieza. L1 palabra igual con imagen, L2 sin imagen, L3 de la imagen a la palabra, L4 leer, L5 escuchar.'),
    aviso,
  );

  // ---- historial ----
  const historial = historialDeSesiones(sesiones);
  const panelHistorial = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'Últimas sesiones'),
    historial.length
      ? el(
          'ul',
          { class: 'lista-filas' },
          historial.map((s) =>
            el(
              'li',
              { class: 'fila-sesion' },
              el('strong', {}, fechaHora(s.inicio)),
              el(
                'span',
                { class: 'ayuda' },
                `${formatearDuracion(s.segundos)} · ${s.ensayos} ensayos · ${s.aciertos} sin ayuda`,
                s.fatiga ? ' · terminó antes por cansancio' : '',
              ),
            ),
          ),
        )
      : el('p', { class: 'ayuda' }, 'Aún no hay sesiones.'),
  );

  const enlaceAnalisis = el(
    'p',
    { class: 'ayuda' },
    '¿Qué palabras le cuestan más? ',
    el('a', { href: '#/adulto/analisis' }, 'Ver «Qué le cuesta»'),
  );
  raiz.replaceChildren(cabecera('Progreso'), panelResumen, enlaceAnalisis, panelOtras, panelGrafico, panelPalabras, panelHistorial);
}
