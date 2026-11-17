// Sincronización de un aula (PLAN.md, Ampliación 3, fase 16). La lógica pura está en core/aula.js y core/sync.js.
//
//   const sincronizador = crearSincronizadorDeAula({ store: vistaDePerfil(...), rol: 'adulto' | 'alumno', ... });
//   const resumen = await sincronizador.sincronizar();
//
// Cada lado escribe SOLO su archivo y lee el del otro:
//   adulto  lee   del-alumno/alumno.json (filtrado)           escribe  adulto.json y los medios del aula
//   alumno  lee   adulto.json y los medios del aula           escribe  del-alumno/alumno.json y su dispositivo-<id>.json
// Las mismas protecciones que `js/sync.js`: una ejecución a la vez, primero los medios y al final el JSON, gana lo local
// si cambió durante la sincronización y nunca se pisa un archivo propio que no se entiende.
//
// Seguridad (tabla «Quién puede tocar qué»): cada lado recibe del otro cliente SOLO sus métodos de lectura, así que ni un
// error de programación puede escribir fuera de lo suyo; y lo que llega pasa por `filtrarEntrantes`.

import { ALMACENES_SYNC, ErrorSync, contarRegistros, fusionarAlmacen, fusionarConAjeno, planDeMedios } from './core/sync.js';
import {
  ARCHIVO_ADULTO, ARCHIVO_ALUMNO, armarArchivoAula, filtrarEntrantes, nombreArchivoDispositivo, nuevoDispositivo,
  validarArchivoAula, validarDispositivo,
  // TRANSITORIO: esta sincronización sigue siendo la de las aulas versión 1 (avance y medios dentro del aula) hasta que
  // la fase 22 la reescriba para cursos con fichas y Biblioteca
  aceptaDeV1 as aceptaDe, publicaRolV1 as publicaRol,
} from './core/aula.js';

import { blobDeApp } from './medios.js';

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
 * @param invitados      (adulto) correos invitados: solo se lee lo que ellos son dueños
 * @param emailPropio    (alumno) el correo de esta cuenta
 * @param duenoEmail     (alumno) el dueño del aula: solo se lee su `adulto.json`
 * @param dispositivo    (alumno) { idDispositivo, nombre, versionApp }
 */
export function crearSincronizadorDeAula({
  store, rol, aula, carpetaAula, carpetaAlumno, invitados = [], emailPropio = '', duenoEmail = '', dispositivo = null,
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
  const medios = esAdulto ? carpetaAula : soloLeer(carpetaAula);

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
      limpiarPropio = d.total - (d.porAlmacen.medios ?? 0) > 0;
      if (limpiarPropio) avisos.push(`Tu archivo ${archivoPropio.name} traía registros que no son de este perfil o de este lado: se quitaron.`);
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
      sumarDescartados(d);
      for (const [n, lista] of Object.entries(almacenes)) ajenos[n] = fusionarAlmacen(ajenos[n] ?? [], lista).resultado;
    }
    if (descartados.total > 0) {
      const detalle = Object.entries(descartados.porAlmacen).map(([n, c]) => `${n}: ${c}`).join(', ');
      avisos.push(`Se descartaron ${descartados.total} registros del ${rolOtro} que no se pueden aceptar (${detalle}).`);
    }

    // ---- lo de este dispositivo (con borrados) y la fusión ----
    const locales = {};
    for (const nombre of ALMACENES_SYNC) locales[nombre] = await store.listar(nombre, { conBorrados: true });
    const fusion = {};
    for (const nombre of ALMACENES_SYNC) fusion[nombre] = fusionarConAjeno({ locales: locales[nombre], propios: propios[nombre] ?? [], ajenos: ajenos[nombre] ?? [] });

    // ---- imágenes y audios: el adulto los sube al aula; el alumno solo los baja ----
    const archivosMedios = new Map(archivosAula.map((a) => [a.name, a]));
    const blobsLocales = new Map(locales.medios.filter((m) => m.blob && !m.deleted).map((m) => [m.id, m.blob]));
    const plan = planDeMedios({ medios: fusion.medios.resultado, archivos: archivosMedios, conBlobLocal: new Set(blobsLocales.keys()) });
    const subir = esAdulto ? plan.subir : [];
    const bajar = esAdulto ? [] : plan.bajar;
    let n = 0;
    for (const { medio, nombre } of subir) {
      alProgreso(`Subiendo imágenes y audios (${++n} de ${subir.length})…`);
      const blob = blobsLocales.get(medio.id);
      await medios.crear(nombre, blob, medio.mime || blob.type || 'application/octet-stream');
    }
    const descargados = new Map();
    n = 0;
    for (const { medio, archivoId } of bajar) {
      alProgreso(`Bajando imágenes y audios (${++n} de ${bajar.length})…`);
      const bajado = await medios.leerBlob(archivoId);
      descargados.set(medio.id, medio.mime && bajado.type !== medio.mime ? new Blob([bajado], { type: medio.mime }) : bajado);
    }

    // ---- voces del catálogo: el contenido sale de la propia app y se guarda en local (nunca viaja por el aula) ----
    for (const medio of plan.deApp) {
      const blob = await traerDeApp(medio.ruta);
      if (blob) descargados.set(medio.id, medio.mime && blob.type !== medio.mime ? new Blob([blob], { type: medio.mime }) : blob);
    }

    // ---- escribir lo nuevo aquí (sin tocar updatedAt ni la cola) ----
    let traidos = 0;
    for (const nombre of ALMACENES_SYNC) {
      let aEscribir = fusion[nombre].paraLocal;
      if (nombre === 'medios') {
        const localesPorId = new Map(locales.medios.map((m) => [m.id, m]));
        aEscribir = [
          ...aEscribir.map((m) => ({ ...m, blob: m.deleted ? null : descargados.get(m.id) ?? localesPorId.get(m.id)?.blob ?? null })),
          ...fusion.medios.resultado
            .filter((m) => descargados.has(m.id) && !fusion.medios.paraLocal.some((p) => p.id === m.id))
            .map((m) => ({ ...m, blob: descargados.get(m.id) })),
        ];
      }
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

    // ---- el adulto limpia en el aula los medios borrados ----
    if (esAdulto) for (const { archivoId } of plan.borrarRemotos) await medios.borrar(archivoId);

    // ---- subir mis datos (después de los medios) ----
    const resultado = {};
    for (const nombre of ALMACENES_SYNC) resultado[nombre] = fusion[nombre].resultado;
    const doc = armarArchivoAula({ rol, perfilId, almacenes: resultado, publica: publicaRol(rol), ahora: ahora() });
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
    const conocidos = store.mediosConocidos ?? new Set();
    for (const m of resultado.medios) conocidos.add(m.id);
    await store.escribirMeta('idsMediosConocidos', [...conocidos]);
    await store.escribirMeta('syncUltimo', fecha);

    return {
      fecha,
      subioDatos,
      mediosSubidos: subir.length,
      mediosBajados: bajar.length,
      mediosSinArchivo: plan.faltantes.length,
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
