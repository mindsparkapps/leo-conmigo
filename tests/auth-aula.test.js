import test from 'node:test';
import assert from 'node:assert/strict';
import { ALCANCES, ALCANCES_AULA, ALCANCE_DRIVE, ErrorCuenta, MENSAJE_ACCESO_DENEGADO, crearAuth } from '../js/auth.js';

/** Un Google falso que concede (o no) el alcance `drive` según `g.concede`. */
function preparar() {
  const g = { concede: true, modo: 'ok', pedidos: [], contador: 0 };
  const ventana = {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config) => ({
            requestAccessToken(opciones) {
              g.pedidos.push(opciones);
              setTimeout(() => {
                if (g.modo === 'denegado') return config.callback({ error: 'access_denied' });
                const scope = `${opciones.scope ?? config.scope}${g.concede && opciones.scope ? '' : ''}`;
                config.callback({ access_token: `t-${++g.contador}`, expires_in: 3600, scope: g.concede ? scope : ALCANCES });
              }, 0);
            },
          }),
          hasGrantedAllScopes: (respuesta, ...alcances) => alcances.every((a) => String(respuesta.scope ?? '').split(' ').includes(a)),
          revoke() {},
        },
      },
    },
  };
  const datos = new Map();
  const almacenamiento = { getItem: (k) => (datos.has(k) ? datos.get(k) : null), setItem: (k, v) => datos.set(k, String(v)), removeItem: (k) => datos.delete(k) };
  const reloj = { t: 1_000_000 };
  const auth = crearAuth({
    clienteId: 'cliente.apps.googleusercontent.com', cargar: async () => {}, ventana, almacenamiento, ahora: () => reloj.t, esperaRenovar: 50,
    fetchFn: async () => new Response(JSON.stringify({ email: 'pedro@gmail.com', name: 'Pedro' })),
  });
  return { auth, g, reloj, almacenamiento };
}

test('el permiso del aula es el alcance `drive` además de los de siempre, y se pide aparte', () => {
  assert.ok(ALCANCES_AULA.startsWith(ALCANCES));
  assert.ok(ALCANCES_AULA.split(' ').includes(ALCANCE_DRIVE));
  assert.ok(!ALCANCES.split(' ').includes(ALCANCE_DRIVE), 'quien no usa alumnos sigue solo con drive.appdata');
});

test('pedirPermisoAulas: pide el alcance con include_granted_scopes y lo recuerda', async () => {
  const { auth, g } = preparar();
  assert.equal(auth.tienePermisoAulas(), false);
  assert.equal(await auth.pedirPermisoAulas(), true);
  assert.equal(g.pedidos[0].scope, ALCANCES_AULA);
  assert.equal(g.pedidos[0].include_granted_scopes, true);
  assert.equal(auth.tienePermisoAulas(), true);
  assert.equal(auth.cuenta().email, 'pedro@gmail.com');
});

test('pedirPermisoAulas: si se desmarca la casilla, se explica con claridad y no queda concedido', async () => {
  const { auth, g } = preparar();
  g.concede = false;
  await assert.rejects(() => auth.pedirPermisoAulas(), (e) => e instanceof ErrorCuenta && /casilla/.test(e.message));
  assert.equal(auth.tienePermisoAulas(), false);
});

test('al renovar el token, quien ya dio el permiso del aula lo conserva', async () => {
  const { auth, g, reloj } = preparar();
  await auth.pedirPermisoAulas();
  reloj.t += 4000 * 1000;
  await auth.obtenerToken();
  assert.equal(g.pedidos.at(-1).scope, ALCANCES_AULA);
});

test('access_denied tiene un mensaje propio sobre el modo Prueba de Google Cloud', async () => {
  const { auth, g } = preparar();
  g.modo = 'denegado';
  await assert.rejects(() => auth.iniciarSesion(), (e) => e instanceof ErrorCuenta && e.message === MENSAJE_ACCESO_DENEGADO && /Público/.test(e.message));
});

test('renovarAlTocar: con token vigente no pide nada; vencido, renueva; interactiva usa el correo como pista', async () => {
  const { auth, g, reloj } = preparar();
  await auth.iniciarSesion();
  const n = g.pedidos.length;
  await auth.renovarAlTocar();
  assert.equal(g.pedidos.length, n);
  reloj.t += 4000 * 1000;
  await auth.renovarAlTocar();
  assert.equal(g.pedidos.length, n + 1);
  reloj.t += 4000 * 1000;
  await auth.renovarAlTocar({ interactiva: true });
  assert.equal(g.pedidos.at(-1).hint, 'pedro@gmail.com');
  const sinCuenta = preparar();
  await assert.rejects(() => sinCuenta.auth.renovarAlTocar(), (e) => e.vuelveAIniciar === true);
});
