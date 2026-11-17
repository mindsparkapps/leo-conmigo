import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAulas, ErrorAula } from '../js/aulas.js';
import { crearDriveAulas, crearDriveCarpeta, ErrorDrive } from '../js/drive.js';
import { vistaDePerfil, vistaDeFichas, ErrorVistaPerfil } from '../js/store-perfil.js';
import { idDeFicha } from '../js/core/curso.js';
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
  await m.adulto.crearAula(p1);
  await m.adulto.crearAula(p2);
  await m.adulto.invitar('P1', A);
  await m.adulto.invitar('P2', B);
  await m.adulto.sincronizarAula('P1');
  await m.adulto.sincronizarAula('P2');
  const aulas = await m.adulto.listarAulas(); // con las carpetas de cada alumno ya creadas
  return { aula1: aulas.P1, aula2: aulas.P2 };
}

const fichaA = idDeFicha('P1', A);
const fichaC = idDeFicha('P1', C);

const miAula = async (alumno) => (await alumno.aulas.buscarMiAula())[0];

// ---------------------------------------------------------------------------------------------------------------

test('el adulto crea dos aulas e invita a A y a B: cada uno encuentra solo la suya y el tercero ninguna', async () => {
  const m = await montar();
  const { aula1, aula2 } = await habilitar(m);

  const delA = await m.a.aulas.buscarMiAula();
  assert.equal(delA.length, 1);
  assert.equal(delA[0].perfilId, 'P1');
  assert.equal(delA[0].carpetaId, aula1.carpetaId);
  assert.equal(delA[0].carpetaAlumnoId, aula1.carpetasAlumnos[A], 'cada alumno encuentra SU carpeta');
  assert.equal(delA[0].dueno, ADULTO);
  const delB = await m.b.aulas.buscarMiAula();
  assert.deepEqual(delB.map((x) => x.perfilId), ['P2']);
  assert.equal(delB[0].carpetaId, aula2.carpetaId);
  assert.deepEqual(await m.c.aulas.buscarMiAula(), []);

  // los permisos de Drive son los de la tabla «Quién puede tocar qué»
  const enAula = m.nube.permisosDe(aula1.carpetaId).map((p) => [p.emailAddress, p.role]).sort();
  assert.deepEqual(enAula, [[ADULTO, 'owner'], [A, 'reader']]);
  assert.deepEqual(m.nube.permisosDe(aula1.carpetasAlumnos[A]).map((p) => [p.emailAddress, p.role]).sort(), [[ADULTO, 'owner'], [A, 'writer']], 'solo A escribe en su carpeta y nadie más la ve');
  assert.equal(m.nube.archivo(aula1.carpetasAlumnos[A]).parents[0], aula1.carpetaAlumnosId, 'la carpeta de A está fuera del aula');
  assert.notEqual(m.nube.archivo(aula1.carpetaAlumnosId).parents[0], aula1.carpetaId);
  assert.deepEqual(m.nube.permisosDe(aula1.carpetaAlumnosId).map((p) => p.emailAddress), [ADULTO], 'el contenedor de los alumnos es privado');
  assert.equal(aula1.carpetaAlumnoId, null, 'un aula nueva ya no tiene la carpeta única del-alumno');
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
  const disp = m.nube.porNombre('dispositivo-disp-a.json', aula1.carpetasAlumnos[A]);
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
  const enBiblioteca = crearDriveCarpeta({ ...dep, carpetaId: aula1.bibliotecaId });
  const archivos = [...await enAula.listar(), ...await enBiblioteca.listar()];
  const idDe = (nombre) => archivos.find((x) => x.name === nombre).id;
  assert.ok(!archivos.some((x) => x.name.startsWith('medio-') && x.parents?.[0] === aula1.carpetaId), 'el aula ya no guarda medios');

  for (const [nombre, cliente] of [['adulto.json', enAula], ['aula.json', enAula], ['medio-m-img.webp', enBiblioteca]]) {
    await assert.rejects(() => cliente.actualizar(idDe(nombre), 'trampa', 'application/json'), (e) => e instanceof ErrorDrive && e.estado === 403, `actualizar ${nombre}`);
    await assert.rejects(() => cliente.borrar(idDe(nombre)), (e) => e instanceof ErrorDrive && e.estado === 403, `borrar ${nombre}`);
  }
  await assert.rejects(() => enAula.crear('nuevo.json', '{}', 'application/json'), (e) => e.estado === 403, 'crear en el aula');
  await assert.rejects(() => enBiblioteca.crear('medio-trampa.webp', '{}', 'image/webp'), (e) => e.estado === 403, 'crear en la Biblioteca');
  assert.equal(m.nube.json(idDe('adulto.json')).perfilId, 'P1', 'el contenido no cambió');

  const trabajo = m.nube.archivo(aula1.carpetaId).parents[0];
  await assert.rejects(() => crearDriveCarpeta({ ...dep, carpetaId: trabajo }).crear('x.json', '{}', 'application/json'), (e) => e.sinAcceso === true, 'carpeta de trabajo');
  assert.deepEqual((await crearDriveCarpeta({ ...dep, carpetaId: trabajo }).listar()).map((x) => x.id).sort(), [aula1.bibliotecaId, aula1.carpetaId].sort(), 'de la carpeta de trabajo solo se ve su propia aula y la Biblioteca');
  assert.deepEqual(await crearDriveCarpeta({ ...dep, carpetaId: aula2.carpetaId }).listar(), [], 'el aula de B se ve vacía');
  await assert.rejects(() => crearDriveCarpeta({ ...dep, carpetaId: aula2.carpetaId }).crear('x.json', '{}', 'application/json'), (e) => e.sinAcceso === true, 'aula de B');
  await assert.rejects(() => crearDriveCarpeta({ ...dep, carpetaId: aula2.carpetasAlumnos[B] }).crear('x.json', '{}', 'application/json'), (e) => e.sinAcceso === true, 'carpeta de B');
  await assert.rejects(() => crearDriveCarpeta({ ...dep, carpetaId: aula1.carpetaAlumnosId }).crear('x.json', '{}', 'application/json'), (e) => e.sinAcceso === true, 'contenedor de los alumnos');

  // la app: lo único que A escribió fue dentro de SU carpeta
  m.nube.reiniciarPeticiones();
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  const escrituras = m.nube.peticionesDe(A).filter((p) => p.metodo !== 'GET');
  assert.ok(escrituras.length > 0);
  assert.ok(escrituras.every((p) => p.padre === aula1.carpetasAlumnos[A]), JSON.stringify(escrituras));
  // y B tampoco ve ni toca lo de A
  const aulaB = await m.b.aulas.buscarMiAula();
  assert.ok(aulaB.every((x) => x.carpetaId !== aula1.carpetaId));
});

test('el adulto nunca escribe dentro de la carpeta de un alumno al sincronizar', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  await m.a.aulas.sincronizarComoAlumno({ aula: await miAula(m.a), email: A });
  m.nube.reiniciarPeticiones();
  await m.adulto.sincronizarAula('P1');
  const escrituras = m.nube.peticionesDe(ADULTO).filter((p) => p.metodo !== 'GET' && !p.ruta.includes('/permissions'));
  assert.ok(escrituras.every((p) => !Object.values(aula1.carpetasAlumnos).includes(p.padre)), JSON.stringify(escrituras));
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
  // llegan al adulto bajo la FICHA de A (nunca bajo el curso)
  for (const [almacen, id] of [['sesiones', 's1'], ['respuestas', 'r1'], ['progresos', 'g1'], ['movimientos', 'mv1'], ['calcomanias', 'k1']]) {
    const r = await m.tienda.obtener(almacen, id);
    assert.equal(r?.perfilId, fichaA, `${almacen} llegó al adulto bajo la ficha de A`);
  }
  assert.deepEqual(await ids(m.tienda, 'sesiones'), ['s1']);
  assert.equal((await m.tienda.listar('sesiones', { perfilId: 'P1' })).length, 0, 'el curso no recibe avance de alumnos');
  assert.equal((await m.tienda.listar('progresos', { perfilId: 'P1' })).length, 0);
  const ficha = await m.tienda.obtener('alumnos', fichaA);
  assert.equal(ficha.cursoId, 'P1');
  assert.equal(ficha.email, A);
});

test('un alumno.json manipulado (palabra, medio, registro de B, perfil ajeno) no cambia nada en el adulto y deja un aviso', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const aula = await miAula(m.a);
  await m.a.store.guardar('sesiones', { id: 's1', perfilId: 'P1' });
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });

  const archivo = m.nube.porNombre('alumno.json', aula1.carpetasAlumnos[A]);
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
  assert.equal((await m.tienda.obtener('sesiones', 's1')).perfilId, fichaA, 'lo legítimo sí llega, bajo la ficha de A');
  assert.equal((await m.tienda.listar('progresos', { perfilId: fichaA })).length, 0, 'g-ajeno no entró a ninguna ficha');
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
  const archivo = m.nube.porNombre('alumno.json', aula1.carpetasAlumnos[A]);
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
  const archivo = m.nube.porNombre('alumno.json', aula1.carpetasAlumnos[A]);
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

  // un alumno.json dentro de la carpeta de A pero de otro dueño (alguien con acceso que no debería) no se lee
  m.nube.archivo(archivo.id).owner = C;
  m.nube.reescribir(archivo.id, bueno);
  r = (await m.adulto.sincronizarAula('P1')).resumen;
  assert.ok(r.avisos.some((a) => /no es de ese alumno/.test(a)));
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

  // borrar un medio (la palabra deja de usarlo y el medio se borra)
  assert.ok(m.nube.porNombre('medio-m-voz.webm', aula1.bibliotecaId));
  await m.tienda.guardar('palabras', { ...(await m.tienda.obtener('palabras', 'w-perro')), medioAudioId: null });
  await m.tienda.borrar('medios', 'm-voz');
  await m.adulto.sincronizarAula('P1');
  assert.equal(m.nube.porNombre('medio-m-voz.webm', aula1.bibliotecaId), undefined, 'el adulto limpia el archivo de la Biblioteca');
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  assert.equal((await m.a.store.obtener('palabras', 'w-perro')).medioAudioId, null);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  await m.adulto.sincronizarAula('P1');
  assert.equal(await m.tienda.obtener('medios', 'm-voz'), undefined, 'no vuelve en el adulto');
  assert.deepEqual(await bytesDe((await m.a.store.obtener('medios', 'm-img')).blob), [4, 5, 6, 13, 10], 'lo demás sigue intacto');
});

test('el alumno nunca publica lo del adulto, y un ajuste del curso no pisa lo que el alumno calcula solo (ni al revés)', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  const aula = await miAula(m.a);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  // el alumno cambia una palabra localmente: nunca viaja (es del adulto)
  const w = await m.a.store.obtener('palabras', 'w-perro');
  await m.a.store.guardar('palabras', { ...w, texto: 'CAMBIO DEL ALUMNO' });
  // y su celular sube su etapa y sus ensayos por sesión (ajustes automáticos)
  const perfilA = await m.a.store.obtener('perfiles', 'P1');
  await m.a.store.guardar('perfiles', { ...perfilA, etapaActual: 3, ajustes: { ...perfilA.ajustes, ensayosPorSesion: 6 }, cambiosAutomaticos: [{ id: 'x', ajuste: 'ensayosPorSesion' }] });
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  const doc = m.nube.json(m.nube.porNombre('alumno.json', aula1.carpetasAlumnos[A]).id);
  assert.deepEqual(Object.keys(doc.almacenes).sort(), ['calcomanias', 'movimientos', 'niveles', 'perfiles', 'progresos', 'respuestas', 'sesiones']);
  // del perfil publica SOLO lo suyo: nada del curso (ni nombre, ni foto, ni álbumes, ni ajustes manuales)
  assert.deepEqual(Object.keys(doc.almacenes.perfiles[0]).sort(), ['ajustes', 'cambiosAutomaticos', 'etapaActual', 'id', 'updatedAt']);
  assert.deepEqual(doc.almacenes.perfiles[0].ajustes, { ensayosPorSesion: 6, maxOpciones: 4, palabrasNuevasPorSesion: 2, escritura: { nivelEscritura: 'E01', palabrasPorSesion: 6 } });
  assert.equal(doc.almacenes.perfiles[0].etapaActual, 3);

  // el adulto cambia un ajuste MANUAL del curso (y también uno automático, que NO debe pisar al alumno)
  const p1 = await m.tienda.obtener('perfiles', 'P1');
  await m.tienda.guardar('perfiles', { ...p1, ajustes: { ...p1.ajustes, mayusculas: true, ensayosPorSesion: 12 } });
  await m.adulto.sincronizarAula('P1');
  assert.equal((await m.tienda.obtener('palabras', 'w-perro')).texto, 'perro');
  const enAdulto = await m.tienda.obtener('perfiles', 'P1');
  assert.equal(enAdulto.etapaActual ?? 1, p1.etapaActual ?? 1, 'el perfil del curso no recibe la etapa del alumno');
  assert.equal(enAdulto.ajustes.ensayosPorSesion, 12, 'ni sus ajustes automáticos');
  assert.equal(enAdulto.cambiosAutomaticos?.length ?? 0, p1.cambiosAutomaticos?.length ?? 0);
  const ficha = await m.tienda.obtener('alumnos', fichaA);
  assert.equal(ficha.estado.etapaActual, 3, 'lo del alumno queda en SU ficha');
  assert.equal(ficha.estado.ajustes.ensayosPorSesion, 6);

  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  const enAlumno = await m.a.store.obtener('perfiles', 'P1');
  assert.equal(enAlumno.ajustes.mayusculas, true, 'el ajuste manual del curso llega al alumno');
  assert.equal(enAlumno.ajustes.ensayosPorSesion, 6, 'el automático del alumno se queda');
  assert.equal(enAlumno.etapaActual, 3);
  assert.equal(enAlumno.cambiosAutomaticos.length, 1);

  // si el adulto pone ese ajuste en «Lo elijo yo», su valor llega al alumno
  const p1b = await m.tienda.obtener('perfiles', 'P1');
  await m.tienda.guardar('perfiles', { ...p1b, ajustes: { ...p1b.ajustes, ensayosPorSesion: 10, automaticos: { ...p1b.ajustes.automaticos, ensayosPorSesion: false } } });
  await m.adulto.sincronizarAula('P1');
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  assert.equal((await m.a.store.obtener('perfiles', 'P1')).ajustes.ensayosPorSesion, 10);
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
  assert.deepEqual(m.nube.permisosDe(aula1.carpetasAlumnos[A]).map((p) => p.emailAddress), [ADULTO]);
  assert.equal((await m.tienda.obtener('sesiones', 's1')).perfilId, fichaA, 'la ficha y su avance se quedan');
  assert.ok(await m.tienda.obtener('alumnos', fichaA));
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

test('dos alumnos del mismo perfil: cada uno con su carpeta, su ficha y su avance; ninguno ve ni toca lo del otro', async () => {
  const m = await montar();
  const { aula1 } = await habilitar(m);
  await m.adulto.invitar('P1', C);
  const info = (await m.adulto.listarAulas()).P1;
  assert.ok(info.carpetasAlumnos[A] && info.carpetasAlumnos[C] && info.carpetasAlumnos[A] !== info.carpetasAlumnos[C]);
  const aulaA = await miAula(m.a);
  const aulaC = await miAula(m.c);
  assert.equal(aulaC.perfilId, 'P1');
  assert.equal(aulaC.carpetaAlumnoId, info.carpetasAlumnos[C]);
  assert.notEqual(aulaC.carpetaAlumnoId, aulaA.carpetaAlumnoId);

  // cada uno juega lo suyo, con los MISMOS ids de palabra (el curso es el mismo)
  const jugar = async (alumno, correo, aula, sufijo, aciertos) => {
    await alumno.store.guardar('sesiones', { id: `s-${sufijo}`, perfilId: 'P1', ensayos: 8 });
    await alumno.store.guardar('progresos', { id: 'P1:w-perro:L1', perfilId: 'P1', elementoId: 'w-perro', actividad: 'L1', aciertos });
    await alumno.store.guardar('niveles', { id: 'P1:L1', perfilId: 'P1', actividad: 'L1', nivel: aciertos });
    await alumno.aulas.sincronizarComoAlumno({ aula, email: correo });
  };
  await jugar(m.a, A, aulaA, 'a', 3);
  await jugar(m.c, C, aulaC, 'c', 7);
  const e = await m.adulto.sincronizarAula('P1');
  assert.deepEqual(e.alumnos.map((x) => [x.email, x.estado]).sort(), [[A, 'conectado'], [C, 'conectado']]);
  assert.deepEqual(e.permisosExtranos, []);

  // en el adulto: dos fichas separadas, cada una con lo suyo, y NADA bajo el perfil del curso
  assert.deepEqual((await m.tienda.listar('alumnos')).filter((f) => f.cursoId === 'P1').map((f) => f.id).sort(), [fichaA, fichaC].sort());
  assert.deepEqual((await m.tienda.listar('alumnos')).filter((f) => f.cursoId === 'P2').map((f) => f.id), [idDeFicha('P2', B)], 'B tiene su ficha en el otro curso');
  const deFicha = async (almacen, ficha) => (await m.tienda.listar(almacen, { perfilId: ficha })).map((r) => r.id).sort();
  assert.deepEqual(await deFicha('sesiones', fichaA), ['s-a']);
  assert.deepEqual(await deFicha('sesiones', fichaC), ['s-c']);
  const progA = await m.tienda.listar('progresos', { perfilId: fichaA });
  const progC = await m.tienda.listar('progresos', { perfilId: fichaC });
  assert.equal(progA.length, 1);
  assert.equal(progC.length, 1);
  assert.notEqual(progA[0].id, progC[0].id, 'el id del avance lleva la ficha: no chocan');
  assert.equal(progA[0].aciertos, 3);
  assert.equal(progC[0].aciertos, 7);
  assert.equal((await m.tienda.listar('niveles', { perfilId: fichaA }))[0].nivel, 3);
  assert.equal((await m.tienda.listar('niveles', { perfilId: fichaC }))[0].nivel, 7);
  for (const almacen of ['sesiones', 'progresos', 'niveles']) assert.equal((await m.tienda.listar(almacen, { perfilId: 'P1' })).length, 0, `${almacen} del curso`);

  // A no puede leer ni escribir la carpeta de C (ni al revés)
  const dep = m.nube.dep(A);
  const deC = crearDriveCarpeta({ ...dep, carpetaId: info.carpetasAlumnos[C] });
  assert.deepEqual(await deC.listar(), [], 'la carpeta de C se ve vacía');
  await assert.rejects(() => deC.leerJson(m.nube.porNombre('alumno.json', info.carpetasAlumnos[C]).id), (x) => x instanceof ErrorDrive && x.sinAcceso === true);
  await assert.rejects(() => deC.crear('x.json', '{}', 'application/json'), (x) => x.sinAcceso === true);
  await assert.rejects(() => deC.actualizar(m.nube.porNombre('alumno.json', info.carpetasAlumnos[C]).id, 'trampa', 'application/json'), (x) => x.sinAcceso === true);
  await assert.rejects(() => crearDriveCarpeta({ ...m.nube.dep(C), carpetaId: info.carpetasAlumnos[A] }).listar().then((l) => { if (l.length) throw new Error('vio algo'); return crearDriveCarpeta({ ...m.nube.dep(C), carpetaId: info.carpetasAlumnos[A] }).crear('x.json', '{}', 'application/json'); }), (x) => x.sinAcceso === true);
  assert.equal(m.nube.json(m.nube.porNombre('alumno.json', info.carpetasAlumnos[C]).id).perfilId, 'P1');

  // la app de A solo escribió en la carpeta de A
  m.nube.reiniciarPeticiones();
  await m.a.aulas.sincronizarComoAlumno({ aula: aulaA, email: A });
  assert.ok(m.nube.peticionesDe(A).filter((p) => p.metodo !== 'GET').every((p) => p.padre === info.carpetasAlumnos[A]));

  // lo de A no pisa lo de C aunque se sincronice otra vez
  await m.adulto.sincronizarAula('P1');
  assert.equal((await m.tienda.listar('progresos', { perfilId: fichaC }))[0].aciertos, 7);
  assert.equal(aula1.carpetaAlumnoId, null);
});

test('un ajuste del curso llega a los dos alumnos sin pisar la etapa ni los ajustes automáticos de cada uno', async () => {
  const m = await montar();
  await habilitar(m);
  await m.adulto.invitar('P1', C);
  const aulaA = await miAula(m.a);
  const aulaC = await miAula(m.c);
  await m.a.aulas.sincronizarComoAlumno({ aula: aulaA, email: A });
  await m.c.aulas.sincronizarComoAlumno({ aula: aulaC, email: C });
  for (const [alumno, etapa, ensayos] of [[m.a, 2, 5], [m.c, 3, 11]]) {
    const p = await alumno.store.obtener('perfiles', 'P1');
    await alumno.store.guardar('perfiles', { ...p, etapaActual: etapa, ajustes: { ...p.ajustes, ensayosPorSesion: ensayos } });
  }
  await m.a.aulas.sincronizarComoAlumno({ aula: aulaA, email: A });
  await m.c.aulas.sincronizarComoAlumno({ aula: aulaC, email: C });
  await m.adulto.sincronizarAula('P1');
  const p1 = await m.tienda.obtener('perfiles', 'P1');
  await m.tienda.guardar('perfiles', { ...p1, nombre: 'Curso nuevo', ajustes: { ...p1.ajustes, tamanoLetra: 'grande', velocidadVoz: 0.8 } });
  await m.adulto.sincronizarAula('P1');
  await m.a.aulas.sincronizarComoAlumno({ aula: aulaA, email: A });
  await m.c.aulas.sincronizarComoAlumno({ aula: aulaC, email: C });
  for (const [alumno, etapa, ensayos] of [[m.a, 2, 5], [m.c, 3, 11]]) {
    const p = await alumno.store.obtener('perfiles', 'P1');
    assert.equal(p.nombre, 'Curso nuevo');
    assert.equal(p.ajustes.tamanoLetra, 'grande');
    assert.equal(p.ajustes.velocidadVoz, 0.8);
    assert.equal(p.etapaActual, etapa, 'su etapa');
    assert.equal(p.ajustes.ensayosPorSesion, ensayos, 'su ajuste automático');
  }
  const fA = await m.tienda.obtener('alumnos', fichaA);
  const fC = await m.tienda.obtener('alumnos', fichaC);
  assert.equal(fA.estado.etapaActual, 2);
  assert.equal(fC.estado.etapaActual, 3);
});

test('un aula de la fase 22 (una sola `del-alumno/` con todos como editores) se migra: carpetas por alumno, fichas y sin editores en la de antes', async () => {
  const m = await montar();
  const p1 = await m.tienda.obtener('perfiles', 'P1');
  await m.adulto.crearAula(p1);
  const info = (await m.adulto.listarAulas()).P1;
  // se arma a mano lo que dejaba la fase 22: la carpeta única dentro del aula, con A como editor y su alumno.json
  const drive = crearDriveAulas(m.nube.dep(ADULTO));
  const legada = await drive.crearCarpeta('del-alumno', { padre: info.carpetaId, propiedades: { leoConmigo: 'del-alumno', perfilId: 'P1' } });
  await drive.compartir(info.carpetaId, A, 'reader', { avisar: false });
  await drive.compartir(legada, A, 'writer', { avisar: false });
  const meta = await m.tienda.leerMeta('aulas');
  await m.tienda.escribirMeta('aulas', { P1: { perfilId: 'P1', carpetaId: info.carpetaId, carpetaAlumnoId: legada, bibliotecaId: info.bibliotecaId, invitados: [A] } });
  assert.ok(meta.P1.carpetaAlumnosId, 'el aula nueva sí tenía carpeta de alumnos');
  const antiguo = crearDriveCarpeta({ ...m.nube.dep(A), carpetaId: legada });
  await antiguo.crear('alumno.json', JSON.stringify({
    formato: 'leo-conmigo-sync', version: 1, actualizado: '2026-11-05T10:00:00.000Z', perfilId: 'P1', rol: 'alumno',
    almacenes: { sesiones: [{ id: 's-vieja', perfilId: 'P1', updatedAt: '2026-11-05T10:00:01.000Z', deleted: false }], perfiles: [{ id: 'P1', nombre: 'Pedro', etapaActual: 2, updatedAt: '2026-11-05T10:00:01.000Z' }] },
  }), 'application/json');

  const e = await m.adulto.sincronizarAula('P1'); // migra y lee lo de antes
  const despues = (await m.adulto.listarAulas()).P1;
  assert.ok(despues.carpetaAlumnosId);
  assert.ok(despues.carpetasAlumnos[A]);
  assert.deepEqual(m.nube.permisosDe(despues.carpetasAlumnos[A]).map((p) => [p.emailAddress, p.role]).sort(), [[ADULTO, 'owner'], [A, 'writer']]);
  assert.equal(m.nube.permisosDe(legada).some((p) => p.emailAddress === A && p.role === 'writer'), false, 'nadie sigue como editor de la carpeta de antes');
  assert.deepEqual(e.permisosExtranos, []);
  assert.deepEqual(m.nube.json(m.nube.porNombre('aula.json', info.carpetaId).id).alumnos, [{ email: A, carpetaId: despues.carpetasAlumnos[A] }]);
  assert.deepEqual((await m.tienda.listar('sesiones', { perfilId: fichaA })).map((s) => s.id), ['s-vieja'], 'su avance de antes pasó a su ficha');
  assert.equal((await m.tienda.obtener('alumnos', fichaA)).estado.etapaActual, 2);
  assert.equal((await m.tienda.listar('sesiones', { perfilId: 'P1' })).length, 0);

  // el alumno (con su celular ya actualizado) encuentra su carpeta nueva y deja de escribir en la de antes
  const aula = await miAula(m.a);
  assert.equal(aula.carpetaAlumnoId, despues.carpetasAlumnos[A]);
  m.nube.reiniciarPeticiones();
  await m.a.aulas.sincronizarComoAlumno({ aula: { ...aula, carpetaAlumnoId: legada }, email: A });
  assert.ok(m.nube.peticionesDe(A).filter((p) => p.metodo !== 'GET').every((p) => p.padre === despues.carpetasAlumnos[A]), 'aunque su celular recordara la de antes');
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

test('vistaDeFichas: solo ve y escribe fichas y avance de las fichas de SU curso', async () => {
  const store = crearStoreEnMemoria({ prefijo: 'f' });
  await store.importar('alumnos', [{ id: idDeFicha('P1', A), cursoId: 'P1', email: A }, { id: idDeFicha('P2', B), cursoId: 'P2', email: B }]);
  await store.importar('sesiones', [{ id: 's1', perfilId: idDeFicha('P1', A) }, { id: 's2', perfilId: idDeFicha('P2', B) }, { id: 's-curso', perfilId: 'P1' }]);
  const vista = vistaDeFichas(store, 'P1');

  assert.deepEqual((await vista.fichas()).map((f) => f.email), [A]);
  assert.deepEqual((await vista.listar('sesiones', { fichaId: idDeFicha('P1', A) })).map((s) => s.id), ['s1']);
  await assert.rejects(() => vista.listar('sesiones', { fichaId: idDeFicha('P2', B) }), ErrorVistaPerfil, 'la ficha de otro curso');
  await assert.rejects(() => vista.listar('sesiones', { fichaId: 'P1' }), ErrorVistaPerfil, 'el curso no es una ficha');
  await assert.rejects(() => vista.listar('palabras', { fichaId: idDeFicha('P1', A) }), ErrorVistaPerfil, 'una ficha no guarda palabras');

  await assert.rejects(() => vista.importar('sesiones', [{ id: 'x', perfilId: 'P1' }]), ErrorVistaPerfil, 'nada bajo el curso');
  await assert.rejects(() => vista.importar('sesiones', [{ id: 'ok', perfilId: idDeFicha('P1', A) }, { id: 'x', perfilId: idDeFicha('P2', B) }]), ErrorVistaPerfil);
  assert.equal(await store.obtener('sesiones', 'ok'), undefined, 'no se escribe ninguno');
  await assert.rejects(() => vista.importar('alumnos', [{ id: idDeFicha('P2', B), cursoId: 'P2' }]), ErrorVistaPerfil, 'una ficha de otro curso');
  await assert.rejects(() => vista.importar('palabras', [{ id: 'w', perfilId: idDeFicha('P1', A) }]), ErrorVistaPerfil);
  await vista.importar('sesiones', [{ id: 'bueno', perfilId: idDeFicha('P1', A) }]);
  assert.ok(await store.obtener('sesiones', 'bueno'));
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
