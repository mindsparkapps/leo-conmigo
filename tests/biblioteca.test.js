import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAulas } from '../js/aulas.js';
import { crearDriveAulas, crearDriveCarpeta } from '../js/drive.js';
import { crearNubeFalsa } from './drive-falso.js';
import { bytesDe, crearStoreEnMemoria } from './memoria.js';

const ADULTO = 'adulto@ejemplo.com';
const A = 'pedro@gmail.com'; // curso 1
const B = 'sofia@gmail.com'; // curso 2
const imagen = (...b) => new Blob([Uint8Array.from(b)], { type: 'image/webp' });
const ids = async (store, almacen) => (await store.listar(almacen)).map((r) => r.id).sort();

/** Dos cursos (P1 y P2) que usan la MISMA foto `m-comun`; cada uno tiene además una foto propia. */
async function montar() {
  const nube = crearNubeFalsa();
  const tienda = crearStoreEnMemoria({ prefijo: 'ad' });
  await tienda.guardar('medios', { id: 'm-comun', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(1, 2, 3) });
  await tienda.guardar('medios', { id: 'm-solo1', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(4) });
  await tienda.guardar('medios', { id: 'm-solo2', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(5) });
  await tienda.guardar('perfiles', { id: 'P1', nombre: 'Lectura inicial' });
  await tienda.guardar('perfiles', { id: 'P2', nombre: 'Grupo 2' });
  await tienda.guardar('palabras', { id: 'w1', perfilId: 'P1', texto: 'perro', medioImagenId: 'm-comun' });
  await tienda.guardar('palabras', { id: 'w1b', perfilId: 'P1', texto: 'gato', medioImagenId: 'm-solo1' });
  await tienda.guardar('palabras', { id: 'w2', perfilId: 'P2', texto: 'perro', medioImagenId: 'm-comun' });
  await tienda.guardar('palabras', { id: 'w2b', perfilId: 'P2', texto: 'luna', medioImagenId: 'm-solo2' });
  const adulto = crearAulas({ store: tienda, ...nube.dep(ADULTO), emailAdulto: ADULTO, versionApp: '0.39.0' });
  const alumno = (email, id) => {
    const store = crearStoreEnMemoria({ prefijo: id, desde: 100 });
    return { store, email, aulas: crearAulas({ store, ...nube.dep(email), idDispositivo: id, nombreDispositivo: id, versionApp: '0.39.0', traerDeApp: async () => null }) };
  };
  return { nube, tienda, adulto, a: alumno(A, 'da'), b: alumno(B, 'db') };
}

async function habilitar(m) {
  await m.adulto.crearAula(await m.tienda.obtener('perfiles', 'P1'));
  await m.adulto.crearAula(await m.tienda.obtener('perfiles', 'P2'));
  await m.adulto.invitar('P1', A);
  await m.adulto.invitar('P2', B);
  await m.adulto.sincronizarAula('P1');
  await m.adulto.sincronizarAula('P2');
  const aulas = await m.adulto.listarAulas();
  return { aula1: aulas.P1, aula2: aulas.P2 };
}
const miAula = async (x) => (await x.aulas.buscarMiAula())[0];
const mediosEnDrive = (nube) => [...nube.estado.archivos.values()].filter((a) => a.name.startsWith('medio-'));

test('dos cursos que usan la misma foto la tienen UNA vez en la Biblioteca; el aula no guarda medios', async () => {
  const m = await montar();
  const { aula1, aula2 } = await habilitar(m);
  assert.equal(aula1.bibliotecaId, aula2.bibliotecaId, 'una sola Biblioteca para todos los cursos');
  const medios = mediosEnDrive(m.nube);
  assert.deepEqual(medios.map((a) => a.name).sort(), ['medio-m-comun.webp', 'medio-m-solo1.webp', 'medio-m-solo2.webp']);
  assert.ok(medios.every((a) => a.parents[0] === aula1.bibliotecaId), 'todos dentro de la Biblioteca');
  // una nueva sincronización no sube nada otra vez
  m.nube.reiniciarPeticiones();
  const r = (await m.adulto.sincronizarAula('P1')).resumen;
  assert.equal(r.mediosSubidos, 0);
  assert.equal(m.nube.peticionesDe(ADULTO).filter((p) => p.metodo === 'POST' && p.ruta.startsWith('/upload')).length, 0);
});

test('A (curso 1) y B (curso 2) bajan solo lo de su curso, lo guardan en local y la Biblioteca es de solo lectura', async () => {
  const m = await montar();
  await habilitar(m);
  const ra = await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  const rb = await m.b.aulas.sincronizarComoAlumno({ aula: await miAula(m.b), email: B });
  assert.equal(ra.mediosBajados, 2);
  assert.equal(rb.mediosBajados, 2);
  assert.deepEqual(await ids(m.a.store, 'medios'), ['m-comun', 'm-solo1']);
  assert.deepEqual(await ids(m.b.store, 'medios'), ['m-comun', 'm-solo2']);
  assert.deepEqual(await bytesDe((await m.a.store.obtener('medios', 'm-solo1')).blob), [4]);
  assert.deepEqual(await ids(m.a.store, 'palabras'), ['w1', 'w1b']);
  assert.deepEqual(await ids(m.b.store, 'palabras'), ['w2', 'w2b']);

  // A puede LEER la Biblioteca (incluso lo de otro curso, fuera de la app) pero no escribir en ella
  const aula1 = (await m.adulto.listarAulas()).P1;
  const bib = crearDriveCarpeta({ ...m.nube.dep(A), carpetaId: aula1.bibliotecaId });
  const archivos = await bib.listar();
  assert.equal(archivos.length, 3);
  const solo2 = archivos.find((x) => x.name === 'medio-m-solo2.webp');
  await assert.rejects(() => bib.actualizar(solo2.id, 'x', 'image/webp'), (e) => e.estado === 403);
  await assert.rejects(() => bib.borrar(solo2.id), (e) => e.estado === 403);
  await assert.rejects(() => bib.crear('medio-trampa.webp', 'x', 'image/webp'), (e) => e.estado === 403);
  // y la app del alumno solo escribió en su carpeta
  m.nube.reiniciarPeticiones();
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  const carpetaDeA = aula1.carpetasAlumnos[A];
  assert.ok(m.nube.peticionesDe(A).filter((p) => p.metodo !== 'GET').every((p) => p.padre === carpetaDeA));
});

test('el alumno nunca puede dejar nada en la Biblioteca y un medio suyo no entra a ella', async () => {
  const m = await montar();
  await habilitar(m);
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  await m.a.store.guardar('medios', { id: 'foto-del-alumno', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(9) });
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  await m.adulto.sincronizarAula('P1');
  assert.ok(!mediosEnDrive(m.nube).some((a) => a.name.includes('foto-del-alumno')));
});

test('permisos de la Biblioteca: lectores = invitados a algún curso; quitarlos del último curso le quita la Biblioteca', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const lectores = () => m.nube.permisosDe(aula1.bibliotecaId).filter((p) => p.role !== 'owner').map((p) => [p.emailAddress, p.role]).sort();
  assert.deepEqual(lectores(), [[B, 'reader'], [A, 'reader']].sort());
  assert.ok(m.nube.permisosDe(aula1.bibliotecaId).every((p) => p.type === 'user'), 'nunca «cualquiera con el enlace»');
  assert.deepEqual(m.nube.permisosDe(m.nube.archivo(aula1.bibliotecaId).parents[0]).map((p) => p.emailAddress), [ADULTO], 'Leo Conmigo/ sigue privada');

  // A también entra al curso 2: al salir del curso 1 conserva la Biblioteca
  await m.adulto.invitar('P2', A);
  await m.adulto.quitarAcceso('P1', A);
  assert.deepEqual(lectores(), [[B, 'reader'], [A, 'reader']].sort());
  // al salir de su último curso, la pierde
  await m.adulto.quitarAcceso('P2', A);
  assert.deepEqual(lectores(), [[B, 'reader']]);
  const bib = crearDriveCarpeta({ ...m.nube.dep(A), carpetaId: aula1.bibliotecaId });
  assert.deepEqual(await bib.listar(), [], 'sin permiso, la Biblioteca se ve vacía');
});

test('un medio de la Biblioteca solo se borra cuando ya no lo usa NINGÚN curso', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const nombre = 'medio-m-comun.webp';
  // el curso 1 deja de usar la foto común y el medio se borra, pero el curso 2 todavía la usa
  await m.tienda.guardar('palabras', { ...(await m.tienda.obtener('palabras', 'w1')), medioImagenId: null });
  await m.tienda.borrar('medios', 'm-comun');
  await m.adulto.sincronizarAula('P1');
  assert.ok(m.nube.porNombre(nombre, aula1.bibliotecaId), 'sigue en la Biblioteca porque el curso 2 la usa');
  // el curso 2 también la deja: ahora sí
  await m.tienda.guardar('palabras', { ...(await m.tienda.obtener('palabras', 'w2')), medioImagenId: null });
  await m.adulto.sincronizarAula('P2');
  assert.equal(m.nube.porNombre(nombre, aula1.bibliotecaId), undefined);
  assert.ok(m.nube.porNombre('medio-m-solo1.webp', aula1.bibliotecaId), 'lo demás sigue');
});

test('alguien que agrega un editor o un enlace público a la Biblioteca aparece como permiso extraño', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  m.nube.permitir(aula1.bibliotecaId, { type: 'user', role: 'writer', emailAddress: 'intruso@gmail.com' });
  m.nube.permitir(aula1.bibliotecaId, { type: 'anyone', role: 'reader' });
  const extranos = await m.adulto.revisarPermisos('P1');
  assert.deepEqual(extranos.filter((p) => p.carpeta === 'biblioteca').map((p) => p.tipo).sort(), ['anyone', 'user']);
  const e = (await m.adulto.sincronizarAula('P1')).permisosExtranos;
  assert.equal(e.filter((p) => p.carpeta === 'biblioteca').length, 2);
  for (const p of extranos) await m.adulto.quitarPermisoExtrano('P1', p);
  assert.deepEqual(await m.adulto.revisarPermisos('P1'), []);
});

// ---------- migración de un aula versión 1 ----------

/** Deja un aula como la dejaba la versión 0.36: sin Biblioteca, con los medio-* y el avance dentro del aula. */
async function volverAVersion1(m, perfilId) {
  const info = structuredClone((await m.adulto.listarAulas())[perfilId]); // (el almacén en memoria comparte los objetos)
  const todos = [...m.nube.estado.archivos.values()];
  for (const a of todos) if (a.name.startsWith('medio-')) a.parents = [info.carpetaId];
  // la carpeta única `del-alumno/` dentro del aula, con los invitados como editores y los archivos de los alumnos dentro
  const drive = crearDriveAulas(m.nube.dep(ADULTO));
  const legada = await drive.crearCarpeta('del-alumno', { padre: info.carpetaId, propiedades: { leoConmigo: 'del-alumno', perfilId } });
  for (const correo of info.invitados) await drive.compartir(legada, correo, 'writer', { avisar: false });
  const propias = new Set(Object.values(info.carpetasAlumnos ?? {}));
  for (const a of todos) if (propias.has(a.parents?.[0])) a.parents = [legada];
  for (const id of [...propias, info.carpetaAlumnosId]) { m.nube.estado.archivos.delete(id); m.nube.estado.permisos.delete(id); }
  info.carpetaAlumnoId = legada;
  const aulaJson = todos.find((a) => a.name === 'aula.json' && a.parents[0] === info.carpetaId);
  const v1 = m.nube.json(aulaJson.id);
  delete v1.alumnos;
  delete v1.bibliotecaId;
  v1.version = 1;
  m.nube.reescribir(aulaJson.id, v1);
  // el almacén del adulto no sabe de la Biblioteca (como antes de actualizar la app)
  const aulas = { ...(await m.tienda.leerMeta('aulas')) };
  aulas[perfilId] = { perfilId, carpetaId: info.carpetaId, carpetaAlumnoId: legada, invitados: info.invitados };
  await m.tienda.escribirMeta('aulas', aulas);
  return info;
}

test('un aula versión 1 con datos se migra MOVIENDO los archivos (sin volver a subirlos) y sin perder lo del alumno', async () => {
  const m = await montar();
  await habilitar(m);
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  // el alumno jugó: una sesión suya viaja a su `del-alumno/`
  await m.a.store.guardar('sesiones', { id: 'ses-1', perfilId: 'P1', inicio: '2026-11-16T10:00:00.000Z', fin: '2026-11-16T10:05:00.000Z', ensayos: [] });
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  const info = await volverAVersion1(m, 'P1');
  const idsAntes = new Map(mediosEnDrive(m.nube).map((a) => [a.name, a.id]));
  m.nube.reiniciarPeticiones();

  const e = await m.adulto.sincronizarAula('P1');
  assert.equal(e.resumen.mediosSubidos, 0, 'no se volvió a subir ningún medio');
  const peticiones = m.nube.peticionesDe(ADULTO);
  assert.equal(peticiones.filter((p) => p.metodo === 'POST' && p.ruta.startsWith('/upload') && p.padre !== info.carpetaId).length, 0, 'ninguna subida de medios');
  const despues = mediosEnDrive(m.nube);
  assert.equal(despues.length, idsAntes.size);
  for (const a of despues) {
    assert.equal(idsAntes.get(a.name), a.id, 'es el mismo archivo');
    assert.notEqual(a.parents[0], info.carpetaId, 'ya no está en el aula');
  }
  const migrada = (await m.adulto.listarAulas()).P1;
  assert.ok(migrada.bibliotecaId);
  assert.ok(despues.every((a) => a.parents[0] === migrada.bibliotecaId));
  const aulaJson = m.nube.json(m.nube.porNombre('aula.json', info.carpetaId).id);
  assert.equal(aulaJson.version, 2);
  assert.equal(aulaJson.bibliotecaId, migrada.bibliotecaId);
  assert.deepEqual(aulaJson.alumnos, [{ email: A, carpetaId: migrada.carpetasAlumnos[A] }]);
  // adulto.json ya no lleva medios ni avance de alumnos
  const adultoJson = m.nube.json(m.nube.porNombre('adulto.json', info.carpetaId).id);
  assert.deepEqual(Object.keys(adultoJson.almacenes).sort(), ['calcomaniasPropias', 'frases', 'libros', 'palabras', 'perfiles', 'premios']);
  // lo que mandó el alumno llegó y sigue en su archivo
  assert.deepEqual((await m.tienda.listar('sesiones', { perfilId: 'ficha:P1:' + A })).map((s) => s.id), ['ses-1'], 'ahora bajo su ficha');
  assert.ok(m.nube.porNombre('alumno.json', info.carpetaAlumnoId), 'su archivo de antes sigue donde estaba (nada se borra)');
  // A sigue pudiendo sincronizar con la Biblioteca nueva
  const r = await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  assert.equal(r.desvinculado, false);
  assert.deepEqual(r.aula.version, 2);
  // los dos cursos migrados siguen compartiendo UNA copia del medio común
  await volverAVersion1(m, 'P2');
  await m.adulto.sincronizarAula('P2');
  assert.equal(mediosEnDrive(m.nube).filter((a) => a.name === 'medio-m-comun.webp').length, 1);
});

test('actualizar con un alumno ya conectado (fase 25): no se pierde nada, no se borra nada de Drive y el alumno sigue jugando con lo suyo', async () => {
  const m = await montar();
  await habilitar(m);
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  await m.a.store.guardar('sesiones', { id: 'ses-vieja', perfilId: 'P1', inicio: '2026-11-10T10:00:00.000Z', fin: '2026-11-10T10:05:00.000Z', ensayos: [] });
  await m.a.store.guardar('progresos', { id: 'P1:w1:L1', perfilId: 'P1', elementoId: 'w1', actividad: 'L1', aciertos: 4 });
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  await volverAVersion1(m, 'P1'); // así lo dejó la 0.36 (aula con medios dentro y una sola del-alumno/)
  const antes = new Set(m.nube.estado.archivos.keys());
  const palabrasAntes = await ids(m.a.store, 'palabras');
  m.nube.reiniciarPeticiones();

  // el adulto abre «Alumnos» con la versión nueva
  const e = await m.adulto.sincronizarAula('P1');
  assert.deepEqual(e.permisosExtranos, []);
  const ahora = new Set(m.nube.estado.archivos.keys());
  for (const id of antes) assert.ok(ahora.has(id), `el archivo ${id} sigue en Drive`);
  assert.ok(m.nube.peticionesDe(ADULTO).every((p) => p.metodo !== 'DELETE' || p.ruta.includes('/permissions')), 'el adulto no borró ningún archivo (solo retiró permisos de edición de la carpeta de antes)');
  assert.deepEqual((await m.tienda.listar('sesiones', { perfilId: 'ficha:P1:' + A })).map((s) => s.id), ['ses-vieja'], 'su avance pasó a su ficha');
  assert.equal((await m.tienda.listar('progresos', { perfilId: 'ficha:P1:' + A }))[0].aciertos, 4);
  assert.equal((await m.tienda.listar('sesiones', { perfilId: 'P1' })).length, 0, 'y no se mezcló con el curso');

  // el celular del alumno, ya con la versión nueva: conserva todo y sigue sincronizando en su carpeta nueva
  const r = await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  assert.equal(r.desvinculado, false);
  assert.deepEqual(await ids(m.a.store, 'palabras'), palabrasAntes);
  assert.deepEqual(await ids(m.a.store, 'sesiones'), ['ses-vieja']);
  assert.equal((await m.a.store.obtener('medios', 'm-comun')).blob.size > 0, true, 'sus fotos siguen en el celular');
  await m.a.store.guardar('sesiones', { id: 'ses-nueva', perfilId: 'P1', inicio: '2026-11-17T10:00:00.000Z', fin: '2026-11-17T10:05:00.000Z', ensayos: [] });
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  await m.adulto.sincronizarAula('P1');
  assert.deepEqual((await m.tienda.listar('sesiones', { perfilId: 'ficha:P1:' + A })).map((s) => s.id).sort(), ['ses-nueva', 'ses-vieja']);
  assert.ok(m.nube.peticionesDe(ADULTO).every((p) => p.metodo !== 'DELETE' || p.ruta.includes('/permissions')));
});

test('migración: un medio repetido (ya estaba en la Biblioteca) NO se borra: se queda en el aula para la limpieza', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const bibliotecaId = aula1.bibliotecaId; // (el almacén en memoria comparte el objeto: se anota antes de «volver a la versión 1»)
  const info = await volverAVersion1(m, 'P1');
  // «medio-m-solo1» también existe ya en la Biblioteca (otra copia que dejó una versión anterior)
  const dentro = m.nube.porNombre('medio-m-solo1.webp');
  const otra = await crearDriveCarpeta({ ...m.nube.dep(ADULTO), carpetaId: bibliotecaId }).crear('medio-m-solo1.webp', imagen(4), 'image/webp');
  await m.adulto.crearAula(await m.tienda.obtener('perfiles', 'P1')); // dispara la migración
  const copias = [...m.nube.estado.archivos.values()].filter((a) => a.name === 'medio-m-solo1.webp');
  assert.equal(copias.length, 2, 'las dos copias siguen en Drive');
  assert.ok(copias.some((a) => a.id === dentro.id && a.parents[0] === info.carpetaId), 'la repetida quedó en el aula');
  assert.ok(copias.some((a) => a.id === otra && a.parents[0] === bibliotecaId));
});

test('un celular de alumno con un aula versión 1 sin migrar sigue bajando sus medios del aula', async () => {
  const m = await montar();
  await habilitar(m);
  const info = await volverAVersion1(m, 'P1');
  const r = await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  assert.equal(r.desvinculado, false);
  assert.equal(r.mediosBajados, 2);
  assert.deepEqual(await ids(m.a.store, 'medios'), ['m-comun', 'm-solo1']);
  assert.ok(info.carpetaId);
});
