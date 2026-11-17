import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAulas } from '../js/aulas.js';
import { crearDrive, crearDriveCarpeta, ErrorDrive } from '../js/drive.js';
import { crearSincronizador } from '../js/sync.js';
import { envolverParaFamilia } from '../js/store-familia.js';
import { materialDe, quitarMaterial } from '../js/material-familia.js';
import { vistaDeFichas, ErrorVistaPerfil } from '../js/store-perfil.js';
import { ErrorCurso, aplicarOrigenDeFamilia, idDeFicha, registrosDeFamilia } from '../js/core/curso.js';
import { rutaPermitidaAlumno } from '../js/core/dispositivo-alumno.js';
import { planDeMedios } from '../js/core/sync.js';
import { planDeBorradoDePerfil } from '../js/core/borrar-perfil.js';
import { crearDriveFalso, crearNubeFalsa } from './drive-falso.js';
import { bytesDe, crearStoreEnMemoria } from './memoria.js';

const ADULTO = 'adulto@ejemplo.com';
const A = 'pedro@gmail.com';
const B = 'sofia@gmail.com';
const imagen = (...b) => new Blob([Uint8Array.from(b)], { type: 'image/webp' });
const ids = async (store, almacen, conBorrados = false) => (await store.listar(almacen, { conBorrados })).map((r) => r.id).sort();

// ---------- reglas puras ----------

test('rutaPermitidaAlumno: el menú reducido del celular del alumno y nada más', () => {
  for (const r of ['/adulto', '#/adulto', '/adulto/vocabulario', '/adulto/palabra/nueva', '/adulto/palabra/abc', '/adulto/frases', '/adulto/libros', '/adulto/album', '/adulto/progreso', '/adulto/analisis', '/adulto/ayuda']) {
    assert.equal(rutaPermitidaAlumno(r), true, r);
  }
  for (const r of ['/adulto/alumnos', '/adulto/cuenta', '/adulto/ajustes', '/adulto/fondo', '/adulto/tienda', '/adulto/perfiles', '/adulto/asistente', '/adulto/respaldo', '/adulto/acerca',
    '/adulto/progreso/ficha/x', '/adulto/palabra/a/b', '/adultos', '/nino', '', undefined]) {
    assert.equal(rutaPermitidaAlumno(r), false, String(r));
  }
});

test('aplicarOrigenDeFamilia: lo nuevo es de la familia, lo de la familia se cambia y lo del curso no se toca', () => {
  assert.equal(aplicarOrigenDeFamilia('palabras', { texto: 'abuela' }, undefined).origen, 'familia');
  assert.equal(aplicarOrigenDeFamilia('medios', { tipo: 'imagen', origen: 'foto' }, undefined).origen, 'familia');
  assert.equal(aplicarOrigenDeFamilia('palabras', { id: 'x', texto: 'otra' }, { id: 'x', origen: 'familia' }).origen, 'familia');
  assert.throws(() => aplicarOrigenDeFamilia('palabras', { id: 'p', texto: 'cambiada' }, { id: 'p', texto: 'perro' }), ErrorCurso);
  assert.throws(() => aplicarOrigenDeFamilia('medios', { id: 'm' }, { id: 'm', origen: 'biblioteca' }), ErrorCurso);
  const progreso = { id: 'g', perfilId: 'P1' };
  assert.equal(aplicarOrigenDeFamilia('progresos', progreso, { id: 'g' }), progreso, 'el avance no se marca ni se bloquea');
});

test('envolverParaFamilia: en el celular de un alumno marca lo nuevo y bloquea lo del curso; en el del adulto no hace nada', async () => {
  const base = crearStoreEnMemoria();
  await base.importar('palabras', [{ id: 'w-perro', perfilId: 'P1', texto: 'perro', updatedAt: '2026-11-05T10:00:00.000Z', deleted: false }]);
  const alumno = envolverParaFamilia(base, () => true);
  const nueva = await alumno.guardar('palabras', { perfilId: 'P1', texto: 'abuela' });
  assert.equal(nueva.origen, 'familia');
  const varias = await alumno.guardarVarios('frases', [{ perfilId: 'P1', texto: 'mi abuela' }]);
  assert.equal(varias[0].origen, 'familia');
  await alumno.guardar('palabras', { ...nueva, texto: 'abuelita' }); // la de la familia sí se cambia
  assert.equal((await base.obtener('palabras', nueva.id)).texto, 'abuelita');
  await assert.rejects(() => alumno.guardar('palabras', { id: 'w-perro', perfilId: 'P1', texto: 'CAMBIADA' }), ErrorCurso);
  await assert.rejects(() => alumno.guardarVarios('palabras', [{ ...nueva }, { id: 'w-perro', perfilId: 'P1', texto: 'x' }]), ErrorCurso);
  await assert.rejects(() => alumno.borrar('palabras', 'w-perro'), ErrorCurso);
  assert.equal((await base.obtener('palabras', 'w-perro')).texto, 'perro', 'el curso quedó intacto');
  assert.equal(await alumno.borrar('palabras', nueva.id), true);
  // lo demás pasa tal cual (el avance, el perfil…)
  assert.equal((await alumno.guardar('progresos', { perfilId: 'P1', elementoId: 'w-perro' })).origen, undefined);

  const adulto = envolverParaFamilia(crearStoreEnMemoria(), () => false);
  assert.equal((await adulto.guardar('palabras', { perfilId: 'P1', texto: 'mamá' })).origen, undefined);
});

test('planDeMedios: un medio de la Biblioteca no se sube al respaldo personal del alumno; el de la familia sí', () => {
  const plan = planDeMedios({
    medios: [{ id: 'b', origen: 'biblioteca', mime: 'image/webp' }, { id: 'f', origen: 'familia', mime: 'image/webp' }],
    archivos: new Map(),
    conBlobLocal: new Set(['b', 'f']),
  });
  assert.deepEqual(plan.subir.map((s) => s.medio.id), ['f']);
  assert.deepEqual(plan.faltantes, []);
});

test('planDeBorradoDePerfil: también borra lo que agregó la familia de las fichas del curso', () => {
  const plan = planDeBorradoDePerfil({
    perfilId: 'P1', perfiles: [{ id: 'P1' }], todos: {},
    fichas: [{ id: 'ficha:P1:a@g.com', cursoId: 'P1' }],
    familia: [{ id: 'f1', fichaId: 'ficha:P1:a@g.com' }, { id: 'f2', fichaId: 'ficha:P2:b@g.com' }],
  });
  assert.deepEqual(plan.registros.contenidoFamilia, ['f1']);
});

test('vistaDeFichas: también guarda lo que agregó la familia, pero solo de las fichas de su curso', async () => {
  const store = crearStoreEnMemoria();
  const vista = vistaDeFichas(store, 'P1');
  const fila = (fichaId, id = 'x') => ({ id: `${fichaId}:palabras:${id}`, fichaId, almacen: 'palabras', registro: { id }, updatedAt: '2026-11-05T10:00:00.000Z', deleted: false });
  await vista.importar('contenidoFamilia', [fila(idDeFicha('P1', A))]);
  await assert.rejects(() => vista.importar('contenidoFamilia', [fila(idDeFicha('P2', B))]), ErrorVistaPerfil);
  assert.equal((await vista.listar('contenidoFamilia', { fichaId: idDeFicha('P1', A) })).length, 1);
  await assert.rejects(() => vista.listar('contenidoFamilia', { fichaId: idDeFicha('P2', B) }), ErrorVistaPerfil);
});

// ---------- de punta a punta con el Drive falso ----------

async function montar() {
  const nube = crearNubeFalsa();
  const tienda = crearStoreEnMemoria({ prefijo: 'ad' });
  await tienda.guardar('medios', { id: 'm-img', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(4, 5, 6) });
  await tienda.guardar('perfiles', { id: 'P1', nombre: 'Lectura inicial' });
  await tienda.guardar('palabras', { id: 'w-perro', perfilId: 'P1', texto: 'perro', medioImagenId: 'm-img' });
  const adulto = crearAulas({ store: tienda, ...nube.dep(ADULTO), emailAdulto: ADULTO, versionApp: '0.41.0' });
  const alumno = (email, id) => {
    const base = crearStoreEnMemoria({ prefijo: id, desde: 100 });
    const store = envolverParaFamilia(base, () => true); // como en el celular de un alumno
    return { base, store, email, aulas: crearAulas({ store, ...nube.dep(email), idDispositivo: id, nombreDispositivo: id, versionApp: '0.41.0', traerDeApp: async () => null }) };
  };
  await adulto.crearAula(await tienda.obtener('perfiles', 'P1'));
  await adulto.invitar('P1', A);
  await adulto.invitar('P1', B);
  await adulto.sincronizarAula('P1');
  return { nube, tienda, adulto, a: alumno(A, 'da'), b: alumno(B, 'db') };
}
const miAula = async (x) => (await x.aulas.buscarMiAula())[0];
const fichaA = idDeFicha('P1', A);

test('la familia agrega una palabra con foto: queda en el Drive del alumno, sus estadísticas llegan al adulto y el material solo con el botón', async () => {
  const m = await montar();
  const aula = await miAula(m.a);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });

  // el celular del alumno: el curso no se toca, lo nuevo es de la familia
  await assert.rejects(() => m.a.store.guardar('palabras', { id: 'w-perro', perfilId: 'P1', texto: 'CAMBIADA' }), ErrorCurso);
  await m.a.store.guardar('medios', { id: 'm-fam', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(7, 7, 7) });
  await m.a.store.guardar('medios', { id: 'm-voz', tipo: 'audio', mime: 'audio/webm', origen: 'grabacion', blob: new Blob([Uint8Array.from([9, 9])], { type: 'audio/webm' }) });
  await m.a.store.guardar('palabras', { id: 'w-abuela', perfilId: 'P1', texto: 'abuela', medioImagenId: 'm-fam', medioAudioId: 'm-voz' });
  await m.a.store.guardar('progresos', { id: 'P1:w-abuela:L1', perfilId: 'P1', elementoId: 'w-abuela', actividad: 'L1', aciertos: 2, ensayos: 3 });
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });

  // en SU Drive: la lista (sin fotos ni voces) en alumno.json y las fotos y voces en `familia/`, archivos de su cuenta
  const info = (await m.adulto.listarAulas()).P1;
  const suCarpeta = info.carpetasAlumnos[A];
  const doc = m.nube.json(m.nube.porNombre('alumno.json', suCarpeta).id);
  assert.deepEqual(doc.contenidoFamilia.palabras.map((p) => p.id), ['w-abuela']);
  assert.equal(doc.contenidoFamilia.palabras[0].blob, undefined);
  assert.equal(doc.almacenes.palabras, undefined, 'la palabra no viaja como contenido del curso');
  assert.deepEqual(doc.almacenes.progresos.map((p) => p.id), ['P1:w-abuela:L1'], 'su avance sí');
  const familia = m.nube.porNombre('familia', suCarpeta);
  assert.ok(familia, 'la carpeta familia/ está dentro de la carpeta del alumno');
  assert.equal(familia.owner, A);
  const archivos = m.nube.hijos(familia.id);
  assert.deepEqual(archivos.map((f) => f.name).sort(), ['medio-m-fam.webp', 'medio-m-voz.webm']);
  assert.ok(archivos.every((f) => f.owner === A), 'son de la cuenta del alumno');

  // el adulto sincroniza
  m.nube.reiniciarPeticiones();
  await m.adulto.sincronizarAula('P1');
  assert.deepEqual((await ids(m.tienda, 'palabras')), ['w-perro'], 'la palabra de la familia NO entra a las palabras del adulto');
  assert.deepEqual(await ids(m.tienda, 'medios'), ['m-img'], 'ni sus fotos ni sus voces están en el celular del adulto');
  const filas = await m.tienda.listar('contenidoFamilia');
  assert.deepEqual(filas.map((f) => [f.fichaId, f.almacen, f.registro.id, f.registro.origen]), [[fichaA, 'palabras', 'w-abuela', 'familia']]);
  assert.equal(filas[0].registro.blob, undefined);
  const progresoFicha = await m.tienda.listar('progresos', { perfilId: fichaA });
  assert.equal(progresoFicha.length, 1, 'sus estadísticas llegan a la ficha del alumno');
  assert.equal(progresoFicha[0].elementoId, 'w-abuela');
  assert.deepEqual(registrosDeFamilia(filas, 'palabras', fichaA).map((p) => p.texto), ['abuela'], 'con el nombre de la palabra');
  const adultoJson = m.nube.json(m.nube.porNombre('adulto.json', info.carpetaId).id);
  assert.ok(!adultoJson.almacenes.palabras.some((p) => p.id === 'w-abuela'), 'nunca se publica en el aula');
  assert.ok(!m.nube.hijos(info.bibliotecaId).some((f) => f.name.includes('m-fam') || f.name.includes('m-voz')), 'ni en la Biblioteca');
  // el adulto no escribió dentro de ninguna carpeta de alumno ni en familia/
  const prohibidas = new Set([...Object.values(info.carpetasAlumnos), familia.id]);
  assert.ok(m.nube.peticionesDe(ADULTO).filter((p) => p.metodo !== 'GET' && !p.ruta.includes('/permissions')).every((p) => !prohibidas.has(p.padre)));
  assert.equal(await m.tienda.pendientesSync().then((c) => c.filter((x) => x.almacen === 'medios' && x.id !== 'm-img').length), 0);

  // «Traer el material de la familia»: baja las copias a este celular, aparte de `medios` (así nunca van a su respaldo personal)
  const r = await m.adulto.traerMaterialDeFamilia('P1', A);
  assert.deepEqual(r, { traidos: 2, sinCarpeta: false });
  const traido = await materialDe(m.tienda, fichaA);
  assert.deepEqual(traido.map((x) => [x.id, x.tipo]).sort(), [['m-fam', 'imagen'], ['m-voz', 'audio']]);
  assert.deepEqual(await bytesDe(traido.find((x) => x.id === 'm-fam').blob), [7, 7, 7]);
  assert.deepEqual(await ids(m.tienda, 'medios'), ['m-img'], 'sigue sin estar en `medios` (ni en la sincronización personal)');

  // «Quitarlo de mi celular»: solo borra la copia local
  assert.equal(await quitarMaterial(m.tienda, fichaA), 2);
  assert.deepEqual(await materialDe(m.tienda, fichaA), []);
  assert.equal(m.nube.hijos(familia.id).length, 2, 'el Drive del alumno no cambió');
  assert.ok(await m.a.store.obtener('medios', 'm-fam'), 'ni el celular del alumno');
  assert.ok(m.nube.peticionesDe(ADULTO).every((p) => p.metodo !== 'DELETE'));
});

test('otro alumno del mismo curso no ve ni recibe lo de la familia de A; borrar lo de la familia propaga el borrado', async () => {
  const m = await montar();
  const aulaA = await miAula(m.a);
  await m.a.aulas.sincronizarComoAlumno({ aula: aulaA, email: A });
  await m.a.store.guardar('medios', { id: 'm-fam', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(7) });
  await m.a.store.guardar('palabras', { id: 'w-abuela', perfilId: 'P1', texto: 'abuela', medioImagenId: 'm-fam' });
  await m.a.aulas.sincronizarComoAlumno({ aula: aulaA, email: A });
  await m.adulto.sincronizarAula('P1');

  const aulaB = await miAula(m.b);
  await m.b.aulas.sincronizarComoAlumno({ aula: aulaB, email: B });
  assert.deepEqual(await ids(m.b.store, 'palabras'), ['w-perro'], 'B no recibe la palabra de la familia de A');
  const info = (await m.adulto.listarAulas()).P1;
  const familiaA = m.nube.porNombre('familia', info.carpetasAlumnos[A]);
  const deB = crearDriveCarpeta({ ...m.nube.dep(B), carpetaId: familiaA.id });
  assert.deepEqual(await deB.listar(), []);
  await assert.rejects(() => deB.leerBlob(m.nube.hijos(familiaA.id)[0].id), (e) => e instanceof ErrorDrive && e.sinAcceso === true);
  await assert.rejects(() => deB.crear('trampa.webp', '{}', 'image/webp'), (e) => e.sinAcceso === true);

  // la familia de A borra su palabra y su foto: el borrado llega al adulto y el archivo sale de familia/
  const { borrarMedio } = await import('../js/medios.js');
  await m.a.store.borrar('palabras', 'w-abuela');
  await borrarMedio(m.a.store, 'm-fam');
  await m.a.aulas.sincronizarComoAlumno({ aula: aulaA, email: A });
  assert.equal(m.nube.hijos(familiaA.id).length, 0, 'el archivo se quitó de familia/');
  await m.adulto.sincronizarAula('P1');
  assert.deepEqual(registrosDeFamilia(await m.tienda.listar('contenidoFamilia'), 'palabras', fichaA), [], 'ya no cuenta como palabra de la familia');
  assert.equal((await m.tienda.listar('contenidoFamilia', { conBorrados: true })).length, 1);
});

// ---------- el respaldo del alumno en su propio Drive ----------

test('el respaldo del alumno: sube su avance y lo de su familia a su appDataFolder y, al reinstalar, lo recupera (sin los medios del curso)', async () => {
  const falso = crearDriveFalso(); // el Drive del alumno (su appDataFolder)
  const drive = () => crearDrive({ obtenerToken: async () => 'token-1', fetchFn: falso.fetch });
  const tel1 = envolverParaFamilia(crearStoreEnMemoria({ prefijo: 'a' }), () => true);
  // lo que bajó del curso
  await tel1.importar('perfiles', [{ id: 'P1', nombre: 'Curso', updatedAt: '2026-11-05T10:00:00.000Z', deleted: false }]);
  await tel1.importar('palabras', [{ id: 'w-perro', perfilId: 'P1', texto: 'perro', medioImagenId: 'm-img', updatedAt: '2026-11-05T10:00:00.000Z', deleted: false }]);
  await tel1.importar('medios', [{ id: 'm-img', tipo: 'imagen', mime: 'image/webp', origen: 'biblioteca', subido: true, blob: imagen(4, 5, 6), updatedAt: '2026-11-05T10:00:00.000Z', deleted: false }]);
  // lo suyo
  await tel1.guardar('medios', { id: 'm-fam', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(7, 7) });
  await tel1.guardar('palabras', { id: 'w-abuela', perfilId: 'P1', texto: 'abuela', medioImagenId: 'm-fam' });
  await tel1.guardar('progresos', { id: 'P1:w-abuela:L1', perfilId: 'P1', elementoId: 'w-abuela', actividad: 'L1', aciertos: 3 });
  await tel1.guardar('sesiones', { id: 's1', perfilId: 'P1', ensayos: [] });

  const resumen = await crearSincronizador({ store: tel1, drive: drive() }).sincronizar();
  assert.equal(resumen.mediosSubidos, 1, 'solo la foto de la familia');
  const nombres = (await drive().listar()).map((a) => a.name).sort();
  assert.deepEqual(nombres, ['data.json', 'medio-m-fam.webp']);

  // reinstala: un celular vacío con la misma cuenta
  const tel2 = envolverParaFamilia(crearStoreEnMemoria({ prefijo: 'b', desde: 500 }), () => true);
  await crearSincronizador({ store: tel2, drive: drive() }).sincronizar();
  assert.deepEqual(await ids(tel2, 'progresos'), ['P1:w-abuela:L1'], 'recupera su avance');
  assert.deepEqual(await ids(tel2, 'sesiones'), ['s1']);
  const abuela = await tel2.obtener('palabras', 'w-abuela');
  assert.equal(abuela.origen, 'familia');
  assert.deepEqual(await bytesDe((await tel2.obtener('medios', 'm-fam')).blob), [7, 7], 'y la foto de su familia');
  assert.equal((await tel2.obtener('medios', 'm-img')).blob ?? null, null, 'la del curso se vuelve a bajar de la Biblioteca, no de su respaldo');
});
