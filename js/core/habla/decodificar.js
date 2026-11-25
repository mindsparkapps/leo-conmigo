// Decodificación CTC voraz de la salida de ZIPA y traducción de sus tokens al
// inventario del español de Chile (data/habla/simbolos.json). Puro.
//
// Salida del modelo: `log_probs` [1, T', 127] (log-softmax) con un cuadro cada
// 20 ms (ver «Decisiones de implementación (fase 33a)» en PLAN.md).

/** Cuánto dura un cuadro de salida del modelo, en milisegundos. */
export const MS_POR_CUADRO = 20;

/** Lee `tokens-zipa.txt` («símbolo id» por línea) → arreglo indexado por id. */
export function leerTokens(texto) {
  const lista = [];
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea) continue;
    const corte = linea.lastIndexOf(' ');
    lista[Number(linea.slice(corte + 1))] = linea.slice(0, corte);
  }
  return lista;
}

/**
 * Argmax por cuadro, quita el blanco y junta repetidos (CTC voraz).
 * `logProbs` es un Float32Array plano de `cuadros × vocabulario`.
 * Devuelve los segmentos `{ id, desde, hasta, prob }` (cuadros de salida,
 * `hasta` exclusivo; `prob` es la probabilidad máxima dentro del segmento).
 */
export function decodificarVoraz(logProbs, cuadros, vocabulario, blanco = 0) {
  const segmentos = [];
  let previo = -1;
  for (let c = 0; c < cuadros; c++) {
    const base = c * vocabulario;
    let mejor = 0;
    let valor = -Infinity;
    for (let v = 0; v < vocabulario; v++) {
      const x = logProbs[base + v];
      if (x > valor) { valor = x; mejor = v; }
    }
    const p = Math.exp(valor);
    if (mejor === previo) {
      if (mejor !== blanco) {
        const ultimo = segmentos[segmentos.length - 1];
        ultimo.hasta = c + 1;
        if (p > ultimo.prob) ultimo.prob = p;
      }
    } else if (mejor !== blanco) {
      segmentos.push({ id: mejor, desde: c, hasta: c + 1, prob: p });
    }
    previo = mejor;
  }
  return segmentos;
}

/**
 * Pasa los segmentos al inventario chileno con `simbolos.json`: quita los
 * tokens especiales y los modificadores, une alófonos (β → b) y deja los
 * sonidos fuera del inventario como `{ fonema: null, ipa }`.
 * Devuelve `[{ fonema, ipa, desde, hasta, prob }]`.
 */
export function traducirSegmentos(segmentos, simbolos) {
  const porId = new Map(simbolos.tokens.map((t) => [t.id, t]));
  const salida = [];
  for (const s of segmentos) {
    const token = porId.get(s.id);
    if (!token || token.tipo === 'especial' || token.tipo === 'modificador') continue;
    salida.push({ fonema: token.fonema, ipa: token.ipa, desde: s.desde, hasta: s.hasta, prob: s.prob });
  }
  return salida;
}

/** Texto legible: los fonemas del inventario seguidos, y `?ipa` los de fuera. */
export function fonemasComoTexto(traducidos) {
  return traducidos.map((t) => t.fonema ?? `?${t.ipa}`).join(' ');
}
