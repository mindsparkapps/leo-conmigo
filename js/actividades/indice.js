// Actividades disponibles. Cada una exporta
//   { id, etapa, nombre, consigna, crearEnsayo(datos), render(contenedor, ensayo, ctx) }
// y, opcionalmente:
//   aplicaA(elemento)        ¿le corresponde esta actividad a ese elemento? (por defecto, sí)
//   esOpcionValida(elemento) ¿puede aparecer como opción? (por defecto, sí)
//   reglas                   reglas extra para elegir distractores ({ soloOtraCategoria })
// La cadena de cada etapa (qué actividades y en qué orden) está en core/etapas.js.

import P1 from './P1.js';
import P2 from './P2.js';
import P3 from './P3.js';
import L1 from './L1.js';
import L2 from './L2.js';
import L3 from './L3.js';
import L4 from './L4.js';
import L5 from './L5.js';
import L6 from './L6.js';
import F1 from './F1.js';
import F2 from './F2.js';
import F3 from './F3.js';
import S1 from './S1.js';
import S2 from './S2.js';
import S3 from './S3.js';
import S4 from './S4.js';

export const ACTIVIDADES = Object.freeze({ P1, P2, P3, L1, L2, L3, L4, L5, L6, F1, F2, F3, S1, S2, S3, S4 });
