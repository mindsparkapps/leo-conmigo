// Primer uso de la app en un dispositivo sin perfiles (PLAN.md, fase 18): dos caminos, «Soy el adulto» (lo de siempre:
// candado, instalar) y «Este dispositivo es de un alumno» (entrar con el Gmail del alumno y bajar su aula).
// Si la descarga se corta, al volver se retoma con «Seguir descargando».

import { el } from '../ui/dom.js';
import { crearCandado } from '../ui/candado.js';
import { habilitarAdulto, esAlumno } from '../acceso.js';
import { NOMBRE_APP, TEXTO_VERSION } from '../config.js';
import { observar, instalar } from '../pwa.js';
import { aulaGuardada, buscarAulasDelAlumno, descargarAula, entrarComoAlumno, olvidarTodo } from '../nube-alumno.js';

export function pintarPrimerUso(vista, { ir, estaVivo }) {
  const zona = el('div', { class: 'primer-uso' });
  vista.append(zona);
  const poner = (...nodos) => { if (estaVivo()) zona.replaceChildren(...nodos.filter(Boolean)); }; // un nodo null se escribiría como «null»
  const titulo = () => el('h1', { class: 'titulo-nino' }, NOMBRE_APP);
  const version = () => el('p', { class: 'version-app' }, TEXTO_VERSION);

  function elegir() {
    poner(
      titulo(),
      el('p', { class: 'mensaje-nino' }, '¿Quién va a usar este dispositivo?'),
      el('button', { type: 'button', class: 'boton', onclick: adulto }, 'Soy el adulto'),
      el('button', { type: 'button', class: 'boton secundario', onclick: () => alumnoEntrar() }, 'Este dispositivo es de un alumno'),
      version(),
    );
  }

  function adulto() {
    // Lo de siempre: el adulto pasa el candado (mantener 3 s y la suma) y prepara la app; aquí puede instalarla
    const instalacion = el('p', { class: 'instalar-inicio' });
    let dejar = null;
    dejar = observar((estado) => {
      if (dejar && !instalacion.isConnected) { dejar(); return; }
      instalacion.replaceChildren(
        ...(estado.puedeInstalar
          ? [el('button', { type: 'button', class: 'boton', onclick: () => instalar() }, 'Instalar en este dispositivo')]
          : estado.instalada
            ? []
            : [el('span', { class: 'ayuda' }, 'Para instalarla: en Android/Chrome abre el menú ⋮ y elige «Instalar aplicación»; en iPhone o iPad usa Compartir → «Agregar a pantalla de inicio».')]),
      );
    });
    poner(
      titulo(),
      el('p', { class: 'mensaje-nino' }, 'Un adulto debe preparar la aplicación.'),
      el('p', { class: 'ayuda' }, 'Mantén presionado el candado 3 segundos sin soltar y luego resuelve la suma.'),
      // Aquí el candado va grande y con texto: el de la esquina casi no se ve en un dispositivo que se abre por primera vez
      crearCandado({ alDesbloquear: () => { habilitarAdulto(); ir('/adulto'); }, etiqueta: 'Entrar como adulto' }),
      instalacion,
      el('button', { type: 'button', class: 'boton secundario chico', onclick: elegir }, 'Volver'),
      version(),
    );
  }

  function alumnoEntrar(error = '') {
    poner(
      titulo(),
      el('p', { class: 'mensaje-nino' }, 'Entra con la cuenta de Google del alumno: el Gmail que invitó tu adulto.'),
      error ? el('p', { class: 'error-texto', role: 'alert' }, error) : null,
      el('button', {
        type: 'button',
        class: 'boton',
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          try {
            elegirAula(await entrarComoAlumno());
          } catch (fallo) {
            alumnoEntrar(fallo?.message ?? 'No se pudo entrar con Google.');
          }
        },
      }, 'Entrar con Google'),
      el('button', { type: 'button', class: 'boton secundario chico', onclick: elegir }, 'Volver'),
      version(),
    );
  }

  function elegirAula({ email, eleccion }) {
    if (eleccion.tipo === 'una') { descarga(eleccion.aula); return; }
    if (eleccion.tipo === 'varias') {
      poner(
        titulo(),
        el('p', { class: 'mensaje-nino' }, 'Elige el aula:'),
        ...eleccion.aulas.map((aula) => el('button', { type: 'button', class: 'boton', onclick: () => descarga(aula) }, aula.nombre)),
        version(),
      );
      return;
    }
    poner(
      titulo(),
      el('p', { class: 'mensaje-nino', role: 'status' }, eleccion.mensaje),
      el('button', {
        type: 'button',
        class: 'boton',
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { elegirAula(await buscarAulasDelAlumno()); } catch (fallo) { alumnoEntrar(fallo?.message ?? 'No se pudo buscar el aula.'); }
        },
      }, 'Buscar otra vez'),
      el('p', { class: 'ayuda' }, `Cuenta: ${email}`),
      version(),
    );
  }

  function descarga(aula) {
    const texto = el('p', { class: 'mensaje-nino', role: 'status' }, 'Preparando…');
    const barra = el('progress', { max: 1, value: 0, hidden: true, 'aria-label': 'Avance de la descarga' });
    poner(
      titulo(),
      el('p', { class: 'mensaje-nino' }, `Bajando todo para «${aula.nombre}»…`),
      texto,
      barra,
      el('p', { class: 'ayuda' }, 'No cierres la app hasta que termine.'),
    );
    descargarAula(aula, (t) => {
      texto.textContent = t;
      const m = /\((\d+) de (\d+)\)/.exec(t);
      barra.hidden = !m;
      if (m) { barra.max = Number(m[2]) || 1; barra.value = Number(m[1]); }
    }).then(() => {
      location.hash = '#/nino';
      location.reload(); // la app arranca ya como dispositivo de alumno (sin candado, con su sincronización)
    }).catch((error) => {
      console.error(error);
      poner(
        titulo(),
        el('p', { class: 'error-texto', role: 'alert' }, error?.message ?? 'No se pudo bajar el aula.'),
        el('button', { type: 'button', class: 'boton', onclick: () => descarga(aula) }, 'Seguir descargando'),
        el('button', { type: 'button', class: 'boton secundario chico', onclick: () => olvidarTodo() }, 'Este dispositivo no es de un alumno'),
        version(),
      );
    });
  }

  // ¿Se cortó una descarga? Si el dispositivo ya se marcó como de alumno y hay aula guardada, se retoma
  (async () => {
    if (esAlumno()) {
      const aula = await aulaGuardada();
      if (aula) {
        poner(
          titulo(),
          el('p', { class: 'mensaje-nino' }, `Falta terminar de bajar el aula «${aula.nombre}».`),
          el('button', { type: 'button', class: 'boton', onclick: () => descarga(aula) }, 'Seguir descargando'),
          el('button', { type: 'button', class: 'boton secundario chico', onclick: () => olvidarTodo() }, 'Este dispositivo no es de un alumno'),
          version(),
        );
        return;
      }
      alumnoEntrar();
      return;
    }
    elegir();
  })().catch((error) => { console.error(error); elegir(); });
}
