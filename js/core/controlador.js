// Controlador de la sesión del niño. Junta el motor (crearSesion / registrarRespuesta), las
// actividades y los toques, y le dice a la pantalla QUÉ hacer. No toca el DOM ni el almacenamiento:
// así toda la sesión se prueba en Node. La pantalla solo dibuja, habla, vibra y guarda lo que él devuelve.
//
//   const ctl = crearControlador({ perfil, palabras, frases, progresos, niveles });
//   let ensayo = ctl.iniciar(ahoraMs);                // ensayo visual (o null si no hay nada que practicar)
//   const r = ctl.tocar(entrada, ahoraMs);            // { efecto: 'ignorado'|'ayuda'|'paso'|'correcto', ... }
//   const sig = ctl.avanzar(ahoraMs);                 // tras un acierto: { guardar, siguiente, terminada, fatiga }
//
// Hay tres modos de ensayo (`ensayo.modo`):
//   'simple'    tocar la opción correcta entre varias (`entrada` = id de la carta)
//   'secuencia' tocar las palabras en orden, «armo la frase» (`entrada` = id de la ficha)
//   'lectura'   leer en voz alta y el adulto decide (`entrada` = 'ok' o 'otra')

import { ACTIVIDADES } from '../actividades/indice.js';
import { ACTIVIDADES_POR_ETAPA, ETAPAS_HECHAS, etapaEfectiva, etapasDesbloqueadas } from './etapas.js';
import { elegirElogio } from './elogios.js';
import { frasesComoElementos } from './frases.js';
import {
  crearIntento, crearIntentoLectura, crearIntentoSecuencia, decidirLectura, fichaSiguiente, resultadoDelIntento,
  tocar as tocarSimple, tocarSecuencia,
} from './intento.js';
import { normalizarAjustes } from './modelos.js';
import { ESTADOS, aplicarResultado, idNivel, idProgreso, nuevoNivel, nuevoProgreso } from './progreso.js';
import { construirRegistroSesion, crearSesion, ensayoActual, iniciarCurso, registrarRespuesta, resumenDeSesion } from './sesion.js';
import { tieneImagen } from './vocabulario.js';

export const MAX_LECTURAS_POR_SESION = 2; // «Leo en voz alta» (L6) por sesión, como máximo

const MODOS = {
  simple: { crear: crearIntento, tocar: tocarSimple },
  secuencia: { crear: crearIntentoSecuencia, tocar: tocarSecuencia },
  lectura: { crear: crearIntentoLectura, tocar: decidirLectura },
};

/** Una palabra solo se practica si se puede mostrar: con foto/pictograma o, al menos, con emoji. */
export function esPracticable(palabra) {
  return !palabra.deleted && palabra.activa !== false && tieneImagen(palabra);
}

/** Actividades de la etapa que ya están hechas (si la etapa no existe aún, se usa la 1). */
export function actividadesDeLaEtapa(etapa = 1) {
  const hechas = (ACTIVIDADES_POR_ETAPA[etapa] ?? []).filter((a) => ACTIVIDADES[a]);
  return hechas.length ? [...hechas] : [...ACTIVIDADES_POR_ETAPA[1]];
}

export function crearControlador({
  perfil, palabras, frases = [], progresos = [], niveles = [], hoy = new Date(), aleatorio = Math.random, reloj = () => new Date(),
}) {
  const ajustes = normalizarAjustes(perfil.ajustes);
  const palabrasPorId = new Map(palabras.filter((p) => !p.deleted).map((p) => [p.id, p]));
  const mapaProgresos = new Map(progresos.map((p) => [p.id, p]));
  const mapaNiveles = new Map(niveles.map((n) => [n.id, n]));

  // ---- qué etapa se practica hoy ----
  const desbloqueadas = etapasDesbloqueadas({ progresos, forzadas: ajustes.etapasForzadas, bloqueadas: ajustes.etapasBloqueadas });
  const elegida = etapaEfectiva({ etapaActual: perfil.etapaActual ?? 1, desbloqueadas });

  function armarEtapa(etapa) {
    const elementos = etapa === 2 ? frasesComoElementos(frases, palabrasPorId) : [...palabrasPorId.values()].filter(esPracticable);
    const plan = crearSesion({
      perfil,
      elementos,
      progresos,
      niveles,
      actividades: actividadesDeLaEtapa(etapa),
      hoy,
      aleatorio,
      puedeHacer: (elemento, actividad) => ACTIVIDADES[actividad].aplicaA?.(elemento) ?? true,
      puedeSerOpcion: (elemento, actividad) => ACTIVIDADES[actividad].esOpcionValida?.(elemento) ?? true,
      reglasDe: (actividad) => ACTIVIDADES[actividad].reglas ?? {},
    });
    return { etapa, elementos, plan };
  }

  // Si en la etapa elegida no hay nada que practicar (p. ej. aún no hay frases), se baja a la anterior.
  const candidatas = [elegida, ...[2, 1, 0].filter((e) => e < elegida && desbloqueadas.includes(e) && ETAPAS_HECHAS.includes(e))];
  let base = null;
  for (const etapa of candidatas) {
    base = armarEtapa(etapa);
    if (base.plan.ensayos.length) break;
  }
  const { etapa, elementos, plan } = base;

  // ---- «Leo en voz alta» (L6): opcional, solo con palabras ya leídas, antes del último ensayo ----
  if (etapa === 1 && ajustes.habilitarL6 && plan.ensayos.length) {
    const ultimaLectura = (p) => {
      const hist = mapaProgresos.get(idProgreso(perfil.id, p.id, 'L6'))?.historial ?? [];
      return hist.length ? Date.parse(hist.at(-1).fecha) || 0 : 0;
    };
    const leidas = elementos.filter((p) => mapaProgresos.get(idProgreso(perfil.id, p.id, 'L4'))?.estado === ESTADOS.DOMINADA);
    const extras = leidas
      .sort((a, b) => ultimaLectura(a) - ultimaLectura(b))
      .slice(0, MAX_LECTURAS_POR_SESION)
      .map((p) => ({ elementoId: p.id, actividad: 'L6', tipo: 'lectura', esFacil: false, distractorIds: [], opciones: 1 }));
    // el último ensayo de la sesión debe seguir siendo uno que el niño hace bien
    if (extras.length) plan.ensayos.splice(Math.max(1, plan.ensayos.length - 1), 0, ...extras);
  }

  let estado = iniciarCurso(plan);
  const porId = new Map(elementos.map((e) => [e.id, e]));
  const consignasDichas = new Set();
  const posiciones = [];
  let visual = null;
  let intento = null;
  let ultimoElogio = null;

  function preparar(ahoraMs) {
    const ensayo = ensayoActual(estado);
    if (!ensayo) {
      visual = null;
      intento = null;
      return null;
    }
    visual = ACTIVIDADES[ensayo.actividad].crearEnsayo({
      ensayo, palabras: porId, palabrasPorId, aleatorio, ultimasPosiciones: posiciones.slice(-2),
    });
    // La consigna se dice la primera vez de cada actividad (o siempre, si cambia en cada ensayo)
    visual.decirConsigna = Boolean(visual.consignaSiempre) || !consignasDichas.has(ensayo.actividad);
    consignasDichas.add(ensayo.actividad);
    posiciones.push(visual.posicionCorrecta);
    intento = MODOS[visual.modo].crear(visual, ahoraMs);
    return visual;
  }

  const conAyudaAhora = () => (visual.modo === 'lectura' ? intento.repeticiones > 0 : intento.errores.length > 0);

  // Todas las imágenes que hay que tener listas para mostrar esta sesión
  const idsDeMedios = new Set();
  for (const e of elementos) {
    if (e.medioImagenId) idsDeMedios.add(e.medioImagenId);
    if (e.medioSimboloId) idsDeMedios.add(e.medioSimboloId);
    for (const parte of e.partes ?? []) if (parte.medioImagenId) idsDeMedios.add(parte.medioImagenId);
  }

  return {
    ajustes,
    plan,
    etapa,
    /** Los elementos de la etapa (palabras o frases), por id: es lo que dibujan las actividades. */
    palabras: porId,
    /** Todas las palabras del niño por id (para decir una frase palabra por palabra). */
    palabrasPorId,
    idsDeMedios: [...idsDeMedios],

    get terminada() { return estado.terminada; },
    get fatiga() { return estado.fatiga; },
    get ensayosHechos() { return estado.resultados.length; },

    /** Presenta el primer ensayo. null si no hay nada que practicar. */
    iniciar: (ahoraMs) => preparar(ahoraMs),

    /** Ensayo visual que se está jugando. */
    actual: () => visual,

    /**
     * Un toque. Con 'ayuda' la pantalla atenúa `atenuadas`, ilumina la correcta (`correctaId`, o
     * `siguienteId` en una secuencia) y repite lo dicho; con 'paso' (solo secuencias) coloca la ficha
     * `fichaId`; con 'correcto' celebra (`elogio`) y luego llama a `avanzar`.
     */
    tocar(entrada, ahoraMs) {
      if (!intento) return { efecto: 'ignorado', atenuadas: [], correctaId: null };
      const r = MODOS[visual.modo].tocar(intento, entrada, ahoraMs);
      intento = r.intento;
      const salida = { efecto: r.efecto, atenuadas: [...(intento.atenuadas ?? [])], correctaId: visual.correctaId };
      if (visual.modo === 'secuencia') {
        salida.fichaId = entrada;
        if (r.efecto === 'ayuda') salida.siguienteId = fichaSiguiente(intento);
      }
      if (r.efecto === 'correcto') {
        ultimoElogio = elegirElogio(ultimoElogio, aleatorio);
        salida.elogio = ultimoElogio;
        salida.conAyuda = conAyudaAhora();
      }
      return salida;
    },

    /**
     * Cierra el ensayo ya acertado: actualiza progreso y nivel y prepara el siguiente.
     * @returns { guardar: { progreso, nivel (null en «leo en voz alta») }, siguiente, terminada, fatiga }
     */
    avanzar(ahoraMs) {
      if (!intento || intento.estado !== 'acertado') throw new Error('El ensayo actual aún no se resolvió');
      const resultado = resultadoDelIntento(intento);
      const ensayo = ensayoActual(estado);
      const idP = idProgreso(perfil.id, ensayo.elementoId, ensayo.actividad);
      const idN = idNivel(perfil.id, ensayo.actividad);
      const esLectura = ensayo.tipo === 'lectura';
      const { progreso, nivel } = aplicarResultado({
        progreso: mapaProgresos.get(idP) ?? nuevoProgreso({ perfilId: perfil.id, elementoId: ensayo.elementoId, actividad: ensayo.actividad }),
        nivel: mapaNiveles.get(idN) ?? nuevoNivel(perfil.id, ensayo.actividad),
        resultado: { fecha: reloj(), correctoAlPrimerIntento: resultado.correctoAlPrimerIntento, opciones: visual.opciones },
        maxOpciones: ajustes.maxOpciones,
        contarParaNivel: !ensayo.esFacil && !esLectura,
      });
      mapaProgresos.set(idP, progreso);
      if (!esLectura) mapaNiveles.set(idN, nivel);

      estado = registrarRespuesta(estado, resultado);
      const siguiente = estado.terminada ? null : preparar(ahoraMs);
      if (estado.terminada) {
        visual = null;
        intento = null;
      }
      return { guardar: { progreso, nivel: esLectura ? null : nivel }, siguiente, terminada: estado.terminada, fatiga: estado.fatiga };
    },

    /** Datos de la sesión para guardar (completa o interrumpida). */
    registro: ({ inicio, fin }) => construirRegistroSesion(estado, { perfilId: perfil.id, inicio, fin }),
    resumen: () => resumenDeSesion(estado),
  };
}

/** ¿Hay algo que practicar hoy? (para mostrar u ocultar el botón de jugar). */
export function hayQuePracticar(datos) {
  return !crearControlador(datos).terminada;
}
