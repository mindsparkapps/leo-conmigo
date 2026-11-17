// Fase 29 (Ampliación 5): lo puro de la pantalla de escritura: el texto de E19 con su hueco y quién es administrador.
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { partesDelTexto } from '../js/actividades/escritura.js';
import { CLAVE_ROL, correoDeLaCuenta, establecerAdministradores, esAdministrador } from '../js/acceso.js';

describe('partesDelTexto (E19)', () => {
  test('cambia la palabra que falta por un hueco y deja el resto igual', () => {
    const partes = partesDelTexto(['Mi gato es blanco.', 'El gato toma leche.'], 'leche');
    assert.deepEqual(partes, [{ texto: 'Mi gato es blanco. El gato toma ' }, { hueco: true, texto: 'leche' }, { texto: '.' }]);
  });

  test('solo cuenta palabras enteras (no una parte de otra) y respeta tildes', () => {
    const partes = partesDelTexto(['Papá cocina sopa.', 'La sopa está rica.'], 'sopa');
    assert.equal(partes.filter((p) => p.hueco).length, 2);
    assert.equal(partesDelTexto(['El pan tapa el panal.'], 'pan').filter((p) => p.hueco).length, 1);
    assert.equal(partesDelTexto(['Está en el árbol.'], 'árbol').filter((p) => p.hueco).length, 1);
  });

  test('sin palabra que falte, el texto va entero', () => {
    assert.deepEqual(partesDelTexto(['Hola.', 'Chao.'], ''), [{ texto: 'Hola. Chao.' }]);
  });
});

describe('esAdministrador', () => {
  let guardado;
  const poner = (datos) => {
    globalThis.localStorage = { getItem: (k) => (k in datos ? datos[k] : null) };
  };
  beforeEach(() => { guardado = globalThis.localStorage; establecerAdministradores([]); });
  afterEach(() => { globalThis.localStorage = guardado; establecerAdministradores([]); });

  test('sin sesión de Google no hay administrador', () => {
    poner({});
    establecerAdministradores(['ana@ejemplo.com']);
    assert.equal(correoDeLaCuenta(), null);
    assert.equal(esAdministrador(), false);
  });

  test('con sesión y el correo en la lista (sin mirar mayúsculas) sí', () => {
    poner({ leo_cuenta_google: JSON.stringify({ email: 'Ana@Ejemplo.com' }) });
    establecerAdministradores([' ANA@ejemplo.com ']);
    assert.equal(esAdministrador(), true);
  });

  test('con sesión pero fuera de la lista, no', () => {
    poner({ leo_cuenta_google: JSON.stringify({ email: 'otra@ejemplo.com' }) });
    establecerAdministradores(['ana@ejemplo.com']);
    assert.equal(esAdministrador(), false);
  });

  test('el dispositivo de un alumno nunca es administrador', () => {
    poner({ leo_cuenta_google: JSON.stringify({ email: 'ana@ejemplo.com' }), [CLAVE_ROL]: 'alumno' });
    establecerAdministradores(['ana@ejemplo.com']);
    assert.equal(esAdministrador(), false);
  });

  test('un dato roto en el almacenamiento no la rompe', () => {
    poner({ leo_cuenta_google: '{no es json' });
    establecerAdministradores(['ana@ejemplo.com']);
    assert.equal(esAdministrador(), false);
  });
});
