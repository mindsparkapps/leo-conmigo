import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HORAS_SIN_SYNC_PARA_VENTANA, dispositivoVacio, elegirAula, esRutaAdulta, esSesionDelNino, estaDesvinculado, firmaDelAdulto, modoDeRenovacion,
  puedeSincronizarAlumno, textoConfirmarConversion,
} from '../js/core/dispositivo-alumno.js';

test('esRutaAdulta: toda ruta #/adulto cuenta; las del niño no', () => {
  for (const h of ['#/adulto', '#/adulto/ajustes', '/adulto/progreso', '#/adulto/palabra?id=1']) assert.equal(esRutaAdulta(h), true, h);
  for (const h of ['#/nino', '#/nino/sesion', '#/adultos', '', undefined]) assert.equal(esRutaAdulta(h), false, String(h));
});

test('esSesionDelNino: solo #/nino/sesion', () => {
  assert.equal(esSesionDelNino('#/nino/sesion'), true);
  assert.equal(esSesionDelNino('#/nino/sesion?x=1'), true);
  assert.equal(esSesionDelNino('#/nino/premio'), false);
  assert.equal(esSesionDelNino('#/nino'), false);
});

test('modoDeRenovacion: silenciosa por defecto; interactiva solo si ya falló y lleva más de 24 h', () => {
  const ahora = Date.parse('2026-11-16T12:00:00Z');
  const hace = (h) => new Date(ahora - h * 3_600_000).toISOString();
  assert.equal(modoDeRenovacion({ tokenVigente: true, ahora }), 'ninguna');
  assert.equal(modoDeRenovacion({ tokenVigente: false, ultimaSync: hace(1), ahora }), 'silenciosa');
  assert.equal(modoDeRenovacion({ tokenVigente: false, silenciosaFallo: true, ultimaSync: hace(5), ahora }), 'silenciosa');
  assert.equal(modoDeRenovacion({ tokenVigente: false, silenciosaFallo: false, ultimaSync: hace(100), ahora }), 'silenciosa', 'sin fallo previo no se abre la ventana');
  assert.equal(modoDeRenovacion({ tokenVigente: false, silenciosaFallo: true, ultimaSync: hace(HORAS_SIN_SYNC_PARA_VENTANA + 1), ahora }), 'interactiva');
  assert.equal(modoDeRenovacion({ tokenVigente: false, silenciosaFallo: true, ultimaSync: null, ahora }), 'interactiva', 'nunca sincronizó');
});

test('puedeSincronizarAlumno: nunca durante la sesión, sin conexión, sin token, oculta o sin aula', () => {
  const base = { esAlumno: true, tieneAula: true, hash: '#/nino', enLinea: true, oculto: false, tokenVigente: true };
  assert.equal(puedeSincronizarAlumno(base), true);
  assert.equal(puedeSincronizarAlumno({ ...base, hash: '#/nino/premio' }), true);
  assert.equal(puedeSincronizarAlumno({ ...base, hash: '#/nino/sesion' }), false);
  for (const roto of [{ esAlumno: false }, { tieneAula: false }, { enLinea: false }, { oculto: true }, { tokenVigente: false }]) {
    assert.equal(puedeSincronizarAlumno({ ...base, ...roto }), false, JSON.stringify(roto));
  }
});

test('elegirAula: ninguna (con el correo en el mensaje), una o varias por nombre', () => {
  const n = elegirAula([], 'pedro@gmail.com');
  assert.equal(n.tipo, 'ninguna');
  assert.match(n.mensaje, /Pídele a tu adulto que invite a pedro@gmail\.com/);
  assert.equal(elegirAula([{ nombre: 'Aula A' }], 'x@y.com').tipo, 'una');
  const v = elegirAula([{ nombre: 'Zeta' }, { nombre: 'Álvaro' }], 'x@y.com');
  assert.equal(v.tipo, 'varias');
  assert.deepEqual(v.aulas.map((a) => a.nombre), ['Álvaro', 'Zeta']);
});

test('dispositivoVacio: solo sin perfiles vivos', () => {
  assert.equal(dispositivoVacio([]), true);
  assert.equal(dispositivoVacio([{ id: 'a', deleted: true }]), true);
  assert.equal(dispositivoVacio([{ id: 'a' }]), false);
});

test('textoConfirmarConversion: dice que borra todo, que no se puede deshacer y sugiere copia; avisa de lo sin subir', () => {
  const base = textoConfirmarConversion({});
  for (const frase of [/perfiles, palabras, fotos, voces y progreso/, /No se puede deshacer/, /copia de seguridad/, /sincronizado/]) assert.match(base, frase);
  assert.doesNotMatch(base, /NO se subieron/);
  assert.match(textoConfirmarConversion({ pendientes: 3 }), /3 cambios que todavía NO se subieron/);
  assert.match(textoConfirmarConversion({ pendientes: 1 }), /1 cambio que todavía NO se subieron/);
  assert.match(textoConfirmarConversion({ sinCuenta: true, pendientes: 5 }), /no está sincronizado con ninguna cuenta/);
  assert.doesNotMatch(textoConfirmarConversion({ sinCuenta: true }), /NO se subieron/);
});

test('estaDesvinculado y firmaDelAdulto', () => {
  assert.equal(estaDesvinculado({ desvinculados: ['d1'] }, 'd1'), true);
  assert.equal(estaDesvinculado({ desvinculados: ['d1'] }, 'd2'), false);
  assert.equal(estaDesvinculado(null, 'd1'), false);
  const archivos = [
    { id: '1', name: 'adulto.json', modifiedTime: 'a', owners: [{ emailAddress: 'Adulto@x.com' }] },
    { id: '2', name: 'aula.json', modifiedTime: 'b', owners: [{ emailAddress: 'adulto@x.com' }] },
    { id: '3', name: 'adulto.json', modifiedTime: 'z', owners: [{ emailAddress: 'otro@x.com' }] },
    { id: '4', name: 'medio-x.webp', modifiedTime: 'c', owners: [{ emailAddress: 'adulto@x.com' }] },
  ];
  assert.equal(firmaDelAdulto(archivos, 'adulto@x.com'), '1:a|2:b');
  assert.notEqual(firmaDelAdulto([{ ...archivos[0], modifiedTime: 'nuevo' }, archivos[1]], 'adulto@x.com'), firmaDelAdulto(archivos, 'adulto@x.com'));
});

test('acceso: en un dispositivo de alumno no hay modo adulto aunque sessionStorage diga que sí', async () => {
  const guardado = new Map();
  const almacen = () => ({ getItem: (k) => (guardado.has(k) ? guardado.get(k) : null), setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) });
  globalThis.localStorage = almacen();
  const sesion = new Map();
  globalThis.sessionStorage = { getItem: (k) => (sesion.has(k) ? sesion.get(k) : null), setItem: (k, v) => sesion.set(k, String(v)), removeItem: (k) => sesion.delete(k), clear: () => sesion.clear() };
  try {
    const acceso = await import('../js/acceso.js');
    sesion.set('leo_modo_adulto', '1');
    assert.equal(acceso.esAlumno(), false);
    assert.equal(acceso.adultoHabilitado(), true, 'en el dispositivo del adulto sigue como siempre');
    acceso.deshabilitarAdulto();
    guardado.set(acceso.CLAVE_ROL, 'alumno');
    sesion.set('leo_modo_adulto', '1');
    assert.equal(acceso.esAlumno(), true);
    assert.equal(acceso.adultoHabilitado(), false);
    acceso.habilitarAdulto();
    assert.equal(acceso.adultoHabilitado(), false, 'habilitarAdulto() no tiene efecto');
    guardado.delete(acceso.CLAVE_ROL);
    sesion.clear();
    assert.equal(acceso.adultoHabilitado(), false, 'y no dejó nada en memoria');
  } finally {
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
  }
});
