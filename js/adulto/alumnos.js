// Alumnos habilitados (modo adulto, PLAN.md fase 17): quién tiene acceso a la versión de cada niño, en qué estado está
// y qué hacer (invitar, quitar acceso, desvincular un dispositivo, ver estadísticas). La lógica está en js/aulas.js,
// js/sync-aula.js y core/aula.js; aquí solo se muestra y se llama. Nada se quita solo: los permisos extraños se avisan.

import { el } from '../ui/dom.js';
import { cabecera, describirError } from '../ui/adulto.js';
import { obtenerStore, fijarPerfilActivo } from '../contexto.js';
import { leerFondo } from '../ui/fondo.js';
import { vistaDePerfil } from '../store-perfil.js';
import { estadoDeAlumnos } from '../core/aula.js';
import { idDeFicha } from '../core/curso.js';
import { materialDe, quitarMaterial, urlsDeMaterial } from '../material-familia.js';
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
  let contenido = {}; // perfilId -> { palabras, medios }: para elegir el perfil que de verdad tiene el material
  let fichas = {}; // perfilId -> fichas de sus alumnos (cada una con su propio avance)
  let familia = {}; // fichaId -> filas de lo que agregó su familia (sin fotos ni voces)
  let material = {}; // fichaId -> fotos y voces de la familia traídas a ESTE celular
  const urlsMaterial = []; // direcciones blob: de lo traído (se liberan al salir)
  const trayendo = {}; // fichaId -> texto mientras se baja el material
  const trabajando = {}; // perfilId -> texto mientras una acción corre
  const mensajes = {}; // perfilId -> { texto, error }
  const borradores = {}; // perfilId -> correo a medio escribir
  let errorPermiso = '';

  async function cargar() {
    const store = await obtenerStore();
    perfiles = (await store.listar('perfiles')).sort((a, b) => (a.creado ?? '').localeCompare(b.creado ?? ''));
    aulasMeta = (await store.leerMeta('aulas', {})) ?? {};
    pendientes = {};
    contenido = {};
    fichas = {};
    const todasLasFichas = await store.listar('alumnos');
    for (const p of perfiles) fichas[p.id] = todasLasFichas.filter((f) => f.cursoId === p.id).sort((a, b) => a.email.localeCompare(b.email));
    const filasFamilia = (await store.listar('contenidoFamilia')).filter((f) => f.registro && !f.registro.deleted);
    familia = {};
    material = {};
    for (const f of todasLasFichas) {
      familia[f.id] = filasFamilia.filter((x) => x.fichaId === f.id);
      material[f.id] = await materialDe(store, f.id);
    }
    for (const p of perfiles) {
      contenido[p.id] = {
        palabras: (await store.listar('palabras', { perfilId: p.id })).length,
        medios: (await vistaDePerfil(store, p.id).listar('medios')).length,
      };
    }
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

  const habilitar = (perfil) => accion(perfil.id, 'Preparando las carpetas del curso…', async () => {
    if (!tienePermisoAulas()) await pedirPermisoAulas();
    await (await obtenerAulas()).crearAula(perfil, { fondo: leerFondo() });
    await cargar();
    trabajando[perfil.id] = 'Subiendo una copia de sus imágenes y audios a tu Drive…';
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
    if (!globalThis.confirm(`¿Quitar el acceso de ${correo} al perfil ${perfil.nombre}? Dejará de ver el curso y de poder subir su avance. Lo que ya trajo a tu app, y su ficha, se quedan. Su dispositivo sigue funcionando sin conexión con lo que ya tiene.`)) return null;
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

  /** El avance que se ha jugado en ESTE celular con el perfil (el adulto no es un alumno: sus estadísticas son aparte de las de cada ficha). */
  const verEstadisticas = async (perfil) => {
    await fijarPerfilActivo(perfil.id);
    location.hash = '#/adulto/progreso';
  };

  /** «Traer el material de la familia»: baja SOLO a este celular las fotos y voces de esa familia (no toca su Drive). */
  const traerMaterial = async (perfil, ficha) => {
    trayendo[ficha.id] = 'Trayendo el material de la familia…';
    delete mensajes[perfil.id];
    pintar();
    try {
      const aulas = await obtenerAulas();
      const r = await aulas.traerMaterialDeFamilia(perfil.id, ficha.email, { alProgresoMaterial: (t) => { trayendo[ficha.id] = t; pintar(); } });
      mensajes[perfil.id] = { texto: r.sinCarpeta ? `${ficha.nombre} todavía no guardó fotos ni voces propias.` : `Listo: ${r.traidos} ${r.traidos === 1 ? 'archivo' : 'archivos'} de la familia de ${ficha.nombre} en este celular.`, error: false };
    } catch (error) {
      console.error(error);
      mensajes[perfil.id] = { texto: error?.name === 'ErrorAula' || error?.name === 'ErrorDrive' || error?.name === 'ErrorCuenta' ? error.message : describirError(error), error: true };
    } finally {
      delete trayendo[ficha.id];
    }
    await cargar();
  };

  /** «Quitarlo de mi celular»: borra solo la copia de este celular, no lo del Drive ni el celular del alumno. */
  const quitarDeMiCelular = async (perfil, ficha) => {
    if (!globalThis.confirm(`¿Quitar de tu celular el material de la familia de ${ficha.nombre}? Solo se borra la copia de aquí: sigue en el Drive y en el celular del alumno, y puedes volver a traerlo.`)) return;
    const store = await obtenerStore();
    const n = await quitarMaterial(store, ficha.id);
    mensajes[perfil.id] = { texto: `Se quitaron ${n} ${n === 1 ? 'archivo' : 'archivos'} de este celular. Lo del alumno no cambió.`, error: false };
    await cargar();
  };

  /** Lo que agregó la familia de un alumno, y los botones para traer o quitar su material. */
  const panelFamilia = (perfil, ficha, ocupado) => {
    const filas = familia[ficha.id] ?? [];
    if (!filas.length && !(material[ficha.id] ?? []).length) return null;
    const cuenta = (almacen) => filas.filter((f) => f.almacen === almacen).length;
    const traido = material[ficha.id] ?? [];
    const { urls, liberar } = urlsDeMaterial(traido);
    urlsMaterial.push(liberar);
    return el('div', { class: 'familia-ficha' },
      el('p', { class: 'ayuda' }, `La familia agregó ${cuantos(cuenta('palabras'), 'palabra', 'palabras')}, ${cuantos(cuenta('frases'), 'frase', 'frases')}, ${cuantos(cuenta('libros'), 'libro', 'libros')}, ${cuantos(cuenta('colecciones'), 'álbum', 'álbumes')} y ${cuantos(cuenta('premios'), 'premio', 'premios')}. Sus estadísticas (también el saldo, las monedas que dio y los premios canjeados) aparecen en su ficha, marcadas «De la familia». Sus fotos y voces están en el Drive del alumno y no se bajan solas.`),
      el('div', { class: 'acciones' },
        trayendo[ficha.id]
          ? progreso(trayendo[ficha.id])
          : el('button', { type: 'button', class: 'boton secundario chico', disabled: ocupado, onclick: () => traerMaterial(perfil, ficha) }, 'Traer el material de la familia'),
        traido.length ? el('button', { type: 'button', class: 'boton secundario chico', disabled: ocupado, onclick: () => quitarDeMiCelular(perfil, ficha) }, 'Quitarlo de mi celular') : null),
      traido.length
        ? el('details', { class: 'detalle-numeros' },
          el('summary', {}, `Material traído a este celular (${traido.length})`),
          el('ul', { class: 'lista-simple' }, traido.map((m) => el('li', {}, m.tipo === 'audio'
            ? el('audio', { controls: true, src: urls.get(m.id), 'aria-label': 'Voz de la familia' })
            : el('img', { src: urls.get(m.id), alt: '', width: 64, height: 64 })))))
        : null);
  };

  /** Los enlaces a las estadísticas de UN alumno (su ficha): Progreso, «Qué le cuesta» y Álbum. */
  const enlacesDeFicha = (ficha) => {
    const sufijo = `/ficha/${encodeURIComponent(ficha.id)}`;
    return el('span', { class: 'acciones-ficha' },
      el('a', { class: 'boton chico', href: `#/adulto/progreso${sufijo}` }, 'Ver estadísticas'),
      el('a', { class: 'boton secundario chico', href: `#/adulto/analisis${sufijo}` }, 'Qué le cuesta'),
      el('a', { class: 'boton secundario chico', href: `#/adulto/album${sufijo}` }, 'Álbum'));
  };

  function pintar() {
    if (!vivo) return;
    for (const liberar of urlsMaterial.splice(0)) liberar(); // lo que se vuelve a dibujar crea sus propias direcciones
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
        el('p', {}, 'Para habilitar alumnos hay que iniciar sesión con tu cuenta de Google: el curso y la Biblioteca viven en tu Drive.'),
        el('a', { class: 'boton', href: '#/adulto/cuenta' }, 'Iniciar sesión'),
      )];
    }
    if (!tienePermisoAulas()) {
      return [el(
        'div',
        { class: 'panel' },
        el('h2', {}, 'Permiso de Drive para las aulas'),
        el('p', {}, 'La Biblioteca, los cursos y las carpetas de los alumnos son carpetas de tu Google Drive que compartes con el Gmail de cada alumno. Para crearlas, la app necesita un permiso más de Google: ver y crear carpetas en tu Drive. Solo lo usa para las carpetas «Leo Conmigo» y nunca comparte nada con quien no invites.'),
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
    const c = contenido[perfil.id];
    const hecho = [
      el('h2', {}, `Perfil (curso): ${perfil.nombre}`),
      c ? el('p', { class: 'ayuda' }, `Este perfil tiene ${cuantos(c.palabras, 'palabra', 'palabras')} y ${cuantos(c.medios, 'imagen o audio', 'imágenes y audios')}. Es lo que verá el alumno.`) : null,
    ].filter(Boolean);
    if (!info) {
      hecho.push(
        el('p', {}, 'Todavía no tiene alumno habilitado. Al tocar «Habilitar alumno», tu app sube una sola vez una copia de su material (palabras, fotos y voces) a una carpeta de tu Drive. No descarga nada ni cambia lo que ya tienes. Cuando termine, aquí mismo aparece el campo para escribir el Gmail del alumno.'),
        c && c.palabras === 0 ? el('p', { class: 'aviso', role: 'note' }, 'Este perfil todavía no tiene palabras: el alumno vería una versión vacía. Si el niño ya tiene un perfil con su material, habilita ese en vez de este.') : null,
        trabajando[perfil.id] ? progreso(trabajando[perfil.id]) : el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'boton', onclick: () => habilitar(perfil) }, 'Habilitar alumno')),
        mensaje ? el('p', { class: mensaje.error ? 'error-texto' : 'ayuda', role: mensaje.error ? 'alert' : 'status' }, mensaje.texto) : null,
      );
      return el('div', { class: 'panel', 'data-perfil': perfil.id }, ...hecho.filter(Boolean));
    }

    const e =aulasEstado.get(perfil.id);
    const sincronizando = e?.fase === 'sincronizando';
    const ocupado = Boolean(trabajando[perfil.id]) || sincronizando;
    const alumnos = e?.alumnos?.length || !info.invitados.length ? (e?.alumnos ?? []) : estadoDeAlumnos({ invitados: info.invitados, ahora: new Date(ahora) }).alumnos;

    hecho.push(
      el('p', { class: 'estado-nube', role: 'status' },
        el('span', { class: `punto-estado ${e?.fase === 'error' ? 'aviso' : sincronizando ? 'aviso' : e?.ultimo ? 'ok' : 'apagado'}`, 'aria-hidden': 'true' }),
        el('strong', {}, sincronizando ? 'Sincronizando…' : e?.fase === 'error' ? 'No se pudo sincronizar' : e?.ultimo ? `Curso al día · ${haceCuanto(ahora - Date.parse(e.ultimo))}` : 'Curso creado, todavía sin sincronizar')),
      sincronizando ? progreso(e.progreso) : null,
      trabajando[perfil.id] ? progreso(trabajando[perfil.id]) : null,
      e?.fase === 'error' && e.mensaje ? el('p', { class: 'error-texto', role: 'alert' }, e.mensaje) : null,
      !ocupado && pendientes[perfil.id] > 0 ? el('p', { class: 'ayuda' }, `Hay ${cuantos(pendientes[perfil.id], 'cambio', 'cambios')} por subir al curso: se suben solos en unos segundos, o toca «Sincronizar ahora».`) : null,
      mensaje ? el('p', { class: mensaje.error ? 'error-texto' : 'ayuda', role: mensaje.error ? 'alert' : 'status' }, mensaje.texto) : null,
    );

    for (const p of e?.permisosExtranos ?? []) {
      hecho.push(el('div', { class: 'aviso', role: 'alert' },
        el('p', {}, el('strong', {}, 'Permiso extraño: '), `${p.motivo}${p.email ? ` (${p.email})` : ''}, en ${p.carpeta === 'aula' ? 'la carpeta del curso' : p.carpeta === 'biblioteca' ? 'la Biblioteca' : 'la carpeta del alumno'}. Leo Conmigo no lo puso.`),
        el('button', { type: 'button', class: 'boton secundario chico', disabled: ocupado, onclick: () => quitarExtrano(perfil, p) }, 'Quitar este permiso')));
    }
    if (e?.avisos?.length) {
      hecho.push(el('div', { class: 'aviso', role: 'status' },
        e.descartados ? el('p', {}, el('strong', {}, `Datos del alumno descartados (${e.descartados}): `), 'no se aceptaron porque no son de lo que un alumno puede enviar.') : el('p', {}, el('strong', {}, 'Avisos de la última sincronización:')),
        el('ul', { class: 'lista-ayuda' }, ...e.avisos.map((a) => el('li', {}, a)))));
    }

    hecho.push(el('h3', {}, 'Alumnos de este perfil'));
    if (!alumnos.length) hecho.push(el('p', { class: 'ayuda' }, 'Todavía no invitaste a nadie.'));
    else {
      hecho.push(el('p', { class: 'ayuda' }, 'Todos ven el mismo perfil, pero cada alumno tiene su propia ficha con su avance y sus estadísticas.'));
      const fichaDe = (correo) => (fichas[perfil.id] ?? []).find((f) => f.id === idDeFicha(perfil.id, correo));
      hecho.push(el('ul', { class: 'lista-alumnos' }, ...alumnos.map((a) => el('li', { class: 'alumno-fila', 'data-alumno': a.email },
        el('div', {}, el('strong', {}, fichaDe(a.email)?.nombre ?? a.email), ` (${a.email}) · `, ESTADOS[a.estado] ?? a.estado),
        ...a.dispositivos.map((d) => el('div', { class: 'ayuda alumno-dispositivo' },
          `${d.nombre || d.idDispositivo} · versión ${d.versionApp ?? '?'} · sincronizó ${haceCuanto(d.haceMs)} `,
          el('button', { type: 'button', class: 'boton secundario chico', disabled: ocupado, onclick: () => desvincular(perfil, d) }, 'Desvincular'))),
        el('div', { class: 'acciones' },
          fichaDe(a.email) ? enlacesDeFicha(fichaDe(a.email)) : null,
          el('button', { type: 'button', class: 'boton secundario chico', disabled: ocupado, onclick: () => quitarAcceso(perfil, a.email) }, 'Quitar acceso')),
        fichaDe(a.email) ? panelFamilia(perfil, fichaDe(a.email), ocupado) : null))));
    }
    // alumnos que ya no tienen acceso pero cuyas estadísticas se conservan
    const antiguos = (fichas[perfil.id] ?? []).filter((f) => !info.invitados.includes(f.email));
    if (antiguos.length) {
      hecho.push(
        el('h3', {}, 'Antiguos alumnos'),
        el('p', { class: 'ayuda' }, 'Ya no tienen acceso, pero sus estadísticas se conservan.'),
        el('ul', { class: 'lista-alumnos' }, ...antiguos.map((f) => el('li', { class: 'alumno-fila', 'data-alumno': f.email }, el('div', {}, el('strong', {}, f.nombre), ` (${f.email})`), el('div', { class: 'acciones' }, enlacesDeFicha(f)), panelFamilia(perfil, f, ocupado)))),
      );
    }

    const campo = el('input', { type: 'email', class: 'entrada', placeholder: 'correo@gmail.com', 'aria-label': `Gmail del alumno de ${perfil.nombre}`, autocomplete: 'off', value: borradores[perfil.id] ?? '', disabled: ocupado });
    campo.addEventListener('input', () => { borradores[perfil.id] = campo.value; });
    campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); invitar(perfil); } });
    hecho.push(
      el('h3', {}, 'Invitar al alumno'),
      el('p', { class: 'ayuda' }, ocupado
        ? 'Podrás escribir el Gmail cuando termine de subir el material (no cierres la app).'
        : 'Escribe el Gmail con el que el alumno entrará en su celular: el mismo que su app muestra en «Pídele a tu adulto que invite a…».'),
      el('div', { class: 'acciones' }, campo, el('button', { type: 'button', class: 'boton', disabled: ocupado, onclick: () => invitar(perfil) }, 'Invitar')),
      el('div', { class: 'acciones' },
        el('button', { type: 'button', class: 'boton secundario', disabled: ocupado, onclick: () => accion(perfil.id, 'Sincronizando…', async () => { await sincronizarAulaAhora(perfil.id); }) }, 'Sincronizar ahora'),
        el('button', { type: 'button', class: 'boton secundario', onclick: () => verEstadisticas(perfil) }, 'Ver lo jugado en este celular')),
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
    for (const liberar of urlsMaterial) liberar();
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
      el('li', {}, 'El curso de su perfil (palabras, frases, libros, álbumes, premios, fotos y voces), en solo lectura. No puede cambiar nada de eso; lo que agrega su familia es aparte y se marca «De la familia».'),
      el('li', {}, 'Puede escribir únicamente en su propia carpeta: su avance y lo de su familia. Ningún otro alumno la ve, tampoco los del mismo perfil.'),
      el('li', {}, 'No ve el resto de tu Drive, ni la carpeta «Leo Conmigo», ni los cursos de otros perfiles. Sí puede leer la «Biblioteca» (las fotos y voces de todos tus cursos): la app solo le muestra las de su curso.'),
      el('li', {}, 'Nadie más ve el curso ni la Biblioteca: solo los correos que invites, uno por uno. Nunca «cualquiera con el enlace».'),
      el('li', {}, 'Si aparece un acceso que Leo Conmigo no puso, te lo mostramos como «Permiso extraño» y tú decides si quitarlo.')),
    el('p', {}, el('strong', {}, 'En el dispositivo del niño: '), 'instala la app, toca «Este dispositivo es de un alumno» y entra con el Gmail que invitaste.'),
  );
}
