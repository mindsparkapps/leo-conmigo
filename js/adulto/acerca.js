// Acerca de: versión, método, créditos (ARASAAC y Andika) y nota de privacidad.

import { el } from '../ui/dom.js';
import { cabecera } from '../ui/adulto.js';
import { NOMBRE_APP, VERSION } from '../config.js';
import { CREDITO_ARASAAC } from '../pictos.js';

export const titulo = 'Acerca de · Leo Conmigo';

const seccion = (encabezado, ...contenido) => el('div', { class: 'panel' }, el('h2', {}, encabezado), ...contenido);
const enlace = (texto, href) => el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, texto);

export function montar(contenedor) {
  contenedor.append(
    el(
      'section',
      { class: 'vista-adulto' },
      cabecera('Acerca de'),
      seccion(
        NOMBRE_APP,
        el('p', {}, `Versión ${VERSION}.`),
        el('p', {}, 'Una aplicación para que un niño con síndrome de Down aprenda a leer paso a paso, con calma y acompañado. No tiene puntajes, tiempos ni vidas: el niño nunca pierde.'),
        el('p', { class: 'ayuda' }, 'Sigue el método de lectura global de María Victoria Troncoso y Mercedes del Cerro («Síndrome de Down: lectura y escritura»). No reemplaza a los profesionales que acompañan al niño.'),
      ),
      seccion(
        'Privacidad',
        el('ul', { class: 'lista-ayuda' }, [
          el('li', {}, 'Las fotos, la voz grabada, las palabras y el progreso del niño se guardan solo en este dispositivo.'),
          el('li', {}, 'Si inicias sesión con Google, además se guardan en una carpeta oculta de tu propio Google Drive que solo esta aplicación puede ver. La app no puede leer nada más de tu Drive.'),
          el('li', {}, 'No hay analítica, publicidad ni seguimiento. Los únicos servicios externos son Google (inicio de sesión y Drive) y ARASAAC (al elegir un pictograma solo se envía el texto que buscas).'),
          el('li', {}, 'Cerrar la sesión de Google no borra los datos del dispositivo. Puedes descargar una copia de todo en «Copia de seguridad».'),
        ]),
      ),
      seccion(
        'Créditos',
        el('p', {}, CREDITO_ARASAAC),
        el('p', { class: 'ayuda' }, 'Más información y términos de uso: ', enlace('arasaac.org', 'https://arasaac.org/terms-of-use')),
        el('p', {}, 'Letra Andika, de SIL International, diseñada para la alfabetización. Se usa bajo la licencia SIL Open Font License 1.1.'),
        el('p', { class: 'ayuda' }, enlace('software.sil.org/andika', 'https://software.sil.org/andika/')),
        el('p', { class: 'ayuda' }, 'Los dibujos de las calcomanías son propios de la aplicación. Los emojis los dibuja el sistema del dispositivo.'),
      ),
    ),
  );
  return undefined;
}
