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
        'Lo que la app hace sola',
        el('p', {}, 'Para que el niño no pierda tiempo con lo que ya sabe y no se canse, la app se adapta. Todo se puede apagar en Ajustes › «Lo que la app hace sola», y el niño nunca ve nada de esto.'),
        lista(
          'Avance rápido: si acierta a la primera los 3 primeros ensayos de una palabra en una actividad, esa actividad queda dominada «a prueba» y se repasa al día siguiente. Si falla ese repaso, vuelve a practicarla.',
          'Palabras aprendidas: cuando una palabra está dominada en todas las actividades y la repasó bien a los 16 días, sale de los repasos normales. Solo se le hace un repaso de control cada 30 días. En Progreso aparece como «Aprendida» y puedes tocar «Volver a practicar».',
          'Más práctica a lo difícil: las palabras que más le cuestan (mira «Qué le cuesta») tienen un ensayo más y las que le salen solas, uno menos. Mientras acierte menos del 80 % de una palabra, no se usa como distractor la que suele confundir con ella.',
          'Ajustes que se adaptan: al terminar cada sesión la app mira las últimas 3. Puede subir o bajar los ensayos por sesión, subir el máximo de opciones, pasar de 2 a 1 palabras nuevas por sesión (y volver), y subir de etapa. Nunca baja la etapa: solo te lo sugiere. Cada cambio te lo avisa en el panel, con «Deshacer».',
          'Si cambias a mano un ajuste automático, pasa a «Lo elijo yo» y la app ya no lo toca. También puedes elegir «Lo elijo yo» en cada uno.',
        ),
      ),
      seccion(
        'Que no salga de la app',
        el('p', {}, 'La pantalla del niño no tiene menús ni enlaces, pero puede salir con los botones del dispositivo. Para evitarlo:'),
        lista(
          'Android: Ajustes › Seguridad › Fijar pantalla (o «Fijar app»). Abre la app, toca Recientes y elige «Fijar».',
          'iPhone y iPad: Ajustes › Accesibilidad › Acceso guiado. Actívalo y, con la app abierta, haz triple clic en el botón lateral.',
        ),
        el('p', {}, 'Para volver al modo adulto desde la pantalla del niño: mantén presionado el candado durante 3 segundos y resuelve la suma. En el celular de un alumno abre el mismo panel con el menú reducido.'),
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
        'Alumnos con su propio celular',
        el('p', {}, 'Un alumno es el niño usando la app en SU dispositivo, con su propio Gmail. Un perfil funciona como un curso: define qué se ve (palabras, frases, libros, álbumes, premios y ajustes) y varios alumnos pueden usar el mismo perfil. Cada alumno tiene su propia ficha, con su avance y sus estadísticas. Tú cambias el curso desde tu celular y las estadísticas de cada alumno te llegan a su ficha.'),
        el('h3', {}, 'Cómo habilitar a un alumno'),
        pasos(
          'En el modo adulto abre «Alumnos» (en el panel). Necesitas haber iniciado sesión con Google en «Cuenta».',
          'La primera vez, toca «Dar el permiso de Drive» y deja marcada la casilla del permiso de Drive en la ventana de Google. Se pide porque el curso y la Biblioteca son carpetas de TU Drive que compartes con el Gmail del alumno; la app solo toca sus carpetas «Leo Conmigo» y no lee el resto de tu Drive.',
          'En el perfil que corresponda toca «Habilitar alumno». Se crea su curso y se suben una sola vez sus fotos y voces a la Biblioteca (puede tardar si hay muchas; no cierres la app).',
          'Escribe el Gmail del alumno y toca «Invitar». Google le manda un correo. Invita un correo por alumno: cada uno tiene su carpeta y su ficha. Si el mismo niño usa dos dispositivos, entran con el mismo correo.',
          'En el dispositivo del alumno: instala la app, toca «Este dispositivo es de un alumno», entra con ese Gmail y espera la descarga. Desde ese momento funciona sin conexión.',
          'En «Alumnos» verás «Invitado, aún no entra» y, cuando entre, «Conectado», con cuánto hace que sincronizó. Toca «Ver estadísticas», «Qué le cuesta» o «Álbum» en el nombre de cada alumno para ver su ficha: solo se mira.',
        ),
        el('h3', {}, 'El celular del alumno y lo que agrega la familia'),
        lista(
          'En su celular, el candado «Config» (mantenerlo 3 segundos y resolver la suma) abre el mismo panel de adulto, pero con el menú reducido: Vocabulario, Frases, Libros, Álbum, Tienda, Progreso, «Qué le cuesta» y Ayuda. No tiene Alumnos, Cuenta, Ajustes, Fondo, Perfiles ni Copia de seguridad.',
          'Lo del curso lo ve la familia con la etiqueta «Del curso» y no lo puede cambiar. Lo que la familia agrega queda marcado «De la familia»: palabras, frases, libros, álbumes completos (con portada, sobre y láminas), premios de la Tienda y monedas que da.',
          'Todo lo de la familia se guarda en el celular del alumno y en el Drive del alumno (nunca en el tuyo ni en la Biblioteca), y se recupera si el alumno reinstala la app y entra con su Gmail.',
          'A ti te llegan las estadísticas de lo de la familia en la ficha del alumno, marcadas «De la familia»: el avance en sus palabras, su saldo, las monedas que dio la familia, los premios canjeados y el avance en sus álbumes.',
          'Sus fotos y voces no se bajan solas. En «Alumnos», bajo el nombre del alumno, toca «Traer el material de la familia» para verlas y oírlas en tu celular, y «Quitarlo de mi celular» para borrar esa copia (no toca el Drive ni el celular del alumno).',
        ),
        el('h3', {}, 'Qué ve el alumno y qué no'),
        lista(
          'Ve solo el curso de su perfil (palabras, frases, libros, álbumes, premios, ajustes) y las fotos y voces de ese curso, y no puede cambiarlos.',
          'Puede escribir únicamente en su propia carpeta: su avance y lo de su familia. Ningún otro alumno la ve, tampoco los del mismo perfil.',
          'No ve el resto de tu Drive, ni la carpeta «Leo Conmigo», ni los cursos de otros perfiles.',
          'Las fotos y voces de todos tus cursos están en una sola carpeta («Biblioteca»), que cada alumno invitado puede leer: la app solo le muestra las de su curso, pero fuera de la app podría abrir cualquiera de sus archivos. Si quieres evitarlo, no invites a esa cuenta.',
          'Nadie más ve el curso ni la Biblioteca: solo los correos que invitas, uno por uno (nunca «cualquiera con el enlace»). Si aparece un acceso que Leo Conmigo no puso, lo verás como «Permiso extraño» con un botón para quitarlo: la app no lo quita sola.',
          'Lo que cambies en el curso (palabras, álbumes, ajustes, fondo) le llega solo en menos de un minuto, sin avisarle al niño y nunca a mitad de una sesión. Su etapa y los ajustes automáticos son de cada alumno y no los pisas.',
        ),
        el('h3', {}, 'Si ya tenías alumnos de una versión anterior'),
        lista(
          'Al actualizar no se pierde nada. La primera vez que abres «Alumnos» la app reorganiza sola tus carpetas de Drive: crea la Biblioteca (mueve ahí las fotos y voces sin volver a subirlas) y una carpeta por alumno, y pasa el avance que ya habían enviado a la ficha de cada uno.',
          'La app no borra nada sola de tu Drive. Pueden quedar archivos repetidos o carpetas que ya no se usan: en «Cuenta» › «Espacio en Drive» puedes verlos por grupo (voces del catálogo copiadas, restos de versiones anteriores, fotos y voces sin uso, copias repetidas), ver cuánto pesan y elegir cuáles eliminar. Antes de eliminar te pide confirmación; lo que está a la vista en tu Drive va a la papelera de Google Drive (puedes recuperarlo) y el respaldo oculto de la app se borra de verdad. Nunca toca lo que usa un perfil, un curso o un alumno.',
          'Los dispositivos de los alumnos siguen funcionando; para el menú reducido y el respaldo en su propio Drive deben actualizar la app.',
        ),
        el('h3', {}, 'Quitar el acceso, desvincular y convertir un dispositivo'),
        lista(
          '«Quitar acceso» (en «Alumnos»): borra los permisos de ese correo en el curso, en su carpeta y, si ya no está en ningún curso, en la Biblioteca. Lo que ya trajo a tu app, y su ficha, se quedan y su dispositivo sigue funcionando sin conexión con lo que ya tiene.',
          '«Desvincular» (en cada dispositivo): la próxima vez que se conecte, ese dispositivo borra sus datos y vuelve a la pantalla de primer uso. También sirve desinstalar la app.',
          '«Convertir este dispositivo en celular de alumno» (en «Cuenta»): para un dispositivo que ya tenía tus datos. Borra TODO lo que hay en él (no se puede deshacer): haz antes una copia de seguridad o comprueba que esté sincronizado.',
        ),
        el('h3', {}, 'Si Google dice «Google no verificó esta app»'),
        el('p', {}, 'Es normal mientras la app no esté verificada por Google. En esa pantalla toca «Configuración avanzada» y luego «Ir a Leo Conmigo (no seguro)», y acepta los permisos. Solo hace falta una vez por cuenta. Si dice que la cuenta no tiene permiso para usar la app, quien publica la app debe revisar la opción «Público» en Google Cloud.'),
        el('p', { class: 'ayuda' }, 'Cómo configurar Google Cloud (orígenes, permisos, publicar la app): guía docs/google-cloud.md del proyecto. Cómo se tratan los datos: ', el('a', { href: 'privacidad.html', target: '_blank', rel: 'noopener' }, 'política de privacidad'), '.'),
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
