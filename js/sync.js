// Sincronización entre el almacén local y Google Drive (la lógica de fusión pura está en core/sync.js).
//
//   const sincronizador = crearSincronizador({ store, drive });
//   const resumen = await sincronizador.sincronizar();
//
// Primero local, luego la nube: la app siempre lee y escribe en IndexedDB; esto solo pone al día las dos partes.
// Es seguro repetirlo: si algo falla a mitad, no se quita nada de la cola y el siguiente intento lo termina.

import {
  ALMACENES_SYNC, ARCHIVO_DATOS, ErrorSync, armarDocumento, contarRegistros, fusionarAlmacen, planDeMedios, validarDocumento,
} from './core/sync.js';

const MIME_JSON = 'application/json';

export function crearSincronizador({ store, drive, ahora = () => new Date(), alProgreso = () => {} }) {
  let enCurso = null;

  async function ejecutar() {
    alProgreso('Mirando qué hay en Google Drive…');
    const pendientes = await store.pendientesSync();
    const archivos = new Map((await drive.listar()).map((a) => [a.name, a]));
    const archivoDatos = archivos.get(ARCHIVO_DATOS);

    // ---- lo de Drive ----
    let remotos = {};
    if (archivoDatos) {
      const doc = await drive.leerJson(archivoDatos.id);
      const error = validarDocumento(doc);
      if (error) throw new ErrorSync(error); // nunca se pisa un archivo que no se entiende
      remotos = doc.almacenes;
    }

    // ---- lo de este dispositivo (con borrados) ----
    const locales = {};
    for (const nombre of ALMACENES_SYNC) locales[nombre] = await store.listar(nombre, { conBorrados: true });

    // ---- fusión ----
    const fusion = {};
    for (const nombre of ALMACENES_SYNC) fusion[nombre] = fusionarAlmacen(locales[nombre], remotos[nombre] ?? []);
    const cambiaRemoto = !archivoDatos || ALMACENES_SYNC.some((n) => fusion[n].paraRemoto > 0);

    // ---- imágenes y audios ----
    const bloblocales = new Map(locales.medios.filter((m) => m.blob && !m.deleted).map((m) => [m.id, m.blob]));
    const plan = planDeMedios({ medios: fusion.medios.resultado, archivos, conBlobLocal: new Set(bloblocales.keys()) });

    let n = 0;
    for (const { medio, nombre } of plan.subir) {
      alProgreso(`Subiendo imágenes y audios (${++n} de ${plan.subir.length})…`);
      const blob = bloblocales.get(medio.id);
      await drive.crear(nombre, blob, medio.mime || blob.type || 'application/octet-stream');
    }
    const descargados = new Map();
    n = 0;
    for (const { medio, archivoId } of plan.bajar) {
      alProgreso(`Bajando imágenes y audios (${++n} de ${plan.bajar.length})…`);
      const bajado = await drive.leerBlob(archivoId);
      // Drive puede devolver «application/octet-stream»: se le devuelve su tipo real para que el PC lo reproduzca
      descargados.set(medio.id, medio.mime && bajado.type !== medio.mime ? new Blob([bajado], { type: medio.mime }) : bajado);
    }

    // ---- escribir lo nuevo aquí (sin tocar updatedAt ni la cola) ----
    const traidos = {};
    for (const nombre of ALMACENES_SYNC) {
      let aEscribir = fusion[nombre].paraLocal;
      if (nombre === 'medios') {
        // el contenido no viaja en los registros: se conserva el que ya hay o el recién bajado
        const localesPorId = new Map(locales.medios.map((m) => [m.id, m]));
        aEscribir = [
          ...aEscribir.map((m) => ({ ...m, blob: m.deleted ? null : descargados.get(m.id) ?? localesPorId.get(m.id)?.blob ?? null })),
          // medios ya fusionados cuyo contenido acabamos de bajar y cuyo registro no cambió
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
      traidos[nombre] = aEscribir.length;
    }

    // ---- limpiar en Drive los archivos de medios borrados ----
    for (const { archivoId } of plan.borrarRemotos) await drive.borrar(archivoId);

    // ---- subir los datos (después de los archivos de medios) ----
    let subioDatos = false;
    if (cambiaRemoto) {
      alProgreso('Guardando los datos en Google Drive…');
      const almacenes = {};
      for (const nombre of ALMACENES_SYNC) almacenes[nombre] = fusion[nombre].resultado;
      const texto = JSON.stringify(armarDocumento({ almacenes, ahora: ahora() }));
      await store.escribirMeta('syncBytesDatos', new TextEncoder().encode(texto).length); // para avisar en Cuenta si crece demasiado
      if (archivoDatos) await drive.actualizar(archivoDatos.id, texto, MIME_JSON);
      else await drive.crear(ARCHIVO_DATOS, texto, MIME_JSON);
      subioDatos = true;
    }

    // ---- listo: se quita de la cola solo lo que no cambió mientras tanto ----
    await store.limpiarCola(pendientes);
    const fecha = ahora().toISOString();
    await store.escribirMeta('syncUltimo', fecha);

    const resultado = {};
    for (const nombre of ALMACENES_SYNC) resultado[nombre] = fusion[nombre].resultado;
    return {
      fecha,
      subioDatos,
      mediosSubidos: plan.subir.length,
      mediosBajados: plan.bajar.length,
      mediosSinArchivo: plan.faltantes.length,
      registrosTraidos: Object.values(traidos).reduce((a, b) => a + b, 0),
      cuenta: contarRegistros(resultado),
    };
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
