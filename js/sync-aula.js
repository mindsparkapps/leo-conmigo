// Sincronización de un aula (PLAN.md, Ampliación 3 fase 16 y Ampliación 4 fases 22 y 23). La lógica pura está en core/aula.js,
// core/curso.js y core/sync.js.
//
//   const sincronizador = crearSincronizadorDeAula({ store: vistaDePerfil(...), rol: 'adulto' | 'alumno', ... });
//   const resumen = await sincronizador.sincronizar();
//
// Cada lado escribe SOLO su archivo y lee el del otro:
//   adulto  lee   alumnos/<correo>/alumno.json de cada invitado (filtrado)   escribe  adulto.json (el contenido del curso) y los medios en la Biblioteca/
//   alumno  lee   adulto.json y los medios de la Biblioteca/                 escribe  su carpeta alumnos/<su correo>/: alumno.json y dispositivo-<id>.json
// Perfil = curso: el avance de cada alumno NO se mezcla con el del curso ni con el de otro alumno. El adulto lo guarda bajo la
// FICHA de cada correo (`aFicha`: `perfilId` = id de la ficha) y su perfil solo lo cambia él; el celular del alumno combina el
// perfil del curso con lo que él calcula solo (`combinarPerfil`) y publica únicamente su parte (`perfilPublicable`).
// Los medios (fotos, grabaciones) están UNA vez en la Biblioteca/ aunque los usen varios cursos; las voces del catálogo
// no van a Drive: el contenido sale de la propia app. El celular del alumno guarda todo en local.
// Las mismas protecciones que `js/sync.js`: una ejecución a la vez, primero los medios y al final el JSON, gana lo local
// si cambió durante la sincronización y nunca se pisa un archivo propio que no se entiende.
//
// Seguridad (tabla «Quién puede tocar qué»): cada lado recibe del otro cliente SOLO sus métodos de lectura, así que ni un
// error de programación puede escribir fuera de lo suyo; y lo que llega pasa por `filtrarEntrantes`. El adulto escribe en el
// almacén únicamente a través de `vistaDeFichas` (fichas y registros de fichas de este curso) y de `vistaDePerfil` (el curso).

import { ErrorSync, contarRegistros, fusionarAlmacen, fusionarConAjeno, nombreArchivoMedio } from './core/sync.js';
import {
  ALMACENES_DEL_ALUMNO, ALMACENES_DEL_CURSO, ARCHIVO_ADULTO, ARCHIVO_ALUMNO, aceptaDe, armarArchivoAula, filtrarEntrantes, mediosDelPerfil, nombreArchivoDispositivo,
  nuevoDispositivo, publicaRol, validarArchivoAula, validarDispositivo,
} from './core/aula.js';
import {
  ALMACENES_DE_FICHA, ORIGEN_FAMILIA, aFicha, combinarPerfil, filasDeContenidoFamilia, idDeFicha, limpiarContenidoFamilia, nuevaFicha, perfilPublicable, separarFamilia,
} from './core/curso.js';
import { ALMACENES_RESPALDO } from './core/respaldo.js';
import { blobDeApp } from './medios.js';

// Lo que las aulas versión 1 traían dentro de adulto.json y que ya no se publica: se ignora sin avisar y se limpia
const LEGADO_DEL_ADULTO = new Set(['medios', ...ALMACENES_DEL_ALUMNO]);
const enOrden = (nombres) => ALMACENES_RESPALDO.filter((n) => nombres.includes(n));
// El adulto solo maneja el contenido del curso; el alumno, el contenido del curso (que recibe) y su avance (que publica)
const ALMACENES_DEL_ADULTO = enOrden(ALMACENES_DEL_CURSO);
// ('colecciones' son los álbumes que agregó la familia: nunca vienen del adulto ni se publican como curso; solo alimentan `contenidoFamilia`)
const ALMACENES_DEL_ALUMNO_Y_CURSO = enOrden([...ALMACENES_DEL_CURSO, ...ALMACENES_DEL_ALUMNO, 'colecciones']);

const MIME_JSON = 'application/json';
const minuscula = (s) => String(s ?? '').trim().toLowerCase();
const duenoDe = (archivo) => minuscula(archivo?.owners?.[0]?.emailAddress);
const soloLeer = (c) => ({ listar: () => c.listar(), leerJson: (id) => c.leerJson(id), leerBlob: (id) => c.leerBlob(id) });
/** JSON con las claves en orden, para comparar objetos sin que cuente el orden en que se armaron. */
const estable = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/**
 * @param store          una `vistaDePerfil` del curso (el adulto) o del perfil que juega el alumno
 * @param fichas         (adulto) una `vistaDeFichas` del curso: ahí se guardan las fichas y su avance
 * @param rol            'adulto' | 'alumno'
 * @param aula           { perfilId, … }
 * @param carpetaAula    cliente de Drive atado al aula (`crearDriveCarpeta`)
 * @param carpetaAlumno  (alumno) cliente atado a SU carpeta `alumnos/<su correo>/`
 * @param carpetasAlumnos (adulto) { <correo>: cliente atado a la carpeta de ese alumno }: solo se leen
 * @param carpetaLegado  (adulto) cliente atado al `del-alumno/` de las aulas anteriores a la fase 23 (solo lectura; puede faltar)
 * @param carpetaFamilia (alumno) cliente atado a SU `familia/` (dentro de su carpeta): ahí van las fotos y voces de la familia
 * @param carpetaMedios  cliente atado a la Biblioteca/ (o, en un aula versión 1 sin migrar, al aula); el alumno solo la lee
 * @param usadosPorOtros (adulto) async () => Set de ids de medios que usan los OTROS cursos (para no borrarlos de la Biblioteca)
 * @param invitados      (adulto) correos invitados: solo se lee lo que ellos son dueños
 * @param emailPropio    (alumno) el correo de esta cuenta
 * @param duenoEmail     (alumno) el dueño del aula: solo se lee su `adulto.json`
 * @param dispositivo    (alumno) { idDispositivo, nombre, versionApp }
 */
export function crearSincronizadorDeAula({
  store, fichas = null, rol, aula, carpetaAula, carpetaAlumno = null, carpetasAlumnos = {}, carpetaLegado = null, carpetaFamilia = null, carpetaMedios = carpetaAula,
  usadosPorOtros = async () => new Set(), invitados = [], emailPropio = '', duenoEmail = '', dispositivo = null,
  ahora = () => new Date(), alProgreso = () => {}, traerDeApp = blobDeApp,
}) {
  if (rol !== 'adulto' && rol !== 'alumno') throw new Error(`Rol desconocido: ${rol}`);
  const esAdulto = rol === 'adulto';
  if (esAdulto && !fichas) throw new Error('El adulto necesita la vista de fichas del curso.');
  if (!esAdulto && !carpetaAlumno) throw new Error('El alumno necesita su carpeta.');
  const perfilId = aula.perfilId;
  const rolOtro = esAdulto ? 'alumno' : 'adulto';
  const correosInvitados = new Set(invitados.map(minuscula));
  const miCorreo = minuscula(emailPropio);
  const almacenesDeDatos = esAdulto ? ALMACENES_DEL_ADULTO : ALMACENES_DEL_ALUMNO_Y_CURSO;
  let enCurso = null;

  // Lo que cada lado puede hacer en cada carpeta: el alumno no tiene ningún método de escritura en el aula ni en la Biblioteca,
  // y el adulto no escribe nunca dentro de las carpetas de los alumnos.
  const propia = esAdulto ? carpetaAula : carpetaAlumno;
  const lectoresDeAlumnos = Object.fromEntries(Object.entries(carpetasAlumnos).map(([correo, c]) => [minuscula(correo), soloLeer(c)]));
  const lectorLegado = carpetaLegado ? soloLeer(carpetaLegado) : null;
  const lectorAula = soloLeer(carpetaAula);
  const medios = esAdulto ? carpetaMedios : soloLeer(carpetaMedios);

  async function leerArchivoAjeno(lector, archivo, avisos, nombre) {
    try {
      const doc = await lector.leerJson(archivo.id);
      const error = validarArchivoAula(doc, { rolEsperado: rolOtro, perfilId });
      if (error) { avisos.push(`${nombre}: ${error} Se ignoró.`); return null; }
      return doc;
    } catch (e) {
      if (e?.sinConexion || e?.sesion) throw e;
      avisos.push(`${nombre}: no se pudo leer. Se ignoró.`);
      return null;
    }
  }

  /** El perfil que ve el celular del alumno: el del curso con lo que él calcula solo (ver `combinarPerfil`). */
  function fusionarPerfilDelAlumno({ locales, ajenos }) {
    const curso = ajenos.find((p) => p.id === perfilId);
    const local = locales.find((p) => p.id === perfilId);
    if (!curso) return { resultado: locales, paraLocal: [], paraPropio: [] };
    const combinado = { ...combinarPerfil(curso, local), updatedAt: [local?.updatedAt, curso.updatedAt].filter(Boolean).sort().at(-1) };
    const igual = local && estable(local) === estable(combinado);
    return { resultado: [combinado], paraLocal: igual ? [] : [combinado], paraPropio: [] };
  }

  async function ejecutar() {
    alProgreso('Mirando qué hay en el aula…');
    const avisos = [];
    const archivosAula = await carpetaAula.listar();
    const archivosAlumno = esAdulto ? [] : await carpetaAlumno.listar();

    // ---- mi archivo (nunca se pisa uno que no se entiende) ----
    const archivoPropio = esAdulto
      ? archivosAula.find((a) => a.name === ARCHIVO_ADULTO)
      : archivosAlumno.find((a) => a.name === ARCHIVO_ALUMNO && (!miCorreo || duenoDe(a) === miCorreo));
    let propios = {};
    let limpiarPropio = false;
    let familiaPublicada = null; // (alumno) lo que mi archivo ya dice de la familia
    if (archivoPropio) {
      const doc = await propia.leerJson(archivoPropio.id);
      const error = validarArchivoAula(doc, { rolEsperado: rol, perfilId });
      if (error) throw new ErrorSync(error);
      familiaPublicada = doc.contenidoFamilia ?? null;
      // También mi propio archivo se filtra: si alguien lo manipuló con mi cuenta, lo ajeno no entra y el archivo se limpia
      const { almacenes, descartados: d } = filtrarEntrantes({ almacenes: doc.almacenes, perfilId, aceptados: publicaRol(rol) });
      propios = almacenes;
      // Lo que traían las aulas versión 1 (medios y avance dentro de adulto.json) se quita en silencio; lo demás, con aviso
      const legado = esAdulto ? Object.entries(d.porAlmacen).filter(([n]) => LEGADO_DEL_ADULTO.has(n)).reduce((s, [, c]) => s + c, 0) : (d.porAlmacen.medios ?? 0);
      limpiarPropio = d.total - (d.porAlmacen.medios ?? 0) > 0 || legado > 0;
      if (d.total - legado > 0) avisos.push(`Tu archivo ${archivoPropio.name} traía registros que no son de este perfil o de este lado: se quitaron.`);
    }

    // ---- lo que llega del otro lado ----
    const descartados = { total: 0, porAlmacen: {} };
    const sumarDescartados = (d) => {
      descartados.total += d.total;
      for (const [n, c] of Object.entries(d.porAlmacen)) descartados.porAlmacen[n] = (descartados.porAlmacen[n] ?? 0) + c;
    };
    const ajenos = {}; // alumno: el contenido del curso
    const deAlumnos = []; // adulto: { correo, ficha, entrantes, estado }
    const dispositivos = []; // adulto: los dispositivos de los invitados

    if (esAdulto) {
      const archivosLegado = lectorLegado ? await lectorLegado.listar().catch((e) => { if (e?.sinConexion || e?.sesion) throw e; return []; }) : [];
      for (const correo of correosInvitados) {
        const lector = lectoresDeAlumnos[correo];
        let archivos = [];
        if (lector) {
          try { archivos = await lector.listar(); } catch (e) {
            if (e?.sinConexion || e?.sesion) throw e;
            avisos.push(`No se pudo abrir la carpeta de ${correo}. Se ignoró.`);
          }
        } else avisos.push(`${correo} todavía no tiene su carpeta en el aula.`);
        const suyos = (lista) => lista.filter((a) => duenoDe(a) === correo);
        for (const a of archivos) {
          if (a.name === ARCHIVO_ALUMNO && duenoDe(a) !== correo) avisos.push(`Se ignoró un ${ARCHIVO_ALUMNO} de ${duenoDe(a) || 'alguien'} dentro de la carpeta de ${correo}: no es de ese alumno.`);
        }
        let archivo = suyos(archivos).find((a) => a.name === ARCHIVO_ALUMNO);
        let origen = lector;
        // Aulas de la fase 22: hasta que el alumno vuelva a sincronizar, su avance sigue en el `del-alumno/` de antes
        if (!archivo && lectorLegado) { archivo = suyos(archivosLegado).find((a) => a.name === ARCHIVO_ALUMNO); origen = lectorLegado; }
        const hallado = { correo, ficha: idDeFicha(perfilId, correo), entrantes: null, estado: null };
        if (archivo) {
          const doc = await leerArchivoAjeno(origen, archivo, avisos, `${ARCHIVO_ALUMNO} de ${correo}`);
          if (doc) {
            const { almacenes, descartados: d } = filtrarEntrantes({ almacenes: doc.almacenes, perfilId, aceptados: aceptaDe(rol, rolOtro) });
            sumarDescartados(d);
            const { almacenes: deLaFicha, estado, descartados: extra } = aFicha(almacenes, { cursoId: perfilId, fichaId: hallado.ficha });
            descartados.total += extra;
            hallado.entrantes = deLaFicha;
            hallado.estado = estado;
            // lo que la familia agregó (sin fotos ni voces): solo para mostrar nombres en sus estadísticas
            const { contenido, descartados: sobrantes } = limpiarContenidoFamilia(doc.contenidoFamilia, { cursoId: perfilId });
            descartados.total += sobrantes;
            hallado.familia = contenido;
          }
        }
        // sus dispositivos (de su carpeta y, si aún no se mudó, del `del-alumno/` de antes): el más reciente de cada uno
        const porId = new Map();
        for (const [lectorDe, lista] of [[lector, archivos], [lectorLegado, archivosLegado]]) {
          if (!lectorDe) continue;
          for (const d of await leerDispositivos(lectorDe, lista, correo, avisos)) {
            const previo = porId.get(d.idDispositivo);
            if (!previo || Date.parse(d.ultimaSync) > Date.parse(previo.ultimaSync)) porId.set(d.idDispositivo, d);
          }
        }
        dispositivos.push(...porId.values());
        deAlumnos.push(hallado);
      }
    } else {
      const archivo = archivosAula.find((a) => a.name === ARCHIVO_ADULTO && (!duenoEmail || duenoDe(a) === minuscula(duenoEmail)));
      const doc = archivo ? await leerArchivoAjeno(lectorAula, archivo, avisos, ARCHIVO_ADULTO) : null;
      if (doc) {
        const { almacenes, descartados: d } = filtrarEntrantes({ almacenes: doc.almacenes, perfilId, aceptados: aceptaDe(rol, rolOtro) });
        // El avance y los medios que un adulto de la versión anterior dejó en adulto.json ya no se aceptan: se ignoran sin avisar
        for (const n of LEGADO_DEL_ADULTO) { d.total -= d.porAlmacen[n] ?? 0; delete d.porAlmacen[n]; }
        sumarDescartados(d);
        for (const [n, lista] of Object.entries(almacenes)) ajenos[n] = fusionarAlmacen(ajenos[n] ?? [], lista).resultado;
      }
    }
    if (descartados.total > 0) {
      const detalle = Object.entries(descartados.porAlmacen).map(([n, c]) => `${n}: ${c}`).join(', ');
      avisos.push(`Se descartaron ${descartados.total} registros del ${rolOtro} que no se pueden aceptar${detalle ? ` (${detalle})` : ''}.`);
    }

    // ---- lo de este dispositivo (con borrados) y la fusión ----
    const locales = {};
    for (const nombre of almacenesDeDatos) locales[nombre] = await store.listar(nombre, { conBorrados: true });
    const fusion = {};
    for (const nombre of almacenesDeDatos) {
      fusion[nombre] = !esAdulto && nombre === 'perfiles'
        ? fusionarPerfilDelAlumno({ locales: locales[nombre], ajenos: ajenos[nombre] ?? [] })
        : fusionarConAjeno({ locales: locales[nombre], propios: propios[nombre] ?? [], ajenos: ajenos[nombre] ?? [] });
    }
    const resultado = {};
    for (const nombre of almacenesDeDatos) resultado[nombre] = fusion[nombre].resultado;

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
    for (const nombre of almacenesDeDatos) {
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

    // ---- el adulto guarda cada alumno bajo SU ficha (nunca bajo el curso ni bajo otro alumno) ----
    const resumenFichas = [];
    if (esAdulto) {
      const fecha = ahora().toISOString();
      const existentes = new Map((await fichas.fichas({ conBorrados: true })).map((f) => [f.id, f]));
      for (const h of deAlumnos) {
        let ficha = existentes.get(h.ficha);
        const nueva = !ficha;
        if (!ficha) ficha = nuevaFicha({ cursoId: perfilId, email: h.correo, ahora: ahora() });
        const cambioEstado = h.estado && estable(h.estado) !== estable(ficha.estado ?? null);
        if (nueva || cambioEstado || ficha.deleted) {
          await fichas.importar('alumnos', [{ ...ficha, deleted: false, estado: h.estado ?? ficha.estado ?? null, updatedAt: fecha }]);
          traidos += 1;
        }
        let nuevos = 0;
        for (const almacen of ALMACENES_DE_FICHA) {
          const delAlumno = h.entrantes?.[almacen] ?? [];
          if (!delAlumno.length) continue;
          const aqui = await fichas.listar(almacen, { fichaId: h.ficha, conBorrados: true });
          const { paraLocal } = fusionarAlmacen(aqui, delAlumno);
          if (paraLocal.length) await fichas.importar(almacen, paraLocal);
          nuevos += paraLocal.length;
        }
        // la lista de lo que agregó la familia: aparte, nunca en palabras, frases ni libros del curso
        let deFamilia = 0;
        if (h.familia) {
          const filas = filasDeContenidoFamilia({ fichaId: h.ficha, contenido: h.familia });
          const aqui = await fichas.listar('contenidoFamilia', { fichaId: h.ficha, conBorrados: true });
          const { paraLocal } = fusionarAlmacen(aqui, filas);
          if (paraLocal.length) await fichas.importar('contenidoFamilia', paraLocal);
          deFamilia = paraLocal.length;
        }
        traidos += nuevos + deFamilia;
        resumenFichas.push({ fichaId: h.ficha, email: h.correo, registros: nuevos, familia: deFamilia, conArchivo: Boolean(h.entrantes) });
      }
    }

    // ---- el adulto quita de la Biblioteca un medio solo cuando ya no lo usa NINGÚN curso ----
    if (esAdulto) {
      const quitar = mediosLocales.filter((m) => m.deleted && !m.conservarEnDrive && !m.ruta && !usados.has(m.id) && porNombre.get(nombreArchivoMedio(m))?.id);
      if (quitar.length) {
        const deOtros = await usadosPorOtros();
        for (const m of quitar) if (!deOtros.has(m.id)) await medios.borrar(porNombre.get(nombreArchivoMedio(m)).id);
      }
    }

    // ---- el alumno sube las fotos y voces de su familia a SU carpeta `familia/` (son de su cuenta: ocupan su espacio) ----
    let familiaSubidos = 0;
    if (!esAdulto && carpetaFamilia) {
      const enFamilia = new Map((await carpetaFamilia.listar()).filter((a) => !a.mimeType?.includes('folder')).map((a) => [a.name, a]));
      for (const m of mediosLocales.filter((x) => x.origen === ORIGEN_FAMILIA)) {
        const nombre = nombreArchivoMedio(m);
        if (m.deleted) {
          if (enFamilia.get(nombre)?.id) await carpetaFamilia.borrar(enFamilia.get(nombre).id);
        } else if (m.blob && !enFamilia.has(nombre)) {
          alProgreso(`Guardando las fotos y voces de la familia (${++familiaSubidos})…`);
          await carpetaFamilia.crear(nombre, m.blob, m.mime || m.blob.type || 'application/octet-stream');
        }
        conocidos.add(m.id); // así un borrado posterior sigue a la vista y su archivo se quita de `familia/`
      }
    }

    // ---- subir mis datos (después de los medios) ----
    // El alumno publica solo SU parte del perfil (`perfilPublicable`): nada del curso. Lo que agregó la familia viaja aparte,
    // en `contenidoFamilia` (sin fotos ni voces: esas van a `familia/`).
    const paraPublicar = esAdulto ? resultado : { ...resultado, perfiles: resultado.perfiles.map((p) => (p.id === perfilId ? perfilPublicable(p) : p)) };
    const contenidoFamilia = esAdulto ? undefined : separarFamilia(resultado).contenidoFamilia;
    const doc = armarArchivoAula({ rol, perfilId, almacenes: paraPublicar, contenidoFamilia, ahora: ahora() });
    const cambiaFamilia = !esAdulto && estable(doc.contenidoFamilia) !== estable(familiaPublicada ?? limpiarContenidoFamilia(null).contenido);
    const cambia = !archivoPropio || limpiarPropio || cambiaFamilia || publicaRol(rol).some((nombre) => {
      if (!esAdulto && nombre === 'perfiles') return estable(propios.perfiles ?? []) !== estable(doc.almacenes.perfiles);
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

    // ---- el alumno registra su dispositivo ----
    const fecha = ahora().toISOString();
    if (!esAdulto && dispositivo) await registrarDispositivo(archivosAlumno, fecha);

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
      fichas: resumenFichas,
      cuenta: contarRegistros(resultado),
    };
  }

  async function registrarDispositivo(archivosDelAlumno, fecha) {
    const nombre = nombreArchivoDispositivo(dispositivo.idDispositivo);
    const existente = archivosDelAlumno.find((a) => a.name === nombre && (!miCorreo || duenoDe(a) === miCorreo));
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

  /** Los `dispositivo-<id>.json` de un invitado (solo los que son de su cuenta y dicen su correo). */
  async function leerDispositivos(lector, archivosDeCarpeta, correo, avisos) {
    const lista = [];
    for (const a of archivosDeCarpeta) {
      if (!/^dispositivo-.+\.json$/.test(a.name) || duenoDe(a) !== correo) continue;
      try {
        const doc = await lector.leerJson(a.id);
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
