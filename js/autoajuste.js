// Aplica los ajustes automáticos al terminar una sesión (PLAN.md, fase 14): junta lo que hace falta del almacén,
// llama a la lógica pura de `core/autoajuste.js` y, si cambió algo, guarda el perfil con sus avisos.
// Nunca debe romper el cierre de la sesión: quien lo llame captura el error.

import { analizar } from './core/analisis.js';
import { evaluarAutoajuste } from './core/autoajuste.js';
import { ETAPAS_HECHAS, etapasDesbloqueadas } from './core/etapas.js';
import { tablaDePalabras } from './core/estadisticas.js';
import { normalizarAjustes } from './core/modelos.js';

/** @returns lista de cambios nuevos (vacía si no hubo ninguno) */
export async function aplicarAutoajuste(store, perfilId, hoy = new Date()) {
  const perfil = await store.obtener('perfiles', perfilId);
  if (!perfil) return [];
  const [sesiones, niveles, palabras, progresos, respuestas] = await Promise.all([
    store.listar('sesiones', { perfilId }),
    store.listar('niveles', { perfilId }),
    store.listar('palabras', { perfilId }),
    store.listar('progresos', { perfilId }),
    store.listar('respuestas', { perfilId }),
  ]);
  const ajustes = normalizarAjustes(perfil.ajustes);
  const etapaActual = perfil.etapaActual ?? 1;

  const indicePorId = new Map(analizar(respuestas, { hoy }).palabras.filter((p) => p.confiable).map((p) => [p.elementoId, p.indice]));
  const filas = tablaDePalabras({ palabras: palabras.filter((p) => p.activa !== false), progresos });
  const indicesEnPractica = filas
    .filter((f) => f.estado === 'practica' || f.estado === 'leida')
    .map((f) => indicePorId.get(f.palabra.id))
    .filter((i) => i !== undefined);

  // La etapa solo sube desde la 1 (palabras) a la 2 (frases): es donde se mide «palabras dominadas o aprendidas»
  const abiertas = etapasDesbloqueadas({ progresos, forzadas: ajustes.etapasForzadas, bloqueadas: ajustes.etapasBloqueadas });
  const etapaSiguienteAbierta = etapaActual === 1 && abiertas.includes(2) && ETAPAS_HECHAS.includes(2);
  const proporcionEtapa = etapaActual === 1 && filas.length
    ? filas.filter((f) => f.estado === 'completa' || f.estado === 'aprendida').length / filas.length
    : null;

  const resultado = evaluarAutoajuste({ perfil, sesiones, niveles, indicesEnPractica, proporcionEtapa, etapaSiguienteAbierta, hoy });
  if (resultado.cambios.length) await store.guardar('perfiles', resultado.perfil);
  return resultado.cambios;
}
