// Niño virtual para probar el motor completo (no es una prueba: no termina en .test.js).
// Usa crearSesion + registrarRespuesta + aplicarResultado igual que lo hará la interfaz.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearAleatorio } from '../js/core/azar.js';
import { crearControladorEscritura } from '../js/core/escritura/controlador.js';
import { elementosDeEscritura } from '../js/core/escritura/elementos.js';
import { nivelSiguiente } from '../js/core/escritura/niveles.js';
import { evaluarAutoajusteEscritura } from '../js/core/autoajuste.js';
import { crearSesion, iniciarCurso, ensayoActual, registrarRespuesta, violacionesDeOrden } from '../js/core/sesion.js';
import { aplicarResultado, claveDia, idNivel, idProgreso, nuevoNivel, nuevoProgreso } from '../js/core/progreso.js';
import { contarDominadas } from '../js/core/etapas.js';
import { ACTIVIDADES, PERFIL_ID, perfil, vocabulario } from './ayudas.js';

/**
 * Mínimo de violaciones de orden posible con el primer y el último ensayo fijos.
 * Fuerza bruta sobre el medio (con poda): sirve para secuencias de hasta ~10 ensayos.
 */
export function minimoViolaciones(ensayos) {
  const primero = ensayos[0];
  const ultimo = ensayos.at(-1);
  const medio = ensayos.slice(1, -1);
  const usado = new Array(medio.length).fill(false);
  const actual = [primero];
  let mejor = Infinity;

  function recorrer() {
    if (actual.length === medio.length + 1) {
      mejor = Math.min(mejor, violacionesDeOrden([...actual, ultimo]));
      return;
    }
    const probadas = new Set();
    for (let i = 0; i < medio.length; i++) {
      if (usado[i]) continue;
      const ficha = `${medio[i].elementoId}:${medio[i].actividad}`;
      if (probadas.has(ficha)) continue; // fichas iguales: no repetir ramas
      probadas.add(ficha);
      usado[i] = true;
      actual.push(medio[i]);
      if (violacionesDeOrden(actual) < mejor) recorrer();
      actual.pop();
      usado[i] = false;
    }
  }
  recorrer();
  return ensayos.length < 3 ? violacionesDeOrden(ensayos) : mejor;
}

/**
 * Niño virtual: en cada palabra y actividad acierta con probabilidad
 * `inicio + aprendizaje * veces_practicadas` (tope 0,95). Los repasos de lo dominado
 * salen bien un 90 % de las veces.
 *
 * @param dias            días de calendario a simular (se descansa 1 día por semana)
 * @param aprendizaje     cuánto sube la probabilidad de acierto con cada exposición
 * @param inicio          probabilidad de acierto la primera vez
 * @param ajustes         ajustes del perfil (ensayosPorSesion, maxOpciones, ...)
 * @param revisar         si es true, comprueba invariantes en cada sesión
 */
export function simular({
  dias = 40, semilla = 1, aprendizaje = 0.08, inicio = 0.4, palabras = 14, ajustes = {}, revisar = true, alPlan = null,
  avanceRapido = false, conocidas = 0, dificultades = new Map(),
} = {}) {
  const azar = crearAleatorio(semilla);
  const elementos = vocabulario(palabras);
  const progresos = new Map();
  const niveles = new Map();
  const exposiciones = new Map();
  const stats = { sesiones: 0, ensayos: 0, fatigas: 0, ensayosPorTipo: {}, dominadasL4PorSesion: [], maxOpciones: 0 };
  const ensayosPorSesion = ajustes.ensayosPorSesion ?? 8;

  for (let dia = 0; dia < dias; dia++) {
    if (dia % 7 === 6) continue; // un día sin practicar por semana
    const hoy = new Date(2026, 9, 1 + dia, 10, 0, 0);
    const plan = crearSesion({
      perfil: perfil(ajustes),
      elementos,
      progresos: [...progresos.values()],
      niveles: [...niveles.values()],
      actividades: ACTIVIDADES,
      hoy,
      aleatorio: azar,
      dificultades,
    });
    if (plan.ensayos.length === 0) break;
    if (alPlan) alPlan(plan, dia);

    if (revisar) {
      const secuencia = plan.ensayos;
      assert.equal(secuencia.length, ensayosPorSesion, `día ${dia}: cantidad de ensayos`);
      // Nunca la misma palabra dos veces seguidas, salvo que sea imposible
      // (una palabra con más de la mitad de los ensayos).
      const porPalabra = {};
      for (const e of secuencia) porPalabra[e.elementoId] = (porPalabra[e.elementoId] ?? 0) + 1;
      if (Math.max(...Object.values(porPalabra)) <= Math.ceil(secuencia.length / 2)) {
        for (let i = 1; i < secuencia.length; i++) {
          assert.notEqual(secuencia[i].elementoId, secuencia[i - 1].elementoId, `día ${dia}: palabra repetida seguida`);
        }
      }
      // Máximo 3 seguidos de la misma actividad: a veces es imposible (al principio todo es L1).
      // Lo que se exige es que el orden elegido sea el mejor que existe.
      if (secuencia.length <= 10) {
        assert.equal(violacionesDeOrden(secuencia), minimoViolaciones(secuencia), `día ${dia}: había un orden mejor`);
      }
    }

    let estado = iniciarCurso(plan);
    while (!estado.terminada) {
      const ensayo = ensayoActual(estado);
      const claveExpo = `${ensayo.elementoId}:${ensayo.actividad}`;
      const veces = exposiciones.get(claveExpo) ?? 0;
      let p = Math.min(0.95, inicio + aprendizaje * veces);
      if (elementos.findIndex((e) => e.id === ensayo.elementoId) < conocidas) p = 0.97; // una palabra que ya conoce
      if (ensayo.tipo === 'repaso') p = 0.9;
      if (ensayo.tipo === 'cierre') p = 0.95;
      const correcto = azar() < p;
      exposiciones.set(claveExpo, veces + 1);

      const idP = idProgreso(PERFIL_ID, ensayo.elementoId, ensayo.actividad);
      const idN = idNivel(PERFIL_ID, ensayo.actividad);
      const res = aplicarResultado({
        progreso: progresos.get(idP) ?? nuevoProgreso({ perfilId: PERFIL_ID, elementoId: ensayo.elementoId, actividad: ensayo.actividad }),
        nivel: niveles.get(idN) ?? nuevoNivel(PERFIL_ID, ensayo.actividad),
        resultado: { fecha: new Date(hoy.getTime() + stats.ensayos * 1000), correctoAlPrimerIntento: correcto, opciones: ensayo.opciones, esFacil: Boolean(ensayo.esFacil) },
        maxOpciones: ajustes.maxOpciones,
        contarParaNivel: !ensayo.esFacil,
        avanceRapido,
      });
      progresos.set(idP, res.progreso);
      niveles.set(idN, res.nivel);
      stats.ensayos += 1;
      stats.ensayosPorTipo[ensayo.tipo] = (stats.ensayosPorTipo[ensayo.tipo] ?? 0) + 1;
      stats.maxOpciones = Math.max(stats.maxOpciones, ensayo.opciones);
      estado = registrarRespuesta(estado, { correctoAlPrimerIntento: correcto, intentos: correcto ? 1 : 2, ms: 1500 });
    }
    stats.sesiones += 1;
    if (estado.fatiga) stats.fatigas += 1;
    stats.dominadasL4PorSesion.push(contarDominadas([...progresos.values()], 'L4'));
  }

  const lista = [...progresos.values()];
  return {
    ...stats,
    progresos: lista,
    niveles: [...niveles.values()],
    dominadasL1: contarDominadas(lista, 'L1'),
    dominadasL4: contarDominadas(lista, 'L4'),
    palabrasConProgreso: new Set(lista.map((p) => p.elementoId)).size,
    ultimoDia: claveDia(new Date(2026, 9, dias)),
  };
}

// ─── Niño virtual que escribe (Ampliación 5, fase 28) ───────────────────────────────────────────────────────────

const BANCO = JSON.parse(readFileSync(new URL('../data/escritura/banco.json', import.meta.url), 'utf8'));

/**
 * Niño virtual de escritura: usa el controlador de escritura completo (sesión, intento, progreso, nivel de extras) y el autoajuste
 * al terminar cada sesión, como lo hará la pantalla. En cada palabra acierta al primer intento con probabilidad
 * `inicio + aprendizaje * veces_vista` (tope 0,95); los repasos, un 90 %. Si falla, comete UN error y luego la arma bien.
 * Mide cuántas sesiones tarda en pasar del nivel `desde` al siguiente (`sesionesHastaE03` si `desde` es E02).
 *
 * @param dias, semilla, aprendizaje, inicio  como en `simular`
 * @param desde         nivel de partida (por defecto E02)
 * @param avanceRapido  como el ajuste del perfil (por defecto true, igual que la app)
 * @param ajustesEscritura  ajustes de escritura del perfil (palabrasPorSesion, maxSilabasExtra…)
 */
export function simularEscritura({
  dias = 60, semilla = 1, aprendizaje = 0.08, inicio = 0.4, desde = 'E02', avanceRapido = true, ajustesEscritura = {},
} = {}) {
  const azar = crearAleatorio(semilla);
  const elementos = elementosDeEscritura({ banco: BANCO });
  const progresos = new Map();
  const niveles = new Map();
  const exposiciones = new Map();
  const sesiones = [];
  let perfilActual = { id: PERFIL_ID, ajustes: { avanceRapido, escritura: { nivelEscritura: desde, ...ajustesEscritura } }, cambiosAutomaticos: [] };
  const stats = { sesiones: 0, ensayos: 0, fatigas: 0, violaciones: 0, sesionesHastaE03: null, diasHastaE03: null, palabrasPorSesion: [], extrasMaximos: 0 };
  let ms = 0;
  const siguienteNivel = nivelSiguiente(desde);

  for (let dia = 0; dia < dias; dia++) {
    if (dia % 7 === 6) continue; // un día sin practicar por semana
    const hoy = new Date(2026, 9, 1 + dia, 10, 0, 0);
    let reloj = hoy.getTime();
    const ctl = crearControladorEscritura({
      perfil: perfilActual, palabras: elementos, progresos: [...progresos.values()], niveles: [...niveles.values()], hoy, aleatorio: azar,
      reloj: () => new Date(reloj), sesionId: `sim${dia}`,
    });
    let visual = ctl.iniciar(ms);
    if (!visual) break;
    const secuencia = ctl.plan.ensayos;
    stats.violaciones += violacionesDeOrden(secuencia, Infinity);
    stats.palabrasPorSesion.push(secuencia.length);
    const inicioSesion = new Date(reloj);
    while (visual) {
      const ensayo = visual.ensayo;
      const clave = `${ensayo.elementoId}:${ensayo.actividad}`;
      const veces = exposiciones.get(clave) ?? 0;
      let p = Math.min(0.95, inicio + aprendizaje * veces);
      if (ensayo.tipo === 'repaso') p = 0.9;
      if (ensayo.tipo === 'cierre') p = 0.95;
      const acierta = azar() < p;
      exposiciones.set(clave, veces + 1);
      stats.extrasMaximos = Math.max(stats.extrasMaximos, visual.extras);
      // el niño arma la palabra; si no acierta al primer intento, se equivoca una vez (cuando hay otra pieza que probar)
      const libres = () => ctl.intento().fichas.filter((f) => !ctl.intento().colocadas.includes(f.id));
      if (!acierta) {
        const mala = libres().find((f) => f.texto.toLowerCase() !== visual.huecos[0].toLowerCase());
        if (mala) { ms += 600; ctl.soltar({ fichaId: mala.id, hueco: 0, forma: 'toque' }, ms); }
      }
      for (let h = 0; h < visual.huecos.length; h++) {
        const ficha = libres().find((f) => f.texto.toLowerCase() === visual.huecos[h].toLowerCase());
        ms += 600;
        ctl.soltar({ fichaId: ficha.id, hueco: h, forma: 'toque' }, ms);
      }
      reloj += 20000; // una palabra tarda ~20 s
      const r = ctl.avanzar(ms + 600);
      ms += 600;
      progresos.set(r.guardar.progreso.id, r.guardar.progreso);
      niveles.set(r.guardar.nivel.id, r.guardar.nivel);
      stats.ensayos += 1;
      visual = r.siguiente;
    }
    const sesion = ctl.registro({ inicio: inicioSesion, fin: new Date(reloj) });
    sesiones.push(sesion);
    stats.sesiones += 1;
    if (sesion.fatiga) stats.fatigas += 1;
    // autoajuste al terminar la sesión
    const evaluado = evaluarAutoajusteEscritura({ perfil: perfilActual, sesiones, elementos, progresos: [...progresos.values()], hoy });
    perfilActual = evaluado.perfil;
    if (stats.sesionesHastaE03 === null && siguienteNivel && perfilActual.ajustes.escritura.nivelEscritura === siguienteNivel) {
      stats.sesionesHastaE03 = stats.sesiones;
      stats.diasHastaE03 = dia + 1;
    }
  }
  const lista = [...progresos.values()];
  return {
    ...stats,
    nivelFinal: perfilActual.ajustes.escritura.nivelEscritura,
    palabrasPorSesionFinal: perfilActual.ajustes.escritura.palabrasPorSesion,
    progresos: lista,
    niveles: [...niveles.values()],
    sesionesGuardadas: sesiones,
    cambios: perfilActual.cambiosAutomaticos,
  };
}
