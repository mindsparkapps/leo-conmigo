// Actividades disponibles (hoy, las de la etapa 1). Cada una exporta
// { id, etapa, nombre, consigna, crearEnsayo(datos), render(contenedor, ensayo, ctx) }.

import L1 from './L1.js';
import L2 from './L2.js';
import L3 from './L3.js';
import L4 from './L4.js';
import L5 from './L5.js';

export const ACTIVIDADES = Object.freeze({ L1, L2, L3, L4, L5 });
