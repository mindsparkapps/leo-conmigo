// Un toque con un segundo dedo se ignora (PLAN.md §2.9). Un clic sin `pointerType` (teclado,
// pulsador, lector de pantalla) es siempre válido: no tiene "dedos".
// El `click` NO sirve para saber si fue el segundo dedo: Chrome lo marca con isPrimary=false aunque sea el
// primer y único dedo (el modo niño no respondía a los toques en el celular). Se mira el `pointerdown`,
// que sí trae el dato verdadero, y se recuerda cuándo fue el último de un dedo no primario.
// Lo usan las cartas Y el botón del altavoz: los dos deben reaccionar igual al mismo toque.

const VENTANA_SEGUNDO_DEDO_MS = 700;
let ultimoSegundoDedo = -Infinity;

/** Se llama con cada `pointerdown` (en captura, sobre el documento). */
export function registrarPuntero(evento, ahora = Date.now()) {
  if (evento.pointerType === 'touch' && evento.isPrimary === false) ultimoSegundoDedo = ahora;
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => registrarPuntero(e), true);
}

export function esSegundoDedo(evento, ahora = Date.now()) {
  return evento.pointerType === 'touch' && ahora - ultimoSegundoDedo < VENTANA_SEGUNDO_DEDO_MS;
}

/** Solo para pruebas. */
export function olvidarPunteros() { ultimoSegundoDedo = -Infinity; }
