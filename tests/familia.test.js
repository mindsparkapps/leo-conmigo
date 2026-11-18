import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAulas } from '../js/aulas.js';
import { crearDrive, crearDriveCarpeta, ErrorDrive } from '../js/drive.js';
import { crearSincronizador } from '../js/sync.js';
import { envolverParaFamilia } from '../js/store-familia.js';
import { materialDe, quitarMaterial } from '../js/material-familia.js';
import { vistaDeFichas, ErrorVistaPerfil } from '../js/store-perfil.js';
import { ErrorCurso, aplicarOrigenDeFamilia, fotoQueSeMuestra, idDeFicha, registrosDeFamilia } from '../js/core/curso.js';
import { fotoQueTeniaElPerfil, guardarFotoAlumno } from '../js/foto-alumno.js';
import { rutaPermitidaAlumno } from '../js/core/dispositivo-alumno.js';
import { planDeMedios } from '../js/core/sync.js';
import { cargarMonedas, comprarSobre } from '../js/albumes.js';
import { cargarColecciones } from '../js/colecciones.js';
import { crearCanje, crearPagoLeccion, crearRegalo, nuevoPremio, premiosVisibles, resumenDeMonedas } from '../js/core/album.js';
import { listarColecciones, nuevaColeccion } from '../js/core/colecciones.js';
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
  for (const r of ['/adulto', '#/adulto', '/adulto/vocabulario', '/adulto/palabra/nueva', '/adulto/palabra/abc', '/adulto/frases', '/adulto/libros', '/adulto/album', '/adulto/tienda', '/adulto/progreso', '/adulto/analisis', '/adulto/ayuda']) {
    assert.equal(rutaPermitidaAlumno(r), true, r);
  }
  for (const r of ['/adulto/alumnos', '/adulto/cuenta', '/adulto/ajustes', '/adulto/fondo', '/adulto/perfiles', '/adulto/asistente', '/adulto/respaldo', '/adulto/acerca',
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

test('foto del alumno: pasa la foto que tenía el perfil a SU foto, queda en su familia/, el adulto solo ve el id hasta traer el material, y B no la recibe', async () => {
  const m = await montar();
  // un perfil antiguo con foto: la foto del curso está en la Biblioteca y le llega al alumno
  await m.tienda.guardar('perfiles', { ...(await m.tienda.obtener('perfiles', 'P1')), fotoMedioId: 'm-img' });
  await m.adulto.sincronizarAula('P1');
  const aula = await miAula(m.a);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  const perfilA = await m.a.store.obtener('perfiles', 'P1');
  const delPerfil = await fotoQueTeniaElPerfil(m.a.store, perfilA);
  assert.deepEqual(await bytesDe(delPerfil.blob), [4, 5, 6]);

  // la familia la pasa a la foto del alumno: un medio NUEVO de la familia (la del curso no se toca)
  const guardado = await guardarFotoAlumno(m.a.store, perfilA, delPerfil);
  const idFoto = guardado.medioFotoAlumnoId;
  assert.ok(idFoto && idFoto !== 'm-img');
  assert.equal((await m.a.store.obtener('medios', idFoto)).origen, 'familia');
  assert.equal(fotoQueSeMuestra(await m.a.store.obtener('perfiles', 'P1')), idFoto);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  assert.equal((await m.a.store.obtener('perfiles', 'P1')).medioFotoAlumnoId, idFoto, 'sincronizar con el curso no la pisa');

  // en SU Drive: el id en alumno.json y el archivo en familia/, de su cuenta; nunca en la Biblioteca
  const info = (await m.adulto.listarAulas()).P1;
  const suCarpeta = info.carpetasAlumnos[A];
  assert.equal(m.nube.json(m.nube.porNombre('alumno.json', suCarpeta).id).almacenes.perfiles[0].medioFotoAlumnoId, idFoto);
  const familia = m.nube.porNombre('familia', suCarpeta);
  const archivo = m.nube.hijos(familia.id).find((f) => f.name.startsWith(`medio-${idFoto}.`));
  assert.equal(archivo?.owner, A);
  assert.ok(!m.nube.hijos(info.bibliotecaId).some((f) => f.name.includes(idFoto)));

  // el adulto: la ficha trae el id, pero la foto solo con «Traer el material de la familia»
  await m.adulto.sincronizarAula('P1');
  const ficha = (await m.tienda.listar('alumnos')).find((f) => f.id === fichaA);
  assert.equal(ficha.estado.medioFotoAlumnoId, idFoto);
  assert.equal(await m.tienda.obtener('medios', idFoto), undefined);
  await m.adulto.traerMaterialDeFamilia('P1', A);
  assert.deepEqual(await bytesDe((await materialDe(m.tienda, fichaA)).find((x) => x.id === idFoto).blob), [4, 5, 6]);
  assert.equal((await m.tienda.obtener('perfiles', 'P1')).fotoMedioId, 'm-img', 'el perfil del adulto no cambió');

  // el otro alumno del curso no recibe la foto de A
  await m.b.aulas.sincronizarComoAlumno({ aula: await miAula(m.b), email: B });
  assert.equal('medioFotoAlumnoId' in (await m.b.store.obtener('perfiles', 'P1')), false);
  assert.equal(await m.b.base.obtener('medios', idFoto), undefined);

  // cambiarla deja la anterior borrada; quitarla deja la del perfil (si aún la tiene)
  const otra = await guardarFotoAlumno(m.a.store, await m.a.store.obtener('perfiles', 'P1'), { blob: imagen(8, 8, 8), mime: 'image/webp' });
  assert.notEqual(otra.medioFotoAlumnoId, idFoto);
  assert.equal(await m.a.store.obtener('medios', idFoto), undefined);
  const sin = await guardarFotoAlumno(m.a.store, otra, {});
  assert.equal('medioFotoAlumnoId' in sin, false);
  assert.equal(fotoQueSeMuestra(sin), 'm-img');
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

// ---------- tienda y álbumes completos para la familia ----------

test('orden de álbumes y premios: lo anterior sin fecha primero y en su orden; lo nuevo, del curso o de la familia, por fecha', () => {
  const laminas = (id) => [{ id: `${id}-1`, coleccionId: id, nombre: 'a' }];
  const perfil = {
    colecciones: [{ id: 'c-viejo-1', nombre: 'Viejo 1' }, { id: 'c-viejo-2', nombre: 'Viejo 2' }, { id: 'c-nuevo-curso', nombre: 'Curso nuevo', creado: '2026-11-10T10:00:00.000Z' }],
  };
  const familiares = [
    { id: 'f-antes', nombre: 'Familia 1', creado: '2026-11-05T10:00:00.000Z' },
    { id: 'f-despues', nombre: 'Familia 2', creado: '2026-11-12T10:00:00.000Z' },
  ];
  const propias = ['c-viejo-1', 'c-viejo-2', 'c-nuevo-curso', 'f-antes', 'f-despues'].flatMap(laminas);
  const lista = listarColecciones({ perfil, propias, familiares });
  assert.deepEqual(lista.map((c) => c.id), ['base', 'c-viejo-1', 'c-viejo-2', 'f-antes', 'c-nuevo-curso', 'f-despues']);
  assert.deepEqual(lista.map((c) => Boolean(c.esFamilia)), [false, false, false, true, false, true]);
  // sin nada de la familia y sin fechas, todo queda como siempre
  assert.deepEqual(listarColecciones({ perfil: { colecciones: [{ id: 'a' }, { id: 'b' }] }, propias: [...laminas('a'), ...laminas('b')] }).map((c) => c.id), ['base', 'a', 'b']);

  const premios = [
    { id: 'p-nuevo-familia', nombre: 'Helado', creado: '2026-11-09T10:00:00.000Z', precio: 5 },
    { id: 'p-viejo-b', nombre: 'B', orden: 1, precio: 5 },
    { id: 'p-nuevo-curso', nombre: 'Parque', creado: '2026-11-11T10:00:00.000Z', precio: 5 },
    { id: 'p-viejo-a', nombre: 'A', orden: 0, precio: 5 },
    { id: 'p-pausa', nombre: 'Pausa', activo: false, orden: 2, precio: 5 },
  ];
  assert.deepEqual(premiosVisibles(premios).map((p) => p.id), ['p-viejo-a', 'p-viejo-b', 'p-nuevo-familia', 'p-nuevo-curso']);
  assert.ok(nuevoPremio({ perfilId: 'P1', nombre: 'x', precio: 3 }).creado, 'un premio nuevo lleva su fecha');
  assert.ok(nuevaColeccion({ nombre: 'x' }).creado, 'un álbum nuevo también');
});

test('la familia crea un álbum completo, un premio, da monedas y canjea: un solo saldo, todo con origen familia y los medios en familia/', async () => {
  const m = await montar();
  const aula = await miAula(m.a);
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  const perfil = await m.a.store.obtener('perfiles', 'P1');

  // un álbum con portada, sobre y dos láminas, un premio con foto y monedas dadas
  const medio = async (id, ...bytes) => m.a.store.guardar('medios', { id, tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(...bytes) });
  await medio('m-port', 1); await medio('m-sobre', 2); await medio('m-l1', 3); await medio('m-l2', 4); await medio('m-premio', 5);
  const album = await m.a.store.guardar('colecciones', { id: 'col-fam', perfilId: 'P1', nombre: 'Los abuelos', medioPortadaId: 'm-port', medioSobreId: 'm-sobre', creado: '2026-11-15T10:00:00.000Z' });
  await m.a.store.guardar('calcomaniasPropias', { id: 'lam-1', perfilId: 'P1', nombre: 'Abuela', medioImagenId: 'm-l1', coleccionId: 'col-fam' });
  await m.a.store.guardar('calcomaniasPropias', { id: 'lam-2', perfilId: 'P1', nombre: 'Abuelo', medioImagenId: 'm-l2', coleccionId: 'col-fam' });
  const premio = await m.a.store.guardar('premios', nuevoPremio({ perfilId: 'P1', nombre: 'Paseo con los abuelos', precio: 30, medioImagenId: 'm-premio' }));
  assert.equal(album.origen, 'familia');
  assert.equal(premio.origen, 'familia');
  await m.a.store.guardar('movimientos', crearRegalo({ perfilId: 'P1', cantidad: 100, nota: 'Del abuelo' }));
  await m.a.store.guardar('movimientos', crearPagoLeccion({ perfilId: 'P1', cantidad: 10 })); // lo ganado jugando

  // con la lógica de siempre: un solo saldo y el álbum de la familia entre los del niño
  const datos = await cargarMonedas(m.a.store, perfil);
  assert.equal(datos.saldo, 110);
  const { colecciones } = await cargarColecciones(m.a.store, perfil);
  assert.deepEqual(colecciones.map((c) => [c.id, Boolean(c.esFamilia)]), [['base', false], ['col-fam', true]]);
  const compra = await comprarSobre(m.a.store, { ...perfil, album: { monedasPorLeccion: 2 } }, { coleccionId: 'col-fam', aleatorio: () => 0 });
  assert.equal(compra.comprado, true);
  assert.ok(compra.codigos.every((c) => c.includes('lam-')), 'las láminas del sobre son del álbum de la familia');
  await m.a.store.guardar('movimientos', crearCanje({ perfilId: 'P1', premio }));
  const tras = await cargarMonedas(m.a.store, perfil);
  assert.equal(tras.saldo, 110 - compra.precio - 30, 'ganado + dado − lo gastado − lo canjeado');

  // se publica: la lista (sin imágenes) en alumno.json, los medios en familia/ y el avance (monedas incluidas) en sus registros
  await m.a.aulas.sincronizarComoAlumno({ aula, email: A });
  const info = (await m.adulto.listarAulas()).P1;
  const doc = m.nube.json(m.nube.porNombre('alumno.json', info.carpetasAlumnos[A]).id);
  assert.deepEqual(doc.contenidoFamilia.colecciones.map((c) => c.id), ['col-fam']);
  assert.deepEqual(doc.contenidoFamilia.premios.map((p) => p.id), [premio.id]);
  assert.deepEqual(doc.contenidoFamilia.calcomaniasPropias.map((p) => p.id).sort(), ['lam-1', 'lam-2']);
  assert.ok(doc.almacenes.movimientos.some((x) => x.tipo === 'regalo' && x.cantidad === 100));
  const enFamilia = m.nube.hijos(m.nube.porNombre('familia', info.carpetasAlumnos[A]).id).map((f) => f.name).sort();
  assert.deepEqual(enFamilia, ['medio-m-l1.webp', 'medio-m-l2.webp', 'medio-m-port.webp', 'medio-m-premio.webp', 'medio-m-sobre.webp']);
  assert.ok(!m.nube.hijos(info.bibliotecaId).some((f) => /m-(port|sobre|l1|l2|premio)/.test(f.name)), 'nada en la Biblioteca');

  // el adulto: estadística en la ficha, sin imágenes ni nada en su tienda
  await m.adulto.sincronizarAula('P1');
  assert.deepEqual(await m.tienda.listar('colecciones'), []);
  assert.deepEqual(await m.tienda.listar('premios', { perfilId: 'P1' }), []);
  assert.deepEqual(await ids(m.tienda, 'medios'), ['m-img'], 'no bajó ninguna imagen de la familia');
  const filas = await m.tienda.listar('contenidoFamilia');
  assert.deepEqual(filas.map((f) => f.almacen).sort(), ['calcomaniasPropias', 'calcomaniasPropias', 'colecciones', 'premios']);
  const movs = await m.tienda.listar('movimientos', { perfilId: fichaA });
  const resumen = resumenDeMonedas({ movimientos: movs, premios: registrosDeFamilia(filas, 'premios') });
  assert.equal(resumen.saldo, tras.saldo, 'el saldo del adulto es el del alumno (mismo cálculo)');
  assert.equal(resumen.dadasPorLaFamilia, 100);
  assert.deepEqual(resumen.canjes.map((c) => [c.nombre, c.estado]), [['Paseo con los abuelos', 'pendiente']]);
  const albumes = listarColecciones({ perfil, propias: registrosDeFamilia(filas, 'calcomaniasPropias'), familiares: registrosDeFamilia(filas, 'colecciones') }).filter((c) => c.esFamilia);
  assert.deepEqual(albumes.map((c) => [c.nombre, c.codigos.length]), [['Los abuelos', 2]]);
  assert.equal(await m.tienda.listar('calcomanias', { perfilId: fichaA }).then((c) => c.length), compra.codigos.length, 'su avance en el álbum llega a la ficha');

  // el material solo con el botón
  const r = await m.adulto.traerMaterialDeFamilia('P1', A);
  assert.equal(r.traidos, 5);
  assert.deepEqual(await ids(m.tienda, 'medios'), ['m-img']);
});

test('el respaldo del alumno incluye álbumes y premios de la familia y se recuperan al reinstalar', async () => {
  const falso = crearDriveFalso();
  const drive = () => crearDrive({ obtenerToken: async () => 'token-1', fetchFn: falso.fetch });
  const tel1 = envolverParaFamilia(crearStoreEnMemoria({ prefijo: 'a' }), () => true);
  await tel1.guardar('medios', { id: 'm-port', tipo: 'imagen', mime: 'image/webp', origen: 'foto', blob: imagen(1) });
  await tel1.guardar('colecciones', { id: 'col-fam', perfilId: 'P1', nombre: 'Los abuelos', medioPortadaId: 'm-port', creado: '2026-11-15T10:00:00.000Z' });
  await tel1.guardar('premios', nuevoPremio({ perfilId: 'P1', nombre: 'Paseo', precio: 9 }));
  await tel1.guardar('movimientos', crearRegalo({ perfilId: 'P1', cantidad: 40 }));
  await crearSincronizador({ store: tel1, drive: drive() }).sincronizar();
  const tel2 = envolverParaFamilia(crearStoreEnMemoria({ prefijo: 'b', desde: 500 }), () => true);
  await crearSincronizador({ store: tel2, drive: drive() }).sincronizar();
  assert.deepEqual(await ids(tel2, 'colecciones'), ['col-fam']);
  assert.equal((await tel2.listar('colecciones'))[0].origen, 'familia');
  assert.equal((await tel2.listar('premios'))[0].origen, 'familia');
  assert.equal((await tel2.listar('movimientos')).reduce((s, x) => s + x.cantidad, 0), 40);
  assert.deepEqual(await bytesDe((await tel2.obtener('medios', 'm-port')).blob), [1]);
});
