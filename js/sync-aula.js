// Sincronización de un aula (PLAN.md, Ampliación 3 fase 16 y Ampliación 4 fase 22). La lógica pura está en core/aula.js y core/sync.js.
//
//   const sincronizador = crearSincronizadorDeAula({ store: vistaDePerfil(...), rol: 'adulto' | 'alumno', ... });
//   const resumen = await sincronizador.sincronizar();
//
// Cada lado escribe SOLO su archivo y lee el del otro:
//   adulto  lee   del-alumno/alumno.json (filtrado)           escribe  adulto.json (el contenido del curso) y los medios en la Biblioteca/
//   alumno  lee   adulto.json y los medios de la Biblioteca/  escribe  del-alumno/alumno.json y su dispositivo-<id>.json
// Los medios (fotos, grabaciones) están UNA vez en la Biblioteca/ aunque los usen varios cursos; las voces del catálogo
// no van a Drive: el contenido sale de la propia app. El celular del alumno guarda todo en local.
// Las mismas protecciones que `js/sync.js`: una ejecución a la vez, primero los medios y al final el JSON, gana lo local
// si cambió durante la sincronización y nunca se pisa un archivo propio que no se entiende.
//
// Seguridad (tabla «Quién puede tocar qué»): cada lado recibe del otro cliente SOLO sus métodos de lectura, así que ni un
// error de programación puede escribir fuera de lo suyo; y lo que llega pasa por `filtrarEntrantes`.

import { ALMACENES_SYNC, ErrorSync, contarRegistros, fusionarAlmacen, fusionarConAjeno } from './core/sync.js';
import {
  ALMACENES_DEL_ALUMNO, ARCHIVO_ADULTO, ARCHIVO_ALUMNO, aceptaDe, armarArchivoAula, filtrarEntrantes, mediosDelPerfil, nombreArchivoDispositivo, nuevoDispositivo,
  publicaRol, validarArchivoAula, validarDispositivo,
} from './core/aula.js';
import { nombreArchivoMedio } from './core/sync.js';
import { blobDeApp } from './medios.js';

// Lo que las aulas versión 1 traían dentro de adulto.json y que ya no se publica: se ignora sin avisar y se limpia
const LEGADO_DEL_ADULTO = new Set(['medios', ...ALMACENES_DEL_ALUMNO]);
const ALMACENES_DE_DATOS = ALMACENES_SYNC.filter((n) => n !== 'medios');

const MIME_JSON = 'application/json';
const minuscula = (s) => String(s ?? '').trim().toLowerCase();
const duenoDe = (archivo) => minuscula(archivo?.owners?.[0]?.emailAddress);
const soloLeer = (c) => ({ listar: () => c.listar(), leerJson: (id) => c.leerJson(id), leerBlob: (id) => c.leerBlob(id) });

/**
 * @param store          una `vistaDePerfil` (solo ve lo de este perfil)
 * @param rol            'adulto' | 'alumno'
 * @param aula           { perfilId, … }
 * @param carpetaAula    cliente de Drive atado al aula (`crearDriveCarpeta`)
 * @param carpetaAlumno  cliente atado a `del-alumno/`
 * @param carpetaMedios  cliente atado a la Biblioteca/ (o, en un aula versión 1 sin migrar, al aula); el alumno solo la lee
 * @param usadosPorOtros (adulto) async () => Set de ids de medios que usan los OTROS cursos (para no borrarlos de la Biblioteca)
 * @param invitados      (adulto) correos invitados: solo se lee lo que ellos son dueños
 * @param emailPropio    (alumno) el correo de esta cuenta
 * @param duenoEmail     (alumno) el dueño del aula: solo se lee su `adulto.json`
 * @param dispositivo    (alumno) { idDispositivo, nombre, versionApp }
 */
export function crearSincronizadorDeAula({
  store, rol, aula, carpetaAula, carpetaAlumno, carpetaMedios = carpetaAula, usadosPorOtros = async () => new Set(), invitados = [], emailPropio = '', duenoEmail = '', dispositivo = null,
  ahora = () => new Date(), alProgreso = () => {}, traerDeApp = blobDeApp,
}) {
  if (rol !== 'adulto' && rol !== 'alumno') throw new Error(`Rol desconocido: ${rol}`);
  const esAdulto = rol === 'adulto';
  const perfilId = aula.perfilId;
  const rolOtro = esAdulto ? 'alumno' : 'adulto';
  const correosInvitados = new Set(invitados.map(minuscula));
  const miCorreo = minuscula(emailPropio);
  let enCurso = null;

  // Lo que cada lado puede hacer en cada carpeta: el alumno no tiene ningún método de escritura en el aula,
  // y el adulto no escribe nunca en `del-alumno/`.
  const propia = esAdulto ? carpetaAula : carpetaAlumno;
  const delOtro = soloLeer(esAdulto ? carpetaAlumno : carpetaAula);
  const medios = esAdulto ? carpetaMedios : soloLeer(carpetaMedios);

  async function leerArchivoAjeno(archivo, avisos, nombre) {
    try {
      const doc = await delOtro.leerJson(archivo.id);
      const error = validarArchivoAula(doc, { rolEsperado: rolOtro, perfilId });
      if (error) { avisos.push(`${nombre}: ${error} Se ignoró.`); return null; }
      return doc;
    } catch (e) {
      if (e?.sinConexion || e?.sesion) throw e;
      avisos.push(`${nombre}: no se pudo leer. Se ignoró.`);
      return null;
    }
  }

  async function ejecutar() {
    alProgreso('Mirando qué hay en el aula…');
    const avisos = [];
    const archivosAula = await carpetaAula.listar();
    const archivosAlumno = await carpetaAlumno.listar();

    // ---- mi archivo (nunca se pisa uno que no se entiende) ----
    const archivoPropio = esAdulto
      ? archivosAula.find((a) => a.name === ARCHIVO_ADULTO)
      : archivosAlumno.find((a) => a.name === ARCHIVO_ALUMNO && (!miCorreo || duenoDe(a) === miCorreo));
    let propios = {};
    let limpiarPropio = false;
    if (archivoPropio) {
      const doc = await propia.leerJson(archivoPropio.id);
      const error = validarArchivoAula(doc, { rolEsperado: rol, perfilId });
      if (error) throw new ErrorSync(error);
      // También mi propio archivo se filtra: si alguien lo manipuló con mi cuenta, lo ajeno no entra y el archivo se limpia
      const { almacenes, descartados: d } = filtrarEntrantes({ almacenes: doc.almacenes, perfilId, aceptados: publicaRol(rol) });
      propios = almacenes;
      // Lo que traían las aulas versión 1 (medios y avance dentro de adulto.json) se quita en silencio; lo demás, con aviso
      const legado = esAdulto ? Object.entries(d.porAlmacen).filter(([n]) => LEGADO_DEL_ADULTO.has(n)).reduce((s, [, c]) => s + c, 0) : (d.porAlmacen.medios ?? 0);
      limpiarPropio = d.total - (d.porAlmacen.medios ?? 0) > 0 || legado > 0;
      if (d.total - legado > 0) avisos.push(`Tu archivo ${archivoPropio.name} traía registros que no son de este perfil o de este lado: se quitaron.`);
    }

    // ---- el archivo del otro lado, filtrado ----
    const aceptados = aceptaDe(rol, rolOtro);
    const ajenos = {};
    const descartados = { total: 0, porAlmacen: {} };
    const sumarDescartados = (d) => {
      descartados.total += d.total;
      for (const [n, c] of Object.entries(d.porAlmacen)) descartados.porAlmacen[n] = (descartados.porAlmacen[n] ?? 0) + c;
    };
    const candidatos = esAdulto
      ? archivosAlumno.filter((a) => a.name === ARCHIVO_ALUMNO)
      : archivosAula.filter((a) => a.name === ARCHIVO_ADULTO && (!duenoEmail || duenoDe(a) === minuscula(duenoEmail)));
    for (const archivo of candidatos) {
      if (esAdulto && !correosInvitados.has(duenoDe(archivo))) {
        avisos.push(`Se ignoró un ${ARCHIVO_ALUMNO} de ${duenoDe(archivo) || 'alguien'} que no está invitado a esta aula.`);
        continue;
      }
      const doc = await leerArchivoAjeno(archivo, avisos, esAdulto ? `${ARCHIVO_ALUMNO} de ${duenoDe(archivo)}` : ARCHIVO_ADULTO);
      if (!doc) continue;
      const { almacenes, descartados: d } = filtrarEntrantes({ almacenes: doc.almacenes, perfilId, aceptados });
      // El avance y los medios que un adulto de la versión anterior dejó en adulto.json ya no se aceptan: se ignoran sin avisar
      if (!esAdulto) for (const n of LEGADO_DEL_ADULTO) { d.total -= d.porAlmacen[n] ?? 0; delete d.porAlmacen[n]; }
      sumarDescartados(d);
      for (const [n, lista] of Object.entries(almacenes)) ajenos[n] = fusionarAlmacen(ajenos[n] ?? [], lista).resultado;
    }
    if (descartados.total > 0) {
      const detalle = Object.entries(descartados.porAlmacen).map(([n, c]) => `${n}: ${c}`).join(', ');
      avisos.push(`Se descartaron ${descartados.total} registros del ${rolOtro} que no se pueden aceptar (${detalle}).`);
    }

    // ---- lo de este dispositivo (con borrados) y la fusión ----
    const locales = {};
    for (const nombre of ALMACENES_DE_DATOS) locales[nombre] = await store.listar(nombre, { conBorrados: true });
    const fusion = {};
    for (const nombre of ALMACENES_DE_DATOS) fusion[nombre] = fusionarConAjeno({ locales: locales[nombre], propios: propios[nombre] ?? [], ajenos: ajenos[nombre] ?? [] });
    const resultado = {};
    for (const nombre of ALMACENES_DE_DATOS) resultado[nombre] = fusion[nombre].resultado;

    // ---- qué medios usa este curso (el curso solo dice QUÉ medios usa; los archivos están una vez en la Biblioteca) ----
    const perfilFusionado = resultado.perfiles.find((p) => p.id === perfilId) ?? { id: perfilId };
    const usados = new Set(mediosDelPerfil({ perfil: perfilFusionado, registros: resultado }));
    const conocidos = store.mediosConocidos ?? new Set();
    for (const id of usados) conocidos.add(id); // así `store` ve sus registros de medios (y un borrado posterior viaja)
    const mediosLocales = await store.listar('medios', { conBorrados: true });
    const archivosMedios = (await medios.listar()).filter((a) => !a.mimeType?.includes('folder') && (esAdulto || !duenoEmail || duenoDe(a) === minuscula(duenoEmail)));
    const porNombre = new Map(archivosMedios.map((a) => [a.name, a]));
    const descargados = new Map(); // id -> { blob, mime, ruta? } (alumno)
    let subidos = 0;
    let bajados = 0;
    let sinArchivo = 0;

    if (esAdulto) {
      // el adulto sube a la Biblioteca solo los medios que usa este curso y que todavía no están (una sola vez por medio)
      const porSubir = mediosLocales.filter((m) => m.blob && !m.deleted && !m.ruta && usados.has(m.id) && !porNombre.has(nombreArchivoMedio(m)));
      for (const medio of porSubir) {
        alProgreso(`Subiendo imágenes y audios (${++subidos} de ${porSubir.length})…`);
        await medios.crear(nombreArchivoMedio(medio), medio.blob, medio.mime || medio.blob.type || 'application/octet-stream');
        porNombre.set(nombreArchivoMedio(medio), { id: null });
      }
    } else {
      // el alumno baja de la Biblioteca los medios de su curso (y saca las voces del catálogo de la app) y los guarda en local
      const conBlob = new Set(mediosLocales.filter((m) => m.blob && !m.deleted).map((m) => m.id));
      const faltan = [...usados].filter((id) => !conBlob.has(id));
      let k = 0;
      for (const id of faltan) {
        alProgreso(`Bajando imágenes y audios (${++k} de ${faltan.length})…`);
        if (id.startsWith('catalogo:')) {
          const ruta = id.slice('catalogo:'.length);
          const blob = await traerDeApp(ruta);
          if (blob) descargados.set(id, { blob, mime: 'audio/mpeg', ruta });
          else sinArchivo += 1; // queda la voz sintética; se reintenta en la próxima sincronización
          continue;
        }
        const archivo = archivosMedios.find((a) => a.name.startsWith(`medio-${id}.`));
        if (!archivo) { sinArchivo += 1; continue; }
        const mime = archivo.mimeType && archivo.mimeType !== 'application/octet-stream' ? archivo.mimeType : '';
        const bajado = await medios.leerBlob(archivo.id);
        descargados.set(id, { blob: mime && bajado.type !== mime ? new Blob([bajado], { type: mime }) : bajado, mime: mime || bajado.type });
        bajados += 1;
      }
    }

    // ---- escribir lo nuevo aquí (sin tocar updatedAt ni la cola) ----
    let traidos = 0;
    for (const nombre of ALMACENES_DE_DATOS) {
      let aEscribir = fusion[nombre].paraLocal;
      // Si el registro cambió aquí mientras se sincronizaba (p. ej. el niño terminó un ensayo), gana lo local
      const actuales = new Map((await store.listar(nombre, { conBorrados: true })).map((r) => [r.id, r]));
      const instantanea = new Map(locales[nombre].map((r) => [r.id, r]));
      aEscribir = aEscribir.filter((r) => {
        const ahoraLocal = actuales.get(r.id);
        return !ahoraLocal || ahoraLocal.updatedAt === instantanea.get(r.id)?.updatedAt;
      });
      await store.importar(nombre, aEscribir);
      traidos += aEscribir.length;
    }
    if (descargados.size) {
      const fechaMedios = ahora().toISOString();
      const previos = new Map(mediosLocales.map((m) => [m.id, m]));
      await store.importar('medios', [...descargados].map(([id, { blob, mime, ruta }]) => ({
        arasaacId: null,
        ...previos.get(id),
        id,
        tipo: String(mime).startsWith('audio') ? 'audio' : 'imagen',
        mime,
        origen: ruta ? 'catalogo' : 'biblioteca',
        ...(ruta ? { ruta } : {}),
        subido: true,
        blob,
        deleted: false,
        updatedAt: previos.get(id)?.updatedAt ?? fechaMedios,
      })));
    }

    // ---- el adulto quita de la Biblioteca un medio solo cuando ya no lo usa NINGÚN curso ----
    if (esAdulto) {
      const quitar = mediosLocales.filter((m) => m.deleted && !m.conservarEnDrive && !m.ruta && !usados.has(m.id) && porNombre.get(nombreArchivoMedio(m))?.id);
      if (quitar.length) {
        const deOtros = await usadosPorOtros();
        for (const m of quitar) if (!deOtros.has(m.id)) await medios.borrar(porNombre.get(nombreArchivoMedio(m)).id);
      }
    }

    // ---- subir mis datos (después de los medios) ----
    const doc = armarArchivoAula({ rol, perfilId, almacenes: resultado, ahora: ahora() });
    const cambia = !archivoPropio || limpiarPropio || publicaRol(rol).some((nombre) => {
      const enDoc = new Set(doc.almacenes[nombre].map((r) => r.id));
      return fusion[nombre].paraPropio.some((r) => enDoc.has(r.id));
    });
    let subioDatos = false;
    if (cambia) {
      alProgreso('Guardando los datos del aula…');
      const texto = JSON.stringify(doc);
      if (archivoPropio) await propia.actualizar(archivoPropio.id, texto, MIME_JSON);
      else await propia.crear(esAdulto ? ARCHIVO_ADULTO : ARCHIVO_ALUMNO, texto, MIME_JSON);
      subioDatos = true;
    }

    // ---- el alumno registra su dispositivo; el adulto lee los de los invitados ----
    const fecha = ahora().toISOString();
    let dispositivos = [];
    if (!esAdulto && dispositivo) await registrarDispositivo(archivosAlumno, fecha);
    if (esAdulto) dispositivos = await leerDispositivos(archivosAlumno, avisos);

    // ---- recordar qué medios ya se sincronizaron (para que un borrado no «resucite») ----
    await store.escribirMeta('idsMediosConocidos', [...conocidos]);
    await store.escribirMeta('syncUltimo', fecha);

    return {
      fecha,
      subioDatos,
      mediosSubidos: subidos,
      mediosBajados: bajados,
      mediosSinArchivo: sinArchivo,
      registrosTraidos: traidos,
      descartados,
      avisos,
      dispositivos,
      cuenta: contarRegistros(resultado),
    };
  }

  async function registrarDispositivo(archivosAlumno, fecha) {
    const nombre = nombreArchivoDispositivo(dispositivo.idDispositivo);
    const existente = archivosAlumno.find((a) => a.name === nombre && (!miCorreo || duenoDe(a) === miCorreo));
    let primeraConexion = fecha;
    if (existente) {
      try {
        const previo = await carpetaAlumno.leerJson(existente.id);
        if (!validarDispositivo(previo)) primeraConexion = previo.primeraConexion ?? fecha;
      } catch (e) {
        if (e?.sinConexion || e?.sesion) throw e;
      }
    }
    const doc = nuevoDispositivo({
      idDispositivo: dispositivo.idDispositivo, email: miCorreo || dispositivo.email, nombre: dispositivo.nombre ?? '',
      versionApp: dispositivo.versionApp, primeraConexion, ahora: new Date(fecha),
    });
    const texto = JSON.stringify(doc);
    if (existente) await carpetaAlumno.actualizar(existente.id, texto, MIME_JSON);
    else await carpetaAlumno.crear(nombre, texto, MIME_JSON);
  }

  async function leerDispositivos(archivosAlumno, avisos) {
    const lista = [];
    for (const a of archivosAlumno) {
      if (!/^dispositivo-.+\.json$/.test(a.name) || !correosInvitados.has(duenoDe(a))) continue;
      try {
        const doc = await delOtro.leerJson(a.id);
        if (validarDispositivo(doc)) { avisos.push(`${a.name}: no se entiende. Se ignoró.`); continue; }
        if (minuscula(doc.email) !== duenoDe(a)) { avisos.push(`${a.name}: el correo no coincide con su dueño. Se ignoró.`); continue; }
        lista.push(doc);
      } catch (e) {
        if (e?.sinConexion || e?.sesion) throw e;
        avisos.push(`${a.name}: no se pudo leer. Se ignoró.`);
      }
    }
    return lista;
  }

  return {
    /** Una sincronización a la vez: si ya hay una en curso, se espera a esa misma. */
    sincronizar() {
      if (!enCurso) enCurso = ejecutar().finally(() => { enCurso = null; });
      return enCurso;
    },
    get ocupado() { return enCurso !== null; },
  };
}
