import test from 'node:test';
import assert from 'node:assert/strict';
import { claveSilaba, empiezanIgual, silabasDe, silabasDistractoras, anotarParaSilabas } from '../js/core/silabeo.js';
import { ESTADOS } from '../js/core/progreso.js';
import { PERFIL_ID, progresoCon } from './ayudas.js';
import { LEIDAS_SILABAS, palabrasSilabas } from './escenarios.js';

const leidas = (ids = LEIDAS_SILABAS) => ids.map((id) => progresoCon(id, 'L4', ESTADOS.DOMINADA, { proximoRepaso: '2026-12-31' }));
const anotar = (progresos = leidas()) => {
  const r = anotarParaSilabas({ perfilId: PERFIL_ID, palabras: palabrasSilabas(), progresos });
  return { ...r, por: new Map(r.elementos.map((e) => [e.id, e])) };
};

test('claveSilaba: sin tilde ni mayúsculas', () => {
  assert.equal(claveSilaba('Má'), 'ma');
  assert.equal(claveSilaba('ñu'), 'nu', 'la tilde de la ñ también se quita: solo sirve para comparar');
  assert.equal(claveSilaba('ma'), claveSilaba('má'));
});

test('silabasDe: usa las del adulto y, si faltan, divide sola', () => {
  assert.deepEqual(silabasDe({ texto: 'mamá', silabas: ['ma', 'má'] }), ['ma', 'má']);
  assert.deepEqual(silabasDe({ texto: 'pelota' }), ['pe', 'lo', 'ta']);
  assert.deepEqual(silabasDe({ texto: 'casa', silabas: [] }), ['ca', 'sa']);
  assert.deepEqual(silabasDe({ texto: 'mesa', silabas: [' me ', 'sa'] }), ['me', 'sa'], 'se limpian los espacios');
});

test('empiezanIgual compara la primera sílaba sin tildes', () => {
  assert.equal(empiezanIgual({ texto: 'mamá' }, { texto: 'mano' }), true);
  assert.equal(empiezanIgual({ texto: 'mamá' }, { texto: 'mesa' }), false);
  assert.equal(empiezanIgual({ texto: 'cama' }, { texto: 'casa' }), true);
});

test('anotar: solo las palabras que ya lee (L4 dominada) cuentan como leídas', () => {
  const { por } = anotar();
  for (const id of LEIDAS_SILABAS) assert.equal(por.get(id).leida, true, id);
  for (const id of ['masa', 'mapa', 'luna']) assert.equal(por.get(id).leida, false, id);
  assert.deepEqual(por.get('pelota').silabas, ['pe', 'lo', 'ta']);
});

test('anotar S1: solo las palabras con otra leída que empieza con su misma sílaba', () => {
  const { por } = anotar();
  const conCompanera = [...por.values()].filter((e) => e.conMismaSilaba).map((e) => e.id).sort();
  assert.deepEqual(conCompanera, ['cama', 'casa', 'mamá', 'mano']);
  assert.equal(por.get('masa').conMismaSilaba, false, 'una palabra nueva no hace S1');
});

test('anotar S4: palabras nunca vistas hechas solo con sílabas que ya domina', () => {
  const { por } = anotar();
  assert.equal(por.get('masa').paraS4, true, 'ma y sa se conocen');
  assert.equal(por.get('mapa').paraS4, true);
  assert.equal(por.get('luna').paraS4, false, 'lu y na no se conocen');
  assert.equal(por.get('mamá').paraS4, false, 'ya la lee');
  assert.equal(por.get('pan').paraS4, false, 'una sílaba no basta');
});

test('anotar S4: una palabra que ya practicó en la etapa 1 no es «nunca vista»', () => {
  const vista = progresoCon('masa', 'L1', ESTADOS.PRACTICA, { aciertos: 1, total: 2 });
  const { por } = anotar([...leidas(), vista]);
  assert.equal(por.get('masa').paraS4, false);
  assert.equal(por.get('masa').vistaAntes, true);
  assert.equal(por.get('mapa').paraS4, true);
});

test('anotar: sin palabras leídas no hay nada para la etapa 3', () => {
  const { elementos, vistasPrevias } = anotar([]);
  assert.ok(elementos.every((e) => !e.leida && !e.conMismaSilaba && !e.paraS4));
  assert.equal(vistasPrevias.size, 0);
});

test('anotar: vistasPrevias son las palabras que el niño ya vio en la etapa 1', () => {
  const { vistasPrevias } = anotar([...leidas(['mamá', 'mano']), progresoCon('casa', 'L2', ESTADOS.PRACTICA, { aciertos: 1, total: 2 })]);
  assert.deepEqual([...vistasPrevias].sort(), ['casa', 'mamá', 'mano']);
});

test('anotar: no modifica las palabras originales ni cuenta progresos borrados', () => {
  const palabras = palabrasSilabas();
  const copia = JSON.stringify(palabras);
  const borrado = { ...leidas(['mamá'])[0], deleted: true };
  const r = anotarParaSilabas({ perfilId: PERFIL_ID, palabras, progresos: [borrado] });
  assert.equal(JSON.stringify(palabras), copia);
  assert.equal(r.elementos.find((e) => e.id === 'mamá').leida, false);
});

test('silabasDistractoras: sin repetir ni usar las vetadas (aunque difieran en la tilde)', () => {
  const palabras = [{ texto: 'mamá' }, { texto: 'mesa' }, { texto: 'pato' }];
  assert.deepEqual(silabasDistractoras({ palabras, excluir: ['ma'], cantidad: 3 }), ['me', 'sa', 'pa'], '«má» queda fuera porque se parece a «ma»');
  assert.deepEqual(silabasDistractoras({ palabras, excluir: [], cantidad: 2 }), ['ma', 'me'], 'respeta la cantidad');
  assert.deepEqual(silabasDistractoras({ palabras, excluir: [], cantidad: 0 }), []);
  assert.deepEqual(silabasDistractoras({ palabras: [{ texto: 'papa', silabas: ['pa', 'pa'] }], excluir: [], cantidad: 5 }), ['pa'], 'una sílaba repetida cuenta una vez');
});
