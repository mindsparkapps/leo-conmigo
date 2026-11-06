// Álbum de calcomanías que se renueva, monedas de oro y tienda (PLAN.md, ampliación 2, fase 11). Lógica pura.
//
// Reglas:
//  - Los álbumes se CALCULAN a partir de las calcomanías ganadas; no se guardan.
//  - Un álbum se llena con `tamano` calcomanías distintas. Al llenarse da `monedasPorAlbum` monedas y empieza otro.
//  - El premio es un movimiento con id determinista (`album:<perfil>:<número>`): si dos dispositivos completan el
//    mismo álbum, es el mismo registro y las monedas no se duplican.
//  - El saldo NUNCA se guarda: es la suma de los movimientos. Nunca se ganan ni se pierden monedas por acertar.
//  - Los álbumes ya completos no cambian si el adulto después cambia el tamaño: el último completo fija un corte.

export const ALBUM_POR_DEFECTO = Object.freeze({ tamano: 12, monedasPorAlbum: 10, codigos: null });
export const TAMANO_MIN = 6;
export const TAMANO_MAX = 24;
export const MONEDAS_MIN = 1;
export const MONEDAS_MAX = 50;
export const PRECIO_MIN = 1;
export const PRECIO_MAX = 100;

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const entero = (valor, porDefecto) => (Number.isFinite(Number(valor)) ? Math.round(Number(valor)) : porDefecto);

/**
 * Completa y acota `perfil.album`.
 * Si el adulto eligió menos calcomanías que el tamaño, el tamaño baja (nunca se pide un álbum imposible de llenar).
 */
export function normalizarAlbum(album = {}) {
  const base = { ...ALBUM_POR_DEFECTO, ...(album ?? {}) };
  let codigos = null;
  if (Array.isArray(base.codigos)) {
    codigos = [...new Set(base.codigos.filter((c) => typeof c === 'string' && c))];
    if (!codigos.length) codigos = null;
  }
  let tamano = limitar(entero(base.tamano, ALBUM_POR_DEFECTO.tamano), TAMANO_MIN, TAMANO_MAX);
  if (codigos && codigos.length < tamano) tamano = Math.max(1, codigos.length);
  return {
    tamano,
    monedasPorAlbum: limitar(entero(base.monedasPorAlbum, ALBUM_POR_DEFECTO.monedasPorAlbum), MONEDAS_MIN, MONEDAS_MAX),
    codigos,
  };
}

// ---------- álbumes ----------

export const idPremioAlbum = (perfilId, numero) => `album:${perfilId}:${numero}`;

/**
 * Reparte las calcomanías en álbumes.
 * @param calcomanias  [{ codigo, fecha }] del perfil (sin borradas)
 * @param movimientos  movimientos del perfil: los de tipo 'album' fijan los álbumes ya cerrados
 * @param tamano       tamaño con que se llenan los álbumes que aún no se cerraron
 * @returns {{ completos, actual, nuevosCompletos }}
 *   completos: [{ numero, codigos, fechaFin, premiado }] (también los que aún no tienen su movimiento);
 *   actual: { numero, codigos } el que se está llenando;
 *   nuevosCompletos: los completos sin movimiento todavía (hay que crearles el premio).
 */
export function calcularAlbumes({ calcomanias = [], movimientos = [], tamano = ALBUM_POR_DEFECTO.tamano }) {
  const cerrados = movimientos
    .filter((m) => m.tipo === 'album' && !m.deleted)
    .sort((a, b) => a.albumNumero - b.albumNumero);
  const completos = cerrados.map((m) => ({
    numero: m.albumNumero,
    codigos: m.codigos ?? [],
    fechaFin: m.fechaFin ?? m.fecha,
    premiado: true,
  }));
  const corte = completos.length ? completos[completos.length - 1].fechaFin : '';
  let numero = completos.length ? completos[completos.length - 1].numero : 0;

  const restantes = calcomanias
    .filter((c) => !c.deleted && (c.fecha ?? '') > corte)
    .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''));

  const nuevosCompletos = [];
  let codigos = [];
  for (const c of restantes) {
    if (codigos.includes(c.codigo)) continue; // una repetida no llena el álbum
    codigos.push(c.codigo);
    if (codigos.length >= tamano) {
      numero += 1;
      const album = { numero, codigos, fechaFin: c.fecha, premiado: false };
      completos.push(album);
      nuevosCompletos.push(album);
      codigos = [];
    }
  }
  return { completos, actual: { numero: numero + 1, codigos }, nuevosCompletos };
}

/** El movimiento que premia un álbum completo (id determinista). */
export function movimientoDeAlbum({ perfilId, album, monedas, tamano }) {
  return {
    id: idPremioAlbum(perfilId, album.numero),
    perfilId,
    fecha: album.fechaFin,
    cantidad: monedas,
    tipo: 'album',
    albumNumero: album.numero,
    fechaFin: album.fechaFin,
    codigos: [...album.codigos],
    tamano,
  };
}

// ---------- monedas y tienda ----------

/** Saldo = suma de movimientos vigentes (los canjes anulados no cuentan; un canje entregado sí). */
export function saldo(movimientos) {
  let total = 0;
  for (const m of movimientos) {
    if (m.deleted || m.estado === 'anulado') continue;
    total += Number(m.cantidad) || 0;
  }
  return total;
}

export function puedeCanjear(saldoActual, premio) {
  return Boolean(premio) && premio.activo !== false && !premio.deleted && saldoActual >= premio.precio;
}

/** Cuántas monedas le faltan para un premio (0 si le alcanza). */
export const faltan = (saldoActual, premio) => Math.max(0, premio.precio - saldoActual);

/** El movimiento de un canje: gasta el precio y queda pendiente hasta que el adulto lo entregue. */
export function crearCanje({ perfilId, premio, fecha = new Date().toISOString() }) {
  return {
    perfilId,
    fecha,
    cantidad: -premio.precio,
    tipo: 'canje',
    premioId: premio.id,
    nota: premio.nombre,
    estado: 'pendiente',
  };
}

export function crearRegalo({ perfilId, cantidad, nota = '', tipo = 'regalo', fecha = new Date().toISOString() }) {
  const n = Math.round(Number(cantidad));
  if (!Number.isFinite(n) || n === 0) throw new Error('La cantidad de monedas no es válida');
  if (tipo === 'correccion' && !String(nota).trim()) throw new Error('Corregir el saldo necesita una nota');
  return { perfilId, fecha, cantidad: n, tipo, nota: String(nota).trim() };
}

export const canjesPendientes = (movimientos) =>
  movimientos.filter((m) => !m.deleted && m.tipo === 'canje' && m.estado === 'pendiente').sort((a, b) => a.fecha.localeCompare(b.fecha));

export function nuevoPremio({ perfilId, nombre, precio, medioImagenId = null, arasaacId = null, emoji = null, activo = true, orden = 0 }) {
  if (!perfilId) throw new Error('El premio necesita un perfil');
  const limpio = String(nombre ?? '').trim();
  if (!limpio) throw new Error('El premio necesita un nombre');
  return {
    perfilId,
    nombre: limpio,
    precio: limitar(entero(precio, PRECIO_MIN), PRECIO_MIN, PRECIO_MAX),
    medioImagenId,
    arasaacId,
    emoji,
    activo,
    orden,
  };
}

/** Premios que el niño ve en la tienda, en el orden del adulto. */
export const premiosVisibles = (premios) =>
  premios.filter((p) => !p.deleted && p.activo !== false).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

/** Un número de monedas dibujadas: hasta `max` (el resto se ve en el número). */
export const monedasADibujar = (n, max = 20) => Math.max(0, Math.min(max, Math.floor(n)));

// ---------- movimientos pendientes de crear ----------

/**
 * Los premios de álbum que faltan crear. Es lo que el fin de sesión (y el inicio) guardan.
 * Idempotente: llamarlo dos veces seguidas devuelve la segunda vez una lista vacía si ya se guardaron.
 */
export function premiosDeAlbumPorCrear({ perfilId, calcomanias, movimientos, album }) {
  const config = normalizarAlbum(album);
  const { nuevosCompletos } = calcularAlbumes({ calcomanias, movimientos, tamano: config.tamano });
  return nuevosCompletos.map((a) => movimientoDeAlbum({ perfilId, album: a, monedas: config.monedasPorAlbum, tamano: config.tamano }));
}
