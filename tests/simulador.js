// Niño virtual para probar el motor completo (no es una prueba: no termina en .test.js).
// Usa crearSesion + registrarRespuesta + aplicarResultado igual que lo hará la interfaz.

import assert from 'node:assert/strict';
import { crearAleatorio } from '../js/core/azar.js';
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
export function simular({ dias = 40, semilla = 1, aprendizaje = 0.08, inicio = 0.4, palabras = 14, ajustes = {}, revisar = true, alPlan = null } = {}) {
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
      if (ensayo.tipo === 'repaso') p = 0.9;
      if (ensayo.tipo === 'cierre') p = 0.95;
      const correcto = azar() < p;
      exposiciones.set(claveExpo, veces + 1);

      const idP = idProgreso(PERFIL_ID, ensayo.elementoId, ensayo.actividad);
      const idN = idNivel(PERFIL_ID, ensayo.actividad);
      const res = aplicarResultado({
        progreso: progresos.get(idP) ?? nuevoProgreso({ perfilId: PERFIL_ID, elementoId: ensayo.elementoId, actividad: ensayo.actividad }),
        nivel: niveles.get(idN) ?? nuevoNivel(PERFIL_ID, ensayo.actividad),
        resultado: { fecha: new Date(hoy.getTime() + stats.ensayos * 1000), correctoAlPrimerIntento: correcto, opciones: ensayo.opciones },
        maxOpciones: ajustes.maxOpciones,
        contarParaNivel: !ensayo.esFacil,
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
