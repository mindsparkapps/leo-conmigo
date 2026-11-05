// Gráfico de barras SVG (sin librerías): aciertos al primer intento por semana.
// Es accesible: lleva un resumen en texto (aria-label) y un <title> en cada barra.

const NS = 'http://www.w3.org/2000/svg';

function svg(nombre, atributos = {}, texto = null) {
  const nodo = document.createElementNS(NS, nombre);
  for (const [clave, valor] of Object.entries(atributos)) nodo.setAttribute(clave, String(valor));
  if (texto !== null) nodo.textContent = texto;
  return nodo;
}

/** '2026-11-02' -> '2 nov' */
export function etiquetaSemana(inicio) {
  const [a, m, d] = inicio.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** '2026-11-02' -> '2/11' (cabe 8 veces en el eje, incluso en un celular) */
export function etiquetaCorta(inicio) {
  const [, m, d] = inicio.split('-').map(Number);
  return `${d}/${m}`;
}

/** Lo que diría un lector de pantalla: «Semana del 2 nov: 80 % (10 ensayos); ...». */
export function resumenAccesible(semanas) {
  const partes = semanas.map((s) =>
    s.precision === null
      ? `semana del ${etiquetaSemana(s.inicio)}: sin datos`
      : `semana del ${etiquetaSemana(s.inicio)}: ${Math.round(s.precision * 100)} % (${s.ensayos} ensayos)`,
  );
  return `Aciertos al primer intento por semana. ${partes.join('; ')}.`;
}

/** @param semanas [{ inicio, ensayos, aciertos, precision (0 a 1 o null) }], de la más antigua a la actual */
export function crearGraficoSemanal(semanas) {
  const ancho = 320;
  const alto = 190;
  const izq = 36;
  const der = 8;
  const arriba = 18;
  const abajo = 36;
  const areaAncho = ancho - izq - der;
  const areaAlto = alto - arriba - abajo;
  const base = arriba + areaAlto;
  const paso = areaAncho / semanas.length;
  const anchoBarra = Math.min(28, paso - 8);

  const grafico = svg('svg', {
    viewBox: `0 0 ${ancho} ${alto}`,
    class: 'grafico-semanal',
    role: 'img',
    'aria-label': resumenAccesible(semanas),
  });

  for (const valor of [0, 50, 100]) {
    const y = arriba + areaAlto * (1 - valor / 100);
    grafico.append(svg('line', { class: 'guia', x1: izq, x2: ancho - der, y1: y, y2: y }));
    grafico.append(svg('text', { class: 'eje', x: izq - 6, y: y + 4, 'text-anchor': 'end' }, `${valor}%`));
  }

  semanas.forEach((semana, i) => {
    const centro = izq + paso * i + paso / 2;
    if (semana.precision === null) {
      const vacia = svg('line', { class: 'barra-vacia', x1: centro - anchoBarra / 2, x2: centro + anchoBarra / 2, y1: base, y2: base });
      vacia.append(svg('title', {}, `Semana del ${etiquetaSemana(semana.inicio)}: sin datos`));
      grafico.append(vacia);
    } else {
      const alturaBarra = Math.max(2, areaAlto * semana.precision);
      const barra = svg('rect', {
        class: 'barra',
        x: centro - anchoBarra / 2,
        y: base - alturaBarra,
        width: anchoBarra,
        height: alturaBarra,
        rx: 4,
      });
      barra.append(svg('title', {}, `Semana del ${etiquetaSemana(semana.inicio)}: ${Math.round(semana.precision * 100)} % de ${semana.ensayos} ensayos`));
      grafico.append(barra);
      grafico.append(svg('text', { class: 'valor', x: centro, y: base - alturaBarra - 4, 'text-anchor': 'middle' }, `${Math.round(semana.precision * 100)}`));
    }
    grafico.append(svg('text', { class: 'eje', x: centro, y: alto - 16, 'text-anchor': 'middle' }, etiquetaCorta(semana.inicio)));
  });
  return grafico;
}
