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
        'Escritura (experimental): en qué se basa',
        el('p', {}, 'No hay un método de escritura con evidencia fuerte y específica para el síndrome de Down. El modo combina el método de Troncoso y del Cerro (después de la etapa global, una etapa analítica que empieza por las sílabas directas, con palabras conocidas y componiendo con piezas en vez de trazar) con lo que muestran los estudios de instrucción explícita: mejoran las palabras enseñadas y se generaliza poco, por eso se mide cuántas palabras nuevas escribe bien a la primera.'),
        el('ul', { class: 'lista-ayuda' }, [
          el('li', {}, 'María Victoria Troncoso y María Mercedes del Cerro, «Síndrome de Down: lectura y escritura» (Masson, 1997).'),
          el('li', {}, enlace('Manual del profesor «Síndrome de Down: palabras, palabras»', 'https://www.orientacionandujar.es/wp-content/uploads/2015/07/Sindrome-de-DOWN-palabras-palabras-Manual_Profesor.pdf')),
          el('li', {}, enlace('Down Syndrome Education International: hallazgos del programa de lectura y lenguaje', 'https://www.down-syndrome.org/en-us/research/projects/reading-language-intervention/findings')),
          el('li', {}, enlace('Revisión de lectura y escritura en síndrome de Down (DSE)', 'https://cdn.down-syndrome.org/pubs/a/reviews-2128.pdf')),
          el('li', {}, enlace('MULTILIT con niños con síndrome de Down (Flinders University)', 'https://researchnow.flinders.edu.au/en/publications/using-the-multilit-literacy-instruction-program-with-children-who/')),
          el('li', {}, enlace('Cajas de Elkonin: una caja por unidad sonora', 'https://en.wikipedia.org/wiki/Elkonin_boxes')),
        ]),
        el('p', { class: 'ayuda' }, 'Consultadas el 17 de noviembre de 2026. No se encontraron estudios con cajas de Elkonin, letras móviles o aprendizaje sin error en esta población: afinar el modo con los datos reales del niño es parte del trabajo.'),
      ),
      seccion(
        'Privacidad',
        el('ul', { class: 'lista-ayuda' }, [
          el('li', {}, 'Las fotos, la voz grabada, las palabras y el progreso del niño se guardan en este dispositivo.'),
          el('li', {}, 'Si inicias sesión con Google, además se guardan en una carpeta oculta de tu propio Google Drive que solo esta aplicación puede ver. Sin habilitar alumnos, la app no puede leer nada más de tu Drive.'),
          el('li', {}, 'No hay analítica, publicidad ni seguimiento. Los únicos servicios externos son Google (inicio de sesión y Drive) y ARASAAC (al elegir un pictograma solo se envía el texto que buscas).'),
          el('li', {}, 'Si habilitas alumnos, las fotos y voces de tus cursos están en una carpeta de tu Drive («Biblioteca») y el contenido de cada curso en otra; las dos se comparten SOLO con los correos que invitas, en solo lectura. Cada alumno escribe únicamente en su propia carpeta, que ningún otro alumno ve. La app avisa si aparece un acceso que ella no puso.'),
          el('li', {}, 'Lo que agrega la familia en el celular de un alumno (palabras, álbumes, premios, fotos y voces) se guarda en ese celular y en el Drive del propio alumno, no en el tuyo. Tú recibes sus estadísticas, y sus fotos y voces solo si tocas «Traer el material de la familia».'),
          el('li', {}, 'Cerrar la sesión de Google no borra los datos del dispositivo. Puedes descargar una copia de todo en «Copia de seguridad».'),
        ]),
        el('p', {}, el('a', { href: 'privacidad.html', target: '_blank', rel: 'noopener' }, 'Política de privacidad completa')),
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
