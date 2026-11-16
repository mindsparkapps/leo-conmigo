// Alumnos habilitados (modo adulto, PLAN.md fase 17): quién tiene acceso a la versión de cada niño, en qué estado está
// y qué hacer (invitar, quitar acceso, desvincular un dispositivo, ver estadísticas). La lógica está en js/aulas.js,
// js/sync-aula.js y core/aula.js; aquí solo se muestra y se llama. Nada se quita solo: los permisos extraños se avisan.

import { el } from '../ui/dom.js';
import { cabecera, describirError } from '../ui/adulto.js';
import { obtenerStore, fijarPerfilActivo } from '../contexto.js';
import { leerFondo } from '../ui/fondo.js';
import { vistaDePerfil } from '../store-perfil.js';
import { estadoDeAlumnos } from '../core/aula.js';
import {
  FASES, nubeConfigurada, observarAulas, observarNube, obtenerAulas, pedirPermisoAulas, refrescarEstado, sincronizarAulaAhora, tienePermisoAulas,
} from '../nube.js';

export const titulo = 'Alumnos habilitados · Leo Conmigo';

const ESTADOS = { invitado: 'Invitado, aún no entra', conectado: 'Conectado', 'sin acceso': 'Sin acceso' };
const cuantos = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** «hace un momento», «hace 5 minutos», «hace 2 horas», «hace 3 días». */
export function haceCuanto(ms) {
  if (ms == null || Number.isNaN(ms)) return 'nunca';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${cuantos(min, 'minuto', 'minutos')}`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${cuantos(horas, 'hora', 'horas')}`;
  return `hace ${cuantos(Math.floor(horas / 24), 'día', 'días')}`;
}

export function montar(contenedor) {
  const zona = el('div');
  contenedor.append(el('section', { class: 'vista-adulto' }, cabecera('Alumnos habilitados'), zona));

  let vivo = true;
  let nube = null; // estado de la cuenta
  let aulasEstado = new Map();
  let perfiles = [];
  let aulasMeta = {};
  let pendientes = {}; // perfilId -> cambios por subir
  const trabajando = {}; // perfilId -> texto mientras una acción corre
  const mensajes = {}; // perfilId -> { texto, error }
  const borradores = {}; // perfilId -> correo a medio escribir
  let errorPermiso = '';

  async function cargar() {
    const store = await obtenerStore();
    perfiles = (await store.listar('perfiles')).sort((a, b) => (a.creado ?? '').localeCompare(b.creado ?? ''));
    aulasMeta = (await store.leerMeta('aulas', {})) ?? {};
    pendientes = {};
    // «por subir al aula»: lo editado después de la última sincronización de esa aula (la cola es de la sincronización personal)
    for (const p of perfiles) {
      if (!aulasMeta[p.id]) continue;
      const desde = (await store.leerMeta(`aula:${p.id}:syncUltimo`)) ?? '';
      pendientes[p.id] = (await vistaDePerfil(store, p.id).pendientesSync()).filter((c) => c.fecha > desde).length;
    }
    if (vivo) pintar();
  }

  async function accion(perfilId, texto, fn) {
    trabajando[perfilId] = texto;
    delete mensajes[perfilId];
    pintar();
    try {
      const aviso = await fn();
      if (aviso) mensajes[perfilId] = { texto: aviso, error: false };
    } catch (error) {
      console.error(error);
      mensajes[perfilId] = { texto: error?.name === 'ErrorAula' || error?.name === 'ErrorDrive' || error?.name === 'ErrorCuenta' ? error.message : describirError(error), error: true };
    } finally {
      delete trabajando[perfilId];
    }
    await cargar();
  }

  const habilitar = (perfil) => accion(perfil.id, 'Preparando la carpeta del aula…', async () => {
    if (!tienePermisoAulas()) await pedirPermisoAulas();
    await (await obtenerAulas()).crearAula(perfil, { fondo: leerFondo() });
    await cargar();
    trabajando[perfil.id] = 'Subiendo imágenes y audios…';
    pintar();
    await sincronizarAulaAhora(perfil.id);
  });

  const invitar = (perfil) => accion(perfil.id, 'Invitando…', async () => {
    const correo = (borradores[perfil.id] ?? '').trim();
    await (await obtenerAulas()).invitar(perfil.id, correo);
    delete borradores[perfil.id];
    await sincronizarAulaAhora(perfil.id);
    return `Listo: ${correo} recibirá un correo de Google con la invitación.`;
  });

  const quitarAcceso = (perfil, correo) => {
    if (!globalThis.confirm(`¿Quitar el acceso de ${correo} a la versión de ${perfil.nombre}? Dejará de ver el aula y de poder subir cosas. Lo que ya trajo a tu app se queda. Su dispositivo sigue funcionando sin conexión con lo que ya tiene.`)) return null;
    return accion(perfil.id, 'Quitando el acceso…', async () => {
      await (await obtenerAulas()).quitarAcceso(perfil.id, correo);
      await sincronizarAulaAhora(perfil.id);
      return `Se quitó el acceso de ${correo}.`;
    });
  };

  const desvincular = (perfil, dispositivo) => {
    if (!globalThis.confirm(`¿Desvincular este dispositivo (${dispositivo.nombre || dispositivo.idDispositivo})? En su próxima sincronización borrará sus datos y volverá a la pantalla de primer uso. No se puede deshacer.`)) return null;
    return accion(perfil.id, 'Desvinculando…', async () => {
      await (await obtenerAulas()).desvincularDispositivo(perfil.id, dispositivo.idDispositivo);
      return 'Listo: ese dispositivo se desvinculará la próxima vez que se conecte.';
    });
  };

  const quitarExtrano = (perfil, permiso) => {
    if (!globalThis.confirm('¿Quitar este permiso? Es un acceso que Leo Conmigo no puso.')) return null;
    return accion(perfil.id, 'Quitando el permiso…', async () => {
      await (await obtenerAulas()).quitarPermisoExtrano(perfil.id, permiso);
      await sincronizarAulaAhora(perfil.id);
      return 'Se quitó el permiso.';
    });
  };

  const verEstadisticas = async (perfil) => {
    await fijarPerfilActivo(perfil.id);
    location.hash = '#/adulto/progreso';
  };

  function pintar() {
    if (!vivo) return;
    const ahora = Date.now();
    zona.replaceChildren(...[
      panelQuePuedeVer(),
      ...panelesPrevios(),
      ...(puedeUsar() ? perfiles.map((p) => panelPerfil(p, ahora)) : []),
      puedeUsar() && !perfiles.length ? el('div', { class: 'panel' }, el('p', {}, 'Todavía no hay ningún niño. Crea su perfil primero.'), el('a', { class: 'boton', href: '#/adulto/asistente' }, 'Crear el primer perfil')) : null,
    ].filter(Boolean)); // el replaceChildren nativo escribe «null» si recibe null
  }

  const cuentaLista = () => nube && nube.email && nube.fase !== FASES.SIN_CUENTA && nube.fase !== FASES.SIN_CONFIGURAR;
  const puedeUsar = () => nubeConfigurada() && cuentaLista() && tienePermisoAulas();

  function panelesPrevios() {
    if (!nubeConfigurada()) {
      return [el('div', { class: 'panel' }, el('p', { class: 'ayuda' }, 'Esta copia de la aplicación todavía no tiene el cliente de Google (CLIENT_ID en js/config.js).'))];
    }
    if (!cuentaLista()) {
      return [el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Primero, tu cuenta de Google'),
        el('p', {}, 'Para habilitar alumnos hay que iniciar sesión con tu cuenta de Google: el aula vive en tu Drive.'),
        el('a', { class: 'boton', href: '#/adulto/cuenta' }, 'Iniciar sesión'),
      )];
    }
    if (!tienePermisoAulas()) {
      return [el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Permiso de Drive para las aulas'),
        el('p', {}, 'Las aulas son carpetas de tu Google Drive que compartes con el Gmail de cada alumno. Para crearlas, la app necesita un permiso más de Google: ver y crear carpetas en tu Drive. Solo lo usa para las carpetas «Leo Conmigo» y nunca comparte nada con quien no invites.'),
        el('p', { class: 'ayuda' }, 'En la ventana de Google, deja marcada la casilla del permiso de Drive.'),
        errorPermiso ? el('p', { class: 'error-texto', role: 'alert' }, errorPermiso) : null,
        el('button', {
          type: 'button',
          class: 'boton',
          onclick: async () => {
            errorPermiso = '';
            try { await pedirPermisoAulas(); } catch (error) { errorPermiso = error?.message ?? 'No se pudo conseguir el permiso.'; }
            await refrescarEstado();
            pintar();
          },
        }, 'Dar el permiso de Drive'),
      )];
    }
    return [];
  }

  function panelPerfil(perfil, ahora) {
    const info = aulasMeta[perfil.id];
    const mensaje = mensajes[perfil.id];
    const hecho = [el('h2', {}, perfil.nombre)];
    if (!info) {
      hecho.push(
        el('p', {}, 'Todavía no tiene alumno habilitado. Al habilitarlo se crea una carpeta en tu Drive con sus palabras, fotos y voces, y podrás invitar el Gmail de quien lo va a usar.'),
        trabajando[perfil.id] ? progreso(trabajando[perfil.id]) : el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton', onclick: () => habilitar(perfil) }, 'Habilitar alumno')),
        mensaje ? el('p', { class: mensaje.error ? 'error-texto' : 'ayuda', role: mensaje.error ? 'alert' : 'status' }, mensaje.texto) : null,
      );
      return el('div', { class: 'panel', 'data-perfil': perfil.id }, ...hecho);
    }

    const e = aulasEstado.get(perfil.id);
    const sincronizando = e?.fase === 'sincronizando';
    const ocupado = Boolean(trabajando[perfil.id]) || sincronizando;
    const alumnos = e?.alumnos?.length || !info.invitados.length ? (e?.alumnos ?? []) : estadoDeAlumnos({ invitados: info.invitados, ahora: new Date(ahora) }).alumnos;

    hecho.push(
      el('p', { class: 'estado-nube', role: 'status' },
        el('span', { class: `punto-estado ${e?.fase === 'error' ? 'aviso' : sincronizando ? 'aviso' : e?.ultimo ? 'ok' : 'apagado'}`, 'aria-hidden': 'true' }),
        el('strong', {}, sincronizando ? 'Sincronizando…' : e?.fase === 'error' ? 'No se pudo sincronizar' : e?.ultimo ? `Aula al día · ${haceCuanto(ahora - Date.parse(e.ultimo))}` : 'Aula creada, todavía sin sincronizar')),
      sincronizando ? progreso(e.progreso) : null,
      trabajando[perfil.id] ? progreso(trabajando[perfil.id]) : null,
      e?.fase === 'error' && e.mensaje ? el('p', { class: 'error-texto', role: 'alert' }, e.mensaje) : null,
      !ocupado && pendientes[perfil.id] > 0 ? el('p', { class: 'ayuda' }, `Hay ${cuantos(pendientes[perfil.id], 'cambio', 'cambios')} por subir al aula: se suben solos en unos segundos, o toca «Sincronizar ahora».`) : null,
      mensaje ? el('p', { class: mensaje.error ? 'error-texto' : 'ayuda', role: mensaje.error ? 'alert' : 'status' }, mensaje.texto) : null,
    );

    for (const p of e?.permisosExtranos ?? []) {
      hecho.push(el('div', { class: 'aviso', role: 'alert' },
        el('p', {}, el('strong', {}, 'Permiso extraño: '), `${p.motivo}${p.email ? ` (${p.email})` : ''}, en ${p.carpeta === 'aula' ? 'la carpeta del aula' : 'la carpeta del alumno'}. Leo Conmigo no lo puso.`),
        el('button', { type: 'button', class: 'boton secundario chico', disabled: ocupado, onclick: () => quitarExtrano(perfil, p) }, 'Quitar este permiso')));
    }
    if (e?.avisos?.length) {
      hecho.push(el('div', { class: 'aviso', role: 'status' },
        e.descartados ? el('p', {}, el('strong', {}, `Datos del alumno descartados (${e.descartados}): `), 'no se aceptaron porque no son de lo que un alumno puede enviar.') : el('p', {}, el('strong', {}, 'Avisos de la última sincronización:')),
        el('ul', { class: 'lista-ayuda' }, ...e.avisos.map((a) => el('li', {}, a)))));
    }

    hecho.push(el('h3', {}, 'Quién tiene acceso'));
    if (!alumnos.length) hecho.push(el('p', { class: 'ayuda' }, 'Todavía no invitaste a nadie.'));
    else {
      hecho.push(el('ul', { class: 'lista-alumnos' }, ...alumnos.map((a) => el('li', { class: 'alumno-fila' },
        el('div', {}, el('strong', {}, a.email), ' · ', ESTADOS[a.estado] ?? a.estado),
        ...a.dispositivos.map((d) => el('div', { class: 'ayuda alumno-dispositivo' },
          `${d.nombre || d.idDispositivo} · versión ${d.versionApp ?? '?'} · sincronizó ${haceCuanto(d.haceMs)} `,
          el('button', { type: 'button', class: 'boton secundario chico', disabled: ocupado, onclick: () => desvincular(perfil, d) }, 'Desvincular'))),
        el('button', { type: 'button', class: 'boton secundario chico', disabled: ocupado, onclick: () => quitarAcceso(perfil, a.email) }, 'Quitar acceso')))));
    }

    const campo = el('input', { type: 'email', class: 'entrada', placeholder: 'correo@gmail.com', 'aria-label': `Gmail del alumno de ${perfil.nombre}`, autocomplete: 'off', value: borradores[perfil.id] ?? '', disabled: ocupado });
    campo.addEventListener('input', () => { borradores[perfil.id] = campo.value; });
    campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); invitar(perfil); } });
    hecho.push(
      el('div', { class: 'acciones' }, campo, el('button', { type: 'button', class: 'boton', disabled: ocupado, onclick: () => invitar(perfil) }, 'Invitar')),
      el('div', { class: 'acciones' },
        el('button', { type: 'button', class: 'boton secundario', disabled: ocupado, onclick: () => accion(perfil.id, 'Sincronizando…', async () => { await sincronizarAulaAhora(perfil.id); }) }, 'Sincronizar ahora'),
        el('button', { type: 'button', class: 'boton secundario', onclick: () => verEstadisticas(perfil) }, 'Ver estadísticas')),
    );
    return el('div', { class: 'panel', 'data-perfil': perfil.id }, ...hecho);
  }

  const dejarDeObservarNube = observarNube((e) => { nube = e; pintar(); });
  const dejarDeObservarAulas = observarAulas((mapa) => {
    aulasEstado = mapa;
    pintar();
    if (vivo && ![...mapa.values()].some((x) => x.fase === 'sincronizando')) cargar().catch(console.error);
  });
  refrescarEstado().catch(() => {});
  cargar().catch((error) => { console.error(error); zona.replaceChildren(el('div', { class: 'aviso', role: 'alert' }, el('p', {}, describirError(error)))); });

  return () => {
    vivo = false;
    dejarDeObservarNube();
    dejarDeObservarAulas();
  };
}

/** Texto de avance con una barra cuando trae «(n de m)». */
function progreso(texto) {
  const m = /\((\d+) de (\d+)\)/.exec(texto ?? '');
  return el('div', { class: 'progreso-aula', role: 'status' },
    el('p', { class: 'ayuda' }, texto || 'Trabajando…'),
    m ? el('progress', { max: m[2], value: m[1], 'aria-label': texto }) : null,
    el('p', { class: 'ayuda' }, 'No cierres la app mientras termina.'));
}

function panelQuePuedeVer() {
  return el(
    'div',
    { class: 'panel' },
    el('h2', {}, 'Qué puede ver el alumno'),
    el('ul', { class: 'lista-ayuda' },
      el('li', {}, 'Solo la carpeta de su aula: sus palabras, frases, libros, álbumes, fotos y voces, en solo lectura. No puede cambiar nada de eso.'),
      el('li', {}, 'Puede escribir únicamente en su propia subcarpeta «del-alumno»: sus sesiones, respuestas y progreso.'),
      el('li', {}, 'No ve el resto de tu Drive, ni la carpeta «Leo Conmigo», ni las aulas de otros niños.'),
      el('li', {}, 'Nadie más ve el aula: solo los correos que invites, uno por uno. Nunca «cualquiera con el enlace».'),
      el('li', {}, 'Si aparece un acceso que Leo Conmigo no puso, te lo mostramos como «Permiso extraño» y tú decides si quitarlo.')),
    el('p', {}, el('strong', {}, 'En el dispositivo del niño: '), 'instala la app, toca «Este dispositivo es de un alumno» y entra con el Gmail que invitaste.'),
  );
}
