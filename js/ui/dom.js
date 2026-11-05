// Creador mínimo de elementos DOM.
//   el('button', { class: 'boton', onclick: fn, hidden: true }, 'Texto', otroNodo)
// - `class` asigna className; `on*` agrega un listener; `true` pone el atributo vacío;
//   `null`/`undefined`/`false` se ignoran. Los hijos de tipo texto se insertan como texto.

export function el(etiqueta, props = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props)) {
    if (valor == null || valor === false) continue;
    if (clave === 'class') nodo.className = valor;
    else if (clave.startsWith('on') && typeof valor === 'function') {
      nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
    } else nodo.setAttribute(clave, valor === true ? '' : String(valor));
  }
  nodo.append(...hijos.flat().filter((h) => h != null && h !== false));
  return nodo;
}
