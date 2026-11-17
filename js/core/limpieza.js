// Qué quedó repetido o sobrante en el Drive del adulto (PLAN.md, Ampliación 4, fase 26). Lógica pura: sin red ni DOM.
//
// Las sincronizaciones de las versiones anteriores dejaron copias que hoy no sirven. Esta función las CLASIFICA en grupos para que
// el adulto las vea y decida; no borra nada. Reglas que nunca se rompen:
//  - solo se mira lo que la app puso en el Drive del adulto: el respaldo personal (`appDataFolder`), la Biblioteca, los cursos y la
//    carpeta `del-alumno/` de antes. Las carpetas de los alumnos (`alumnos/<correo>/`) son del alumno y no entran aquí;
//  - solo archivos `medio-<id>.<ext>` (y la carpeta `del-alumno/` de antes): jamás `data.json`, `adulto.json`, `aula.json` ni `alumno.json`;
//  - un medio que hoy usa algún perfil, curso o ficha (`usados`) no aparece en ningún grupo (salvo la copia SOBRANTE de uno que
//    se queda en su sitio: la repetida de la Biblioteca, o un resto dentro del curso);
//  - un aula que aún no se migró (sin Biblioteca) no se toca: sus alumnos todavía leen los medios de ahí.

const PATRON_MEDIO = /^medio-(.+)\.[^./]+$/;
export const idDeMedioDeArchivo = (nombre) => PATRON_MEDIO.exec(String(nombre ?? ''))?.[1] ?? null;

export const GRUPOS = Object.freeze({
  restos: {
    titulo: 'Restos de versiones anteriores',
    ayuda: 'Fotos y voces que quedaron dentro de un curso después de pasarlas a la Biblioteca, y la carpeta «del-alumno» de antes (su avance ya está en la ficha de cada alumno).',
  },
  catalogo: {
    titulo: 'Voces del catálogo copiadas',
    ayuda: 'Estas voces ya vienen dentro de la app: no hace falta guardarlas en Drive (los celulares las toman de la app).',
  },
  sinUso: {
    titulo: 'Fotos y voces sin uso',
    ayuda: 'Archivos cuyo medio ya no existe, está borrado o no lo usa ningún perfil ni curso.',
  },
  repetidas: {
    titulo: 'Copias repetidas',
    ayuda: 'El mismo archivo en más de un lugar de tu Drive: se queda la copia de la Biblioteca y se pueden eliminar las demás.',
  },
});

const bytesDe = (a) => Number(a.size) || 0;
const etiquetaDeLugar = (l) => ({
  respaldo: 'Respaldo personal de la app (carpeta oculta)',
  biblioteca: 'Biblioteca',
  curso: `Curso${l.nombre ? ` · ${l.nombre}` : ''}`,
  legado: `Carpeta «del-alumno» de antes${l.nombre ? ` · ${l.nombre}` : ''}`,
}[l.tipo] ?? l.tipo);

/**
 * @param archivos  [{ id, name, size, esCarpeta, espacio: 'appdata'|'drive', lugar: { tipo: 'respaldo'|'biblioteca'|'curso'|'legado', cursoId?, nombre? } }]
 * @param medios    todos los registros del almacén `medios` (también los borrados)
 * @param usados    Set con los ids de medios que hoy usa algún perfil, curso o ficha
 * @param aulas     [{ cursoId, migrada, legadoSuperado }]: `migrada` = ya tiene Biblioteca; `legadoSuperado` = cada invitado que
 *                  tenía avance en la carpeta de antes ya tiene su `alumno.json` en su carpeta nueva
 * @returns {{ grupos: [{ id, titulo, ayuda, archivos, bytes }], sinMigrar: string[], bytes, cantidad }}
 */
export function clasificarEspacio({ archivos = [], medios = [], usados = new Set(), aulas = [] }) {
  const porId = new Map(medios.map((m) => [m.id, m]));
  const migradas = new Set(aulas.filter((a) => a.migrada).map((a) => a.cursoId));
  const legadoSuperado = new Set(aulas.filter((a) => a.migrada && a.legadoSuperado).map((a) => a.cursoId));
  const enBiblioteca = new Set(archivos.filter((a) => a.lugar.tipo === 'biblioteca' && !a.esCarpeta).map((a) => a.name));
  const asignado = new Map(); // id del archivo -> id del grupo
  const poner = (a, grupo) => { if (!asignado.has(a.id)) asignado.set(a.id, grupo); };

  // lo que se puede mirar: nunca una carpeta (salvo `del-alumno/` de antes) ni un archivo que no sea un medio, ni un curso sin migrar
  const visible = (a) => (a.lugar.tipo !== 'curso' || migradas.has(a.lugar.cursoId));
  const medioDe = (a) => {
    const id = idDeMedioDeArchivo(a.name);
    return id ? { id, registro: porId.get(id) } : null;
  };

  // 1. restos de versiones anteriores
  for (const a of archivos) {
    if (a.lugar.tipo === 'legado' && a.esCarpeta && legadoSuperado.has(a.lugar.cursoId)) { poner(a, 'restos'); continue; }
    if (a.lugar.tipo === 'curso' && !a.esCarpeta && visible(a)) {
      const m = medioDe(a);
      if (m && (enBiblioteca.has(a.name) || !usados.has(m.id))) poner(a, 'restos');
    }
  }
  // 2. voces del catálogo copiadas (el contenido sale de la app). Si un perfil aún usa el medio viejo, sin `ruta`, todavía se necesita.
  for (const a of archivos) {
    if (a.esCarpeta || a.lugar.tipo === 'legado' || !visible(a)) continue;
    const m = medioDe(a);
    if (!m) continue;
    const esCatalogo = m.registro?.origen === 'catalogo' || m.id.startsWith('catalogo:');
    if (esCatalogo && !(usados.has(m.id) && !m.registro?.ruta)) poner(a, 'catalogo');
  }
  // 3. medios sin uso
  for (const a of archivos) {
    if (a.esCarpeta || a.lugar.tipo === 'legado' || !visible(a)) continue;
    const m = medioDe(a);
    if (!m || usados.has(m.id)) continue;
    if (a.lugar.tipo === 'respaldo') {
      // en el respaldo personal, un medio que existe y no está borrado es copia de seguridad del adulto: se queda
      if (!m.registro || m.registro.deleted === true) poner(a, 'sinUso');
    } else {
      poner(a, 'sinUso');
    }
  }
  // 4. copias repetidas dentro de lo que está a la vista (Biblioteca y cursos): se queda la de la Biblioteca
  const porNombre = new Map();
  for (const a of archivos) {
    if (a.esCarpeta || a.lugar.tipo === 'legado' || a.lugar.tipo === 'respaldo' || !visible(a) || !medioDe(a)) continue;
    if (!porNombre.has(a.name)) porNombre.set(a.name, []);
    porNombre.get(a.name).push(a);
  }
  for (const copias of porNombre.values()) {
    if (copias.length < 2) continue;
    const quedan = copias.find((c) => c.lugar.tipo === 'biblioteca') ?? copias[0];
    for (const c of copias) if (c.id !== quedan.id) poner(c, 'repetidas');
  }

  const grupos = Object.entries(GRUPOS).map(([id, g]) => {
    const lista = archivos.filter((a) => asignado.get(a.id) === id).map((a) => ({
      id: a.id, name: a.name, size: bytesDe(a), esCarpeta: Boolean(a.esCarpeta), espacio: a.espacio, lugar: etiquetaDeLugar(a.lugar), cursoId: a.lugar.cursoId ?? null,
    }));
    return { id, titulo: g.titulo, ayuda: g.ayuda, archivos: lista, bytes: lista.reduce((s, a) => s + a.size, 0) };
  });
  const todos = grupos.flatMap((g) => g.archivos);
  return {
    grupos,
    sinMigrar: aulas.filter((a) => !a.migrada).map((a) => a.cursoId),
    bytes: todos.reduce((s, a) => s + a.size, 0),
    cantidad: todos.length,
  };
}

/** «1,5 MB», «820 KB», «0 B». */
export function textoDeTamano(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Lo que de verdad se puede eliminar de lo que el adulto marcó: la intersección con lo que el grupo contiene AHORA (se vuelve a
 * clasificar justo antes de borrar, así un medio que entretanto empezó a usarse ya no está).
 */
export function seleccionVigente(marcados, grupoAhora) {
  const vigentes = new Map((grupoAhora?.archivos ?? []).map((a) => [a.id, a]));
  return [...new Set(marcados)].filter((id) => vigentes.has(id)).map((id) => vigentes.get(id));
}
