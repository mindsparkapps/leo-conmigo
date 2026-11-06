import test from 'node:test';
import assert from 'node:assert/strict';
import { ALCANCES, ErrorCuenta, cargarGoogle, crearAuth } from '../js/auth.js';

/** Un «Google Identity Services» falso. `comportamiento.modo`: 'ok' | 'cerrada' | 'sin-token' | 'silencio'. */
function crearGoogleFalso() {
  const g = { modo: 'ok', pedidos: [], revocados: [], configuraciones: [], contador: 0, expiraEn: 3600 };
  g.ventana = {
    google: {
      accounts: {
        oauth2: {
          initTokenClient(config) {
            g.configuraciones.push(config);
            return {
              requestAccessToken(opciones) {
                g.pedidos.push(opciones);
                if (g.modo === 'silencio') return;
                setTimeout(() => {
                  if (g.modo === 'ok') config.callback({ access_token: `token-${++g.contador}`, expires_in: g.expiraEn });
                  else if (g.modo === 'sin-token') config.callback({ error: 'access_denied' });
                  else config.error_callback({ type: 'popup_closed' });
                }, 0);
              },
            };
          },
          revoke(token, listo) { g.revocados.push(token); listo?.(); },
        },
      },
    },
  };
  return g;
}

function almacenamientoFalso() {
  const datos = new Map();
  return { getItem: (k) => (datos.has(k) ? datos.get(k) : null), setItem: (k, v) => datos.set(k, String(v)), removeItem: (k) => datos.delete(k), datos };
}

function preparar({ clienteId = 'cliente.apps.googleusercontent.com', reloj = { t: 1_000_000 }, esperaRenovar = 50 } = {}) {
  const google = crearGoogleFalso();
  const almacenamiento = almacenamientoFalso();
  const peticiones = [];
  const auth = crearAuth({
    clienteId,
    cargar: async () => {},
    ventana: google.ventana,
    almacenamiento,
    fetchFn: async (url, op) => {
      peticiones.push([url, op.headers.Authorization]);
      return new Response(JSON.stringify({ email: 'ana@example.com', name: 'Ana' }));
    },
    ahora: () => reloj.t,
    esperaRenovar,
  });
  return { auth, google, almacenamiento, peticiones, reloj };
}

test('el permiso que se pide es solo la carpeta oculta de la app (más identidad)', () => {
  assert.ok(ALCANCES.includes('https://www.googleapis.com/auth/drive.appdata'));
  assert.ok(!ALCANCES.includes('auth/drive '), 'no pide acceso a todo el Drive');
  assert.ok(!/auth\/drive(\.file|\.readonly)?(\s|$)/.test(ALCANCES));
});

test('iniciar sesión: pide el token, lee el correo y recuerda la cuenta (no el token)', async () => {
  const { auth, almacenamiento, peticiones, google } = preparar();
  assert.deepEqual(auth.cuenta(), { vinculada: false, email: '', nombre: '' });
  const usuario = await auth.iniciarSesion();
  assert.deepEqual(usuario, { email: 'ana@example.com', nombre: 'Ana' });
  assert.deepEqual(auth.cuenta(), { vinculada: true, email: 'ana@example.com', nombre: 'Ana' });
  assert.equal(google.configuraciones[0].client_id, 'cliente.apps.googleusercontent.com');
  assert.equal(google.configuraciones[0].scope, ALCANCES);
  assert.deepEqual(google.pedidos[0], { prompt: '' });
  assert.equal(peticiones[0][1], 'Bearer token-1');
  const guardado = JSON.stringify([...almacenamiento.datos.values()]);
  assert.ok(!guardado.includes('token-1'), 'el token solo vive en memoria');
});

test('cambiar de cuenta pide elegirla', async () => {
  const { auth, google } = preparar();
  await auth.iniciarSesion({ cambiarCuenta: true });
  assert.deepEqual(google.pedidos[0], { prompt: 'select_account' });
});

test('el token vigente se reutiliza; al vencer se renueva en silencio con el correo de pista', async () => {
  const { auth, google, reloj } = preparar();
  await auth.iniciarSesion();
  assert.equal(auth.tokenVigente(), true);
  assert.equal(await auth.obtenerToken(), 'token-1');
  assert.equal(google.pedidos.length, 1, 'no se vuelve a pedir');

  reloj.t += 3600 * 1000 - 30_000; // faltan 30 s: dentro del margen de un minuto
  assert.equal(auth.tokenVigente(), false);
  assert.equal(await auth.obtenerToken(), 'token-2');
  assert.deepEqual(google.pedidos[1], { prompt: '', hint: 'ana@example.com' });
});

test('forzar renueva aunque el token siga vigente (para un 401)', async () => {
  const { auth } = preparar();
  await auth.iniciarSesion();
  assert.equal(await auth.obtenerToken(true), 'token-2');
});

test('varias peticiones de token a la vez comparten una sola renovación', async () => {
  const { auth, google, reloj } = preparar();
  await auth.iniciarSesion();
  reloj.t += 4000 * 1000;
  const tokens = await Promise.all([auth.obtenerToken(), auth.obtenerToken(), auth.obtenerToken()]);
  assert.deepEqual(tokens, ['token-2', 'token-2', 'token-2']);
  assert.equal(google.pedidos.length, 2);
});

test('sin cuenta vinculada no hay token y se pide iniciar sesión', async () => {
  const { auth } = preparar();
  await assert.rejects(() => auth.obtenerToken(), (e) => e instanceof ErrorCuenta && e.vuelveAIniciar === true);
});

test('si el adulto cierra la ventana de Google, se avisa y no se vincula nada', async () => {
  const { auth, google } = preparar();
  google.modo = 'cerrada';
  await assert.rejects(() => auth.iniciarSesion(), (e) => e instanceof ErrorCuenta && /ventana/.test(e.message));
  assert.equal(auth.cuenta().vinculada, false);
});

test('si Google no entrega el permiso, se avisa', async () => {
  const { auth, google } = preparar();
  google.modo = 'sin-token';
  await assert.rejects(() => auth.iniciarSesion(), (e) => e.vuelveAIniciar === true);
});

test('si la renovación en silencio falla o no responde, hay que volver a iniciar sesión', async () => {
  const { auth, google, reloj } = preparar({ esperaRenovar: 30 });
  await auth.iniciarSesion();
  reloj.t += 4000 * 1000;
  google.modo = 'cerrada';
  await assert.rejects(() => auth.obtenerToken(), (e) => e.vuelveAIniciar === true);
  assert.equal(auth.tokenVigente(), false);
  google.modo = 'silencio';
  await assert.rejects(() => auth.obtenerToken(), (e) => e.vuelveAIniciar === true && /no respondió/.test(e.message));
  google.modo = 'ok';
  assert.equal(await auth.obtenerToken(), 'token-2', 'después de un fallo se puede reintentar');
});

test('cerrar sesión: revoca el token, olvida la cuenta y deja de haber token', async () => {
  const { auth, google, almacenamiento } = preparar();
  await auth.iniciarSesion();
  auth.cerrarSesion();
  assert.deepEqual(google.revocados, ['token-1']);
  assert.equal(auth.cuenta().vinculada, false);
  assert.equal(almacenamiento.datos.size, 0);
  assert.equal(auth.tokenVigente(), false);
  await assert.rejects(() => auth.obtenerToken(), (e) => e.vuelveAIniciar === true);
});

test('sin CLIENT_ID configurado se explica y no se abre nada', async () => {
  const { auth, google } = preparar({ clienteId: '' });
  assert.equal(auth.configurado(), false);
  await assert.rejects(() => auth.iniciarSesion(), (e) => /CLIENT_ID/.test(e.message));
  assert.equal(google.pedidos.length, 0);
});

test('un almacenamiento roto no impide iniciar sesión', async () => {
  const google = crearGoogleFalso();
  const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); }, removeItem() { throw new Error('bloqueado'); } };
  const auth = crearAuth({
    clienteId: 'x', cargar: async () => {}, ventana: google.ventana, almacenamiento: roto,
    fetchFn: async () => new Response(JSON.stringify({ email: 'a@b.c' })),
  });
  assert.equal((await auth.iniciarSesion()).email, 'a@b.c');
  assert.equal(auth.cuenta().vinculada, false, 'sin dónde recordar, la próxima vez habrá que iniciar sesión');
});

test('cargarGoogle: no vuelve a cargar si ya está, y falla con un mensaje claro si el script no carga', async () => {
  await cargarGoogle({ ventana: { google: { accounts: { oauth2: {} } } }, documento: null });

  const hijos = [];
  const documento = {
    createElement: () => ({}),
    head: { append: (s) => { hijos.push(s); setTimeout(() => s.onerror(), 0); } },
  };
  await assert.rejects(() => cargarGoogle({ ventana: {}, documento, espera: 1000 }), (e) => e instanceof ErrorCuenta && /conexión/.test(e.message));
  assert.match(hijos[0].src, /accounts\.google\.com\/gsi\/client/);

  const documentoLento = { createElement: () => ({}), head: { append: () => {} } };
  await assert.rejects(() => cargarGoogle({ ventana: {}, documento: documentoLento, espera: 20 }), (e) => e instanceof ErrorCuenta);
});
