// Fase 32 (Ampliación 5): el script que lista las voces que faltan corre y deja un archivo coherente con lo que imprime.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

test('herramientas/listar-voces-escritura.mjs: el resumen coincide con data/escritura/faltan-voces.txt', () => {
  const salida = execFileSync(process.execPath, [join(RAIZ, 'herramientas/listar-voces-escritura.mjs')], { encoding: 'utf8' });
  const resumen = JSON.parse(salida.split('\n')[0]);
  for (const clave of ['silabasDelBanco', 'silabasDistractoras', 'palabras', 'ejemplosDeNivel']) assert.ok(Number.isInteger(resumen[clave]) && resumen[clave] >= 0, clave);
  const texto = readFileSync(join(RAIZ, 'data/escritura/faltan-voces.txt'), 'utf8');
  const filas = (seccion) => {
    const desde = texto.indexOf(seccion);
    const resto = texto.slice(desde).split('\n').slice(1);
    const hasta = resto.findIndex((l) => l.startsWith('## '));
    return (hasta === -1 ? resto : resto.slice(0, hasta)).filter((l) => l && !l.startsWith('#'));
  };
  assert.equal(filas('## 1.').length, resumen.silabasDelBanco);
  assert.equal(filas('## 2.').length, resumen.silabasDistractoras);
  assert.equal(filas('## 3.').length, resumen.palabras);
  assert.equal(filas('## 4.').length, resumen.ejemplosDeNivel);
  // cada fila de sílaba dice a qué archivo va, sin tildes
  for (const fila of filas('## 1.')) assert.match(fila, /^\S+\tdata\/voces\/silabas\/[a-z]+(-t)?\.mp3$/);
});
