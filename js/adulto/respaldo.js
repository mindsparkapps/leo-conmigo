// Copia de seguridad: descargar todo en un archivo y restaurarlo (PLAN.md §5, «Cuenta»).
// El inicio de sesión con Google y la sincronización están en cuenta.js.

import { el } from '../ui/dom.js';
import { cabecera, describirError } from '../ui/adulto.js';
import { obtenerStore } from '../contexto.js';
import { descargarArchivo, elegirArchivo } from '../hardware.js';
import { contarRespaldo, exportarTodo, importarTodo, nombreDeArchivo } from '../respaldo.js';

export const titulo = 'Copia de seguridad · Leo Conmigo';

const NOMBRES = {
  perfiles: ['niño', 'niños'],
  palabras: ['palabra', 'palabras'],
  medios: ['imagen o audio', 'imágenes y audios'],
  progresos: ['registro de progreso', 'registros de progreso'],
  niveles: ['nivel', 'niveles'],
  sesiones: ['sesión', 'sesiones'],
  calcomanias: ['calcomanía', 'calcomanías'],
  frases: ['frase', 'frases'],
  libros: ['libro', 'libros'],
  calcomaniasPropias: ['calcomanía propia', 'calcomanías propias'],
  premios: ['premio de la tienda', 'premios de la tienda'],
  movimientos: ['movimiento de monedas', 'movimientos de monedas'],
  respuestas: ['respuesta registrada', 'respuestas registradas'],
};
const plural = (clave, n) => `${n} ${NOMBRES[clave][n === 1 ? 0 : 1]}`;
const tamano = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function montar(contenedor) {
  const estadoCopia = el('p', { class: 'ayuda', role: 'status' });
  const errorCopia = el('p', { class: 'error-texto', role: 'alert', hidden: true });
  const estadoRestaurar = el('div', { role: 'status' });
  const errorRestaurar = el('p', { class: 'error-texto', role: 'alert', hidden: true });

  const descargar = el('button', { type: 'button', class: 'boton' }, 'Descargar copia de seguridad');
  descargar.addEventListener('click', async () => {
    errorCopia.hidden = true;
    estadoCopia.textContent = 'Preparando la copia…';
    descargar.disabled = true;
    try {
      const store = await obtenerStore();
      const respaldo = await exportarTodo(store);
      const blob = new Blob([JSON.stringify(respaldo)], { type: 'application/json' });
      const nombre = nombreDeArchivo();
      descargarArchivo(blob, nombre);
      const cuenta = contarRespaldo(respaldo);
      estadoCopia.textContent = `Listo: ${nombre} (${tamano(blob.size)}). Trae ${plural('perfiles', cuenta.perfiles)}, ${plural('palabras', cuenta.palabras)} y ${plural('medios', cuenta.medios)}.`;
    } catch (error) {
      console.error(error);
      estadoCopia.textContent = '';
      errorCopia.textContent = describirError(error);
      errorCopia.hidden = false;
    } finally {
      descargar.disabled = false;
    }
  });

  const restaurar = el('button', { type: 'button', class: 'boton secundario' }, 'Elegir una copia para restaurar');
  restaurar.addEventListener('click', async () => {
    errorRestaurar.hidden = true;
    estadoRestaurar.replaceChildren();
    const archivo = await elegirArchivo({ accept: 'application/json,.json' });
    if (!archivo) return;
    restaurar.disabled = true;
    estadoRestaurar.replaceChildren(el('p', { class: 'ayuda' }, 'Restaurando…'));
    try {
      const store = await obtenerStore();
      const resumen = await importarTodo(store, await archivo.text());
      const agregados = Object.entries(resumen).filter(([, r]) => r.nuevos > 0).map(([clave, r]) => plural(clave, r.nuevos));
      estadoRestaurar.replaceChildren(
        el('p', {}, agregados.length ? `Listo. Se agregaron: ${agregados.join(', ')}.` : 'No había nada nuevo: tu información ya estaba al día.'),
        el('div', { class: 'acciones' }, el('a', { class: 'boton secundario chico', href: '#/adulto/vocabulario' }, 'Ver vocabulario'), el('a', { class: 'boton secundario chico', href: '#/adulto/progreso' }, 'Ver progreso')),
      );
    } catch (error) {
      if (error?.name !== 'ErrorRespaldo') console.error(error);
      estadoRestaurar.replaceChildren();
      errorRestaurar.textContent = error?.name === 'ErrorRespaldo' ? error.message : describirError(error);
      errorRestaurar.hidden = false;
    } finally {
      restaurar.disabled = false;
    }
  });

  contenedor.append(
    el(
      'section',
      { class: 'vista-adulto' },
      cabecera('Copia de seguridad'),
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Guardar una copia'),
        el('p', {}, 'Descarga un archivo con todo: los niños, sus palabras, las fotos, las voces grabadas, el progreso y las calcomanías.'),
        el('p', { class: 'ayuda' }, 'Ese archivo tiene fotos y la voz del niño: guárdalo en un lugar privado.'),
        el('div', { class: 'acciones' }, descargar),
        estadoCopia,
        errorCopia,
      ),
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Restaurar una copia'),
        el('p', {}, 'Elige un archivo que hayas descargado antes. No se borra nada de lo que ya tienes: se suma lo que falta y, si algo está en los dos lados, se queda lo más reciente.'),
        el('div', { class: 'acciones' }, restaurar),
        estadoRestaurar,
        errorRestaurar,
      ),
    ),
  );
  return undefined;
}
