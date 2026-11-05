import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS, INTERVALOS_LEITNER, MAX_HISTORIAL,
  claveDia, sumarDias, nuevoProgreso, cumpleDominio, estaVencido, registrarEnsayo, tasaAciertoHistorial,
  nuevoNivel, precision, registrarEnNivel, esNivelFacil, opcionesEfectivas, aplicarResultado,
  idProgreso, idNivel,
} from '../js/core/progreso.js';
import { crearAleatorio } from '../js/core/azar.js';

// Ensayo del día `dia` de noviembre de 2026 (hora local)
const E = (dia, ok, hora = '10:00:00') => ({
  fecha: `2026-11-${String(dia).padStart(2, '0')}T${hora}`,
  correctoAlPrimerIntento: ok,
  opciones: 2,
});
const aplicar = (progreso, ensayos) => ensayos.reduce((p, e) => registrarEnsayo(p, e), progreso);
const vacio = () => nuevoProgreso({ perfilId: 'p1', elementoId: 'w1', actividad: 'L1' });

// ---------- fechas ----------

test('claveDia y sumarDias: cambios de mes, año y bisiesto', () => {
  assert.equal(claveDia('2026-11-05T10:00:00'), '2026-11-05');
  assert.equal(sumarDias('2026-11-30', 1), '2026-12-01');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');
  assert.equal(sumarDias('2026-11-05', 16), '2026-11-21');
  assert.throws(() => claveDia('no es fecha'), RangeError);
});

test('identificadores', () => {
  assert.equal(idProgreso('p', 'w', 'L4'), 'p:w:L4');
  assert.equal(idNivel('p', 'L4'), 'p:L4');
});

// ---------- dominio ----------

test('un elemento nuevo pasa a "práctica" con su primer ensayo', () => {
  const p = registrarEnsayo(vacio(), E(1, true));
  assert.equal(p.estado, ESTADOS.PRACTICA);
  assert.equal(p.historial.length, 1);
});

test('4 aciertos el mismo día NO dominan (hacen falta 2 días distintos)', () => {
  const p = aplicar(vacio(), [E(1, true, '09:00:00'), E(1, true, '10:00:00'), E(1, true, '11:00:00'), E(1, true, '12:00:00')]);
  assert.equal(p.estado, ESTADOS.PRACTICA);
});

test('4 aciertos repartidos en 2 días distintos dominan', () => {
  const p = aplicar(vacio(), [E(1, true), E(1, true), E(2, true), E(2, true)]);
  assert.equal(p.estado, ESTADOS.DOMINADA);
  assert.equal(p.cajaLeitner, 1);
  assert.equal(p.proximoRepaso, '2026-11-03');
});

test('4 de los últimos 5 con un error en medio también dominan', () => {
  const p = aplicar(vacio(), [E(1, true), E(1, false), E(2, true), E(2, true), E(3, true)]);
  assert.equal(p.estado, ESTADOS.DOMINADA);
});

test('3 aciertos de 5 no dominan', () => {
  const p = aplicar(vacio(), [E(1, true), E(1, false), E(2, true), E(2, false), E(3, true)]);
  assert.equal(p.estado, ESTADOS.PRACTICA);
});

test('un error antiguo fuera de la ventana de 5 no cuenta', () => {
  const p = aplicar(vacio(), [E(1, false), E(1, true), E(2, true), E(2, true), E(3, true), E(3, true)]);
  assert.equal(p.estado, ESTADOS.DOMINADA);
});

test('cumpleDominio sobre un historial suelto', () => {
  assert.equal(cumpleDominio([]), false);
  assert.equal(cumpleDominio([E(1, true), E(2, true), E(3, true)]), false);
  assert.equal(cumpleDominio([E(1, true), E(2, true), E(3, true), E(4, true)]), true);
});

test('el historial guarda solo los últimos 10 ensayos', () => {
  const ensayos = Array.from({ length: 14 }, (_, i) => E(1 + (i % 3), i % 2 === 0));
  const p = aplicar(vacio(), ensayos);
  assert.equal(p.historial.length, MAX_HISTORIAL);
  assert.equal(p.historial.at(-1).fecha, ensayos.at(-1).fecha);
});

test('registrarEnsayo no modifica el objeto original', () => {
  const original = Object.freeze({ ...vacio(), historial: Object.freeze([]) });
  const nuevo = registrarEnsayo(original, E(1, true));
  assert.equal(original.historial.length, 0);
  assert.equal(original.estado, ESTADOS.NUEVA);
  assert.notEqual(nuevo, original);
});

test('tasaAciertoHistorial', () => {
  assert.equal(tasaAciertoHistorial([]), 0);
  assert.equal(tasaAciertoHistorial([E(1, true), E(1, false), E(1, true), E(1, true)]), 0.75);
});

// ---------- Leitner y retroceso ----------

function dominada() {
  return aplicar(vacio(), [E(1, true), E(1, true), E(2, true), E(2, true)]); // vence el día 3
}

test('Leitner: cada acierto en repaso vencido sube de caja (1, 2, 4, 8, 16 días) y se queda en la 5', () => {
  let p = dominada();
  assert.equal(p.cajaLeitner, 1);
  let dia = 3;
  const esperado = [
    { caja: 2, dias: 2 },
    { caja: 3, dias: 4 },
    { caja: 4, dias: 8 },
    { caja: 5, dias: 16 },
    { caja: 5, dias: 16 },
  ];
  for (const { caja, dias } of esperado) {
    assert.equal(estaVencido(p, claveDia(`2026-11-${String(dia).padStart(2, '0')}T10:00:00`)), true);
    p = registrarEnsayo(p, E(dia, true));
    assert.equal(p.cajaLeitner, caja);
    assert.equal(p.proximoRepaso, sumarDias(`2026-11-${String(dia).padStart(2, '0')}`, dias));
    dia += dias;
    if (dia > 30) break; // los intervalos suman más de un mes: alcanza para comprobar las cajas
  }
  assert.deepEqual([...INTERVALOS_LEITNER], [1, 2, 4, 8, 16]);
});

test('Leitner: un acierto antes de que venza el repaso no adelanta la caja', () => {
  const p = dominada(); // vence el 3
  const igual = registrarEnsayo(p, E(2, true, '18:00:00'));
  assert.equal(igual.cajaLeitner, 1);
  assert.equal(igual.proximoRepaso, '2026-11-03');
  assert.equal(igual.estado, ESTADOS.DOMINADA);
});

test('un error en repaso vuelve a la caja 1 y se repasa al día siguiente', () => {
  let p = dominada();
  p = registrarEnsayo(p, E(3, true)); // caja 2
  assert.equal(p.cajaLeitner, 2);
  p = registrarEnsayo(p, E(5, false));
  assert.equal(p.cajaLeitner, 1);
  assert.equal(p.proximoRepaso, '2026-11-06');
  assert.equal(p.estado, ESTADOS.DOMINADA);
});

test('dos errores seguidos en repaso devuelven la palabra a "práctica"', () => {
  let p = dominada();
  p = registrarEnsayo(p, E(3, false));
  assert.equal(p.estado, ESTADOS.DOMINADA);
  p = registrarEnsayo(p, E(4, false));
  assert.equal(p.estado, ESTADOS.PRACTICA);
  assert.equal(p.cajaLeitner, 1);
  assert.equal(p.proximoRepaso, null);
  assert.equal(p.fallosRepaso, 0);
});

test('error, acierto, error: no retrocede (los fallos deben ser seguidos)', () => {
  let p = dominada();
  p = registrarEnsayo(p, E(3, false));
  p = registrarEnsayo(p, E(4, true));
  p = registrarEnsayo(p, E(5, false));
  assert.equal(p.estado, ESTADOS.DOMINADA);
});

test('una palabra nunca pasa a "dominada" con un ensayo fallido (con cualquier secuencia)', () => {
  const azar = crearAleatorio(7);
  for (let intento = 0; intento < 300; intento++) {
    let p = vacio();
    for (let i = 0; i < 40; i++) {
      const dia = 1 + Math.floor(i / 3);
      const ok = azar() < 0.7;
      const antes = p.estado;
      p = registrarEnsayo(p, E(dia, ok));
      if (antes !== ESTADOS.DOMINADA && p.estado === ESTADOS.DOMINADA) {
        assert.equal(ok, true, 'se dominó con un ensayo fallido');
      }
    }
  }
});

test('tras dominar, el primer fallo no hace retroceder pero el segundo seguido sí', () => {
  const p = dominada();
  assert.equal(p.fallosRepaso, 0);
  const uno = registrarEnsayo(p, E(4, false));
  assert.equal(uno.estado, ESTADOS.DOMINADA);
  assert.equal(uno.fallosRepaso, 1);
  assert.equal(registrarEnsayo(uno, E(5, false)).estado, ESTADOS.PRACTICA);
});

test('estaVencido: solo las dominadas; sin fecha cuentan como vencidas', () => {
  const p = dominada(); // vence el 3
  assert.equal(estaVencido(p, '2026-11-02'), false);
  assert.equal(estaVencido(p, '2026-11-03'), true);
  assert.equal(estaVencido({ ...p, proximoRepaso: null }, '2026-11-01'), true);
  assert.equal(estaVencido(vacio(), '2030-01-01'), false);
});

// ---------- niveles (número de opciones) ----------

const nivel = (extra = {}) => ({ ...nuevoNivel('p1', 'L1'), ...extra });
const ronda = (n, niv, ok) => Array.from({ length: n }).reduce((acc) => registrarEnNivel(acc, ok), niv);
const mezcla = (niv, aciertos, fallos) => {
  let r = niv;
  for (let i = 0; i < aciertos; i++) r = registrarEnNivel(r, true);
  for (let i = 0; i < fallos; i++) r = registrarEnNivel(r, false);
  return r;
};

test('nivel inicial: 2 opciones', () => {
  assert.equal(nivel().opciones, 2);
  assert.equal(precision([]), null);
  assert.equal(precision([true, false, true, true]), 0.75);
});

test('10 aciertos suben una opción (2 -> 3 -> 4) y no pasan de 4', () => {
  let n = ronda(10, nivel(), true);
  assert.equal(n.opciones, 3);
  assert.deepEqual(n.ultimos, []); // la ventana se reinicia al cambiar de nivel
  n = ronda(10, n, true);
  assert.equal(n.opciones, 4);
  n = ronda(10, n, true);
  assert.equal(n.opciones, 4);
});

test('no cambia antes de reunir 10 ensayos', () => {
  assert.equal(ronda(9, nivel(), true).opciones, 2);
});

test('el umbral para subir es 80 % (8 de 10 sube, 7 de 10 no)', () => {
  assert.equal(mezcla(nivel(), 8, 2).opciones, 3);
  assert.equal(mezcla(nivel(), 7, 3).opciones, 2);
});

test('el umbral para bajar es menos de 50 % (4 de 10 baja, 5 de 10 no)', () => {
  assert.equal(mezcla(nivel({ opciones: 4 }), 4, 6).opciones, 3);
  assert.equal(mezcla(nivel({ opciones: 4 }), 5, 5).opciones, 4);
});

test('nunca baja de 2 opciones', () => {
  assert.equal(ronda(10, nivel({ opciones: 2 }), false).opciones, 2);
});

test('respeta el máximo de opciones que fijó el adulto', () => {
  let n = nivel();
  for (let i = 0; i < 10; i++) n = registrarEnNivel(n, true, 2);
  assert.equal(n.opciones, 2);
  n = nivel({ opciones: 4 });
  n = registrarEnNivel(n, true, 3); // el adulto bajó el máximo a 3
  assert.equal(n.opciones, 3);
});

test('esNivelFacil: 2 opciones, precisión baja o sin datos', () => {
  assert.equal(esNivelFacil(nivel({ opciones: 2 })), true);
  assert.equal(esNivelFacil(nivel({ opciones: 3, ultimos: [] })), true);
  assert.equal(esNivelFacil(nivel({ opciones: 3, ultimos: [true, true, false, false] })), true);
  assert.equal(esNivelFacil(nivel({ opciones: 3, ultimos: [true, true, true, true, false] })), false);
});

test('opcionesEfectivas', () => {
  assert.equal(opcionesEfectivas(nivel({ opciones: 4 }), 3), 3);
  assert.equal(opcionesEfectivas(nivel({ opciones: 3 }), 4), 3);
  assert.equal(opcionesEfectivas(undefined), 2);
});

test('aplicarResultado: actualiza progreso y nivel; los ensayos fáciles no cuentan para el nivel', () => {
  const entrada = E(1, true);
  const conNivel = aplicarResultado({ progreso: vacio(), nivel: nivel(), resultado: entrada });
  assert.equal(conNivel.progreso.historial.length, 1);
  assert.equal(conNivel.nivel.ultimos.length, 1);

  const sinNivel = aplicarResultado({ progreso: vacio(), nivel: nivel(), resultado: entrada, contarParaNivel: false });
  assert.equal(sinNivel.progreso.historial.length, 1);
  assert.equal(sinNivel.nivel.ultimos.length, 0);
});
