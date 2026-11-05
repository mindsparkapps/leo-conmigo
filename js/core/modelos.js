// Modelos de datos y valores por defecto (PLAN.md §5 y §7). Lógica pura.

import { nuevoId } from './id.js';
import { silabear } from './silabas.js';

export const AJUSTES_POR_DEFECTO = Object.freeze({
  ensayosPorSesion: 8, // 4 a 15
  maxOpciones: 4, // 2 a 4
  actividadesHabilitadas: null, // null = todas las de la etapa
  mayusculas: false,
  tamanoLetra: 'normal', // 'normal' | 'grande'
  velocidadVoz: 1, // 0.6 a 1.2
  sonido: true,
  vibracion: true,
  intensidadCelebracion: 'normal', // 'ninguna' | 'suave' | 'normal'
  altoContraste: false,
  habilitarL6: false,
});

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const entero = (valor, porDefecto) => (Number.isFinite(Number(valor)) ? Math.round(Number(valor)) : porDefecto);
const dentroDe = (valor, permitidos, porDefecto) => (permitidos.includes(valor) ? valor : porDefecto);

/** Completa y acota los ajustes de un perfil (nunca devuelve valores fuera de rango). */
export function normalizarAjustes(ajustes = {}) {
  const a = { ...AJUSTES_POR_DEFECTO, ...ajustes };
  a.ensayosPorSesion = limitar(entero(a.ensayosPorSesion, 8), 4, 15);
  a.maxOpciones = limitar(entero(a.maxOpciones, 4), 2, 4);
  a.actividadesHabilitadas =
    Array.isArray(a.actividadesHabilitadas) && a.actividadesHabilitadas.length ? [...a.actividadesHabilitadas] : null;
  a.tamanoLetra = dentroDe(a.tamanoLetra, ['normal', 'grande'], 'normal');
  a.intensidadCelebracion = dentroDe(a.intensidadCelebracion, ['ninguna', 'suave', 'normal'], 'normal');
  a.velocidadVoz = limitar(Number.isFinite(Number(a.velocidadVoz)) ? Number(a.velocidadVoz) : 1, 0.6, 1.2);
  a.mayusculas = Boolean(a.mayusculas);
  a.sonido = Boolean(a.sonido);
  a.vibracion = Boolean(a.vibracion);
  a.altoContraste = Boolean(a.altoContraste);
  a.habilitarL6 = Boolean(a.habilitarL6);
  return a;
}

export function nuevoPerfil({ nombre, fotoMedioId = null, fechaNacimiento = null, etapaActual = 1, ajustes = {} }) {
  if (!String(nombre ?? '').trim()) throw new Error('El perfil necesita un nombre');
  return {
    id: nuevoId(),
    nombre: String(nombre).trim(),
    fotoMedioId,
    fechaNacimiento,
    ajustes: normalizarAjustes(ajustes),
    etapaActual,
    creado: new Date().toISOString(),
  };
}

export function nuevaPalabra({
  perfilId,
  texto,
  silabas,
  categoria = 'otras',
  tipo = 'sustantivo',
  medioImagenId = null,
  arasaacId = null,
  emoji = null,
  medioAudioId = null,
  orden = 0,
  activa = true,
}) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) throw new Error('La palabra necesita texto');
  if (!perfilId) throw new Error('La palabra necesita un perfil');
  return {
    id: nuevoId(),
    perfilId,
    texto: limpio,
    silabas: silabas && silabas.length ? [...silabas] : silabear(limpio),
    categoria,
    tipo,
    medioImagenId,
    arasaacId,
    emoji,
    medioAudioId,
    orden,
    activa,
  };
}
