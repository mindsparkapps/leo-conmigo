// Ayuda para el adulto: cómo empezar, cómo acompañar al niño, cómo fijar la pantalla y qué hacer si algo falla.

import { el } from '../ui/dom.js';
import { cabecera } from '../ui/adulto.js';

export const titulo = 'Ayuda · Leo Conmigo';

const seccion = (encabezado, ...contenido) => el('div', { class: 'panel' }, el('h2', {}, encabezado), ...contenido);
const lista = (...items) => el('ul', { class: 'lista-ayuda' }, items.map((t) => el('li', {}, t)));
const pasos = (...items) => el('ol', { class: 'lista-ayuda' }, items.map((t) => el('li', {}, t)));

export function montar(contenedor) {
  contenedor.append(
    el(
      'section',
      { class: 'vista-adulto' },
      cabecera('Ayuda'),
      seccion(
        'Para empezar',
        pasos(
          'Crea el perfil del niño (su nombre es la primera palabra que verá cada día) y elige 5 a 8 palabras con significado para él: su gente, su mascota, sus comidas y juguetes favoritos.',
          'Ponle a cada palabra una foto real si puedes: se aprende mucho más fácil que con un dibujo. Si no, usa un pictograma o un emoji.',
          'Graba tu propia voz diciendo cada palabra: es la que el niño conoce. Sin grabación se usa una voz sintética.',
          'Entrégale el dispositivo y deja que toque el botón verde ▶. Acompáñalo siempre.',
          'De vez en cuando mira «Progreso» para ver qué palabras ya lee y agrega palabras nuevas cuando haga falta.',
        ),
      ),
      seccion(
        'Cómo acompañarlo',
        lista(
          'Con 1 o 2 sesiones al día basta: son cortas a propósito (unos 5 a 10 minutos).',
          'Siéntate a su lado. Celebra los aciertos con tu voz y tu cara; la app también lo felicita.',
          'Si se equivoca no pasa nada: la app le muestra la respuesta sin avisos de error. No lo corrijas con palabras de «no».',
          'Si se cansa o se frustra, termina la sesión. Mejor un rato corto y contento que uno largo.',
          'Muchos niños con síndrome de Down tienen pérdida auditiva: por eso todo lo que se dice también se ve, y lo que se ve se puede escuchar tocándolo.',
          'Esta app no reemplaza a su educadora ni a sus terapeutas: úsala junto con ellos.',
        ),
      ),
      seccion(
        'Cómo aprende',
        el('p', {}, 'Sigue el método de lectura global: primero reconoce palabras enteras con los ojos y mucho después las sílabas. Cada etapa se abre sola cuando el niño está listo, y tú puedes elegir cuál practica en Ajustes.'),
        lista(
          'Etapa 0: emparejar imágenes y clasificar. Para niños que aún no emparejan bien.',
          'Etapa 1: palabras. Una palabra cuenta como «leída» cuando la reconoce escrita y toca su dibujo sin ayuda, en días distintos.',
          'Etapa 2: frases cortas y libros que tú armas con sus fotos. Se abre con 10 palabras leídas.',
          'Etapa 3: sílabas, siempre a partir de palabras que ya conoce. Se abre con 20 palabras leídas.',
          'Etapa 4: cuentos con preguntas que responde tocando un dibujo (se arman en Libros).',
        ),
      ),
      seccion(
        'Que no salga de la app',
        el('p', {}, 'La pantalla del niño no tiene menús ni enlaces, pero puede salir con los botones del dispositivo. Para evitarlo:'),
        lista(
          'Android: Ajustes › Seguridad › Fijar pantalla (o «Fijar app»). Abre la app, toca Recientes y elige «Fijar».',
          'iPhone y iPad: Ajustes › Accesibilidad › Acceso guiado. Actívalo y, con la app abierta, haz triple clic en el botón lateral.',
        ),
        el('p', {}, 'Para volver al modo adulto desde la pantalla del niño: mantén presionado el candado de la esquina durante 3 segundos y resuelve la suma.'),
      ),
      seccion(
        'Instalarla y usarla sin conexión',
        lista(
          'Android (Chrome): menú ⋮ › «Instalar aplicación». iPhone o iPad (Safari): Compartir › «Agregar a pantalla de inicio».',
          'Una vez abierta con internet, funciona sin conexión. Lo que se haga sin conexión se guarda en el dispositivo.',
          'Con una cuenta de Google (en «Cuenta de Google») los datos quedan iguales en el computador y en el celular. También puedes descargar una copia de seguridad en un archivo.',
        ),
      ),
      seccion(
        'Si algo no funciona',
        lista(
          'No se oye nada: sube el volumen del dispositivo. En iPhone, revisa que el interruptor lateral no esté en silencio y toca la pantalla una vez antes de empezar.',
          'No hay voz sintética en español: graba tu voz en cada palabra, o instala una voz en español en los ajustes de voz del dispositivo.',
          'No se puede grabar la voz o tomar fotos: da permiso al micrófono o la cámara en el navegador. Si no hay cámara, elige una foto de la galería.',
          'Una palabra no aparece en las actividades: necesita una imagen (foto, pictograma o emoji) y estar activa.',
          'Salió una versión nueva: en «Modo adulto» aparece un aviso para actualizar. El niño nunca lo ve.',
        ),
      ),
    ),
  );
  return undefined;
}
