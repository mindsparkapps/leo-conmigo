// Controlador de la sesión del niño. Junta el motor (crearSesion / registrarRespuesta), las
// actividades y los toques, y le dice a la pantalla QUÉ hacer. No toca el DOM ni el almacenamiento:
// así toda la sesión se prueba en Node. La pantalla solo dibuja, habla, vibra y guarda lo que él devuelve.
//
//   const ctl = crearControlador({ perfil, palabras, progresos, niveles });
//   let ensayo = ctl.iniciar(ahoraMs);                // ensayo visual (o null si no hay nada que practicar)
//   const r = ctl.tocar(cartaId, ahoraMs);            // { efecto: 'ignorado'|'ayuda'|'correcto', ... }
//   const sig = ctl.avanzar(ahoraMs);                 // tras un acierto: { guardar, siguiente, terminada, fatiga }

import { ACTIVIDADES } from '../actividades/indice.js';
import { ACTIVIDADES_POR_ETAPA } from './etapas.js';
import { elegirElogio } from './elogios.js';
import { crearIntento, tocar as tocarIntento, resultadoDelIntento } from './intento.js';
import { normalizarAjustes } from './modelos.js';
import { aplicarResultado, idNivel, idProgreso, nuevoNivel, nuevoProgreso } from './progreso.js';
import { construirRegistroSesion, crearSesion, ensayoActual, iniciarCurso, registrarRespuesta, resumenDeSesion } from './sesion.js';

/** Una palabra solo se practica si se puede mostrar: con foto/pictograma o, al menos, con emoji. */
export function esPracticable(palabra) {
  return !palabra.deleted && palabra.activa !== false && Boolean(palabra.medioImagenId || palabra.emoji);
}

/** Actividades de la etapa que ya están hechas (si la etapa no existe aún, se usa la 1). */
export function actividadesDeLaEtapa(etapa = 1) {
  const hechas = (ACTIVIDADES_POR_ETAPA[etapa] ?? []).filter((a) => ACTIVIDADES[a]);
  return hechas.length ? [...hechas] : [...ACTIVIDADES_POR_ETAPA[1]];
}

export function crearControlador({
  perfil, palabras, progresos = [], niveles = [], hoy = new Date(), aleatorio = Math.random, reloj = () => new Date(),
}) {
  const ajustes = normalizarAjustes(perfil.ajustes);
  const practicables = palabras.filter(esPracticable);
  const plan = crearSesion({
    perfil, elementos: practicables, progresos, niveles, actividades: actividadesDeLaEtapa(perfil.etapaActual ?? 1), hoy, aleatorio,
  });
  let estado = iniciarCurso(plan);

  const porId = new Map(practicables.map((p) => [p.id, p]));
  const mapaProgresos = new Map(progresos.map((p) => [p.id, p]));
  const mapaNiveles = new Map(niveles.map((n) => [n.id, n]));
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
      ensayo, palabras: porId, aleatorio, ultimasPosiciones: posiciones.slice(-2),
    });
    visual.decirConsigna = !consignasDichas.has(ensayo.actividad); // la consigna se dice la primera vez de cada actividad
    consignasDichas.add(ensayo.actividad);
    posiciones.push(visual.posicionCorrecta);
    intento = crearIntento(visual, ahoraMs);
    return visual;
  }

  return {
    ajustes,
    plan,
    palabras: porId,

    get terminada() { return estado.terminada; },
    get fatiga() { return estado.fatiga; },
    get ensayosHechos() { return estado.resultados.length; },

    /** Presenta el primer ensayo. null si no hay nada que practicar. */
    iniciar: (ahoraMs) => preparar(ahoraMs),

    /** Ensayo visual que se está jugando. */
    actual: () => visual,

    /**
     * Un toque sobre una opción. Con 'ayuda' la pantalla atenúa `atenuadas`, ilumina `correctaId` y repite la palabra;
     * con 'correcto' celebra (`elogio`) y luego llama a `avanzar`.
     */
    tocar(opcionId, ahoraMs) {
      if (!intento) return { efecto: 'ignorado', atenuadas: [], correctaId: null };
      const r = tocarIntento(intento, opcionId, ahoraMs);
      intento = r.intento;
      const salida = { efecto: r.efecto, atenuadas: [...intento.atenuadas], correctaId: visual.correctaId };
      if (r.efecto === 'correcto') {
        ultimoElogio = elegirElogio(ultimoElogio, aleatorio);
        salida.elogio = ultimoElogio;
        salida.conAyuda = intento.errores.length > 0;
      }
      return salida;
    },

    /**
     * Cierra el ensayo ya acertado: actualiza progreso y nivel y prepara el siguiente.
     * @returns { guardar: { progreso, nivel }, siguiente (ensayo visual o null), terminada, fatiga }
     */
    avanzar(ahoraMs) {
      if (!intento || intento.estado !== 'acertado') throw new Error('El ensayo actual aún no se resolvió');
      const resultado = resultadoDelIntento(intento);
      const ensayo = ensayoActual(estado);
      const idP = idProgreso(perfil.id, ensayo.elementoId, ensayo.actividad);
      const idN = idNivel(perfil.id, ensayo.actividad);
      const { progreso, nivel } = aplicarResultado({
        progreso: mapaProgresos.get(idP) ?? nuevoProgreso({ perfilId: perfil.id, elementoId: ensayo.elementoId, actividad: ensayo.actividad }),
        nivel: mapaNiveles.get(idN) ?? nuevoNivel(perfil.id, ensayo.actividad),
        resultado: { fecha: reloj(), correctoAlPrimerIntento: resultado.correctoAlPrimerIntento, opciones: visual.cartas.length },
        maxOpciones: ajustes.maxOpciones,
        contarParaNivel: !ensayo.esFacil,
      });
      mapaProgresos.set(idP, progreso);
      mapaNiveles.set(idN, nivel);

      estado = registrarRespuesta(estado, resultado);
      const siguiente = estado.terminada ? null : preparar(ahoraMs);
      if (estado.terminada) {
        visual = null;
        intento = null;
      }
      return { guardar: { progreso, nivel }, siguiente, terminada: estado.terminada, fatiga: estado.fatiga };
    },

    /** Datos de la sesión para guardar (completa o interrumpida). */
    registro: ({ inicio, fin }) => construirRegistroSesion(estado, { perfilId: perfil.id, inicio, fin }),
    resumen: () => resumenDeSesion(estado),
  };
}
