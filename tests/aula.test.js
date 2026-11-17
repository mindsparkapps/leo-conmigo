import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALMACENES_DEL_ALUMNO, ALMACENES_DEL_CURSO, ALMACENES_SOLO_ADULTO, aulaComoV2, aceptaDe, armarArchivoAula, estadoDeAlumnos, filtrarEntrantes, mediosDelPerfil,
  nuevaAula, nuevoDispositivo, publicaRol, validarArchivoAula, validarAula, validarDispositivo,
} from '../js/core/aula.js';
import { ALMACENES_RESPALDO } from '../js/core/respaldo.js';
import { mediosDeRegistro } from '../js/core/borrar-perfil.js';
import { fusionarAlmacen, fusionarConAjeno } from '../js/core/sync.js';

const t = (s) => `2026-11-05T10:00:${String(s).padStart(2, '0')}.000Z`;
const reg = (id, s, extra = {}) => ({ id, updatedAt: t(s), deleted: false, ...extra });

// ---------- listas de almacenes ----------

test('listas: no se pisan, con los medios cubren todos los almacenes y los medios ya no van en el aula', () => {
  const juntas = [...ALMACENES_SOLO_ADULTO, ...ALMACENES_DEL_ALUMNO];
  assert.equal(new Set(juntas).size, juntas.length);
  // 'alumnos' (las fichas) es solo del adulto y no viaja por el aula: se guarda en su celular
  assert.deepEqual([...juntas, 'medios', 'alumnos'].sort(), [...ALMACENES_RESPALDO].sort());
  assert.deepEqual([...ALMACENES_SOLO_ADULTO].sort(), ['calcomaniasPropias', 'frases', 'libros', 'palabras', 'premios']);
  assert.deepEqual([...ALMACENES_DEL_CURSO].sort(), ['calcomaniasPropias', 'frases', 'libros', 'palabras', 'perfiles', 'premios']);
  assert.deepEqual([...ALMACENES_DEL_ALUMNO].sort(), ['calcomanias', 'movimientos', 'niveles', 'perfiles', 'progresos', 'respuestas', 'sesiones']);
});

test('publicaRol / aceptaDe: el alumno nunca publica lo del curso; el adulto publica el curso y nunca avance de alumnos', () => {
  assert.deepEqual([...publicaRol('alumno')], [...ALMACENES_DEL_ALUMNO]);
  assert.deepEqual([...publicaRol('adulto')], [...ALMACENES_DEL_CURSO]);
  assert.deepEqual([...aceptaDe('adulto', 'alumno')], [...ALMACENES_DEL_ALUMNO]);
  assert.deepEqual([...aceptaDe('alumno', 'adulto')], [...ALMACENES_DEL_CURSO]);
  for (const a of ['progresos', 'niveles', 'sesiones', 'respuestas', 'calcomanias', 'movimientos', 'medios']) {
    assert.ok(!publicaRol('adulto').includes(a), a); // el avance viaja en un solo sentido: del alumno al adulto
  }
  for (const a of ALMACENES_SOLO_ADULTO) {
    assert.ok(!publicaRol('alumno').includes(a), a);
    assert.ok(!aceptaDe('adulto', 'alumno').includes(a), a);
  }
  assert.deepEqual([...aceptaDe('adulto', 'adulto')], []);
  assert.throws(() => publicaRol('profe'));
  assert.throws(() => aceptaDe('adulto', 'otro'));
});

// ---------- filtrarEntrantes ----------

const delAlumno = () => ({
  perfiles: [reg('P1', 1, { nombre: 'Pedro' }), reg('P2', 1, { nombre: 'Sofía' })],
  progresos: [reg('g1', 1, { perfilId: 'P1' }), reg('g2', 1, { perfilId: 'P2' })],
  sesiones: [reg('s1', 1, { perfilId: 'P1' }), { id: 's0', updatedAt: t(1) }],
  respuestas: [reg('r1', 1, { perfilId: 'P1' })],
  palabras: [reg('w1', 1, { perfilId: 'P1', texto: 'mamá' })],
  medios: [reg('m1', 1)],
});

test('filtrarEntrantes: descarta registros de otro perfil, otro perfil en `perfiles`, almacenes de solo adulto y medios', () => {
  const { almacenes, descartados } = filtrarEntrantes({ almacenes: delAlumno(), perfilId: 'P1', aceptados: aceptaDe('adulto', 'alumno') });
  assert.deepEqual(almacenes.perfiles.map((r) => r.id), ['P1']);
  assert.deepEqual(almacenes.progresos.map((r) => r.id), ['g1']);
  assert.deepEqual(almacenes.sesiones.map((r) => r.id), ['s1']); // el registro sin perfilId se descarta
  assert.deepEqual(almacenes.respuestas.map((r) => r.id), ['r1']);
  assert.equal(almacenes.palabras, undefined);
  assert.equal(almacenes.medios, undefined);
  assert.deepEqual(descartados.porAlmacen, { perfiles: 1, progresos: 1, sesiones: 1, palabras: 1, medios: 1 });
  assert.equal(descartados.total, 5);
});

test('filtrarEntrantes: un almacén desconocido o que no es lista se descarta', () => {
  const { almacenes, descartados } = filtrarEntrantes({
    almacenes: { progresos: 'x', cosas: [reg('c', 1, { perfilId: 'P1' })] }, perfilId: 'P1', aceptados: [...ALMACENES_DEL_ALUMNO, 'cosas'],
  });
  assert.deepEqual(almacenes, {});
  assert.equal(descartados.total, 2);
});

test('filtrarEntrantes: lo limpio pasa entero y nada se descarta; también pasan los borrados', () => {
  const limpio = { perfiles: [reg('P1', 1)], progresos: [reg('g1', 1, { perfilId: 'P1', deleted: true })] };
  const { almacenes, descartados } = filtrarEntrantes({ almacenes: limpio, perfilId: 'P1', aceptados: ALMACENES_DEL_ALUMNO });
  assert.deepEqual(almacenes, limpio);
  assert.equal(descartados.total, 0);
});

test('filtrarEntrantes (alumno recibe del adulto): solo los medios que usa el perfil, y los borrados', () => {
  const adulto = {
    perfiles: [reg('P1', 1, { fotoMedioId: 'f', colecciones: [{ id: 'c1', medioPortadaId: 'port', medioSobreId: 'sobre' }] })],
    palabras: [reg('w1', 1, { perfilId: 'P1', medioImagenId: 'img' }), reg('w2', 1, { perfilId: 'P2', medioImagenId: 'ajena' })],
    medios: [reg('f', 1), reg('port', 1), reg('sobre', 1), reg('img', 1), reg('ajena', 1), reg('suelto', 1), reg('viejo', 2, { deleted: true })],
  };
  const { almacenes, descartados } = filtrarEntrantes({ almacenes: adulto, perfilId: 'P1', aceptados: [...aceptaDe('alumno', 'adulto'), 'medios'] });
  assert.deepEqual(almacenes.medios.map((m) => m.id).sort(), ['f', 'img', 'port', 'sobre', 'viejo']);
  assert.equal(descartados.porAlmacen.medios, 2);
  assert.equal(descartados.porAlmacen.palabras, 1);
});

// ---------- mediosDelPerfil ----------

test('mediosDelPerfil: foto, palabras, frases, libros, premios, calcomanías propias y álbumes (portadas y sobres)', () => {
  const perfil = {
    id: 'P1',
    fotoMedioId: 'foto',
    colecciones: [{ id: 'c1', medioPortadaId: 'portada1', medioSobreId: 'sobre1' }, { id: 'c2', medioPortadaId: null, medioSobreId: 'sobre2' }],
    base: { medioPortadaId: 'portadaBase', medioSobreId: null },
  };
  const registros = {
    palabras: [reg('w', 1, { perfilId: 'P1', medioImagenId: 'img', medioAudioId: 'voz', medioSimboloId: 'sim' }), reg('wx', 1, { perfilId: 'P2', medioImagenId: 'ajeno' })],
    frases: [reg('f', 1, { perfilId: 'P1', medioImagenId: 'imgFrase' })],
    libros: [reg('l', 1, { perfilId: 'P1', paginas: [{ medioImagenId: 'pag1' }, { fraseId: 'x' }] })],
    premios: [reg('pr', 1, { perfilId: 'P1', medioImagenId: 'premio' })],
    calcomaniasPropias: [reg('cp', 1, { perfilId: 'P1', medioImagenId: 'lamina', coleccionId: 'c1' })],
    palabrasBorradas: [],
  };
  registros.palabras.push(reg('wd', 1, { perfilId: 'P1', medioImagenId: 'borrada', deleted: true }));
  const ids = mediosDelPerfil({ perfil, registros }).sort();
  assert.deepEqual(ids, ['foto', 'img', 'imgFrase', 'lamina', 'pag1', 'portada1', 'portadaBase', 'premio', 'sim', 'sobre1', 'sobre2', 'voz']);
});

test('mediosDeRegistro: ahora también mira los álbumes anidados del perfil', () => {
  assert.deepEqual(mediosDeRegistro({ fotoMedioId: 'a', colecciones: [{ medioPortadaId: 'p', medioSobreId: 's' }, null], base: { medioSobreId: 'b' } }).sort(), ['a', 'b', 'p', 's']);
  assert.deepEqual(mediosDeRegistro({ colecciones: 'raro', base: 5 }), []);
});

// ---------- validaciones ----------

const aulaBuena = () => nuevaAula({ perfilId: 'P1', nombre: 'Alumno · Pedro', email: 'adulto@ejemplo.com', fondo: { color: '#fff' } });

test('validarAula: acepta una buena y rechaza formato ajeno, versión nueva, perfil que no coincide y datos rotos', () => {
  assert.equal(validarAula(aulaBuena()), null);
  assert.equal(validarAula(aulaBuena(), { perfilId: 'P1' }), null);
  assert.match(validarAula({ formato: 'otra-cosa' }), /no es de Leo Conmigo/);
  assert.match(validarAula(null), /no es de Leo Conmigo/);
  assert.match(validarAula({ ...aulaBuena(), version: 3 }), /versión más nueva/);
  assert.match(validarAula({ ...aulaBuena(), version: 0 }), /versión/);
  assert.match(validarAula(aulaBuena(), { perfilId: 'P2' }), /otro perfil/);
  assert.match(validarAula({ ...aulaBuena(), perfilId: '' }), /perfil/);
  assert.match(validarAula({ ...aulaBuena(), nombre: ' ' }), /nombre/);
  assert.match(validarAula({ ...aulaBuena(), dueno: { email: 'no-es-correo' } }), /dueño/);
  assert.match(validarAula({ ...aulaBuena(), desvinculados: 'x' }), /desvinculados/);
  assert.match(validarAula({ ...aulaBuena(), desvinculados: [3] }), /desvinculados/);
});

test('validarArchivoAula: rol y perfil deben coincidir; formato y versión como data.json', () => {
  const doc = armarArchivoAula({ rol: 'alumno', perfilId: 'P1', almacenes: delAlumno(), ahora: new Date('2026-11-05T12:00:00Z') });
  assert.equal(validarArchivoAula(doc, { rolEsperado: 'alumno', perfilId: 'P1' }), null);
  assert.match(validarArchivoAula(doc, { rolEsperado: 'adulto', perfilId: 'P1' }), /adulto/);
  assert.match(validarArchivoAula(doc, { rolEsperado: 'alumno', perfilId: 'P2' }), /otro perfil/);
  assert.match(validarArchivoAula({ ...doc, formato: 'x' }, { rolEsperado: 'alumno', perfilId: 'P1' }), /no es de Leo Conmigo/);
  assert.match(validarArchivoAula({ ...doc, version: 9 }, { rolEsperado: 'alumno', perfilId: 'P1' }), /versión más nueva/);
  const sinPerfil = { ...doc };
  delete sinPerfil.perfilId;
  assert.match(validarArchivoAula(sinPerfil, { rolEsperado: 'alumno' }), /perfil/);
  assert.match(validarArchivoAula({ ...doc, almacenes: { progresos: [{ sinId: 1 }] } }, { rolEsperado: 'alumno', perfilId: 'P1' }), /sin identificador/);
});

test('armarArchivoAula: el alumno publica solo lo suyo y solo de su perfil; el adulto publica todo de ese perfil sin contenido de medios', () => {
  const alumno = armarArchivoAula({ rol: 'alumno', perfilId: 'P1', almacenes: delAlumno() });
  assert.equal(alumno.rol, 'alumno');
  assert.equal(alumno.perfilId, 'P1');
  assert.deepEqual(Object.keys(alumno.almacenes).sort(), [...ALMACENES_DEL_ALUMNO].sort());
  assert.deepEqual(alumno.almacenes.perfiles.map((p) => p.id), ['P1']);
  assert.deepEqual(alumno.almacenes.progresos.map((p) => p.id), ['g1']);

  const adulto = armarArchivoAula({
    rol: 'adulto',
    perfilId: 'P1',
    almacenes: { ...delAlumno(), perfiles: [reg('P1', 1, { fotoMedioId: 'm1' })], medios: [reg('m1', 1, { mime: 'image/png', blob: new Blob(['x']) }), reg('otro', 1)] },
  });
  assert.deepEqual(adulto.almacenes.palabras.map((p) => p.id), ['w1']);
  assert.deepEqual(Object.keys(adulto.almacenes).sort(), [...ALMACENES_DEL_CURSO].sort()); // sin medios ni almacenes del alumno
  assert.equal(adulto.contenidoFamilia, undefined);
});

test('validarDispositivo: acepta uno bueno y rechaza formato ajeno, versión nueva y datos rotos', () => {
  const d = nuevoDispositivo({ idDispositivo: 'd1', email: 'Pedro@Gmail.com', nombre: 'Tablet', versionApp: '0.34.0' });
  assert.equal(validarDispositivo(d), null);
  assert.match(validarDispositivo({ ...d, formato: 'x' }), /no es de Leo Conmigo/);
  assert.match(validarDispositivo({ ...d, version: 3 }), /versión más nueva/);
  assert.match(validarDispositivo({ ...d, idDispositivo: '' }), /identificador/);
  assert.match(validarDispositivo({ ...d, email: 'x' }), /correo/);
  assert.match(validarDispositivo({ ...d, ultimaSync: 'ayer' }), /última sincronización/);
  assert.match(validarDispositivo(null), /no es de Leo Conmigo/);
});

// ---------- estadoDeAlumnos ----------

const ahora = new Date('2026-11-16T12:00:00Z');
const dispositivo = (id, email, ultimaSync) => ({ ...nuevoDispositivo({ idDispositivo: id, email, versionApp: '0.34.0' }), ultimaSync });
const dueno = { id: 'o', type: 'user', role: 'owner', emailAddress: 'adulto@ejemplo.com' };
const lector = (email, id = `r-${email}`) => ({ id, type: 'user', role: 'reader', emailAddress: email });
const editor = (email, id = `w-${email}`) => ({ id, type: 'user', role: 'writer', emailAddress: email });

test('estadoDeAlumnos: invitado → conectado, con dispositivos y hace cuánto sincronizó', () => {
  const r = estadoDeAlumnos({
    invitados: ['pedro@gmail.com', 'Mama@Gmail.com'],
    permisos: { aula: [dueno, lector('pedro@gmail.com'), lector('mama@gmail.com')], delAlumno: [dueno, lector('pedro@gmail.com'), editor('pedro@gmail.com'), editor('mama@gmail.com')] },
    dispositivos: [
      dispositivo('d1', 'Pedro@gmail.com', '2026-11-16T11:00:00Z'),
      dispositivo('d2', 'pedro@gmail.com', '2026-11-16T11:59:00Z'),
      { formato: 'basura' },
    ],
    ahora,
  });
  const pedro = r.alumnos.find((a) => a.email === 'pedro@gmail.com');
  const mama = r.alumnos.find((a) => a.email === 'mama@gmail.com');
  assert.equal(pedro.estado, 'conectado');
  assert.deepEqual(pedro.dispositivos.map((d) => [d.idDispositivo, d.haceMs]), [['d2', 60_000], ['d1', 3_600_000]]);
  assert.equal(mama.estado, 'invitado');
  assert.deepEqual(mama.dispositivos, []);
  assert.deepEqual(r.permisosExtranos, []);
  assert.equal(r.dispositivosInvalidos, 1);
});

test('estadoDeAlumnos: sin permiso en el aula = «sin acceso»', () => {
  const r = estadoDeAlumnos({
    invitados: ['pedro@gmail.com'],
    permisos: { aula: [dueno], delAlumno: [dueno] },
    dispositivos: [dispositivo('d1', 'pedro@gmail.com', '2026-11-16T11:00:00Z')],
    ahora,
  });
  assert.equal(r.alumnos[0].estado, 'sin acceso');
});

test('estadoDeAlumnos: `anyone`, un writer en el aula, otro correo o un grupo son permisos extraños', () => {
  const anyone = { id: 'a1', type: 'anyone', role: 'reader' };
  const r = estadoDeAlumnos({
    invitados: ['pedro@gmail.com'],
    permisos: {
      aula: [dueno, lector('pedro@gmail.com'), anyone, editor('pedro@gmail.com', 'w-aula'), lector('intruso@gmail.com', 'x1')],
      delAlumno: [dueno, editor('pedro@gmail.com'), { id: 'g1', type: 'group', role: 'writer', emailAddress: 'g@grupos.com' }, { id: 'd1', type: 'domain', role: 'reader' }, editor('intruso@gmail.com', 'x2')],
    },
    ahora,
  });
  assert.deepEqual(r.permisosExtranos.map((p) => [p.carpeta, p.id]).sort(), [['aula', 'a1'], ['aula', 'w-aula'], ['aula', 'x1'], ['del-alumno', 'd1'], ['del-alumno', 'g1'], ['del-alumno', 'x2']].sort());
  assert.ok(r.permisosExtranos.find((p) => p.id === 'a1').motivo.includes('enlace'));
});

test('estadoDeAlumnos: un permiso extraño del aula heredado en del-alumno se cuenta una sola vez', () => {
  const anyone = { id: 'anyoneWithLink', type: 'anyone', role: 'reader' };
  const r = estadoDeAlumnos({ invitados: ['pedro@gmail.com'], permisos: { aula: [dueno, anyone], delAlumno: [dueno, anyone] }, ahora });
  assert.deepEqual(r.permisosExtranos.map((p) => p.carpeta), ['aula']);
});

test('estadoDeAlumnos: sin permisos leídos no inventa extraños ni quita el acceso', () => {
  const r = estadoDeAlumnos({ invitados: ['pedro@gmail.com'], ahora });
  assert.equal(r.alumnos[0].estado, 'invitado');
  assert.deepEqual(r.permisosExtranos, []);
});

// ---------- fusionarConAjeno ----------

test('fusionarConAjeno: lo que solo hay en una fuente llega a las otras', () => {
  const r = fusionarConAjeno({ locales: [reg('a', 1)], propios: [reg('b', 1)], ajenos: [reg('c', 1)] });
  assert.deepEqual(r.resultado.map((x) => x.id).sort(), ['a', 'b', 'c']);
  assert.deepEqual(r.paraLocal.map((x) => x.id).sort(), ['b', 'c']);
  assert.deepEqual(r.paraPropio.map((x) => x.id).sort(), ['a', 'c']);
});

test('fusionarConAjeno: gana el más reciente entre las tres fuentes y el empate es de lo local', () => {
  const local = reg('x', 5, { v: 'local' });
  const propio = reg('x', 5, { v: 'propio' });
  const ajeno = reg('x', 5, { v: 'ajeno' });
  assert.equal(fusionarConAjeno({ locales: [local], propios: [propio], ajenos: [ajeno] }).resultado[0].v, 'local');
  assert.equal(fusionarConAjeno({ locales: [local], propios: [propio], ajenos: [reg('x', 6, { v: 'ajeno' })] }).resultado[0].v, 'ajeno');
  assert.equal(fusionarConAjeno({ locales: [local], propios: [reg('x', 7, { v: 'propio' })], ajenos: [reg('x', 6, { v: 'ajeno' })] }).resultado[0].v, 'propio');
  assert.equal(fusionarConAjeno({ locales: [reg('x', 8, { v: 'local' })], propios: [propio], ajenos: [reg('x', 6, { v: 'ajeno' })] }).resultado[0].v, 'local');
});

test('fusionarConAjeno: un borrado más nuevo viaja y uno más viejo no resucita el registro', () => {
  const borradoNuevo = fusionarConAjeno({ locales: [reg('x', 1)], propios: [reg('x', 1)], ajenos: [reg('x', 3, { deleted: true })] });
  assert.equal(borradoNuevo.resultado[0].deleted, true);
  assert.equal(borradoNuevo.paraLocal.length, 1);
  assert.equal(borradoNuevo.paraPropio.length, 1);

  const viejo = fusionarConAjeno({ locales: [reg('x', 5, { deleted: true })], propios: [reg('x', 5, { deleted: true })], ajenos: [reg('x', 2)] });
  assert.equal(viejo.resultado[0].deleted, true);
  assert.deepEqual(viejo.paraLocal, []);
  assert.deepEqual(viejo.paraPropio, []);
});

test('fusionarConAjeno: conflicto — lo local que cambió después del archivo propio se publica; lo ajeno más nuevo se baja', () => {
  const r = fusionarConAjeno({
    locales: [reg('a', 9, { v: 'nuevo' }), reg('b', 1)],
    propios: [reg('a', 2, { v: 'viejo' }), reg('b', 1)],
    ajenos: [reg('b', 4, { v: 'ajeno' })],
  });
  assert.deepEqual(r.paraPropio.map((x) => [x.id, x.updatedAt]).sort(), [['a', t(9)], ['b', t(4)]]);
  assert.deepEqual(r.paraLocal.map((x) => x.id), ['b']);
});

test('fusionarConAjeno: todo igual no genera trabajo; soloLectura no publica nada', () => {
  const igual = [reg('a', 1), reg('b', 2)];
  const r = fusionarConAjeno({ locales: igual, propios: igual, ajenos: igual });
  assert.deepEqual(r.paraLocal, []);
  assert.deepEqual(r.paraPropio, []);
  const lectura = fusionarConAjeno({ locales: [reg('a', 1)], propios: [], ajenos: [reg('b', 1)], soloLectura: true });
  assert.deepEqual(lectura.paraPropio, []);
  assert.deepEqual(lectura.paraLocal.map((x) => x.id), ['b']);
});

test('fusionarConAjeno sin lo ajeno y sin lo propio coincide con fusionarAlmacen (que no cambia)', () => {
  const locales = [reg('a', 3), reg('b', 1)];
  const remotos = [reg('a', 1), reg('b', 2), reg('c', 1)];
  const viejo = fusionarAlmacen(locales, remotos);
  const nuevo = fusionarConAjeno({ locales, propios: remotos, ajenos: [] });
  assert.deepEqual(nuevo.resultado.map((x) => x.id).sort(), viejo.resultado.map((x) => x.id).sort());
  assert.deepEqual(nuevo.paraLocal.map((x) => x.id).sort(), viejo.paraLocal.map((x) => x.id).sort());
  assert.equal(nuevo.paraPropio.length, viejo.paraRemoto);
});

// ---------- Ampliación 4: aula.json v2, familia y permisos nuevos ----------

test('aula.json: la versión 1 se sigue leyendo (y se migra) y la 2 trae alumnos y biblioteca', () => {
  const v2 = aulaBuena();
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.alumnos, []);
  assert.equal(v2.bibliotecaId, null);
  const { alumnos, bibliotecaId, ...resto } = v2;
  const v1 = { ...resto, version: 1 };
  assert.equal(validarAula(v1), null);
  const migrada = aulaComoV2(v1);
  assert.equal(migrada.version, 2);
  assert.deepEqual(migrada.alumnos, []);
  assert.equal(migrada.bibliotecaId, null);
  assert.equal(validarAula(migrada), null);
  const conAlumnos = nuevaAula({ perfilId: 'P1', nombre: 'Curso', email: 'adulto@ejemplo.com', alumnos: [{ email: 'Pedro@Gmail.com', carpetaId: 'k1' }], bibliotecaId: 'bib' });
  assert.deepEqual(conAlumnos.alumnos, [{ email: 'pedro@gmail.com', carpetaId: 'k1' }]);
  assert.equal(validarAula(conAlumnos, { perfilId: 'P1' }), null);
  assert.match(validarAula({ ...conAlumnos, alumnos: [{ email: 'x' }] }), /alumnos/);
  assert.match(validarAula({ ...conAlumnos, alumnos: 'x' }), /alumnos/);
  assert.match(validarAula({ ...conAlumnos, bibliotecaId: 5 }), /biblioteca/);
  assert.match(validarAula({ ...v2, version: 3 }), /versión más nueva/);
});

test('filtrarEntrantes: lo que tiene origen «familia» no entra como contenido del curso, en ninguna dirección', () => {
  const delCurso = {
    palabras: [reg('w1', 1, { perfilId: 'P1' }), reg('wf', 1, { perfilId: 'P1', origen: 'familia' })],
    frases: [reg('f1', 1, { perfilId: 'P1', origen: 'familia' })],
    medios: [reg('m1', 1, { origen: 'familia' }), reg('m2', 1, { origen: 'familia', deleted: true })],
  };
  // el celular del alumno recibe del adulto
  const alAlumno = filtrarEntrantes({ almacenes: delCurso, perfilId: 'P1', aceptados: aceptaDe('alumno', 'adulto') });
  assert.deepEqual(alAlumno.almacenes.palabras.map((r) => r.id), ['w1']);
  assert.deepEqual(alAlumno.almacenes.frases, []);
  assert.equal(alAlumno.descartados.porAlmacen.palabras, 1);
  assert.equal(alAlumno.descartados.porAlmacen.medios, 2); // los medios ni siquiera viajan en el aula
  // el adulto recibe del alumno: un registro de la familia metido en un almacén normal se descarta
  const alAdulto = filtrarEntrantes({
    almacenes: { progresos: [reg('g1', 1, { perfilId: 'P1' }), reg('g2', 1, { perfilId: 'P1', origen: 'familia' })], palabras: [reg('wf', 1, { perfilId: 'P1', origen: 'familia' })] },
    perfilId: 'P1', aceptados: aceptaDe('adulto', 'alumno'),
  });
  assert.deepEqual(alAdulto.almacenes.progresos.map((r) => r.id), ['g1']);
  assert.equal(alAdulto.almacenes.palabras, undefined);
  assert.equal(alAdulto.descartados.porAlmacen.progresos, 1);
  // aunque se aceptaran medios, los de la familia no pasan
  const v1 = filtrarEntrantes({ almacenes: { medios: [reg('m1', 1, { origen: 'familia' })] }, perfilId: 'P1', aceptados: ['medios'] });
  assert.deepEqual(v1.almacenes.medios, []);
});

test('armarArchivoAula: el alumno publica contenidoFamilia aparte y sin blobs; nunca como palabras del curso', () => {
  const alumno = armarArchivoAula({
    rol: 'alumno',
    perfilId: 'P1',
    almacenes: { ...delAlumno(), palabras: [reg('wf', 1, { perfilId: 'P1', origen: 'familia' })] },
    contenidoFamilia: { palabras: [reg('wf', 1, { perfilId: 'P1', origen: 'familia', blob: 'x' }), reg('malo', 1, { perfilId: 'P1' })], progresos: [reg('p', 1)] },
  });
  assert.equal(alumno.almacenes.palabras, undefined);
  assert.deepEqual(alumno.contenidoFamilia.palabras.map((p) => p.id), ['wf']);
  assert.equal('blob' in alumno.contenidoFamilia.palabras[0], false);
  assert.equal(alumno.contenidoFamilia.progresos, undefined);
  assert.equal(validarArchivoAula(alumno, { rolEsperado: 'alumno', perfilId: 'P1' }), null);
  assert.match(validarArchivoAula({ ...alumno, contenidoFamilia: 'x' }, { rolEsperado: 'alumno', perfilId: 'P1' }), /familia/);
  // un archivo del adulto no puede traer contenido de la familia
  const adulto = armarArchivoAula({ rol: 'adulto', perfilId: 'P1', almacenes: {}, contenidoFamilia: { palabras: [reg('wf', 1, { perfilId: 'P1', origen: 'familia' })] } });
  assert.equal(adulto.contenidoFamilia, undefined);
  assert.match(validarArchivoAula({ ...adulto, contenidoFamilia: {} }, { rolEsperado: 'adulto', perfilId: 'P1' }), /familia/);
});

test('armarArchivoAula: el adulto nunca publica avance de alumnos ni medios, aunque los tenga en su almacén', () => {
  const adulto = armarArchivoAula({
    rol: 'adulto',
    perfilId: 'P1',
    almacenes: { ...delAlumno(), perfiles: [reg('P1', 1)], medios: [reg('m1', 1)] },
  });
  for (const n of ['progresos', 'niveles', 'sesiones', 'respuestas', 'calcomanias', 'movimientos', 'medios']) assert.equal(adulto.almacenes[n], undefined, n);
  assert.deepEqual(adulto.almacenes.perfiles.map((p) => p.id), ['P1']);
});

const lectorDe = (email) => ({ id: `r-${email}`, type: 'user', role: 'reader', emailAddress: email });
const editorDe = (email) => ({ id: `w-${email}`, type: 'user', role: 'writer', emailAddress: email });
const duenoA = { id: 'o', type: 'user', role: 'owner', emailAddress: 'adulto@ejemplo.com' };

test('estadoDeAlumnos (v2): Biblioteca para invitados de cualquier curso, curso para los suyos y alumnos/<correo>/ con su editor', () => {
  const r = estadoDeAlumnos({
    invitados: ['pedro@gmail.com', 'sofia@gmail.com'],
    invitadosDeTodos: ['pedro@gmail.com', 'sofia@gmail.com', 'luis@gmail.com'],
    permisos: {
      biblioteca: [duenoA, lectorDe('pedro@gmail.com'), lectorDe('sofia@gmail.com'), lectorDe('luis@gmail.com')],
      aula: [duenoA, lectorDe('pedro@gmail.com'), lectorDe('sofia@gmail.com')],
      alumnos: {
        'pedro@gmail.com': [duenoA, editorDe('pedro@gmail.com')], // fuera del aula: nadie más la ve, ni como lector
        'sofia@gmail.com': [duenoA, editorDe('sofia@gmail.com')],
      },
    },
    ahora,
  });
  assert.deepEqual(r.permisosExtranos, []);
  assert.deepEqual(r.alumnos.map((a) => [a.email, a.estado]), [['pedro@gmail.com', 'invitado'], ['sofia@gmail.com', 'invitado']]);
});

test('estadoDeAlumnos (v2): permisos extraños en Biblioteca, en el curso y en las carpetas de los alumnos', () => {
  const anyone = { id: 'a1', type: 'anyone', role: 'reader' };
  const r = estadoDeAlumnos({
    invitados: ['pedro@gmail.com', 'sofia@gmail.com'],
    invitadosDeTodos: ['pedro@gmail.com', 'sofia@gmail.com'],
    permisos: {
      biblioteca: [duenoA, editorDe('pedro@gmail.com'), lectorDe('intruso@gmail.com')], // un editor en la Biblioteca y alguien no invitado
      aula: [duenoA, lectorDe('pedro@gmail.com'), anyone],
      alumnos: {
        'pedro@gmail.com': [duenoA, editorDe('pedro@gmail.com'), anyone, editorDe('sofia@gmail.com')], // sofia no es la dueña de esta carpeta: no puede ni leerla
        'sofia@gmail.com': [duenoA, editorDe('sofia@gmail.com'), lectorDe('pedro@gmail.com'), { id: 'g', type: 'group', role: 'reader', emailAddress: 'g@grupos.com' }],
      },
    },
    ahora,
  });
  const lista = r.permisosExtranos.map((p) => [p.carpeta, p.id]).sort();
  assert.deepEqual(lista, [
    ['alumnos/pedro@gmail.com', 'a1'], // la carpeta del alumno está fuera del aula: un acceso suyo no es el del aula
    ['alumnos/pedro@gmail.com', 'w-sofia@gmail.com'],
    ['alumnos/sofia@gmail.com', 'g'],
    ['alumnos/sofia@gmail.com', 'r-pedro@gmail.com'],
    ['aula', 'a1'],
    ['biblioteca', 'r-intruso@gmail.com'],
    ['biblioteca', 'w-pedro@gmail.com'],
  ].sort());
  assert.match(r.permisosExtranos.find((p) => p.id === 'w-sofia@gmail.com').motivo, /carpeta de un alumno/);
});

test('estadoDeAlumnos (v2): un invitado a otro curso puede leer la Biblioteca pero no el curso ni ver la carpeta de un alumno', () => {
  const r = estadoDeAlumnos({
    invitados: ['pedro@gmail.com'],
    invitadosDeTodos: ['pedro@gmail.com', 'luis@gmail.com'],
    permisos: {
      biblioteca: [duenoA, lectorDe('luis@gmail.com')],
      aula: [duenoA, lectorDe('pedro@gmail.com'), lectorDe('luis@gmail.com')], // luis no es de este curso
      alumnos: { 'pedro@gmail.com': [duenoA, editorDe('pedro@gmail.com'), lectorDe('luis@gmail.com')] }, // ni siquiera como lector
    },
    ahora,
  });
  assert.deepEqual(r.permisosExtranos.map((p) => [p.carpeta, p.id, p.motivo]).sort(), [
    ['alumnos/pedro@gmail.com', 'r-luis@gmail.com', 'Otro correo con acceso a la carpeta de un alumno'],
    ['aula', 'r-luis@gmail.com', 'Un correo que no invitaste'],
  ]);
});
