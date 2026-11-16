// Google y Drive simulados para probar las aulas en el navegador (no es una prueba automática).
//
//   const sim = await import('/tests/navegador/simular-aulas.js');
//   await sim.instalar();                 // Google Identity y fetch falsos, con el adulto ya vinculado
//   // ... recargar la página para que la app tome el Google falso (el script se reinstala solo si sessionStorage lo pide)
//
// La «nube» vive en la memoria de esta página (tests/drive-falso.js, varias cuentas). El alumno se simula con las mismas
// piezas de la app (js/aulas.js) sobre un almacén en memoria y la cuenta de otro correo.

import { crearNubeFalsa } from '/tests/drive-falso.js';
import { crearStoreEnMemoria } from '/tests/memoria.js';
import { crearAulas } from '/js/aulas.js';

export const ADULTO = 'adulto@ejemplo.com';

export function instalar({ adulto = ADULTO } = {}) {
  const nube = crearNubeFalsa();
  const original = globalThis.fetch.bind(globalThis);
  nube.cuenta(adulto);
  const registro = { pedidos: [], concede: true };

  globalThis.google = {
    accounts: {
      oauth2: {
        initTokenClient: (config) => ({
          requestAccessToken(opciones = {}) {
            registro.pedidos.push(opciones);
            setTimeout(() => {
              const scope = opciones.scope ?? config.scope;
              config.callback({ access_token: `token-${adulto}`, expires_in: 3600, scope: registro.concede ? scope : 'openid email profile https://www.googleapis.com/auth/drive.appdata' });
            }, 0);
          },
        }),
        hasGrantedAllScopes: (r, ...alcances) => alcances.every((a) => String(r.scope ?? '').split(' ').includes(a)),
        revoke: () => {},
      },
    },
  };

  globalThis.fetch = async (url, opciones = {}) => {
    const u = String(url);
    if (u.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) {
      const token = (opciones.headers?.Authorization ?? '').replace('Bearer ', '');
      return new Response(JSON.stringify({ email: nube.estado.tokens.get(token) ?? adulto, name: 'Adulto de prueba' }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (u.startsWith('https://www.googleapis.com/')) {
      const token = (opciones.headers?.Authorization ?? '').replace('Bearer ', '');
      const correo = nube.estado.tokens.get(token);
      if (!correo) return new Response('{}', { status: 401 });
      return nube.cuenta(correo).fetch(url, opciones);
    }
    return original(url, opciones);
  };

  /** Un dispositivo de alumno: otra cuenta, otro almacén. */
  const alumno = (email, idDispositivo) => {
    const store = crearStoreEnMemoria({ prefijo: `al-${idDispositivo}`, desde: 200 });
    const aulas = crearAulas({ store, ...nube.dep(email), idDispositivo, nombreDispositivo: `Tablet de ${email.split('@')[0]}`, versionApp: '0.34.0' });
    return {
      store, aulas, email,
      async sincronizar() {
        const [aula] = await aulas.buscarMiAula();
        if (!aula) return null;
        return aulas.sincronizarComoAlumno({ aula, email });
      },
    };
  };

  globalThis.__sim = { nube, alumno, registro, original };
  return globalThis.__sim;
}
