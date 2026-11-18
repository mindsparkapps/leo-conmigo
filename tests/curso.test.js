import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AJUSTES_DEL_ALUMNO, AJUSTES_DEL_CURSO, CAMPOS_DEL_ALUMNO, CAMPOS_DEL_CURSO, CLAVES_FAMILIA, aFicha, combinarPerfil, contenidoDe,
  fichaDeCorreo, filasDeContenidoFamilia, fotoQueSeMuestra, idDeFicha, limpiarContenidoFamilia, nuevaFicha, perfilPublicable, separarFamilia,
} from '../js/core/curso.js';
import { AJUSTES_POR_DEFECTO, nuevoPerfil, normalizarAjustes } from '../js/core/modelos.js';
import { evaluarAutoajuste } from '../js/core/autoajuste.js';
import { idNivel, idProgreso } from '../js/core/progreso.js';
import { idPremioAlbum } from '../js/core/album.js';

const t = (s) => `2026-11-16T10:00:${String(s).padStart(2, '0')}.000Z`;
const reg = (id, s, extra = {}) => ({ id, updatedAt: t(s), deleted: false, ...extra });

// ---------- división de campos ----------

test('la división de campos cubre todo lo que se escribe en el perfil y no se pisa', () => {
  // Lo que se escribe en el perfil (auditado en js/autoajuste.js, js/adulto/album.js, js/adulto/ajustes.js, perfiles.js, asistente.js):
  const campos = ['id', 'nombre', 'fotoMedioId', 'fechaNacimiento', 'creado', 'album', 'colecciones', 'base', 'ajustes', 'etapaActual', 'cambiosAutomaticos', 'medioFotoAlumnoId'];
  const repartidos = [...CAMPOS_DEL_CURSO, ...CAMPOS_DEL_ALUMNO, 'ajustes'];
  assert.deepEqual([...repartidos].sort(), [...campos].sort());
  assert.equal(new Set(repartidos).size, repartidos.length);
  // un perfil nuevo no trae campos que no estén repartidos
  for (const k of Object.keys(nuevoPerfil({ nombre: 'Curso' }))) assert.ok(campos.includes(k), k);
});

test('ajustes: lo del alumno y lo del curso juntos son todos los ajustes, sin repetirse', () => {
  const todos = Object.keys(AJUSTES_POR_DEFECTO);
  const juntos = [...Object.keys(AJUSTES_DEL_ALUMNO), ...AJUSTES_DEL_CURSO];
  assert.deepEqual([...juntos].sort(), [...todos].sort());
  assert.equal(new Set(juntos).size, juntos.length);
  assert.deepEqual([...Object.keys(AJUSTES_DEL_ALUMNO)].sort(), ['ensayosPorSesion', 'maxOpciones', 'palabrasNuevasPorSesion']);
  for (const k of ['mayusculas', 'tamanoLetra', 'velocidadVoz', 'sonido', 'vibracion', 'intensidadCelebracion', 'altoContraste', 'habilitarL6',
    'actividadesHabilitadas', 'etapasForzadas', 'etapasBloqueadas', 'avanceRapido', 'automaticos']) {
    assert.ok(AJUSTES_DEL_CURSO.includes(k), k);
  }
});

const curso = (extra = {}, ajustes = {}) => ({
  id: 'C1', nombre: 'Lectura inicial', fotoMedioId: 'foto', fechaNacimiento: null, creado: t(0), album: { tamano: 12 }, colecciones: [{ id: 'c1' }], base: {},
  etapaActual: 1, ajustes: normalizarAjustes(ajustes), ...extra,
});

test('combinarPerfil: con un ajuste en «Automático» gana el valor del alumno; en «Lo elijo yo», el del curso', () => {
  const c = curso({}, { ensayosPorSesion: 8, maxOpciones: 3, palabrasNuevasPorSesion: 2, automaticos: { ensayosPorSesion: true, maxOpciones: false, palabrasNuevas: true, etapa: true } });
  const propio = { ajustes: { ensayosPorSesion: 12, maxOpciones: 4, palabrasNuevasPorSesion: 1 }, etapaActual: 2, cambiosAutomaticos: [{ ajuste: 'etapa' }] };
  const r = combinarPerfil(c, propio);
  assert.equal(r.ajustes.ensayosPorSesion, 12); // automático: del alumno
  assert.equal(r.ajustes.maxOpciones, 3); // manual: del curso, aunque el alumno tenga otro
  assert.equal(r.ajustes.palabrasNuevasPorSesion, 1);
  assert.equal(r.etapaActual, 2);
  assert.deepEqual(r.cambiosAutomaticos, [{ ajuste: 'etapa' }]);
  assert.equal(r.nombre, 'Lectura inicial'); // el resto es del curso
  assert.equal(r.fotoMedioId, 'foto');
});

test('foto del alumno: es solo suya, la publica, el curso no la pisa y se muestra antes que la foto antigua del perfil', () => {
  // el curso no trae foto del alumno (aunque alguien la meta): la del alumno se conserva al combinar
  const c = curso({ medioFotoAlumnoId: 'intrusa' });
  assert.equal(combinarPerfil(c, { medioFotoAlumnoId: 'foto-victor' }).medioFotoAlumnoId, 'foto-victor');
  assert.equal('medioFotoAlumnoId' in combinarPerfil(c, null), false);
  assert.equal('medioFotoAlumnoId' in combinarPerfil(c, { medioFotoAlumnoId: '' }), false);
  // el alumno la publica (solo el id; el archivo va en su familia/) y nada del curso
  const p = perfilPublicable({ ...curso(), medioFotoAlumnoId: 'foto-victor' });
  assert.equal(p.medioFotoAlumnoId, 'foto-victor');
  assert.equal('fotoMedioId' in p, false);
  assert.equal('medioFotoAlumnoId' in perfilPublicable(curso()), false);
  // llega a la ficha del adulto dentro de su estado
  const { estado } = aFicha({ perfiles: [{ ...curso(), medioFotoAlumnoId: 'foto-victor' }] }, { cursoId: 'C1', fichaId: idDeFicha('C1', 'v@x.cl') });
  assert.equal(estado.medioFotoAlumnoId, 'foto-victor');
  // qué se muestra
  assert.equal(fotoQueSeMuestra({ fotoMedioId: 'curso', medioFotoAlumnoId: 'alumno' }), 'alumno');
  assert.equal(fotoQueSeMuestra({ fotoMedioId: 'curso' }), 'curso');
  assert.equal(fotoQueSeMuestra({}), null);
  assert.equal(fotoQueSeMuestra(null), null);
});

test('combinarPerfil: un cambio automático del alumno no lo pisa un ajuste manual del curso, y al revés', () => {
  // el alumno sube sus ensayos a 12 solo; el adulto después lo pasa a «Lo elijo yo» con 6: gana el curso en todos los alumnos
  const propio = { ajustes: { ensayosPorSesion: 12 }, etapaActual: 3 };
  const manual = curso({ etapaActual: 1 }, { ensayosPorSesion: 6, automaticos: { ensayosPorSesion: false, etapa: false } });
  const r = combinarPerfil(manual, propio);
  assert.equal(r.ajustes.ensayosPorSesion, 6);
  assert.equal(r.etapaActual, 1); // etapa manual: la del curso
  // y si el adulto lo devuelve a «Automático», vuelve a mandar el alumno
  const auto = curso({ etapaActual: 1 }, { ensayosPorSesion: 6, automaticos: { ensayosPorSesion: true, etapa: true } });
  const r2 = combinarPerfil(auto, propio);
  assert.equal(r2.ajustes.ensayosPorSesion, 12);
  assert.equal(r2.etapaActual, 3);
});

test('combinarPerfil: los ajustes del curso que no son automáticos siempre son del curso', () => {
  const c = curso({}, { mayusculas: true, tamanoLetra: 'grande', velocidadVoz: 0.8, habilitarL6: true, etapasForzadas: [2], etapasBloqueadas: [3], avanceRapido: false, actividadesHabilitadas: ['L1'] });
  const propio = { ajustes: { mayusculas: false, tamanoLetra: 'normal', velocidadVoz: 1.2, habilitarL6: false, etapasForzadas: [], avanceRapido: true, actividadesHabilitadas: null } };
  const r = combinarPerfil(c, propio);
  assert.equal(r.ajustes.mayusculas, true);
  assert.equal(r.ajustes.tamanoLetra, 'grande');
  assert.equal(r.ajustes.velocidadVoz, 0.8);
  assert.equal(r.ajustes.habilitarL6, true);
  assert.deepEqual(r.ajustes.etapasForzadas, [2]);
  assert.deepEqual(r.ajustes.etapasBloqueadas, [3]);
  assert.equal(r.ajustes.avanceRapido, false);
  assert.deepEqual(r.ajustes.actividadesHabilitadas, ['L1']);
});

test('combinarPerfil: sin perfil propio usa el curso, y no modifica lo recibido', () => {
  const c = curso({ cambiosAutomaticos: [{ ajuste: 'del-curso' }] });
  const copia = JSON.parse(JSON.stringify(c));
  const r = combinarPerfil(c, null);
  assert.equal(r.etapaActual, 1);
  assert.equal(r.ajustes.ensayosPorSesion, 8);
  assert.deepEqual(r.cambiosAutomaticos, []); // los avisos del curso son del adulto, no de este alumno
  assert.deepEqual(c, copia);
});

test('perfilPublicable: solo lo del alumno; lo manual y lo del curso no salen', () => {
  const perfil = curso({ etapaActual: 2, cambiosAutomaticos: [{ ajuste: 'etapa' }], updatedAt: t(5) }, {
    ensayosPorSesion: 10, maxOpciones: 3, palabrasNuevasPorSesion: 1, mayusculas: true,
    automaticos: { ensayosPorSesion: true, maxOpciones: false, palabrasNuevas: true, etapa: true },
  });
  const p = perfilPublicable(perfil);
  assert.deepEqual(p, { id: 'C1', ajustes: { ensayosPorSesion: 10, palabrasNuevasPorSesion: 1, escritura: { nivelEscritura: 'E01', palabrasPorSesion: 6 } }, etapaActual: 2, cambiosAutomaticos: [{ ajuste: 'etapa' }], updatedAt: t(5) });
  for (const k of ['nombre', 'fotoMedioId', 'album', 'colecciones', 'base']) assert.equal(k in p, false, k);
  const manual = perfilPublicable(curso({}, { automaticos: { etapa: false } }));
  assert.equal('etapaActual' in manual, false);
});

test('el ajuste automático real (evaluarAutoajuste) y combinarPerfil se entienden: lo que publica el alumno vuelve igual', () => {
  const c = curso({}, { ensayosPorSesion: 8 });
  const alumno = combinarPerfil(c, null);
  const sesion = (i) => ({ id: `s${i}`, inicio: t(i), fin: `2026-11-16T10:0${i}:30.000Z`, ensayos: Array.from({ length: 8 }, () => ({ correctoAlPrimerIntento: true })) });
  const { perfil, cambios } = evaluarAutoajuste({ perfil: alumno, sesiones: [sesion(1), sesion(2), sesion(3)], hoy: new Date('2026-11-16T12:00:00Z') });
  assert.ok(cambios.some((x) => x.ajuste === 'ensayosPorSesion'));
  const publicado = perfilPublicable(perfil);
  // el adulto publica un cambio de apariencia del curso: el celular del alumno conserva lo calculado
  const despues = combinarPerfil(curso({ nombre: 'Otro nombre' }), publicado);
  assert.equal(despues.ajustes.ensayosPorSesion, perfil.ajustes.ensayosPorSesion);
  assert.equal(despues.nombre, 'Otro nombre');
  assert.ok(despues.cambiosAutomaticos.length > 0);
});

// ---------- fichas ----------

test('nuevaFicha: id determinista por curso y correo, correo en minúscula y nombre por defecto', () => {
  const f = nuevaFicha({ cursoId: 'C1', email: ' Victor@Gmail.com ', ahora: new Date('2026-11-16T12:00:00Z') });
  assert.deepEqual(f, { id: 'ficha:C1:victor@gmail.com', cursoId: 'C1', email: 'victor@gmail.com', nombre: 'victor', creado: '2026-11-16T12:00:00.000Z', estado: null });
  assert.equal(nuevaFicha({ cursoId: 'C1', email: 'victor@gmail.com' }).id, f.id); // dos dispositivos del adulto crean la misma ficha
  assert.notEqual(nuevaFicha({ cursoId: 'C2', email: 'victor@gmail.com' }).id, f.id);
  assert.equal(nuevaFicha({ cursoId: 'C1', email: 'a@b.co', nombre: ' Ana ' }).nombre, 'Ana');
  assert.throws(() => nuevaFicha({ cursoId: '', email: 'a@b.co' }), /curso/);
  assert.throws(() => nuevaFicha({ cursoId: 'C1', email: 'sin-arroba' }), /correo/);
  assert.equal(idDeFicha('C1', 'A@B.co'), 'ficha:C1:a@b.co');
});

test('fichaDeCorreo: busca por curso y correo sin importar mayúsculas y salta las borradas', () => {
  const fichas = [nuevaFicha({ cursoId: 'C1', email: 'a@b.co' }), { ...nuevaFicha({ cursoId: 'C2', email: 'a@b.co' }), deleted: true }];
  assert.equal(fichaDeCorreo(fichas, { cursoId: 'C1', email: 'A@B.co' }).cursoId, 'C1');
  assert.equal(fichaDeCorreo(fichas, { cursoId: 'C2', email: 'a@b.co' }), null);
  assert.equal(fichaDeCorreo(fichas, { cursoId: 'C1', email: 'otro@b.co' }), null);
});

test('contenidoDe: un perfil es su propio contenido; una ficha lee el del curso', () => {
  assert.equal(contenidoDe({ id: 'C1', nombre: 'Curso' }), 'C1');
  assert.equal(contenidoDe(nuevaFicha({ cursoId: 'C1', email: 'a@b.co' })), 'C1');
  assert.equal(contenidoDe(null), null);
  assert.equal(contenidoDe({}), null);
});

const delDispositivo = (cursoId, k = '') => ({
  progresos: [reg(idProgreso(cursoId, 'w1', 'L1'), 1, { perfilId: cursoId, elementoId: 'w1', actividad: 'L1', k })],
  niveles: [reg(idNivel(cursoId, 'L1'), 1, { perfilId: cursoId, actividad: 'L1', k })],
  sesiones: [reg(`ses-${k}`, 1, { perfilId: cursoId })],
  respuestas: [reg(`resp-${k}`, 1, { perfilId: cursoId, elementoId: 'w1' })],
  calcomanias: [reg(`cal-${k}`, 1, { perfilId: cursoId, codigo: 'x' })],
  movimientos: [
    reg(idPremioAlbum(cursoId, 1), 1, { perfilId: cursoId, tipo: 'album', albumNumero: 1 }),
    reg(`pago-${k}`, 1, { perfilId: cursoId, tipo: 'leccion' }),
  ],
  perfiles: [reg(cursoId, 1, { nombre: 'Curso', ajustes: { ensayosPorSesion: 10, automaticos: { ensayosPorSesion: true } }, etapaActual: 2 })],
});

test('aFicha: dos alumnos del mismo curso no chocan en progresos ni niveles ni premios de álbum', () => {
  const a = nuevaFicha({ cursoId: 'C1', email: 'ana@b.co' });
  const b = nuevaFicha({ cursoId: 'C1', email: 'beto@b.co' });
  const ra = aFicha(delDispositivo('C1', 'a'), { cursoId: 'C1', fichaId: a.id });
  const rb = aFicha(delDispositivo('C1', 'b'), { cursoId: 'C1', fichaId: b.id });
  for (const almacen of ['progresos', 'niveles', 'movimientos']) {
    const idsA = ra.almacenes[almacen].map((r) => r.id);
    const idsB = rb.almacenes[almacen].filter((r) => r).map((r) => r.id);
    assert.equal(idsA.filter((id) => idsB.includes(id) && almacen !== 'movimientos').length, 0, almacen);
  }
  // los ids de progreso, nivel y premio de álbum se rearman con la ficha
  assert.equal(ra.almacenes.progresos[0].id, idProgreso(a.id, 'w1', 'L1'));
  assert.equal(rb.almacenes.progresos[0].id, idProgreso(b.id, 'w1', 'L1'));
  assert.equal(ra.almacenes.niveles[0].id, idNivel(a.id, 'L1'));
  assert.equal(ra.almacenes.movimientos[0].id, idPremioAlbum(a.id, 1));
  assert.equal(rb.almacenes.movimientos[0].id, idPremioAlbum(b.id, 1));
  assert.notEqual(ra.almacenes.movimientos[0].id, rb.almacenes.movimientos[0].id);
  // todo queda bajo la ficha
  for (const almacen of Object.values(ra.almacenes)) for (const r of almacen) assert.equal(r.perfilId, a.id);
  // lo demás (sesiones, respuestas, calcomanías, otros movimientos) conserva su id y su contenido
  assert.equal(ra.almacenes.sesiones[0].id, 'ses-a');
  assert.equal(ra.almacenes.movimientos[1].id, 'pago-a');
  assert.equal(ra.almacenes.progresos[0].updatedAt, t(1));
  // el estado de perfil del alumno sale aparte y nunca como un perfil
  assert.deepEqual(ra.estado.ajustes, { ensayosPorSesion: 10, maxOpciones: 4, palabrasNuevasPorSesion: 2, escritura: { nivelEscritura: 'E01', palabrasPorSesion: 6 } }); // lo no indicado queda en «Automático»
  assert.equal(ra.estado.etapaActual, 2);
  assert.equal(ra.almacenes.perfiles, undefined);
});

test('aFicha: descarta lo que no es del curso o no es del alumno y cuenta lo descartado; no modifica la entrada', () => {
  const entrada = delDispositivo('C1', 'a');
  entrada.progresos.push(reg('x', 1, { perfilId: 'OTRO', elementoId: 'w', actividad: 'L1' }), { id: 'sin-perfil' });
  entrada.palabras = [reg('w1', 1, { perfilId: 'C1' })]; // contenido del curso: no es del alumno
  entrada.medios = [reg('m1', 1)];
  const copia = JSON.parse(JSON.stringify(entrada));
  const r = aFicha(entrada, { cursoId: 'C1', fichaId: 'F' });
  assert.equal(r.almacenes.progresos.length, 1);
  assert.equal(r.descartados, 2 + 1 + 1);
  assert.equal(r.almacenes.palabras, undefined);
  assert.deepEqual(entrada, copia);
  assert.deepEqual(aFicha(undefined, { cursoId: 'C1', fichaId: 'F' }).almacenes.progresos, []);
});

// ---------- contenido de la familia ----------

const delCelularDelAlumno = () => ({
  perfiles: [reg('C1', 1)],
  palabras: [
    reg('w1', 1, { perfilId: 'C1', texto: 'mamá' }),
    reg('wf', 2, { perfilId: 'C1', texto: 'Firulais', origen: 'familia', medioImagenId: 'mf' }),
    reg('wfb', 3, { perfilId: 'C1', texto: 'Borrada', origen: 'familia', deleted: true }),
  ],
  frases: [reg('f1', 1, { perfilId: 'C1', origen: 'familia' })],
  libros: [reg('l1', 1, { perfilId: 'C1' })],
  calcomaniasPropias: [reg('cp', 1, { perfilId: 'C1', origen: 'familia', medioImagenId: 'mc' })],
  premios: [reg('pr', 1, { perfilId: 'C1', origen: 'familia' })],
  medios: [reg('mf', 1, { origen: 'familia', blob: new Blob(['x']) }), reg('mc', 1, { origen: 'familia' }), reg('mm', 1)],
  progresos: [
    reg(idProgreso('C1', 'w1', 'L1'), 1, { perfilId: 'C1', elementoId: 'w1', actividad: 'L1' }),
    reg(idProgreso('C1', 'wf', 'L1'), 1, { perfilId: 'C1', elementoId: 'wf', actividad: 'L1' }),
  ],
});

test('separarFamilia: el avance de una palabra de la familia sí se publica; la palabra viaja solo en contenidoFamilia, sin blob', () => {
  const entrada = delCelularDelAlumno();
  const { delCurso, contenidoFamilia, mediosFamilia } = separarFamilia(entrada);
  // el avance (progresos) de la palabra de la familia queda con el resto de lo del alumno
  assert.deepEqual(delCurso.progresos.map((p) => p.elementoId), ['w1', 'wf']);
  // la palabra misma, no
  assert.deepEqual(delCurso.palabras.map((p) => p.id), ['w1']);
  assert.deepEqual(contenidoFamilia.palabras.map((p) => p.id), ['wf', 'wfb']); // también el borrado, para que el borrado viaje
  assert.deepEqual(contenidoFamilia.frases.map((p) => p.id), ['f1']);
  assert.deepEqual(contenidoFamilia.calcomaniasPropias.map((p) => p.id), ['cp']);
  assert.deepEqual(contenidoFamilia.premios.map((p) => p.id), ['pr']);
  assert.deepEqual(contenidoFamilia.libros, []);
  assert.deepEqual(Object.keys(contenidoFamilia), [...CLAVES_FAMILIA]);
  // los medios de la familia no van en ninguna de las dos partes: viajan a su carpeta `familia/`
  assert.deepEqual(delCurso.medios.map((m) => m.id), ['mm']);
  assert.deepEqual(mediosFamilia.sort(), ['mc', 'mf']);
  assert.equal(JSON.stringify(contenidoFamilia).includes('blob'), false);
  // no modifica lo recibido
  assert.equal(entrada.palabras.length, 3);
  assert.equal(entrada.medios.length, 3);
});

test('separarFamilia: un blob dentro de un registro de la familia se quita', () => {
  const { contenidoFamilia } = separarFamilia({ palabras: [reg('wf', 1, { perfilId: 'C1', origen: 'familia', blob: new Blob(['x']) })] });
  assert.equal('blob' in contenidoFamilia.palabras[0], false);
});

test('limpiarContenidoFamilia: solo registros de la familia del curso, sin blobs y sin claves ajenas', () => {
  const { contenido, descartados } = limpiarContenidoFamilia({
    palabras: [reg('a', 1, { perfilId: 'C1', origen: 'familia', blob: 'x' }), reg('b', 1, { perfilId: 'C1' }), reg('c', 1, { perfilId: 'C2', origen: 'familia' }), { origen: 'familia' }],
    frases: 'raro',
    progresos: [reg('p', 1)], // nunca entra como contenido de la familia
    libros: [],
  }, { cursoId: 'C1' });
  assert.deepEqual(contenido.palabras.map((p) => p.id), ['a']);
  assert.equal('blob' in contenido.palabras[0], false);
  assert.deepEqual(contenido.frases, []);
  assert.deepEqual(Object.keys(contenido), [...CLAVES_FAMILIA]);
  assert.equal(descartados, 3 + 1 + 1);
  assert.deepEqual(limpiarContenidoFamilia(undefined).contenido.palabras, []);
  assert.equal(limpiarContenidoFamilia('x').descartados, 1);
});

test('filasDeContenidoFamilia: una fila por registro, con la ficha y sin mezclarse con palabras', () => {
  const { contenidoFamilia } = separarFamilia(delCelularDelAlumno());
  const filas = filasDeContenidoFamilia({ fichaId: 'F1', contenido: contenidoFamilia });
  assert.equal(filas.length, 5);
  const fila = filas.find((f) => f.registro.id === 'wf');
  assert.deepEqual([fila.id, fila.fichaId, fila.almacen, fila.deleted], ['F1:palabras:wf', 'F1', 'palabras', false]);
  assert.equal(filas.find((f) => f.registro.id === 'wfb').deleted, true);
});
