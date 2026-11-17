// Cuenta de Google y sincronización con Drive (modo adulto): los datos del niño quedan iguales en el
// computador y en el celular. Todo se guarda primero en el dispositivo; la nube es un respaldo y un puente.

import { el } from '../ui/dom.js';
import { cabecera } from '../ui/adulto.js';
import { datosMuyGrandes } from '../core/sync.js';
import { obtenerStore } from '../contexto.js';
import { cargarAdministradores, correoDeLaCuenta, guardarAdministradores } from '../acceso.js';
import { textoConfirmarConversion } from '../core/dispositivo-alumno.js';
import { convertirEnDispositivoDeAlumno } from '../nube-alumno.js';
import {
  FASES, cerrarSesion, clasePunto, iniciarSesion, nubeConfigurada, observarNube, refrescarEstado, sincronizarAhora, textoDeEstado,
} from '../nube.js';

export const titulo = 'Cuenta de Google · Leo Conmigo';

const fechaHora = (iso) => new Date(iso).toLocaleString('es', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const cuantos = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function montar(contenedor) {
  const zona = el('div');
  contenedor.append(
    el(
      'section',
      { class: 'vista-adulto' },
      cabecera('Cuenta de Google'),
      zona,
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Qué se guarda y dónde'),
        el(
          'ul',
          { class: 'lista-ayuda' },
          el('li', {}, 'Las fotos, la voz grabada, las palabras, el progreso y las calcomanías se guardan en una carpeta oculta de tu Google Drive que solo esta aplicación puede ver. No aparece entre tus archivos y la app no puede leer nada más de tu Drive.'),
          el('li', {}, 'Todo funciona sin conexión: los cambios se guardan en el dispositivo y se suben cuando hay internet.'),
          el('li', {}, 'Si dos dispositivos cambian lo mismo, se queda lo más reciente. Nada se borra por sincronizar.'),
          el('li', {}, 'Con la sesión cerrada, los datos se quedan en este dispositivo.'),
        ),
        el('p', { class: 'ayuda' }, el('a', { href: '#/adulto/respaldo' }, 'Copia de seguridad en un archivo')),
      ),
    ),
  );

  const pintar = (e) => {
    const punto = el('span', { class: `punto-estado ${clasePunto(e.fase)}`, 'aria-hidden': 'true' });
    const trabajando = e.fase === FASES.SINCRONIZANDO;
    const vinculada = Boolean(e.email) && e.fase !== FASES.SIN_CUENTA && e.fase !== FASES.SIN_CONFIGURAR;

    const botones = [];
    if (e.fase === FASES.SIN_CUENTA) {
      botones.push(boton('Iniciar sesión con Google', 'boton', () => iniciarSesion()));
    } else if (e.fase === FASES.RECONECTAR) {
      botones.push(boton('Iniciar sesión de nuevo', 'boton', () => iniciarSesion()));
    } else if (vinculada) {
      botones.push(boton('Sincronizar ahora', 'boton', () => sincronizarAhora(), trabajando));
      botones.push(boton('Usar otra cuenta', 'boton secundario', () => iniciarSesion({ cambiarCuenta: true }), trabajando));
    }
    if (vinculada) {
      botones.push(boton('Cerrar sesión', 'boton secundario', async () => {
        if (!globalThis.confirm('¿Cerrar la sesión de Google en este dispositivo? Los datos del dispositivo se quedan.')) return;
        await cerrarSesion();
      }, trabajando));
    }

    const r = e.resumen;
    zona.replaceChildren(...[
      el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Sincronización'),
        el('p', { class: 'estado-nube', role: 'status' }, punto, el('strong', {}, textoDeEstado(e))),
        vinculada ? el('p', {}, `Cuenta: ${e.email}`) : null,
        e.fase === FASES.SIN_CONFIGURAR
          ? el('p', { class: 'ayuda' }, 'Esta copia de la aplicación todavía no tiene el cliente de Google (CLIENT_ID en js/config.js). Quien publica la app debe completarlo.')
          : null,
        e.fase === FASES.SIN_CUENTA
          ? el('p', {}, 'Inicia sesión con tu cuenta de Google para tener los mismos datos en el computador y en el celular.')
          : null,
        e.ultimo && vinculada ? el('p', { class: 'ayuda' }, `Última sincronización: ${fechaHora(e.ultimo)}.`) : null,
        vinculada && datosMuyGrandes(e.bytesDatos)
          ? el('p', { class: 'ayuda', role: 'status' }, `Los datos guardados en Drive ya pesan ${(e.bytesDatos / 1048576).toFixed(1)} MB (sobre todo el registro de respuestas). Sigue funcionando; si la sincronización se pone lenta, avisa para decidir qué hacer. No se borra nada sin preguntarte.`)
          : null,
        e.fase === FASES.PENDIENTE || e.fase === FASES.SIN_CONEXION
          ? el('p', { class: 'ayuda' }, e.pendientes > 0 ? `${cuantos(e.pendientes, 'cambio espera', 'cambios esperan')} para subirse.` : 'No hay cambios por subir.')
          : null,
        e.mensaje ? el('p', { class: 'error-texto', role: 'alert' }, e.mensaje) : null,
        r && e.fase === FASES.SINCRONIZADO
          ? el(
              'p',
              { class: 'ayuda' },
              `Esta vez: ${cuantos(r.registrosTraidos, 'registro nuevo traído', 'registros nuevos traídos')}, ${cuantos(r.mediosSubidos, 'imagen o audio subido', 'imágenes y audios subidos')}, ${cuantos(r.mediosBajados, 'imagen o audio bajado', 'imágenes y audios bajados')}.`,
              r.mediosSinArchivo ? ` ${cuantos(r.mediosSinArchivo, 'imagen o audio no está en ningún dispositivo', 'imágenes o audios no están en ningún dispositivo')}: vuelve a elegirlos.` : '',
            )
          : null,
        botones.length ? el('div', { class: 'acciones' }, botones) : null,
      ),
      // ver y limpiar lo repetido que dejaron las versiones anteriores (solo con la sesión iniciada)
      vinculada ? el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Espacio en Drive'),
        el('p', { class: 'ayuda' }, 'Mira qué copias repetidas o sobrantes dejaron las versiones anteriores en tu Drive, cuánto pesan, y elige cuáles eliminar.'),
        el('div', { class: 'acciones' }, el('a', { class: 'boton secundario', href: '#/adulto/espacio' }, 'Ver el espacio en Drive')),
      ) : null,
    ].filter(Boolean)); // el replaceChildren nativo escribe «null» si recibe null
  };

  // Convertir este dispositivo en celular de alumno: borra todo lo suyo (con una confirmación clara)
  let ultimaFase = null;
  contenedor.querySelector('.vista-adulto').append(
    panelAdministradores(),
    el(
      'div',
      { class: 'panel' },
      el('h2', {}, 'Celular de un alumno'),
      el('p', { class: 'ayuda' }, 'Si este dispositivo va a ser del niño (no tuyo), conviértelo: se borra todo lo que hay aquí y entra con el Gmail del alumno para bajar su aula. El alumno no ve nada de configuración.'),
      el('div', { class: 'acciones' }, el('button', {
        type: 'button',
        class: 'boton secundario',
        onclick: async () => {
          const store = await obtenerStore();
          const sinCuenta = !ultimaFase || ultimaFase === FASES.SIN_CUENTA || ultimaFase === FASES.SIN_CONFIGURAR;
          const pendientes = sinCuenta ? 0 : (await store.pendientesSync()).length;
          if (!globalThis.confirm(textoConfirmarConversion({ pendientes, sinCuenta }))) return;
          await convertirEnDispositivoDeAlumno();
        },
      }, 'Convertir este dispositivo en celular de alumno')),
    ),
  );

  const dejarDeObservar = observarNube((e) => { ultimaFase = e.fase; pintar(e); });
  if (nubeConfigurada()) refrescarEstado();
  return () => dejarDeObservar();
}

/**
 * «Administradores (funciones experimentales)»: los correos de Google que ven los botones en prueba (por ahora, «Escritura»).
 * La lista se guarda en `meta` y viaja con la sincronización personal; nunca va al aula ni a la Biblioteca.
 */
function panelAdministradores() {
  const zona = el('div', { class: 'panel' });
  const pintar = async () => {
    const store = await obtenerStore();
    const lista = await cargarAdministradores(store);
    const mio = correoDeLaCuenta();
    const guardar = async (nueva) => { await guardarAdministradores(store, nueva); await pintar(); };
    const entrada = el('input', { type: 'email', placeholder: 'correo@gmail.com', autocomplete: 'off', 'aria-label': 'Correo del administrador' });
    const agregar = async () => {
      const correo = entrada.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { entrada.setCustomValidity('Escribe un correo válido.'); entrada.reportValidity(); entrada.setCustomValidity(''); return; }
      await guardar([...lista, correo]);
    };
    zona.replaceChildren(...[
      el('h2', {}, 'Administradores (funciones experimentales)'),
      el('p', { class: 'ayuda' }, 'Quien inicie sesión con uno de estos correos ve las funciones que todavía no están habilitadas para el niño (por ahora, el botón «Escritura» con la etiqueta «Modo administrador»). Lo que juega ahí se guarda en un perfil de prueba, no en el del niño. Esta lista se sincroniza entre tus dispositivos, no con los alumnos.'),
      lista.length
        ? el('ul', { class: 'lista-filas' }, lista.map((correo) => el('li', { class: 'fila-perfil' }, el('div', { class: 'fila-contenido' },
          el('div', { class: 'fila-texto' }, el('strong', {}, correo), correo === mio ? el('span', { class: 'insignia' }, 'Tú') : null),
          el('div', { class: 'acciones-fila' }, el('button', { type: 'button', class: 'boton secundario chico', onclick: () => guardar(lista.filter((c) => c !== correo)).catch(console.error) }, 'Quitar'))))))
        : el('p', { class: 'ayuda' }, 'Todavía no hay administradores.'),
      !lista.length && mio
        ? el('p', {}, el('button', { type: 'button', class: 'boton', onclick: () => guardar([mio]).catch(console.error) }, `Hacerme administrador (${mio})`))
        : null,
      !lista.length && !mio ? el('p', { class: 'ayuda' }, 'Inicia sesión con Google arriba para poder hacerte administrador con tu cuenta.') : null,
      el('div', { class: 'acciones' }, entrada, el('button', { type: 'button', class: 'boton secundario', onclick: () => agregar().catch(console.error) }, 'Agregar correo')),
    ].filter(Boolean));
  };
  pintar().catch((error) => console.error(error));
  return zona;
}

function boton(texto, clase, alToque, deshabilitado = false) {
  return el('button', { type: 'button', class: clase, disabled: deshabilitado, onclick: alToque }, texto);
}
