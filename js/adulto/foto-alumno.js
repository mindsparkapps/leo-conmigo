// «Foto del alumno»: en el celular de un ALUMNO, la familia elige su foto desde el panel reducido (la lógica está en
// `js/foto-alumno.js`). Con un perfil antiguo que todavía tiene foto, «Usar la foto que tenía el perfil» la copia al alumno.

import { el } from '../ui/dom.js';
import { crearSelectorFoto } from '../ui/selector-foto.js';
import { describirError } from '../ui/adulto.js';
import { urlDeMedio } from '../medios.js';
import { fotoQueTeniaElPerfil, guardarFotoAlumno } from '../foto-alumno.js';

/**
 * El bloque de la pantalla. `alGuardar` se llama después de guardar (para repintar).
 * @returns {Promise<{ elemento, liberar }>}
 */
export async function crearBloqueFotoAlumno({ store, perfil, alGuardar = () => {} }) {
  const urlActual = await urlDeMedio(store, perfil.medioFotoAlumnoId);
  const selector = crearSelectorFoto({ urlInicial: urlActual, texto: perfil.nombre });
  const mensaje = el('p', { class: 'ayuda', role: 'status' });
  const guardar = el('button', { type: 'button', class: 'boton' }, 'Guardar la foto');

  const ejecutar = async (boton, accion) => {
    boton.disabled = true;
    mensaje.textContent = 'Guardando…';
    try {
      await accion();
      mensaje.textContent = 'Listo.';
      alGuardar();
    } catch (error) {
      console.error(error);
      mensaje.textContent = describirError(error);
      boton.disabled = false;
    }
  };

  guardar.addEventListener('click', () => {
    const { blob, mime, quitar } = selector.estado;
    if (!blob && !quitar) { mensaje.textContent = 'Primero toma o elige una foto.'; return; }
    ejecutar(guardar, () => guardarFotoAlumno(store, perfil, { blob, mime }));
  });

  const delPerfil = perfil.medioFotoAlumnoId ? null : await fotoQueTeniaElPerfil(store, perfil);
  const usarDelPerfil = delPerfil ? el('button', { type: 'button', class: 'boton secundario' }, 'Usar la foto que tenía el perfil') : null;
  usarDelPerfil?.addEventListener('click', () => ejecutar(usarDelPerfil, () => guardarFotoAlumno(store, perfil, delPerfil)));

  const elemento = el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'Foto del alumno'),
    el('p', { class: 'ayuda' }, 'Se ve en su pantalla de inicio. Se guarda en este celular y en el Drive del alumno; su adulto la ve solo si trae el material de la familia.'),
    selector.elemento,
    el('div', { class: 'acciones' }, usarDelPerfil, guardar),
    mensaje,
  );
  return { elemento, liberar: () => selector.liberar() };
}
