// «Qué le cuesta» (PLAN.md, fase 13): para el adulto, qué palabras le cuestan más o menos al niño, con qué se
// confunde y dónde se traba; y cómo exportar los datos para analizarlos con una IA. Todo sale de
// `core/analisis.js`, que lee los registros de `respuestas`: esta pantalla no recalcula nada.
// El niño nunca ve esta pantalla y el tiempo no se usa para juzgarlo.

import { el } from '../ui/dom.js';
import { cabecera, cargando, mostrarError, describirError } from '../ui/adulto.js';
import { crearMiniatura } from '../ui/miniatura.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { urlDeMedio, liberarUrls } from '../medios.js';
import { ACTIVIDADES } from '../actividades/indice.js';
import { VERSION } from '../config.js';
import { copiarTexto, descargarArchivo } from '../hardware.js';
import { analizar, construirExportacion, nombreDeArchivoAnalisis, resumenParaIA, MIN_ENSAYOS } from '../core/analisis.js';
import { idsDeProgresoDe, marcarDominada } from '../core/estadisticas.js';

export const titulo = 'Qué le cuesta · Leo Conmigo';

const FLECHAS = { mejora: ['↑', 'mejora'], igual: ['→', 'sin cambios'], empeora: ['↓', 'empeora'] };
const segundos = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`);
const porciento = (n) => `${Math.round(n * 100)} %`;
const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');

export function montar(contenedor) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Qué le cuesta'), cargando());
  contenedor.append(raiz);
  let vivo = true;
  pintar(raiz, () => vivo).catch((error) => mostrarError(raiz, error));
  return () => {
    vivo = false;
    liberarUrls();
  };
}

async function pintar(raiz, estaVivo, { abierta = null, ocultar = false } = {}) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!perfil) {
    raiz.replaceChildren(
      cabecera('Qué le cuesta'),
      el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.')),
      el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el primer perfil'),
    );
    return;
  }
  const [palabras, frases, progresos, sesiones, respuestas] = await Promise.all([
    store.listar('palabras', { perfilId: perfil.id }),
    store.listar('frases', { perfilId: perfil.id }),
    store.listar('progresos', { perfilId: perfil.id }),
    store.listar('sesiones', { perfilId: perfil.id }),
    store.listar('respuestas', { perfilId: perfil.id }),
  ]);
  const elementos = new Map([...frases, ...palabras].map((e) => [e.id, e]));
  const analisis = analizar(respuestas);
  const urls = new Map();
  for (const p of analisis.palabras) {
    const e = elementos.get(p.elementoId);
    if (e?.medioImagenId) urls.set(p.elementoId, await urlDeMedio(store, e.medioImagenId));
  }
  if (!estaVivo()) return;

  const repintar = (opciones) => pintar(raiz, estaVivo, { abierta, ocultar, ...opciones }).catch((error) => mostrarError(raiz, error));
  const aviso = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const fallar = (error) => {
    console.error(error);
    aviso.textContent = describirError(error);
    aviso.hidden = false;
  };

  // ---- una palabra con su índice ----
  const miniatura = (p) => {
    const e = elementos.get(p.elementoId);
    return crearMiniatura({ url: urls.get(p.elementoId) ?? null, emoji: e?.emoji ?? null, texto: p.texto });
  };
  const filaPalabra = (p) => {
    const [flecha, nombreTendencia] = FLECHAS[p.tendencia];
    const abierto = abierta === p.elementoId;
    const boton = el(
      'button',
      {
        type: 'button',
        class: 'fila-analisis',
        'aria-expanded': String(abierto),
        'aria-label': `${p.texto}: dificultad ${p.indice} de 100. Ver los últimos ensayos`,
        onclick: () => repintar({ abierta: abierto ? null : p.elementoId }),
      },
      miniatura(p),
      el(
        'span',
        { class: 'fila-texto' },
        el('strong', {}, p.texto),
        el(
          'span',
          { class: 'barra-indice', role: 'img', 'aria-label': `Dificultad ${p.indice} de 100` },
          el('span', { class: 'barra-indice-relleno', style: `width:${Math.max(p.indice, 3)}%` }),
        ),
        el(
          'span',
          { class: 'ayuda' },
          `${porciento(p.tasa)} sin ayuda · ${segundos(p.tiempoMediano)} · `,
          el('span', { title: nombreTendencia, 'aria-label': nombreTendencia }, `${flecha} ${nombreTendencia}`),
          p.confiable ? '' : ` · pocos datos (${p.ensayos} de ${MIN_ENSAYOS} ensayos)`,
        ),
      ),
    );
    return el('li', { class: abierto ? 'item-analisis abierto' : 'item-analisis' }, boton, abierto ? detalle(p) : null);
  };

  // ---- detalle de una palabra: últimos 20 ensayos y acciones ----
  function detalle(p) {
    const suyas = respuestas
      .filter((r) => r.elementoId === p.elementoId)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
      .slice(0, 20);
    const lineas = suyas.map((r) => {
      const confundio = (r.errores ?? []).map((e) => e.texto).filter(Boolean);
      return el(
        'li',
        {},
        el('strong', {}, fechaHora(r.fecha)),
        ` · ${r.actividad} · `,
        r.correctoAlPrimerIntento ? '✓ sin ayuda' : '↻ con ayuda',
        confundio.length ? ` · se confundió con ${[...new Set(confundio)].map((t) => `«${t}»`).join(', ')}` : '',
        ` · ${r.distraido ? 'se distrajo' : segundos(r.msAcierto)}`,
        r.esFacil ? ' · ensayo fácil' : '',
      );
    });
    const palabra = palabras.find((x) => x.id === p.elementoId);
    const acciones = [];
    if (palabra) {
      const sabe = el('button', { type: 'button', class: 'boton chico' }, 'Ya la sabe');
      sabe.addEventListener('click', async () => {
        sabe.disabled = true;
        try {
          await store.guardarVarios('progresos', marcarDominada({ perfilId: perfil.id, elementoId: palabra.id, existentes: progresos }));
          repintar({ abierta: p.elementoId });
        } catch (e) {
          fallar(e);
          sabe.disabled = false;
        }
      });
      const reiniciar = el('button', { type: 'button', class: 'boton secundario chico' }, 'Empezar de nuevo');
      reiniciar.addEventListener('click', async () => {
        if (!globalThis.confirm(`¿Empezar de nuevo con «${palabra.texto}»? Se borra su progreso y vuelve a ser una palabra nueva. Los ensayos ya registrados se conservan.`)) return;
        reiniciar.disabled = true;
        try {
          for (const id of idsDeProgresoDe(progresos, palabra.id)) await store.borrar('progresos', id);
          repintar({ abierta: p.elementoId });
        } catch (e) {
          fallar(e);
          reiniciar.disabled = false;
        }
      });
      acciones.push(el('div', { class: 'acciones' }, sabe, reiniciar));
    }
    return el(
      'div',
      { class: 'detalle-analisis' },
      el('p', { class: 'ayuda' }, `${p.ensayos} ensayos en ${p.dias} día${p.dias === 1 ? '' : 's'} · ${p.errores} equivocaciones · pidió oír otra vez ${String(p.audioPorEnsayo).replace('.', ',')} veces por ensayo (promedio).`),
      el('ul', { class: 'lista-ayuda' }, lineas),
      ...acciones,
    );
  }

  const tarjeta = (titulo, ayuda, contenido) =>
    el('div', { class: 'panel' }, el('h2', {}, titulo), ayuda ? el('p', { class: 'ayuda' }, ayuda) : null, contenido);
  const listaDe = (items, vacio) =>
    items.length ? el('ul', { class: 'lista-filas' }, items.map(filaPalabra)) : el('p', { class: 'ayuda' }, vacio);

  // ---- sin datos suficientes ----
  const piezas = [cabecera('Qué le cuesta')];
  if (!analisis.hayDatos) {
    piezas.push(
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Todavía hay pocos datos'),
        el(
          'p',
          {},
          analisis.ensayos
            ? `Hay ${analisis.ensayos} ensayo${analisis.ensayos === 1 ? '' : 's'} registrado${analisis.ensayos === 1 ? '' : 's'} en los últimos ${analisis.dias} días, pero ninguna palabra llega a ${MIN_ENSAYOS} ensayos.`
            : `Todavía no hay ensayos registrados en los últimos ${analisis.dias} días.`,
        ),
        el('p', { class: 'ayuda' }, `Cuando ${perfil.nombre} practique unas cuantas sesiones más, aquí verás qué palabras le cuestan, cuáles le salen fáciles y con qué se confunde. Una palabra necesita al menos ${MIN_ENSAYOS} ensayos para aparecer en las listas.`),
        el('a', { class: 'boton secundario', href: '#/adulto/progreso' }, 'Ver el progreso'),
      ),
    );
  } else {
    // ---- confusiones ----
    const confusiones = analisis.confusiones.length
      ? el(
          'ul',
          { class: 'lista-ayuda' },
          analisis.confusiones.slice(0, 8).map((c) => el('li', {}, el('strong', {}, `${c.objetivo} → ${c.tocada}`), `: ${c.veces} veces`)),
        )
      : el('p', { class: 'ayuda' }, 'Todavía no se repite ninguna confusión (hacen falta al menos 2 veces el mismo error).');

    // ---- actividad más difícil ----
    const mas = analisis.actividadMasDificil;
    const actividades = mas
      ? [
          el('p', {}, el('strong', {}, `${mas.actividad} · ${ACTIVIDADES[mas.actividad]?.nombre ?? ''}`), `: ${porciento(mas.tasa)} sin ayuda en ${mas.ensayos} ensayos.`),
          el(
            'details',
            { class: 'detalle-numeros' },
            el('summary', {}, 'Ver todas las actividades'),
            el(
              'ul',
              { class: 'lista-ayuda' },
              analisis.porActividad.map((a) =>
                el('li', {}, el('strong', {}, `${a.actividad} · ${ACTIVIDADES[a.actividad]?.nombre ?? ''}`), `: ${porciento(a.tasa)} sin ayuda · ${segundos(a.tiempoMediano)} · ${a.ensayos} ensayos`)),
            ),
          ),
        ]
      : el('p', { class: 'ayuda' }, `Ninguna actividad tiene aún ${MIN_ENSAYOS} ensayos.`);

    piezas.push(
      tarjeta('Le cuestan más', 'Las palabras con mayor índice de dificultad. Toca una para ver sus últimos ensayos.', listaDe(analisis.masDificiles, 'Ninguna palabra le está costando: todas le salen bien.')),
      tarjeta('Le salen fácil', null, listaDe(analisis.masFaciles, 'Aún no hay palabras que se distingan por lo fáciles.')),
      tarjeta('Para repetir más', 'Índice de 50 o más, o que va empeorando, o que falló un repaso esta semana.', listaDe(analisis.paraRepetirMas, 'Nada que repetir de más por ahora.')),
      tarjeta('Se confunde entre…', 'Pide la primera palabra y toca la segunda.', confusiones),
      tarjeta('Actividad más difícil', null, actividades),
      analisis.porHora.length
        ? tarjeta(
            'Según el momento del día',
            'Aciertos sin ayuda en cada franja con datos suficientes.',
            el('ul', { class: 'lista-ayuda' }, analisis.porHora.map((h) => el('li', {}, el('strong', {}, h.nombre), `: ${porciento(h.tasa)} sin ayuda en ${h.ensayos} ensayos`))),
          )
        : null,
    );
  }

  // ---- ayuda ----
  piezas.push(
    el(
      'div',
      { class: 'panel' },
      el('h2', {}, 'Cómo leer esto'),
      el(
        'ul',
        { class: 'lista-ayuda' },
        el('li', {}, el('strong', {}, 'Índice (barra): '), 'de 0 (le sale solo) a 100 (le cuesta mucho). Mezcla los aciertos sin ayuda, lo que tarda comparado con su propio promedio y cuántas veces pide oír otra vez.'),
        el('li', {}, el('strong', {}, 'Sin ayuda: '), 'porcentaje de ensayos que acertó a la primera.'),
        el('li', {}, el('strong', {}, 'Tarda: '), 'tiempo típico en acertar a la primera, sin contar los ensayos en que se distrajo (más de 1 minuto).'),
        el('li', {}, el('strong', {}, 'Flecha: '), 'sus últimos 5 ensayos comparados con los 5 anteriores.'),
      ),
      el('p', { class: 'ayuda' }, `Se miran los últimos ${analisis.dias} días. Los ensayos fáciles de relleno, «Leo en voz alta» y las preguntas de los cuentos no cuentan. El tiempo se compara solo con el propio niño: nunca con otros, no se usa para juzgarlo y él no lo ve.`),
    ),
  );

  // ---- exportar ----
  const casillaOcultar = el('input', { type: 'checkbox', id: 'ocultar-nombre' });
  casillaOcultar.checked = ocultar;
  casillaOcultar.addEventListener('change', () => { ocultar = casillaOcultar.checked; });
  const estado = el('p', { class: 'ayuda', role: 'status' });

  const exportar = el('button', { type: 'button', class: 'boton' }, 'Exportar para analizar con IA');
  exportar.addEventListener('click', () => {
    aviso.hidden = true;
    try {
      const datos = construirExportacion({ perfil, sesiones, respuestas, ocultarNombre: casillaOcultar.checked, version: VERSION });
      const blob = new Blob([JSON.stringify(datos, null, 1)], { type: 'application/json' });
      const nombre = nombreDeArchivoAnalisis(perfil, new Date(), casillaOcultar.checked);
      descargarArchivo(blob, nombre);
      estado.textContent = `Listo: ${nombre} (${datos.respuestas.length} ensayos registrados).`;
    } catch (e) {
      fallar(e);
    }
  });

  const copiar = el('button', { type: 'button', class: 'boton secundario' }, 'Copiar resumen para IA');
  copiar.addEventListener('click', async () => {
    aviso.hidden = true;
    const texto = resumenParaIA({ perfil, analisis, ocultarNombre: casillaOcultar.checked });
    if (await copiarTexto(texto)) estado.textContent = `Resumen copiado (${texto.length} caracteres). Pégalo en el chat con la IA.`;
    else fallar(new Error('Este navegador no deja copiar. Usa «Exportar para analizar con IA».'));
  });

  piezas.push(
    el(
      'div',
      { class: 'panel' },
      el('h2', {}, 'Analizar con una IA'),
      el('p', {}, 'Descarga un archivo con todos los ensayos y las métricas, o copia un resumen corto para pegarlo en un chat. No lleva fotos ni audios.'),
      el('label', { class: 'casilla', for: 'ocultar-nombre' }, casillaOcultar, ' Ocultar el nombre del niño'),
      el('div', { class: 'acciones' }, exportar, copiar),
      estado,
      aviso,
      el('p', { class: 'ayuda' }, 'La app no envía estos datos a ningún lado. Tú decides con quién compartirlos.'),
    ),
  );

  raiz.replaceChildren(...piezas.filter(Boolean));
}
