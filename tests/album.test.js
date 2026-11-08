import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALBUM_POR_DEFECTO, normalizarAlbum, calcularAlbumes, movimientoDeAlbum, idPremioAlbum, saldo, puedeCanjear, faltan, crearCanje, crearRegalo,
  canjesPendientes, nuevoPremio, premiosVisibles, monedasADibujar, premiosDeAlbumPorCrear,
} from '../js/core/album.js';
import { CALCOMANIAS, CODIGOS_CATALOGO, codigosEnJuego, codigoDePropia, elegirCalcomania, esPropia, idDePropia } from '../js/core/calcomanias.js';
import { crearAleatorio } from '../js/core/azar.js';

const fechaDe = (i) => new Date(Date.UTC(2026, 10, 1, 10, 0, i)).toISOString();
/** n calcomanías distintas del catálogo, una por "sesión". */
const ganadas = (n, desde = 0) => Array.from({ length: n }, (_, i) => ({ codigo: CODIGOS_CATALOGO[(desde + i) % CODIGOS_CATALOGO.length], fecha: fechaDe(desde + i) }));

test('respaldo y sincronización incluyen los almacenes de monedas', async () => {
  const { ALMACENES_SYNC } = await import('../js/core/sync.js');
  const { ALMACENES_RESPALDO } = await import('../js/core/respaldo.js');
  const { ALMACENES } = await import('../js/store.js');
  for (const nombre of ['calcomaniasPropias', 'premios', 'movimientos']) {
    assert.ok(ALMACENES_SYNC.includes(nombre), `sync: ${nombre}`);
    assert.ok(ALMACENES_RESPALDO.includes(nombre), `respaldo: ${nombre}`);
    assert.ok(Object.hasOwn(ALMACENES, nombre), `store: ${nombre}`);
  }
  // todo almacén de datos (salvo los que ya lo hacen) viaja en la copia y en la sincronización
  for (const nombre of Object.keys(ALMACENES)) assert.ok(ALMACENES_SYNC.includes(nombre), `falta en sync: ${nombre}`);
});

test('catálogo: 75 láminas sin repetir código', () => {
  assert.equal(CALCOMANIAS.length, 75);
  assert.equal(new Set(CODIGOS_CATALOGO).size, 75);
});

test('normalizarAlbum: valores por defecto y límites', () => {
  assert.deepEqual(normalizarAlbum(), ALBUM_POR_DEFECTO);
  assert.equal(normalizarAlbum({ tamano: 2 }).tamano, 6);
  assert.equal(normalizarAlbum({ tamano: 99 }).tamano, 24);
  assert.equal(normalizarAlbum({ monedasPorAlbum: 0 }).monedasPorAlbum, 1);
  assert.equal(normalizarAlbum({ monedasPorAlbum: 500 }).monedasPorAlbum, 50);
  assert.equal(normalizarAlbum({ tamano: 'x', monedasPorAlbum: 'y' }).tamano, 12);
});

test('normalizarAlbum: codigos sin repetir; con menos códigos que el tamaño, el tamaño baja', () => {
  const a = normalizarAlbum({ tamano: 12, codigos: ['sol', 'sol', 'luna', '', 7] });
  assert.deepEqual(a.codigos, ['sol', 'luna']);
  assert.equal(a.tamano, 2);
  assert.equal(normalizarAlbum({ codigos: [] }).codigos, null);
});

test('calcularAlbumes: sin calcomanías hay un álbum vacío número 1', () => {
  const r = calcularAlbumes({ calcomanias: [], movimientos: [], tamano: 12 });
  assert.deepEqual(r.completos, []);
  assert.deepEqual(r.actual, { numero: 1, codigos: [] });
  assert.deepEqual(r.nuevosCompletos, []);
});

test('calcularAlbumes: se llena a las 12 y empieza otro', () => {
  const r = calcularAlbumes({ calcomanias: ganadas(11), tamano: 12 });
  assert.equal(r.completos.length, 0);
  assert.equal(r.actual.codigos.length, 11);
  const r2 = calcularAlbumes({ calcomanias: ganadas(12), tamano: 12 });
  assert.equal(r2.completos.length, 1);
  assert.equal(r2.completos[0].numero, 1);
  assert.equal(r2.completos[0].codigos.length, 12);
  assert.equal(r2.completos[0].fechaFin, fechaDe(11));
  assert.deepEqual(r2.actual, { numero: 2, codigos: [] });
  assert.equal(r2.nuevosCompletos.length, 1);
  const r3 = calcularAlbumes({ calcomanias: ganadas(15), tamano: 12 });
  assert.equal(r3.actual.numero, 2);
  assert.equal(r3.actual.codigos.length, 3);
});

test('calcularAlbumes: una calcomanía repetida no llena el álbum', () => {
  const tengo = [...ganadas(5), { codigo: CODIGOS_CATALOGO[0], fecha: fechaDe(10) }];
  const r = calcularAlbumes({ calcomanias: tengo, tamano: 6 });
  assert.equal(r.completos.length, 0);
  assert.equal(r.actual.codigos.length, 5);
});

test('calcularAlbumes: ignora las borradas y no depende del orden de la lista', () => {
  const lista = ganadas(6).reverse();
  lista[0] = { ...lista[0], deleted: true };
  const r = calcularAlbumes({ calcomanias: lista, tamano: 6 });
  assert.equal(r.completos.length, 0);
  assert.equal(r.actual.codigos.length, 5);
});

test('premio del álbum: 10 monedas con id determinista', () => {
  const calcomanias = ganadas(12);
  const [premio] = premiosDeAlbumPorCrear({ perfilId: 'p1', calcomanias, movimientos: [], album: {} });
  assert.equal(premio.id, idPremioAlbum('p1', 1));
  assert.equal(premio.cantidad, 10);
  assert.equal(premio.tipo, 'album');
  assert.equal(premio.fechaFin, fechaDe(11));
  assert.equal(saldo([premio]), 10);
});

test('premio del álbum: es idempotente (una vez guardado, no se vuelve a crear)', () => {
  const calcomanias = ganadas(12);
  const primeros = premiosDeAlbumPorCrear({ perfilId: 'p1', calcomanias, movimientos: [], album: {} });
  assert.equal(primeros.length, 1);
  const otra = premiosDeAlbumPorCrear({ perfilId: 'p1', calcomanias, movimientos: primeros, album: {} });
  assert.deepEqual(otra, []);
});

test('dos dispositivos completan el mismo álbum: mismo id, las monedas no se duplican', () => {
  const calcomanias = ganadas(12);
  const [deA] = premiosDeAlbumPorCrear({ perfilId: 'p1', calcomanias, movimientos: [], album: {} });
  const [deB] = premiosDeAlbumPorCrear({ perfilId: 'p1', calcomanias, movimientos: [], album: {} });
  assert.equal(deA.id, deB.id);
  // la fusión del sync deja un solo registro por id
  const fusionado = new Map([deA, deB].map((m) => [m.id, m]));
  assert.equal(saldo([...fusionado.values()]), 10);
});

test('ya jugó con las 12 calcomanías del álbum viejo: el primer álbum completo paga retroactivo', () => {
  const r = premiosDeAlbumPorCrear({ perfilId: 'p1', calcomanias: [...ganadas(12), ...ganadas(3, 0).map((c, i) => ({ ...c, fecha: fechaDe(20 + i) }))], movimientos: [], album: {} });
  assert.equal(r.length, 1); // las 3 repetidas del álbum viejo empiezan el segundo álbum, que aún no se llena
});

test('cambiar el tamaño del álbum no toca los álbumes ya completos', () => {
  const calcomanias = ganadas(12);
  const movs = premiosDeAlbumPorCrear({ perfilId: 'p1', calcomanias, movimientos: [], album: {} });
  // el adulto achica el álbum a 6 y el niño gana 6 más
  const mas = ganadas(6, 12);
  const r = calcularAlbumes({ calcomanias: [...calcomanias, ...mas], movimientos: movs, tamano: 6 });
  assert.equal(r.completos.length, 2);
  assert.equal(r.completos[0].codigos.length, 12, 'el primero sigue con sus 12');
  assert.equal(r.completos[0].premiado, true);
  assert.equal(r.completos[1].codigos.length, 6);
  assert.equal(r.nuevosCompletos.length, 1);
  assert.equal(r.nuevosCompletos[0].numero, 2);
  assert.equal(r.actual.numero, 3);
});

test('movimientoDeAlbum guarda el tamaño y los códigos del álbum', () => {
  const [album] = calcularAlbumes({ calcomanias: ganadas(6), tamano: 6 }).completos;
  const m = movimientoDeAlbum({ perfilId: 'p9', album, monedas: 7, tamano: 6 });
  assert.equal(m.cantidad, 7);
  assert.equal(m.tamano, 6);
  assert.equal(m.codigos.length, 6);
});

test('saldo: suma de movimientos; un canje anulado devuelve las monedas', () => {
  const premio = nuevoPremio({ perfilId: 'p1', nombre: 'Helado', precio: 4 });
  const movs = [{ cantidad: 10, tipo: 'album' }];
  assert.equal(saldo(movs), 10);
  const canje = { ...crearCanje({ perfilId: 'p1', premio: { ...premio, id: 'pr1' } }), id: 'c1' };
  assert.equal(canje.cantidad, -4);
  assert.equal(canje.estado, 'pendiente');
  assert.equal(saldo([...movs, canje]), 6);
  assert.equal(saldo([...movs, { ...canje, estado: 'entregado' }]), 6);
  assert.equal(saldo([...movs, { ...canje, estado: 'anulado' }]), 10);
  assert.equal(saldo([...movs, { ...canje, deleted: true }]), 10);
  assert.equal(saldo([]), 0);
});

test('puedeCanjear y faltan', () => {
  const premio = { id: 'a', precio: 7, activo: true };
  assert.equal(puedeCanjear(7, premio), true);
  assert.equal(puedeCanjear(6, premio), false);
  assert.equal(faltan(6, premio), 1);
  assert.equal(faltan(20, premio), 0);
  assert.equal(puedeCanjear(99, { ...premio, activo: false }), false);
  assert.equal(puedeCanjear(99, { ...premio, deleted: true }), false);
  assert.equal(puedeCanjear(99, null), false);
});

test('crearRegalo: acepta positivos y negativos; corregir exige nota', () => {
  assert.equal(crearRegalo({ perfilId: 'p1', cantidad: 3 }).cantidad, 3);
  assert.equal(crearRegalo({ perfilId: 'p1', cantidad: -2, tipo: 'correccion', nota: 'me equivoqué' }).cantidad, -2);
  assert.throws(() => crearRegalo({ perfilId: 'p1', cantidad: -2, tipo: 'correccion' }), /nota/);
  assert.throws(() => crearRegalo({ perfilId: 'p1', cantidad: 0 }));
  assert.throws(() => crearRegalo({ perfilId: 'p1', cantidad: 'x' }));
});

test('canjes pendientes: solo los pendientes, del más viejo al más nuevo', () => {
  const m = [
    { id: '1', tipo: 'canje', estado: 'pendiente', fecha: '2026-11-03' },
    { id: '2', tipo: 'canje', estado: 'entregado', fecha: '2026-11-02' },
    { id: '3', tipo: 'canje', estado: 'pendiente', fecha: '2026-11-01' },
    { id: '4', tipo: 'album', fecha: '2026-11-01' },
    { id: '5', tipo: 'canje', estado: 'pendiente', fecha: '2026-11-04', deleted: true },
  ];
  assert.deepEqual(canjesPendientes(m).map((x) => x.id), ['3', '1']);
});

test('nuevoPremio: valida y acota el precio', () => {
  assert.throws(() => nuevoPremio({ perfilId: 'p1', nombre: ' ', precio: 3 }), /nombre/);
  assert.throws(() => nuevoPremio({ nombre: 'x', precio: 3 }), /perfil/);
  assert.equal(nuevoPremio({ perfilId: 'p1', nombre: 'x', precio: 0 }).precio, 1);
  assert.equal(nuevoPremio({ perfilId: 'p1', nombre: 'x', precio: 500 }).precio, 100);
  assert.equal(nuevoPremio({ perfilId: 'p1', nombre: ' Parque ', precio: 5 }).nombre, 'Parque');
});

test('premiosVisibles: solo activos, no borrados, en el orden del adulto', () => {
  const lista = [
    { id: 'a', orden: 2, activo: true },
    { id: 'b', orden: 0, activo: true },
    { id: 'c', orden: 1, activo: false },
    { id: 'd', orden: 3, activo: true, deleted: true },
  ];
  assert.deepEqual(premiosVisibles(lista).map((p) => p.id), ['b', 'a']);
});

test('monedasADibujar: tope de 20', () => {
  assert.equal(monedasADibujar(0), 0);
  assert.equal(monedasADibujar(7), 7);
  assert.equal(monedasADibujar(35), 20);
  assert.equal(monedasADibujar(-3), 0);
});

// ---------- elegir calcomanía ----------

test('elegirCalcomania: nunca repite dentro del álbum y solo usa lo que está en juego', () => {
  const azar = crearAleatorio(5);
  const enJuego = ['sol', 'luna', 'flor', 'pez', 'casa', 'barco', 'arbol'];
  const enAlbum = [];
  for (let i = 0; i < enJuego.length; i++) {
    const { codigo, esNueva } = elegirCalcomania(enAlbum, azar, enJuego);
    assert.equal(esNueva, true);
    assert.ok(enJuego.includes(codigo));
    assert.ok(!enAlbum.includes(codigo), `repetida: ${codigo}`);
    enAlbum.push(codigo);
  }
  const extra = elegirCalcomania(enAlbum, azar, enJuego);
  assert.equal(extra.esNueva, false);
});

test('codigosEnJuego: catálogo completo, elegidos, y propias que existen', () => {
  assert.equal(codigosEnJuego(normalizarAlbum()).length, 75);
  assert.deepEqual(codigosEnJuego({ codigos: ['sol', 'luna'] }), ['sol', 'luna']);
  const propias = [{ id: 'x1' }];
  assert.equal(codigosEnJuego(normalizarAlbum(), propias).length, 76);
  assert.deepEqual(codigosEnJuego({ codigos: ['sol', 'propia:x1', 'propia:borrada', 'inventada'] }, propias), ['sol', 'propia:x1']);
});

test('calcomanías propias: el código se arma y se deshace', () => {
  assert.equal(codigoDePropia('abc'), 'propia:abc');
  assert.equal(esPropia('propia:abc'), true);
  assert.equal(esPropia('sol'), false);
  assert.equal(idDePropia('propia:abc'), 'abc');
});
