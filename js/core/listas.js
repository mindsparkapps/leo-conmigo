// Utilidades puras para listas largas del modo adulto: paginación, filtros del historial de monedas,
// orden del vocabulario y color de la barra de dificultad. Sin DOM.

/** Parte una lista en páginas. `pagina` empieza en 1 y se ajusta al rango válido. */
export function paginar(lista, pagina = 1, tamano = 20) {
  const total = lista.length;
  const t = Math.max(1, Math.floor(tamano) || 1);
  const paginas = Math.max(1, Math.ceil(total / t));
  const actual = Math.min(Math.max(1, Math.floor(pagina) || 1), paginas);
  const desde = (actual - 1) * t;
  return { items: lista.slice(desde, desde + t), pagina: actual, paginas, total, desde: total ? desde + 1 : 0, hasta: Math.min(total, desde + t) };
}

/**
 * Filtra el historial de monedas (lo más reciente primero).
 * @param tipo   'todos' o el tipo de movimiento ('album', 'sobre', 'venta', 'canje', ...)
 * @param signo  'todos' | 'ganadas' (cantidad > 0) | 'gastadas' (cantidad < 0)
 * @param desde,hasta  'AAAA-MM-DD' (incluidos), hora local; vacío = sin límite
 * @param texto  busca en la nota
 */
export function filtrarMovimientos(movimientos, { tipo = 'todos', signo = 'todos', desde = '', hasta = '', texto = '' } = {}) {
  const buscado = String(texto ?? '').trim().toLowerCase();
  const inicio = desde ? new Date(`${desde}T00:00:00`).getTime() : -Infinity;
  const fin = hasta ? new Date(`${hasta}T23:59:59.999`).getTime() : Infinity;
  return movimientos
    .filter((m) => !m.deleted)
    .filter((m) => tipo === 'todos' || m.tipo === tipo)
    .filter((m) => signo === 'todos' || (signo === 'ganadas' ? m.cantidad > 0 : m.cantidad < 0))
    .filter((m) => {
      const t = new Date(m.fecha).getTime();
      return Number.isNaN(t) || (t >= inicio && t <= fin);
    })
    .filter((m) => !buscado || String(m.nota ?? '').toLowerCase().includes(buscado))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Ordena filas con `texto` para la lista de vocabulario.
 * @param modo  'aprendizaje' (se deja como viene) | 'alfabetico' | 'uso' (más usadas en español primero)
 * @param frecuencias  { palabra en minúsculas: puesto en la lista de frecuencia (1 = la más usada) }
 */
export function ordenarVocabulario(filas, modo = 'aprendizaje', frecuencias = {}) {
  const copia = [...filas];
  const alfa = (a, b) => sinTildes(a.texto).localeCompare(sinTildes(b.texto), 'es') || String(a.texto).localeCompare(String(b.texto), 'es');
  if (modo === 'alfabetico') return copia.sort(alfa);
  if (modo === 'uso') {
    const puesto = (f) => frecuencias[String(f.texto).toLowerCase().trim()] ?? Infinity;
    return copia.sort((a, b) => {
      const pa = puesto(a);
      const pb = puesto(b);
      if (pa === pb) return alfa(a, b);
      return pa < pb ? -1 : 1;
    });
  }
  return copia;
}

/** Color de la barra de dificultad (0–100): verde, amarillo, naranja y rojo. */
export function colorDeIndice(indice) {
  const n = Number(indice) || 0;
  if (n < 25) return 'verde';
  if (n < 50) return 'amarillo';
  if (n < 75) return 'naranja';
  return 'rojo';
}
