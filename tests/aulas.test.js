import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAulas, ErrorAula } from '../js/aulas.js';
import { crearDriveAulas, crearDriveCarpeta, ErrorDrive } from '../js/drive.js';
import { vistaDePerfil, ErrorVistaPerfil } from '../js/store-perfil.js';
import { crearNubeFalsa } from './drive-falso.js';
import { bytesDe, crearStoreEnMemoria } from './memoria.js';

const ADULTO = 'adulto@ejemplo.com';
const A = 'pedro@gmail.com'; // alumno A (perfil P1)
const B = 'sofia@gmail.com'; // alumno B (perfil P2)
const C = 'tercero@gmail.com'; // no invitado a nada

const imagen = (...b) => new Blob([Uint8Array.from(b)], { type: 'image/webp' });
const audio = (...b) => new Blob([Uint8Array.from(b)], { type: 'audio/webm' });
const ids = async (store, almacen, conBorrados = false) => (await store.listar(almacen, { conBorrados })).map((r) => r.id).sort();

/** El adulto con dos perfiles (P1 Pedro con álbum, libro, premio y voces; P2 Sofía) y las cuentas de los demás. */
async function montar() {
  const nube = crearNubeFalsa();
  const tienda = crearStoreEnMemoria({ prefijo: 'ad' });
  await tienda.guardar('medios', { id: 'm-foto', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(1, 2, 3) });
  await tienda.guardar('medios', { id: 'm-img', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(4, 5, 6, 13, 10) });
  await tienda.guardar('medios', { id: 'm-voz', tipo: 'audio', mime: 'audio/webm', origen: 'grabacion', blob: audio(7, 8, 9) });
  await tienda.guardar('medios', { id: 'm-port', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(10) });
  await tienda.guardar('medios', { id: 'm-sobre', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(11) });
  await tienda.guardar('medios', { id: 'm-lamina', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(12) });
  await tienda.guardar('medios', { id: 'm-premio', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(13) });
  await tienda.guardar('medios', { id: 'm-pag', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(14) });
  await tienda.guardar('medios', { id: 'm-de-sofia', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(99) });
  await tienda.guardar('perfiles', { id: 'P1', nombre: 'Pedro', fotoMedioId: 'm-foto', colecciones: [{ id: 'c1', nombre: 'Dinos', medioPortadaId: 'm-port', medioSobreId: 'm-sobre' }] });
  await tienda.guardar('perfiles', { id: 'P2', nombre: 'Sofía' });
  await tienda.guardar('palabras', { id: 'w-perro', perfilId: 'P1', texto: 'perro', medioImagenId: 'm-img', medioAudioId: 'm-voz' });
  await tienda.guardar('palabras', { id: 'w-sofia', perfilId: 'P2', texto: 'luna', medioImagenId: 'm-de-sofia' });
  await tienda.guardar('frases', { id: 'f1', perfilId: 'P1', texto: 'el perro', palabraIds: ['w-perro'] });
  await tienda.guardar('libros', { id: 'l1', perfilId: 'P1', titulo: 'Mi libro', paginas: [{ medioImagenId: 'm-pag', fraseId: 'f1' }] });
  await tienda.guardar('calcomaniasPropias', { id: 'cp1', perfilId: 'P1', coleccionId: 'c1', medioImagenId: 'm-lamina' });
  await tienda.guardar('premios', { id: 'pr1', perfilId: 'P1', nombre: 'Helado', precio: 3, medioImagenId: 'm-premio' });
  const adulto = crearAulas({ store: tienda, ...nube.dep(ADULTO), emailAdulto: ADULTO, versionApp: '0.34.0' });
  const alumno = (email, id, prefijo) => {
    const store = crearStoreEnMemoria({ prefijo, desde: 100 });
    return { store, email, aulas: crearAulas({ store, ...nube.dep(email), idDispositivo: id, nombreDispositivo: `Tablet ${id}`, versionApp: '0.34.0' }) };
  };
  return { nube, tienda, adulto, a: alumno(A, 'disp-a', 'al'), b: alumno(B, 'disp-b', 'bl'), c: alumno(C, 'disp-c', 'cl') };
}

/** El adulto habilita a los dos alumnos y sincroniza las dos aulas. */
async function habilitar(m) {
  const p1 = await m.tienda.obtener('perfiles', 'P1');
  const p2 = await m.tienda.obtener('perfiles', 'P2');
  const aula1 = await m.adulto.crearAula(p1);
  const aula2 = await m.adulto.crearAula(p2);
  await m.adulto.invitar('P1', A);
  await m.adulto.invitar('P2', B);
  await m.adulto.sincronizarAula('P1');
  await m.adulto.sincronizarAula('P2');
  return { aula1, aula2 };
}

const miAula = async (alumno) => (await alumno.aulas.buscarMiAula())[0];

// ---------------------------------------------------------------------------------------------------------------

test('el adulto crea dos aulas e invita a A y a B: cada uno encuentra solo la suya y el tercero ninguna', async () => {
  const m = await montar();
  const { aula1, aula2 } = await habilitar(m);

  const delA = await m.a.aulas.buscarMiAula();
  assert.equal(delA.length, 1);
  assert.equal(delA[0].perfilId, 'P1');
  assert.equal(delA[0].carpetaId, aula1.carpetaId);
  assert.equal(delA[0].carpetaAlumnoId, aula1.carpetaAlumnoId);
  assert.equal(delA[0].dueno, ADULTO);
  const delB = await m.b.aulas.buscarMiAula();
  assert.deepEqual(delB.map((x) => x.perfilId), ['P2']);
  assert.equal(delB[0].carpetaId, aula2.carpetaId);
  assert.deepEqual(await m.c.aulas.buscarMiAula(), []);

  // los permisos de Drive son los de la tabla «Quién puede tocar qué»
  const enAula = m.nube.permisosDe(aula1.carpetaId).map((p) => [p.emailAddress, p.role]).sort();
  assert.deepEqual(enAula, [[ADULTO, 'owner'], [A, 'reader']]);
  const enDelAlumno = m.nube.permisosDe(aula1.carpetaAlumnoId).filter((p) => p.emailAddress === A).map((p) => p.role);
  assert.deepEqual(enDelAlumno, ['writer']);
  const trabajo = m.nube.archivo(aula1.carpetaId).parents[0];
  assert.deepEqual(m.nube.permisosDe(trabajo).map((p) => p.emailAddress), [ADULTO], 'la carpeta de trabajo no se comparte con nadie');
  assert.ok(m.nube.permisosDe(aula1.carpetaId).every((p) => p.type === 'user'), 'nunca «cualquiera con el enlace»');
  assert.deepEqual(m.nube.estado.avisos.map((x) => x.a).sort(), [A, B], 'solo un aviso por correo');
});

test('A baja todo (palabra con foto y voz, libro, álbum con portada y sobre) y se registra', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const r = await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });

  assert.equal(r.desvinculado, false);
  assert.equal(r.aula.perfilId, 'P1');
  assert.deepEqual(await ids(m.a.store, 'perfiles'), ['P1']);
  assert.deepEqual(await ids(m.a.store, 'palabras'), ['w-perro']);
  assert.deepEqual(await ids(m.a.store, 'libros'), ['l1']);
  assert.deepEqual(await ids(m.a.store, 'frases'), ['f1']);
  assert.deepEqual(await ids(m.a.store, 'calcomaniasPropias'), ['cp1']);
  assert.deepEqual(await ids(m.a.store, 'premios'), ['pr1']);
  assert.deepEqual(await ids(m.a.store, 'medios'), ['m-foto', 'm-img', 'm-lamina', 'm-pag', 'm-port', 'm-premio', 'm-sobre', 'm-voz']);
  assert.deepEqual(await bytesDe((await m.a.store.obtener('medios', 'm-voz')).blob), [7, 8, 9]);
  assert.deepEqual(await bytesDe((await m.a.store.obtener('medios', 'm-sobre')).blob), [11]);
  assert.equal(await m.a.store.obtener('medios', 'm-de-sofia'), undefined, 'los medios de otro perfil no se bajan');
  assert.equal(r.mediosBajados, 8);

  // se registró: su archivo de dispositivo está en del-alumno/ y es de su cuenta
  const disp = m.nube.porNombre('dispositivo-disp-a.json', aula1.carpetaAlumnoId);
  assert.ok(disp);
  assert.equal(disp.owner, A);
  assert.equal(m.nube.json(disp.id).email, A);

  // el adulto lo ve «Conectado»
  const e = await m.adulto.sincronizarAula('P1');
  assert.equal(e.alumnos.find((x) => x.email === A).estado, 'conectado');
  assert.equal(e.alumnos.find((x) => x.email === A).dispositivos[0].idDispositivo, 'disp-a');
  assert.deepEqual(e.permisosExtranos, []);
});

test('A no puede escribir en el aula, en la carpeta de trabajo ni en el aula de B (y la app no lo intenta)', async () => {
  const m = await montar();
  const { aula1, aula2 } = await habilitar(m);
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  const dep = m.nube.dep(A);
  const enAula = crearDriveCarpeta({ ...dep, carpetaId: aula1.carpetaId });
  const archivos = await enAula.listar();
  const idDe = (nombre) => archivos.find((x) => x.name === nombre).id;

  for (const nombre of ['adulto.json', 'aula.json', 'medio-m-img.webp']) {
    await assert.rejects(() => enAula.actualizar(idDe(nombre), 'trampa', 'application/json'), (e) => e instanceof ErrorDrive && e.estado === 403, `actualizar ${nombre}`);
    await assert.rejects(() => enAula.borrar(idDe(nombre)), (e) => e instanceof ErrorDrive && e.estado === 403, `borrar ${nombre}`);
  }
  await assert.rejects(() => enAula.crear('nuevo.json', '{}', 'application/json'), (e) => e.estado === 403, 'crear en el aula');
  assert.equal(m.nube.json(idDe('adulto.json')).perfilId, 'P1', 'el contenido no cambió');

  const trabajo = m.nube.archivo(aula1.carpetaId).parents[0];
  await assert.rejects(() => crearDriveCarpeta({ ...dep, carpetaId: trabajo }).crear('x.json', '{}', 'application/json'), (e) => e.sinAcceso === true, 'carpeta de trabajo');
  assert.deepEqual((await crearDriveCarpeta({ ...dep, carpetaId: trabajo }).listar()).map((x) => x.id), [aula1.carpetaId], 'de la carpeta de trabajo solo se ve su propia aula');
  assert.deepEqual(await crearDriveCarpeta({ ...dep, carpetaId: aula2.carpetaId }).listar(), [], 'el aula de B se ve vacía');
  await assert.rejects(() => crearDriveCarpeta({ ...dep, carpetaId: aula2.carpetaId }).crear('x.json', '{}', 'application/json'), (e) => e.sinAcceso === true, 'aula de B');
  await assert.rejects(() => crearDriveCarpeta({ ...dep, carpetaId: aula2.carpetaAlumnoId }).crear('x.json', '{}', 'application/json'), (e) => e.sinAcceso === true, 'del-alumno de B');

  // la app: lo único que A escribió fue dentro de su `del-alumno/`
  m.nube.reiniciarPeticiones();
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  const escrituras = m.nube.peticionesDe(A).filter((p) => p.metodo !== 'GET');
  assert.ok(escrituras.length > 0);
  assert.ok(escrituras.every((p) => p.padre === aula1.carpetaAlumnoId), JSON.stringify(escrituras));
  // y B tampoco ve ni toca lo de A
  const aulaB = await m.b.aulas.buscarMiAula();
  assert.ok(aulaB.every((x) => x.carpetaId !== aula1.carpetaId));
});

test('el adulto nunca escribe dentro de `del-alumno/` al sincronizar', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  m.nube.reiniciarPeticiones();
  await m.adulto.sincronizarAula('P1');
  const escrituras = m.nube.peticionesDe(ADULTO).filter((p) => p.metodo !== 'GET' && !p.ruta.includes('/permissions'));
  assert.ok(escrituras.every((p) => p.padre !== aula1.carpetaAlumnoId), JSON.stringify(escrituras));
});

test('A juega sin conexión y al volver sube sesión y respuestas, que aparecen en el adulto con el mismo perfilId', async () => {
  const m = await montar();
  await habilitar(m);
  const aula = await miAula(m.a);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });

  // sin conexión: la sesión se juega y se guarda en el almacén local
  m.nube.estado.sinRed = true;
  await assert.rejects(() => m.a.aulas.sincronizarComoAlumno({ aula, email: A }), (e) => e.sinConexion === true);
  await m.a.store.guardar('sesiones', { id: 's1', perfilId: 'P1', etapa: 1, ensayos: 8 });
  await m.a.store.guardar('respuestas', { id: 'r1', perfilId: 'P1', elementoId: 'w-perro', acierto: true });
  await m.a.store.guardar('progresos', { id: 'g1', perfilId: 'P1', palabraId: 'w-perro', caja: 2 });
  await m.a.store.guardar('movimientos', { id: 'mv1', perfilId: 'P1', monedas: 2 });
  await m.a.store.guardar('calcomanias', { id: 'k1', perfilId: 'P1', codigo: 'gta-01' });
  m.nube.estado.sinRed = false;

  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  await m.adulto.sincronizarAula('P1');
  for (const [almacen, id] of [['sesiones', 's1'], ['respuestas', 'r1'], ['progresos', 'g1'], ['movimientos', 'mv1'], ['calcomanias', 'k1']]) {
    const r = await m.tienda.obtener(almacen, id);
    assert.equal(r?.perfilId, 'P1', `${almacen} llegó al adulto`);
  }
  // lo del alumno no toca a Sofía
  assert.equal((await m.tienda.listar('sesiones')).filter((s) => s.perfilId !== 'P1').length, 0);
});

test('un alumno.json manipulado (palabra, medio, registro de B, perfil ajeno) no cambia nada en el adulto y deja un aviso', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const aula = await miAula(m.a);
  await m.a.store.guardar('sesiones', { id: 's1', perfilId: 'P1' });
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });

  const archivo = m.nube.porNombre('alumno.json', aula1.carpetaAlumnoId);
  const doc = m.nube.json(archivo.id);
  const futuro = '2099-01-01T00:00:00.000Z';
  doc.almacenes.palabras = [{ id: 'w-trampa', perfilId: 'P1', texto: 'trampa', updatedAt: futuro }, { id: 'w-perro', perfilId: 'P1', texto: 'CAMBIADA', updatedAt: futuro }];
  doc.almacenes.medios = [{ id: 'm-trampa', mime: 'image/webp', updatedAt: futuro }];
  doc.almacenes.libros = [{ id: 'l1', perfilId: 'P1', titulo: 'CAMBIADO', updatedAt: futuro }];
  doc.almacenes.progresos.push({ id: 'g-ajeno', perfilId: 'P2', updatedAt: futuro });
  doc.almacenes.sesiones.push({ id: 's-ajena', perfilId: 'P2', updatedAt: futuro }, { id: 's-sin-perfil', updatedAt: futuro });
  doc.almacenes.perfiles.push({ id: 'P2', nombre: 'HACKEADO', updatedAt: futuro });
  m.nube.reescribir(archivo.id, doc);

  const antes = { palabras: await ids(m.tienda, 'palabras', true), medios: await ids(m.tienda, 'medios', true) };
  const sofia = await m.tienda.obtener('perfiles', 'P2');
  const { resumen } = await m.adulto.sincronizarAula('P1');

  assert.deepEqual(await ids(m.tienda, 'palabras', true), antes.palabras);
  assert.deepEqual(await ids(m.tienda, 'medios', true), antes.medios);
  assert.equal((await m.tienda.obtener('palabras', 'w-perro')).texto, 'perro');
  assert.equal((await m.tienda.obtener('libros', 'l1')).titulo, 'Mi libro');
  assert.equal(await m.tienda.obtener('progresos', 'g-ajeno'), undefined);
  assert.equal(await m.tienda.obtener('sesiones', 's-ajena'), undefined);
  assert.equal(await m.tienda.obtener('sesiones', 's-sin-perfil'), undefined);
  assert.deepEqual(await m.tienda.obtener('perfiles', 'P2'), sofia);
  assert.equal((await m.tienda.obtener('sesiones', 's1')).perfilId, 'P1', 'lo legítimo sí llega');
  assert.ok(resumen.avisos.length > 0);
  assert.deepEqual(Object.keys(resumen.descartados.porAlmacen).sort(), ['libros', 'medios', 'palabras', 'perfiles', 'progresos', 'sesiones']);
  assert.equal(resumen.descartados.porAlmacen.palabras, 2);

  // tampoco se republica la manipulación: lo del aula de P2 no cambió
  const aula2 = await m.adulto.sincronizarAula('P2');
  assert.deepEqual(aula2.resumen.descartados.total, 0);
});

test('si el propio alumno.json de A trae registros ajenos (manipulado con su cuenta), A no los toma y el archivo se limpia', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const aula = await miAula(m.a);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  const archivo = m.nube.porNombre('alumno.json', aula1.carpetaAlumnoId);
  const doc = m.nube.json(archivo.id);
  doc.almacenes.progresos.push({ id: 'g-ajeno', perfilId: 'P2', updatedAt: '2099-01-01T00:00:00.000Z' });
  doc.almacenes.palabras = [{ id: 'w-x', perfilId: 'P1', updatedAt: '2099-01-01T00:00:00.000Z' }];
  m.nube.reescribir(archivo.id, doc);
  const r = await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  assert.equal(await m.a.store.obtener('progresos', 'g-ajeno'), undefined);
  assert.equal(await m.a.store.obtener('palabras', 'w-x'), undefined);
  assert.ok(r.avisos.length > 0);
  const limpio = m.nube.json(archivo.id);
  assert.ok(!limpio.almacenes.progresos.some((x) => x.id === 'g-ajeno'));
  assert.equal(limpio.almacenes.palabras, undefined);
});

test('un alumno.json de otro dueño, de otro perfil o dañado se ignora con un aviso', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  const archivo = m.nube.porNombre('alumno.json', aula1.carpetaAlumnoId);
  const bueno = m.nube.json(archivo.id);

  m.nube.reescribir(archivo.id, { ...bueno, perfilId: 'P2' });
  let r = (await m.adulto.sincronizarAula('P1')).resumen;
  assert.ok(r.avisos.some((a) => /otro perfil/.test(a)));
  m.nube.reescribir(archivo.id, '{ esto no es json');
  r = (await m.adulto.sincronizarAula('P1')).resumen;
  assert.ok(r.avisos.some((a) => /alumno\.json/.test(a)));
  m.nube.reescribir(archivo.id, { ...bueno, rol: 'adulto' });
  r = (await m.adulto.sincronizarAula('P1')).resumen;
  assert.ok(r.avisos.some((a) => /no lo escribió el alumno/.test(a)));

  // un alumno.json cuyo dueño no está invitado (p. ej. alguien con acceso que no debería) no se lee
  m.nube.archivo(archivo.id).owner = C;
  m.nube.reescribir(archivo.id, bueno);
  r = (await m.adulto.sincronizarAula('P1')).resumen;
  assert.ok(r.avisos.some((a) => /no está invitado/.test(a)));
});

test('el adulto agrega un álbum y A lo recibe; un medio borrado por el adulto desaparece en A y no vuelve', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const aula = await miAula(m.a);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });

  // álbum nuevo con portada, sobre y una lámina
  await m.tienda.guardar('medios', { id: 'm-port2', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(21) });
  await m.tienda.guardar('medios', { id: 'm-sobre2', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(22) });
  await m.tienda.guardar('medios', { id: 'm-lam2', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(23) });
  const p1 = await m.tienda.obtener('perfiles', 'P1');
  await m.tienda.guardar('perfiles', { ...p1, colecciones: [...p1.colecciones, { id: 'c2', nombre: 'Autos', medioPortadaId: 'm-port2', medioSobreId: 'm-sobre2' }] });
  await m.tienda.guardar('calcomaniasPropias', { id: 'cp2', perfilId: 'P1', coleccionId: 'c2', medioImagenId: 'm-lam2' });
  await m.adulto.sincronizarAula('P1');

  const r = await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  assert.equal(r.mediosBajados, 3);
  assert.deepEqual((await m.a.store.obtener('perfiles', 'P1')).colecciones.map((c) => c.id), ['c1', 'c2']);
  assert.deepEqual(await bytesDe((await m.a.store.obtener('medios', 'm-port2')).blob), [21]);
  assert.deepEqual(await ids(m.a.store, 'calcomaniasPropias'), ['cp1', 'cp2']);

  // borrar un medio
  assert.ok(m.nube.porNombre('medio-m-voz.webm', aula1.carpetaId));
  await m.tienda.borrar('medios', 'm-voz');
  await m.adulto.sincronizarAula('P1');
  assert.equal(m.nube.porNombre('medio-m-voz.webm', aula1.carpetaId), undefined, 'el adulto limpia el archivo del aula');
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  assert.equal(await m.a.store.obtener('medios', 'm-voz'), undefined);
  assert.equal((await m.a.store.obtener('medios', 'm-voz', { conBorrados: true })).deleted, true);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  await m.adulto.sincronizarAula('P1');
  assert.equal(await m.a.store.obtener('medios', 'm-voz'), undefined, 'no vuelve');
  assert.equal(await m.tienda.obtener('medios', 'm-voz'), undefined, 'ni en el adulto');
  assert.deepEqual(await bytesDe((await m.a.store.obtener('medios', 'm-img')).blob), [4, 5, 6, 13, 10], 'lo demás sigue intacto');
});

test('si el adulto cambia un ajuste y A también, gana el más reciente; el alumno nunca publica lo del adulto', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const aula = await miAula(m.a);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  // el alumno cambia una palabra localmente: nunca viaja (es del adulto)
  const w = await m.a.store.obtener('palabras', 'w-perro');
  await m.a.store.guardar('palabras', { ...w, texto: 'CAMBIO DEL ALUMNO' });
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  const doc = m.nube.json(m.nube.porNombre('alumno.json', aula1.carpetaAlumnoId).id);
  assert.deepEqual(Object.keys(doc.almacenes).sort(), ['calcomanias', 'movimientos', 'niveles', 'perfiles', 'progresos', 'respuestas', 'sesiones']);
  await m.adulto.sincronizarAula('P1');
  assert.equal((await m.tienda.obtener('palabras', 'w-perro')).texto, 'perro');
});

test('un permiso `anyone` o un editor en el aula puestos a mano salen como «Permiso extraño»; se quitan solo a pedido', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  assert.deepEqual(await m.adulto.revisarPermisos('P1'), []);

  m.nube.permitir(aula1.carpetaId, { type: 'anyone', role: 'reader' });
  m.nube.permitir(aula1.carpetaId, { type: 'user', role: 'writer', emailAddress: A });
  const { permisosExtranos } = await m.adulto.sincronizarAula('P1');
  assert.deepEqual(permisosExtranos.map((p) => [p.carpeta, p.tipo, p.rol]).sort(), [['aula', 'anyone', 'reader'], ['aula', 'user', 'writer']].sort());
  assert.equal(m.nube.permisosDe(aula1.carpetaId).some((p) => p.type === 'anyone'), true, 'la app no lo quita sola');

  for (const p of permisosExtranos) await m.adulto.quitarPermisoExtrano('P1', p);
  assert.deepEqual(await m.adulto.revisarPermisos('P1'), []);
  assert.equal(m.nube.permisosDe(aula1.carpetaId).some((p) => p.type === 'anyone'), false);
});

test('quitar acceso: A deja de ver el aula, el correo sale de la lista y los datos ya traídos se quedan', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const aula = await miAula(m.a);
  await m.a.store.guardar('sesiones', { id: 's1', perfilId: 'P1' });
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  await m.adulto.sincronizarAula('P1');

  const info = await m.adulto.quitarAcceso('P1', A);
  assert.deepEqual(info.invitados, []);
  assert.deepEqual(await m.a.aulas.buscarMiAula(), []);
  await assert.rejects(() => m.a.aulas.sincronizarComoAlumno({ aula, email: A }), (e) => e.sinAcceso === true);
  assert.deepEqual(m.nube.permisosDe(aula1.carpetaAlumnoId).map((p) => p.emailAddress), [ADULTO]);
  assert.equal((await m.tienda.obtener('sesiones', 's1')).perfilId, 'P1');
  // y con su dispositivo todavía en la carpeta, el adulto ya no lo cuenta como invitado
  const e = await m.adulto.sincronizarAula('P1');
  assert.deepEqual(e.alumnos, []);
});

test('desvincular un dispositivo lo anota en aula.json y ese dispositivo deja de sincronizar', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const aula = await miAula(m.a);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  const nuevo = await m.adulto.desvincularDispositivo('P1', 'disp-a');
  assert.deepEqual(nuevo.desvinculados, ['disp-a']);
  assert.deepEqual(m.nube.json(m.nube.porNombre('aula.json', aula1.carpetaId).id).desvinculados, ['disp-a']);
  const r = await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  assert.equal(r.desvinculado, true);
  // otro dispositivo de la misma cuenta sigue funcionando
  const otro = crearAulas({ store: crearStoreEnMemoria({ prefijo: 'ot' }), ...m.nube.dep(A), idDispositivo: 'disp-a2', versionApp: '0.34.0' });
  assert.equal((await otro.sincronizarComoAlumno({ aula, email: A })).desvinculado, false);
});

test('cambiar el fondo lo reescribe en aula.json y A lo recibe; si no cambió no se reescribe', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const aula = await miAula(m.a);
  const fondo = { color: '#ffeedd', alpha: 0.3, textura: 'agua' };
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  assert.equal(await m.a.aulas.huboCambiosDelAdulto(aula), false);

  await m.adulto.cambiarApariencia('P1', fondo);
  assert.deepEqual(m.nube.json(m.nube.porNombre('aula.json', aula1.carpetaId).id).apariencia.fondo, fondo);
  assert.equal(await m.a.aulas.huboCambiosDelAdulto(aula), true, 'el alumno detecta que aula.json cambió');
  const r = await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  assert.deepEqual(r.aula.apariencia.fondo, fondo);

  m.nube.reiniciarPeticiones();
  await m.adulto.cambiarApariencia('P1', fondo);
  assert.equal(m.nube.peticionesDe(ADULTO).filter((p) => p.metodo !== 'GET').length, 0, 'mismo fondo: no se escribe nada');
  assert.equal(await m.a.aulas.huboCambiosDelAdulto(aula), false);
});

test('dos cuentas del mismo alumno (tablet y celular) comparten el aula y el adulto las ve a las dos', async () => {
  const m = await montar();
  await habilitar(m);
  await m.adulto.invitar('P1', C);
  const aulaA = await miAula(m.a);
  const aulaC = await miAula(m.c);
  assert.equal(aulaC.perfilId, 'P1');
  await m.a.store.guardar('sesiones', { id: 'sa', perfilId: 'P1' });
  await m.c.store.guardar('sesiones', { id: 'sc', perfilId: 'P1' });
  await m.a.aulas.sincronizarComoAlumno({ aula: aulaA, email: A });
  await m.c.aulas.sincronizarComoAlumno({ aula: aulaC, email: C });
  const e = await m.adulto.sincronizarAula('P1');
  assert.deepEqual(e.alumnos.map((x) => [x.email, x.estado]).sort(), [[A, 'conectado'], [C, 'conectado']]);
  assert.deepEqual(await ids(m.tienda, 'sesiones'), ['sa', 'sc']);
});

// ---------------------------------------------------------------------------------------------------------------

test('si la carpeta de trabajo se compartió a mano, no se habilita a ningún alumno', async () => {
  const m = await montar();
  const trabajo = await m.adulto.asegurarCarpetaDeTrabajo();
  m.nube.permitir(trabajo, { type: 'user', role: 'writer', emailAddress: C });
  await assert.rejects(async () => m.adulto.crearAula(await m.tienda.obtener('perfiles', 'P1')), (e) => e instanceof ErrorAula && e.permisosExtranos.length === 1);
  assert.equal(m.nube.hijos(trabajo).length, 0);
});

test('compartir solo acepta reader o writer para una persona con su correo', async () => {
  const m = await montar();
  const drive = crearDriveAulas(m.nube.dep(ADULTO));
  const carpeta = await drive.crearCarpeta('X');
  for (const rol of ['owner', 'commenter', 'organizer', 'anyone', 'fileOrganizer', '', undefined]) {
    await assert.rejects(() => drive.compartir(carpeta, A, rol), /Rol no permitido/, String(rol));
  }
  for (const correo of ['', 'sin-arroba', 'a b@c.com', null]) await assert.rejects(() => drive.compartir(carpeta, correo, 'reader'), /correo/);
  assert.deepEqual(m.nube.permisosDe(carpeta).map((p) => p.emailAddress), [ADULTO], 'no se compartió nada');
  await drive.compartir(carpeta, A, 'reader');
  assert.equal(m.nube.permisosDe(carpeta).find((p) => p.emailAddress === A).role, 'reader');
});

test('invitar rechaza un correo inválido y el propio correo del adulto', async () => {
  const m = await montar();
  await habilitar(m);
  await assert.rejects(() => m.adulto.invitar('P1', 'no-es-correo'), ErrorAula);
  await assert.rejects(() => m.adulto.invitar('P1', ADULTO.toUpperCase()), ErrorAula);
  await assert.rejects(() => m.adulto.invitar('P9', A), ErrorAula);
});

test('el Drive falso exige token y no deja ver lo que no se comparte', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const intruso = crearDriveCarpeta({ obtenerToken: async () => 'token-falso', fetchFn: m.nube.cuenta(C).fetch, carpetaId: aula1.carpetaId });
  await assert.rejects(() => intruso.listar(), (e) => e.sesion === true && e.estado === 401);
  await assert.rejects(() => crearDriveCarpeta({ ...m.nube.dep(C), carpetaId: aula1.carpetaId }).leerJson(m.nube.porNombre('adulto.json', aula1.carpetaId).id), (e) => e.sinAcceso === true);
});

// ---------------------------------------------------------------------------------------------------------------

test('vistaDePerfil: solo ve lo del perfil, rechaza importar lo de otro y mantiene los medios ya conocidos', async () => {
  const store = crearStoreEnMemoria({ prefijo: 'v' });
  await store.guardar('perfiles', { id: 'P1', nombre: 'Pedro', fotoMedioId: 'f1', colecciones: [{ id: 'c', medioPortadaId: 'port' }] });
  await store.guardar('perfiles', { id: 'P2', nombre: 'Sofía', fotoMedioId: 'f2' });
  await store.guardar('palabras', { id: 'a', perfilId: 'P1', medioImagenId: 'i1' });
  await store.guardar('palabras', { id: 'b', perfilId: 'P2', medioImagenId: 'i2' });
  for (const id of ['f1', 'f2', 'i1', 'i2', 'port', 'huerfano', 'viejo']) await store.guardar('medios', { id, mime: 'image/webp', blob: imagen(1) });
  await store.borrar('medios', 'viejo');
  const vista = vistaDePerfil(store, 'P1', { idsMediosConocidos: ['viejo'] });

  assert.deepEqual(await ids(vista, 'perfiles'), ['P1']);
  assert.deepEqual(await ids(vista, 'palabras'), ['a']);
  assert.deepEqual(await ids(vista, 'medios'), ['f1', 'i1', 'port']);
  assert.deepEqual(await ids(vista, 'medios', true), ['f1', 'i1', 'port', 'viejo'], 'un borrado conocido sigue viajando');
  assert.equal(await vista.obtener('palabras', 'b'), undefined);

  await assert.rejects(() => vista.importar('palabras', [{ id: 'x', perfilId: 'P2' }]), ErrorVistaPerfil);
  await assert.rejects(() => vista.importar('perfiles', [{ id: 'P2' }]), ErrorVistaPerfil);
  await assert.rejects(() => vista.importar('palabras', [{ id: 'ok', perfilId: 'P1' }, { id: 'x', perfilId: 'P2' }]), ErrorVistaPerfil);
  assert.equal(await store.obtener('palabras', 'ok'), undefined, 'no se escribe ninguno');
  await vista.importar('palabras', [{ id: 'bueno', perfilId: 'P1' }]);
  assert.ok(await store.obtener('palabras', 'bueno'));
});

test('vistaDePerfil: la cola de la sincronización personal se filtra y no se limpia; la meta lleva prefijo', async () => {
  const store = crearStoreEnMemoria({ prefijo: 'v' });
  await store.guardar('perfiles', { id: 'P1' });
  await store.guardar('perfiles', { id: 'P2' });
  await store.guardar('palabras', { id: 'a', perfilId: 'P1' });
  await store.guardar('palabras', { id: 'b', perfilId: 'P2' });
  const vista = vistaDePerfil(store, 'P1');
  const cola = await vista.pendientesSync();
  assert.deepEqual(cola.map((c) => c.clave).sort(), ['palabras/a', 'perfiles/P1']);
  await vista.limpiarCola(cola);
  assert.equal((await store.pendientesSync()).length, 4, 'la cola de la sincronización personal no se toca');
  await vista.escribirMeta('syncUltimo', 'x');
  assert.equal(await store.leerMeta('aula:P1:syncUltimo'), 'x');
  assert.equal(await store.leerMeta('syncUltimo'), undefined);
});

test('la sincronización del aula no toca la cola ni la meta de la sincronización personal', async () => {
  const m = await montar();
  await habilitar(m);
  const cola = (await m.tienda.pendientesSync()).length;
  assert.ok(cola > 0);
  assert.equal(await m.tienda.leerMeta('syncUltimo'), undefined);
  assert.ok(await m.tienda.leerMeta('aula:P1:syncUltimo'));
  await m.adulto.sincronizarAula('P1');
  assert.equal((await m.tienda.pendientesSync()).length, cola);
});
