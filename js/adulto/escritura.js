// Menú «Escritura (experimental)» del adulto (Ampliación 5, fase 30). Todo se guarda en `perfil.ajustes.escritura` y
// `perfil.ajustes.automaticos` al instante y se usa desde la sesión siguiente. Es del curso: el celular de un alumno no lo abre.

import { el } from '../ui/dom.js';
import { cabecera, campo, cargando, mostrarError, describirError } from '../ui/adulto.js';
import { obtenerStore, perfilActivo } from '../contexto.js';
import { normalizarAjustes } from '../core/modelos.js';
import { contarDatosDePrueba, borrarDatosDePrueba } from '../core/borrar-perfil.js';
import { MIN_PALABRAS_POR_NIVEL, elementosDeEscritura, nivelEfectivo, nivelesDisponibles, palabrasPorNivel } from '../core/escritura/elementos.js';
import { NIVELES } from '../core/escritura/niveles.js';
import { pedirPrueba } from '../nino/escritura.js';

export const titulo = 'Escritura · Leo Conmigo';

export function montar(contenedor, { ir }) {
  const raiz = el('section', { class: 'vista-adulto' }, cabecera('Escritura (experimental)'), cargando());
  contenedor.append(raiz);
  let vivo = true;
  pintar(raiz, () => vivo, ir).catch((error) => mostrarError(raiz, error));
  return () => { vivo = false; };
}

function interruptor(etiqueta, marcado, ayuda = null) {
  const casilla = el('input', { type: 'checkbox', checked: marcado });
  return { casilla, elemento: el('label', { class: 'interruptor' }, casilla, el('span', {}, el('strong', {}, etiqueta), ayuda ? el('span', { class: 'ayuda' }, ayuda) : null)) };
}
const selector = (opciones, valor) => el('select', {}, opciones.map(([v, t]) => el('option', { value: String(v), selected: String(v) === String(valor) }, t)));
const MODOS = [['auto', 'Automático'], ['manual', 'Lo elijo yo']];

async function pintar(raiz, estaVivo, ir) {
  const store = await obtenerStore();
  const perfil = await perfilActivo();
  if (!perfil) {
    raiz.replaceChildren(cabecera('Escritura (experimental)'), el('div', { class: 'panel' }, el('p', {}, 'Primero crea el perfil del niño.')), el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el primer perfil'));
    return;
  }
  const [palabras, frases, banco, enPrueba] = await Promise.all([
    store.listar('palabras', { perfilId: perfil.id }),
    store.listar('frases', { perfilId: perfil.id }),
    fetch('data/escritura/banco.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    contarDatosDePrueba(store, perfil.id),
  ]);
  if (!estaVivo()) return;

  const estado = el('p', { class: 'ayuda', role: 'status' });
  /** Guarda un cambio sobre el perfil más reciente. `escritura` y `automaticos` se mezclan con lo que ya había. */
  async function cambiar({ escritura = {}, automaticos = {} }) {
    try {
      const actual = (await store.obtener('perfiles', perfil.id)) ?? perfil;
      const a = normalizarAjustes(actual.ajustes);
      await store.guardar('perfiles', { ...actual, ajustes: { ...actual.ajustes, escritura: { ...a.escritura, ...escritura }, automaticos: { ...a.automaticos, ...automaticos } } });
      estado.textContent = 'Guardado.';
    } catch (error) {
      estado.textContent = describirError(error);
    }
  }
  const a = normalizarAjustes(perfil.ajustes);
  const esc = a.escritura;
  const elementos = elementosDeEscritura({ palabras, frases, banco, bancoApagado: esc.bancoApagado });
  const cuenta = palabrasPorNivel(elementos);
  const disponibles = nivelesDisponibles(elementos.filter((e) => e.activa !== false && !e.deleted));
  const efectivo = nivelEfectivo({ nivelEscritura: esc.nivelEscritura, disponibles, bloqueados: esc.nivelesBloqueados, forzados: esc.nivelesForzados });
  const nombreNivel = (id) => { const n = NIVELES.find((x) => x.id === id); return n ? `${n.numero} · ${n.nombre}` : id; };

  // ---------- habilitar y probar ----------
  const habilitada = interruptor('Habilitar «Escritura (experimental)» para este perfil', esc.habilitada, 'Prendida: el botón «Escritura» aparece en el inicio del niño. Apagada: solo lo ven los administradores (con la etiqueta «Modo administrador») y lo que jueguen se guarda en un perfil de prueba.');
  habilitada.casilla.addEventListener('change', () => cambiar({ escritura: { habilitada: habilitada.casilla.checked } }));
  const zonaPrueba = el('div');
  const pintarPrueba = (n) => zonaPrueba.replaceChildren(
    n > 0 ? el('p', { class: 'ayuda' }, `Hay ${n} registro${n === 1 ? '' : 's'} del perfil de prueba. `, el('a', { href: '#/adulto/escritura/progreso/prueba' }, 'Ver su progreso')) : el('p', { class: 'ayuda' }, 'Todavía no hay datos de prueba.'),
    n > 0 ? el('button', { type: 'button', class: 'boton secundario', onclick: async () => {
      if (!globalThis.confirm('¿Borrar los datos de prueba de Escritura? Se borran las sesiones, el progreso, las láminas y las monedas del perfil de prueba. No toca nada del perfil del niño.')) return;
      await borrarDatosDePrueba(store, perfil.id);
      pintarPrueba(await contarDatosDePrueba(store, perfil.id));
    } }, 'Borrar los datos de prueba') : null,
  );
  pintarPrueba(enPrueba);
  const panelHabilitar = el('div', { class: 'panel' },
    el('h2', {}, 'Escritura (experimental)'),
    el('p', { class: 'ayuda' }, 'El niño arma palabras poniendo sílabas en cajas, desde las vocales hasta oraciones y dictados (20 niveles). Es una prueba: cambia dos reglas de la lectura (se puede tocar o arrastrar, y el error puede verse en rojo suave) que aquí puedes suavizar.'),
    habilitada.elemento,
    el('div', { class: 'acciones' },
      el('button', { type: 'button', class: 'boton', onclick: () => { pedirPrueba(); ir('/nino/escritura'); } }, 'Probar Escritura'),
      el('a', { class: 'boton secundario', href: '#/adulto/escritura/progreso' }, 'Ver el progreso')),
    el('p', { class: 'ayuda' }, '«Probar Escritura» juega una sesión como el niño pero se guarda en el perfil de prueba, nunca en el del niño.'),
    zonaPrueba,
  );

  // ---------- nivel y sesión ----------
  const nivel = selector(NIVELES.map((n) => [n.id, nombreNivel(n.id)]), esc.nivelEscritura);
  const modoNivel = selector(MODOS, a.automaticos.nivelEscritura ? 'auto' : 'manual');
  nivel.addEventListener('change', () => { modoNivel.value = 'manual'; cambiar({ escritura: { nivelEscritura: nivel.value }, automaticos: { nivelEscritura: false } }); });
  modoNivel.addEventListener('change', () => cambiar({ automaticos: { nivelEscritura: modoNivel.value === 'auto' } }));
  const porSesion = el('input', { type: 'range', min: '4', max: '12', step: '1', value: String(esc.palabrasPorSesion) });
  const porSesionValor = el('output', { class: 'valor-ajuste' }, String(esc.palabrasPorSesion));
  const modoPorSesion = selector(MODOS, a.automaticos.palabrasEscritura ? 'auto' : 'manual');
  porSesion.addEventListener('input', () => { porSesionValor.textContent = porSesion.value; });
  porSesion.addEventListener('change', () => { modoPorSesion.value = 'manual'; cambiar({ escritura: { palabrasPorSesion: Number(porSesion.value) }, automaticos: { palabrasEscritura: false } }); });
  modoPorSesion.addEventListener('change', () => cambiar({ automaticos: { palabrasEscritura: modoPorSesion.value === 'auto' } }));
  const maxExtras = selector([0, 1, 2, 3, 4].map((n) => [n, String(n)]), esc.maxSilabasExtra);
  maxExtras.addEventListener('change', () => cambiar({ escritura: { maxSilabasExtra: Number(maxExtras.value) } }));
  const modoExtras = selector(MODOS, a.automaticos.silabasExtra ? 'auto' : 'manual');
  const fijas = selector([0, 1, 2, 3, 4].map((n) => [n, String(n)]), esc.silabasExtraManual ?? 0);
  const pintarFijas = () => { fijas.hidden = modoExtras.value === 'auto'; };
  pintarFijas();
  modoExtras.addEventListener('change', () => { pintarFijas(); cambiar({ automaticos: { silabasExtra: modoExtras.value === 'auto' }, escritura: { silabasExtraManual: modoExtras.value === 'auto' ? null : Number(fijas.value) } }); });
  fijas.addEventListener('change', () => cambiar({ escritura: { silabasExtraManual: Number(fijas.value) } }));
  const panelSesion = el('div', { class: 'panel' },
    el('h2', {}, 'Nivel y sesiones'),
    el('p', { class: 'ayuda' }, efectivo ? `Hoy practica: ${nombreNivel(efectivo)}.` : 'Todavía no hay ningún nivel con palabras suficientes.'),
    campo('Nivel actual', el('div', { class: 'fila' }, nivel, modoNivel), '«Automático»: sube solo al siguiente cuando domina el 80 % de las palabras del nivel (mínimo 4), como mucho una vez por día. Nunca baja solo: si le cuesta, solo te sugiere.'),
    campo('Palabras por sesión', el('div', { class: 'fila' }, porSesion, porSesionValor, modoPorSesion), 'De 4 a 12. Escribir una palabra tarda más que un ensayo de lectura.'),
    campo('Sílabas que no son (máximo)', maxExtras, '0 a 4 sílabas de más entre las piezas. En «Automático» empieza en 0 y sube según cómo le va, sin pasar de este máximo.'),
    campo('Sílabas que no son (cómo)', el('div', { class: 'fila' }, modoExtras, fijas), '«Lo elijo yo»: siempre ese número.'),
  );

  // ---------- cómo se juega ----------
  const mover = selector([['tocar', 'Tocar (por defecto): tocar la sílaba la dice y la toma; tocar la caja la pone'], ['arrastrar', 'Arrastrar la sílaba a su caja']], esc.formaDeMover);
  mover.addEventListener('change', () => cambiar({ escritura: { formaDeMover: mover.value } }));
  const error = selector([['suave', 'Suave (por defecto): la pieza se atenúa y vuelve'], ['rojo', 'Rojo suave: la caja se pone roja un momento']], esc.colorError);
  error.addEventListener('change', () => cambiar({ escritura: { colorError: error.value } }));
  const oracion = selector([['palabras', 'Por palabras (una caja por palabra)'], ['silabas', 'Por sílabas (una caja por sílaba)']], esc.piezasOracion);
  oracion.addEventListener('change', () => cambiar({ escritura: { piezasOracion: oracion.value } }));
  const eleccion = selector([['alcanzados', 'El nivel actual y los anteriores'], ['todos', 'Cualquier nivel'], ['ninguno', 'Ninguno (sin botón de niveles)']], esc.eleccionNino);
  eleccion.addEventListener('change', () => cambiar({ escritura: { eleccionNino: eleccion.value } }));
  const panelJuego = el('div', { class: 'panel' },
    el('h2', {}, 'Cómo se juega'),
    campo('Forma de mover las sílabas', mover),
    campo('Cuando se equivoca', error, 'En los dos casos: sin sonido, sin vibración y sin cruz. Tras 2 errores en la misma caja, la sílaba correcta se ilumina en amarillo y se dice.'),
    campo('Oraciones (nivel 18), valor inicial', oracion, 'Al abrir el nivel, el niño ve un interruptor «Por palabras / Por sílabas» con esta opción resaltada.'),
    campo('Qué niveles puede elegir el niño', eleccion, 'Elegir otro nivel solo vale para esa sesión: no cambia el nivel guardado.'),
  );

  // ---------- niveles: abrir o bloquear ----------
  const filasNiveles = NIVELES.map((n) => {
    const valor = esc.nivelesForzados.includes(n.id) ? 'abrir' : esc.nivelesBloqueados.includes(n.id) ? 'bloquear' : 'auto';
    const sel = selector([['auto', 'Automático'], ['abrir', 'Abrir ahora'], ['bloquear', 'Bloquear']], valor);
    const faltan = cuenta[n.id] < MIN_PALABRAS_POR_NIVEL && !esc.nivelesForzados.includes(n.id);
    sel.addEventListener('change', async () => {
      const actual = normalizarAjustes((await store.obtener('perfiles', perfil.id))?.ajustes).escritura;
      const sin = (lista) => lista.filter((x) => x !== n.id);
      await cambiar({ escritura: { nivelesForzados: sel.value === 'abrir' ? [...sin(actual.nivelesForzados), n.id] : sin(actual.nivelesForzados), nivelesBloqueados: sel.value === 'bloquear' ? [...sin(actual.nivelesBloqueados), n.id] : sin(actual.nivelesBloqueados) } });
    });
    return campo(nombreNivel(n.id), sel, `${cuenta[n.id]} palabra${cuenta[n.id] === 1 ? '' : 's'} (${n.dificultad}).${faltan ? ' Con menos de 3 se salta sola.' : ''}`);
  });
  const panelNiveles = el('div', { class: 'panel' }, el('h2', {}, 'Los 20 niveles'), el('p', { class: 'ayuda' }, 'Un nivel bloqueado no se practica; uno abierto se usa aunque tenga pocas palabras.'), filasNiveles);

  // ---------- palabras por nivel ----------
  const apagadas = new Set(esc.bancoApagado);
  const guardarApagadas = () => cambiar({ escritura: { bancoApagado: [...apagadas] } });
  const grupos = NIVELES.filter((n) => elementos.some((e) => e.nivel === n.id && !e.dictado)).map((n) => {
    const lista = elementos.filter((e) => e.nivel === n.id && !e.dictado);
    return el('details', { class: 'grupo-catalogo' },
      el('summary', {}, `${nombreNivel(n.id)} (${lista.filter((e) => e.activa !== false).length} de ${lista.length})`),
      el('div', { class: 'catalogo-items' }, lista.map((e) => {
        const texto = e.modelo ? `${e.texto} (${e.modelo})` : e.texto;
        if (e.origen !== 'banco') return el('span', { class: 'item-catalogo' }, `${texto} · del perfil`);
        const casilla = el('input', { type: 'checkbox', checked: e.activa !== false });
        casilla.addEventListener('change', () => { if (casilla.checked) apagadas.delete(e.id); else apagadas.add(e.id); guardarApagadas(); });
        return el('label', { class: 'item-catalogo' }, casilla, el('span', {}, texto));
      })));
  });
  const panelPalabras = el('div', { class: 'panel' },
    el('h2', {}, 'Palabras por nivel'),
    el('p', { class: 'ayuda' }, 'Las palabras del niño (con foto) entran solas al nivel que les toca y van primero. Las del banco incluido completan: apaga con la casilla las que no quieras. Para agregar las tuyas, usa el vocabulario de siempre.'),
    grupos,
  );

  raiz.replaceChildren(cabecera('Escritura (experimental)'), panelHabilitar, panelSesion, panelJuego, panelNiveles, panelPalabras, estado);
}
