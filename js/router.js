// Router por hash (#/nino, #/adulto, ...).
// Cada vista es un módulo que exporta `montar(contenedor, { ruta, ir })`
// (puede devolver una función de limpieza) y, opcionalmente, `titulo`.

export function crearRouter({ contenedor, rutas, rutaInicial }) {
  let limpiar = null;
  let generacion = 0;

  async function mostrar() {
    const miGeneracion = ++generacion;
    const ruta = location.hash.slice(1) || rutaInicial;
    const def = rutas.find((r) => ruta === r.ruta || ruta.startsWith(r.ruta + '/'));

    if (!def) { ir(rutaInicial, true); return; }
    if (def.guardia && !def.guardia()) { ir(def.siNoPasa ?? rutaInicial, true); return; }

    let modulo;
    try {
      modulo = await def.cargar();
    } catch (error) {
      console.error('No se pudo cargar la vista', ruta, error);
      return;
    }
    if (miGeneracion !== generacion) return; // llegó otra navegación mientras cargaba

    if (limpiar) { limpiar(); limpiar = null; }
    contenedor.replaceChildren();
    document.title = modulo.titulo ?? 'Leo Conmigo';
    const resultado = modulo.montar(contenedor, { ruta, ir });
    limpiar = typeof resultado === 'function' ? resultado : null;
    contenedor.focus({ preventScroll: true });
  }

  function ir(ruta, reemplazar = false) {
    const destino = '#' + ruta;
    if (location.hash === destino) { mostrar(); return; }
    if (reemplazar) location.replace(destino);
    else location.hash = destino;
  }

  window.addEventListener('hashchange', mostrar);
  mostrar();
  return { ir };
}
