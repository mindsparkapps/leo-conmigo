// Las palabras largas no caben en una carta a 56 px o más: se achican solo lo justo para que entren.

const MINIMO_PX = 28;

function ajustarUno(texto) {
  texto.style.fontSize = '';
  const carta = texto.parentElement;
  const estilo = getComputedStyle(carta);
  const disponible = carta.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
  if (disponible <= 0) return; // aún no está en pantalla
  let tam = parseFloat(getComputedStyle(texto).fontSize);
  while (texto.scrollWidth > disponible && tam > MINIMO_PX) {
    tam -= 2;
    texto.style.fontSize = `${tam}px`;
  }
}

/** Ajusta todas las palabras de `raiz` y vuelve a hacerlo si cambia el tamaño o la orientación. */
export function ajustarTextos(raiz) {
  const ajustar = () => raiz.querySelectorAll('.palabra-texto').forEach(ajustarUno);
  ajustar();
  globalThis.document?.fonts?.ready?.then(ajustar); // al cargar la letra Andika cambian los anchos
  globalThis.addEventListener('resize', ajustar);
  return () => globalThis.removeEventListener('resize', ajustar);
}
