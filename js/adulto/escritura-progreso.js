// Progreso de Escritura (Ampliación 5, fase 30): por nivel, tabla por palabra, historial y precisión semanal.
//   #/adulto/escritura/progreso                    el niño activo
//   #/adulto/escritura/progreso/ficha/<id>         un alumno del curso (solo lectura)
//   #/adulto/escritura/progreso/prueba             el «Perfil de prueba» (lo jugado en modo administrador o con «Probar Escritura»)

import { el } from '../ui/dom.js';
import { cabecera, cargando, mostrarError } from '../ui/adulto.js';
import { crearGraficoSemanal } from '../ui/grafico-semanal.js';
import { crearPaginacion } from '../ui/paginacion.js';
import { esAlumno } from '../acceso.js';
import { obtenerStore, sujetoDeEstadisticas } from '../contexto.js';
import { formatearDuracion, precisionSemanal } from '../core/estadisticas.js';
import { paginar } from '../core/listas.js';
import { borrarDatosDePrueba, contarDatosDePrueba } from '../core/borrar-perfil.js';
import { elementosDeEscritura } from '../core/escritura/elementos.js';
import { NIVELES } from '../core/escritura/niveles.js';
import { historialDeEscritura, resumenDeEscritura, resumenPorNivel, tablaDeEscritura } from '../core/escritura/estadisticas.js';

export const titulo = 'Progreso de escritura · Leo Conmigo';

const NOMBRE_ESTADO = { nueva: 'Nueva', practica: 'En práctica', dominada: 'Dominada', aprendida: 'Aprendida' };
const fechaHora = (iso) => new Date(iso).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');

export function montar(contenedor, { ruta = '' } = {}) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Progreso de escritura'), cargando());
  contenedor.append(raiz);
  let vivo = true;
  pintar(raiz, () => vivo, ruta).catch((error) => mostrarError(raiz, error));
  return () => { vivo = false; };
}

const sujetoDe = (ruta) => sujetoDeEstadisticas(ruta); // activo, ficha de un alumno o `…/prueba`

async function pintar(raiz, estaVivo, ruta, { nivel = 'todos', pagina = 1 } = {}) {
  const store = await obtenerStore();
  const sujeto = await sujetoDe(ruta);
  if (sujeto?.faltaFicha) {
    raiz.replaceChildren(cabecera('Progreso de escritura', { atras: '#/adulto/alumnos', textoAtras: '← Alumnos' }), el('div', { class: 'panel' }, el('p', {}, 'Esa ficha de alumno ya no existe.')));
    return;
  }
  if (!sujeto) {
    raiz.replaceChildren(cabecera('Progreso de escritura'), el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.')));
    return;
  }
  const deFicha = Boolean(sujeto.ficha);
  const [palabras, frases, progresos, sesiones, banco] = await Promise.all([
    store.listar('palabras', { perfilId: sujeto.contenidoId }),
    store.listar('frases', { perfilId: sujeto.contenidoId }),
    store.listar('progresos', { perfilId: sujeto.id }),
    store.listar('sesiones', { perfilId: sujeto.id }),
    fetch('data/escritura/banco.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  const hayPrueba = !deFicha && !sujeto.esPrueba ? await contarDatosDePrueba(store, sujeto.contenidoId) : 0;
  if (!estaVivo()) return;
  const repintar = (opciones) => pintar(raiz, estaVivo, ruta, opciones).catch((error) => mostrarError(raiz, error));

  const bancoApagado = sujeto.perfil.ajustes?.escritura?.bancoApagado ?? [];
  const elementos = elementosDeEscritura({ palabras, frases, banco, bancoApagado });
  const filas = tablaDeEscritura({ elementos, progresos });
  const resumen = resumenDeEscritura({ filas, sesiones });

  const dato = (valor, etiqueta) => el('div', { class: 'dato' }, el('strong', {}, String(valor)), el('span', {}, etiqueta));
  const panelResumen = el('div', { class: 'panel' },
    el('h2', {}, `Escritura de ${sujeto.titulo}`),
    sujeto.esPrueba ? el('p', { class: 'ayuda' }, 'Es el «Perfil de prueba»: lo que se jugó en modo administrador o con «Probar Escritura». No cuenta para el avance del niño ni para sus ajustes automáticos.') : null,
    deFicha ? el('p', { class: 'ayuda' }, `Es el avance de ${sujeto.ficha.nombre} (${sujeto.ficha.email}). Solo se puede ver.`) : null,
    el('div', { class: 'datos' },
      dato(resumen.practicadas, 'palabras practicadas'),
      dato(resumen.dominadas, 'dominadas'),
      dato(resumen.aprendidas, 'aprendidas'),
      dato(resumen.sesiones, resumen.sesiones === 1 ? 'sesión' : 'sesiones'),
      dato(resumen.ultimaSesion ? fechaHora(resumen.ultimaSesion) : '—', 'última sesión')),
    sujeto.esPrueba
      ? el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton secundario', onclick: async () => {
        if (!globalThis.confirm('¿Borrar los datos de prueba de Escritura? Se borran las sesiones, el progreso, las láminas y las monedas del perfil de prueba. No toca nada del perfil del niño.')) return;
        await borrarDatosDePrueba(store, sujeto.contenidoId);
        repintar();
      } }, 'Borrar los datos de prueba'))
      : null,
    hayPrueba > 0 ? el('p', { class: 'ayuda' }, el('a', { href: '#/adulto/escritura/progreso/prueba' }, 'Ver el «Perfil de prueba»')) : null,
  );

  // ---- por nivel ----
  const porNivel = resumenPorNivel(filas);
  const tablaNiveles = el('table', { class: 'tabla' },
    el('thead', {}, el('tr', {}, ['Nivel', 'Nuevas', 'En práctica', 'Dominadas', 'Aprendidas'].map((t) => el('th', {}, t)))),
    el('tbody', {}, porNivel.filter((n) => n.total > 0).map((n) => el('tr', {}, el('td', {}, el('strong', {}, `${n.id} · ${n.nombre}`)), el('td', {}, String(n.nuevas)), el('td', {}, String(n.practica)), el('td', {}, String(n.dominadas)), el('td', {}, String(n.aprendidas))))));
  const panelNiveles = el('div', { class: 'panel' }, el('h2', {}, 'Por nivel'), el('div', { class: 'tabla-contenedor' }, tablaNiveles));

  // ---- gráfico ----
  const semanas = precisionSemanal(sesiones, { escritura: true });
  const panelGrafico = el('div', { class: 'panel' },
    el('h2', {}, 'Aciertos a la primera por semana'),
    semanas.some((s) => s.ensayos > 0) ? crearGraficoSemanal(semanas) : el('p', { class: 'ayuda' }, 'Todavía no hay sesiones de escritura.'));

  // ---- tabla por palabra ----
  const selNivel = el('select', { class: 'selector', 'aria-label': 'Mostrar el nivel' }, [['todos', 'Todos los niveles'], ...NIVELES.map((n) => [n.id, `${n.id} · ${n.nombre}`])].map(([v, t]) => el('option', { value: v, selected: v === nivel }, t)));
  selNivel.addEventListener('change', () => repintar({ nivel: selNivel.value }));
  const visibles = filas.filter((f) => nivel === 'todos' || f.nivel === nivel);
  const info = paginar(visibles, pagina, 20);
  const tablaPalabras = el('table', { class: 'tabla' },
    el('thead', {}, el('tr', {}, ['Palabra', 'Nivel', 'Estado', 'Sin ayuda'].map((t) => el('th', {}, t)))),
    el('tbody', {}, info.items.map((f) => el('tr', {},
      el('td', {}, el('strong', {}, f.elemento.modelo ? `${f.elemento.texto} (${f.elemento.modelo})` : f.elemento.texto), f.elemento.dictado ? el('span', { class: 'insignia suave' }, 'dictado') : null),
      el('td', {}, f.nivel),
      el('td', {}, el('span', { class: `insignia suave estado-${f.estado}` }, NOMBRE_ESTADO[f.estado])),
      el('td', {}, f.ensayos ? `${f.aciertos}/${f.ensayos}` : '·')))));
  const panelPalabras = el('div', { class: 'panel' },
    el('h2', {}, 'Cada palabra'),
    el('div', { class: 'acciones' }, selNivel),
    visibles.length ? el('div', { class: 'tabla-contenedor' }, tablaPalabras) : el('p', { class: 'ayuda' }, 'No hay palabras en este grupo.'),
    crearPaginacion(info, (p) => repintar({ nivel, pagina: p })),
    el('p', { class: 'ayuda leyenda' }, '«Sin ayuda» = veces que la armó sin ningún error (de los últimos ensayos guardados).'));

  // ---- historial ----
  const historial = historialDeEscritura(sesiones);
  const panelHistorial = el('div', { class: 'panel' },
    el('h2', {}, 'Últimas sesiones'),
    historial.length
      ? el('ul', { class: 'lista-filas' }, historial.map((s) => el('li', { class: 'fila-sesion' },
        el('strong', {}, fechaHora(s.inicio)),
        el('span', { class: 'ayuda' },
          `${s.nivel ?? '—'} · ${formatearDuracion(s.segundos)} · ${s.palabras} palabra${s.palabras === 1 ? '' : 's'} · ${s.aciertos} a la primera · ${s.conAyuda} con ayuda`,
          s.nivelElegidoPorNino ? ' · nivel elegido por el niño' : '', s.fatiga ? ' · terminó antes por cansancio' : '', s.interrumpida ? ' · interrumpida' : ''))))
      : el('p', { class: 'ayuda' }, 'Aún no hay sesiones de escritura.'));

  raiz.replaceChildren(...[
    deFicha ? cabecera('Progreso de escritura', { atras: '#/adulto/alumnos', textoAtras: '← Alumnos' }) : cabecera('Progreso de escritura', esAlumno() ? {} : { atras: '#/adulto/escritura', textoAtras: '← Escritura' }),
    panelResumen, panelNiveles, panelGrafico, panelPalabras, panelHistorial,
  ].filter(Boolean));
}
