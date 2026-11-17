// Controlador de la sesión de escritura (Ampliación 5, fase 28). Hace por la escritura lo que `core/controlador.js` por la lectura y
// comparte con él todo lo común: el avance de la sesión (`iniciarCurso`/`registrarRespuesta`, con la fatiga), el resultado de un
// intento, los elogios y el motor de progreso. No toca el DOM ni el almacenamiento: la pantalla (fase 29) solo dibuja, habla,
// vibra y guarda lo que él devuelve.
//
//   const ctl = crearControladorEscritura({ perfil, palabras, progresos, niveles });
//   let ensayo = ctl.iniciar(ahoraMs);                       // ensayo visual: cajas y piezas (o null si no hay nada que escribir)
//   const r = ctl.soltar({ fichaId, hueco, forma }, ahoraMs);  // { efecto: 'ignorado'|'correcto'|'incorrecto', completo, ayuda, … }
//   ctl.escuchar(fichaId, ahoraMs);                          // tocar una pieza para oírla
//   const sig = ctl.avanzar(ahoraMs);                        // tras completar: { guardar, siguiente, terminada, fatiga }
//
// Perfil de prueba (modo administrador): `perfilId = idDePrueba(perfil.id)` y los progresos/niveles de esa ficha. El perfil real
// solo pone los ajustes y el contenido; nada de lo que se guarda lleva su id.

import { elegirElogio } from '../elogios.js';
import { resultadoDelIntento } from '../intento.js';
import { nuevoId } from '../id.js';
import { normalizarAjustes } from '../modelos.js';
import { idNivel, idProgreso, nuevoProgreso } from '../progreso.js';
import { construirRespuestaEscritura } from '../registro.js';
import { construirRegistroSesion, ensayoActual, iniciarCurso, registrarRespuesta, resumenDeSesion } from '../sesion.js';
import { esIdDePrueba } from '../curso.js';
import { ayudaActual, crearIntentoEscritura, escuchar as escucharPieza, soltar as soltarPieza } from './intento.js';
import {
  aplicarResultadoEscritura, armarEnsayoEscritura, crearSesionEscritura, extrasEfectivos, nuevoNivelEscritura,
} from './sesion.js';

export function crearControladorEscritura({
  perfil, perfilId = perfil.id, palabras, progresos = [], niveles = [], nivel = null, nivelElegidoPorNino = false, dificultades = new Map(),
  hoy = new Date(), aleatorio = Math.random, reloj = () => new Date(), sesionId = nuevoId(),
}) {
  const ajustes = normalizarAjustes(perfil.ajustes);
  const mapaProgresos = new Map(progresos.map((p) => [p.id, p]));
  const mapaNiveles = new Map(niveles.map((n) => [n.id, n]));
  const clave = (elementoId, actividad) => `${elementoId}:${actividad}`;
  const porClave = new Map(palabras.map((e) => [clave(e.id, e.nivel), e]));

  const plan = crearSesionEscritura({ perfil, perfilId, palabras, progresos, niveles, nivel, hoy, aleatorio, dificultades });
  let estado = iniciarCurso(plan);
  let visual = null;
  let intento = null;
  let ultimoElogio = null;
  let repeticionesAudio = 0; // veces que pidió oír la palabra otra vez, en el ensayo actual

  function preparar(ahoraMs) {
    const ensayo = ensayoActual(estado);
    repeticionesAudio = 0;
    if (!ensayo) {
      visual = null;
      intento = null;
      return null;
    }
    const elemento = porClave.get(clave(ensayo.elementoId, ensayo.actividad));
    visual = armarEnsayoEscritura({ ensayo, elemento, ajustes: perfil.ajustes, aleatorio });
    visual.ensayo = ensayo;
    visual.elemento = elemento;
    intento = crearIntentoEscritura(visual, ahoraMs);
    return visual;
  }

  // Imágenes que hay que tener listas esta sesión
  const idsDeMedios = new Set();
  for (const e of palabras) {
    if (e.medioImagenId) idsDeMedios.add(e.medioImagenId);
    if (e.medioSimboloId) idsDeMedios.add(e.medioSimboloId);
  }

  return {
    ajustes,
    plan,
    nivel: plan.nivel,
    perfilId,
    esPrueba: esIdDePrueba(perfilId),
    palabras: porClave,
    idsDeMedios: [...idsDeMedios],

    get terminada() { return estado.terminada; },
    get fatiga() { return estado.fatiga; },
    get ensayosHechos() { return estado.resultados.length; },

    /** Presenta el primer ensayo. null si no hay nada que escribir. */
    iniciar: (ahoraMs) => preparar(ahoraMs),
    /** Ensayo visual que se está jugando. */
    actual: () => visual,
    /** Estado del intento en curso (cajas llenas, errores…): la pantalla lo dibuja. */
    intento: () => intento,

    /**
     * Una pieza se suelta (o se toca para ponerla) en una caja. `efecto`: 'ignorado' | 'correcto' (queda puesta, verde) |
     * 'incorrecto' (vuelve a su lugar; `colorError` dice cómo se ve). `ayuda`: `{ hueco, fichaId }` cuando la pieza correcta debe
     * iluminarse (tras 2 errores en la misma caja). Con `completo`, la palabra está armada: `elogio` y luego `avanzar`.
     */
    soltar(entrada, ahoraMs) {
      if (!intento) return { efecto: 'ignorado', completo: false, ayuda: null };
      const r = soltarPieza(intento, entrada, ahoraMs);
      intento = r.intento;
      const salida = {
        efecto: r.efecto, completo: r.completo, fichaId: entrada.fichaId, hueco: entrada.hueco, ayuda: ayudaActual(intento),
        colorError: ajustes.escritura.colorError,
      };
      if (r.completo) {
        ultimoElogio = elegirElogio(ultimoElogio, aleatorio);
        salida.elogio = ultimoElogio;
        salida.conAyuda = intento.errores.length > 0;
      }
      return salida;
    },

    /** Tocar una pieza (sin ponerla) para oír su sonido: se anota, no es un error. */
    escuchar(fichaId, ahoraMs) {
      if (!intento) return { efecto: 'ignorado' };
      const r = escucharPieza(intento, fichaId, ahoraMs);
      intento = r.intento;
      return { efecto: r.efecto };
    },

    /** El niño tocó el altavoz o el modelo para volver a oír la palabra. */
    oirOtraVez() {
      if (intento && intento.estado !== 'acertado') repeticionesAudio += 1;
    },

    sesionId,

    /**
     * Cierra el ensayo ya armado: actualiza progreso y nivel de extras y prepara el siguiente.
     * @returns { guardar: { progreso, nivel, respuesta }, siguiente, terminada, fatiga }
     */
    avanzar(ahoraMs) {
      if (!intento || intento.estado !== 'acertado') throw new Error('El ensayo actual aún no se resolvió');
      const resultado = resultadoDelIntento(intento);
      const ensayo = ensayoActual(estado);
      const elemento = visual.elemento;
      const idP = idProgreso(perfilId, ensayo.elementoId, ensayo.actividad);
      const idN = idNivel(perfilId, ensayo.actividad);
      const progresoAntes = mapaProgresos.get(idP) ?? nuevoProgreso({ perfilId, elementoId: ensayo.elementoId, actividad: ensayo.actividad });
      const nivelAntes = mapaNiveles.get(idN) ?? nuevoNivelEscritura(perfilId, ensayo.actividad);
      const fecha = reloj();
      const { progreso, nivel: nivelDespues } = aplicarResultadoEscritura({
        progreso: progresoAntes,
        nivel: nivelAntes,
        resultado: { fecha, correctoAlPrimerIntento: resultado.correctoAlPrimerIntento, opciones: visual.opciones, esFacil: Boolean(ensayo.esFacil) },
        maxExtras: ajustes.escritura.maxSilabasExtra,
        contarParaNivel: !ensayo.esFacil && ensayo.tipo !== 'cierre',
        avanceRapido: ajustes.avanceRapido,
      });
      mapaProgresos.set(idP, progreso);
      mapaNiveles.set(idN, nivelDespues);

      const respuesta = construirRespuestaEscritura({
        perfilId,
        sesionId,
        numeroEnSesion: estado.resultados.length + 1,
        fecha,
        ensayo,
        elemento,
        visual,
        intento,
        progresoAntes,
        progresoDespues: progreso,
        nivelExtras: extrasEfectivos(nivelAntes, perfil.ajustes),
        repeticionesAudio,
        fatigaActiva: Boolean(estado.cierre),
        primeraVez: progresoAntes.historial.length === 0,
      });

      estado = registrarRespuesta(estado, resultado);
      const siguiente = estado.terminada ? null : preparar(ahoraMs);
      if (estado.terminada) {
        visual = null;
        intento = null;
      }
      return { guardar: { progreso, nivel: nivelDespues, respuesta }, siguiente, terminada: estado.terminada, fatiga: estado.fatiga };
    },

    /** Datos de la sesión para guardar (completa o interrumpida): lleva `tipo: 'escritura'` y el nivel jugado. */
    registro: ({ inicio, fin, interrumpida = false }) => ({
      id: sesionId,
      ...construirRegistroSesion(estado, { perfilId, inicio, fin }),
      tipo: 'escritura',
      nivel: plan.nivel,
      ...(nivelElegidoPorNino ? { nivelElegidoPorNino: true } : {}),
      ...(interrumpida ? { interrumpida: true } : {}),
    }),
    resumen: () => resumenDeSesion(estado),
  };
}

/** ¿Hay algo que escribir hoy? (para mostrar u ocultar el botón). */
export function hayQueEscribir(datos) {
  return !crearControladorEscritura(datos).terminada;
}
