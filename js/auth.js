// Inicio de sesión con Google (Google Identity Services, sin servidor propio).
//
// Se usa el «token client»: el token de acceso dura cerca de 1 hora y SOLO se guarda en memoria.
// Lo único que queda en el dispositivo es el correo de la cuenta vinculada, para saber que hay que renovar
// el token en silencio al abrir la app. El permiso pedido es solo la carpeta oculta de la app en Drive
// (`drive.appdata`): la app no ve nada más del Drive.

import { CLIENT_ID } from './config.js';

export const ALCANCES = 'https://www.googleapis.com/auth/drive.appdata openid email profile';
const URL_GSI = 'https://accounts.google.com/gsi/client';
const URL_USUARIO = 'https://www.googleapis.com/oauth2/v3/userinfo';
const CLAVE_CUENTA = 'leo_cuenta_google';
const MARGEN_MS = 60_000; // se renueva un minuto antes de que venza
const ESPERA_RENOVAR_MS = 15_000;
const ESPERA_INTERACTIVA_MS = 180_000; // el adulto puede tardar en elegir la cuenta

export class ErrorCuenta extends Error {
  constructor(mensaje, { vuelveAIniciar = false } = {}) {
    super(mensaje);
    this.name = 'ErrorCuenta';
    this.vuelveAIniciar = vuelveAIniciar; // true: hace falta que el adulto inicie sesión de nuevo
  }
}

/** Carga el script de Google (si ya está cargado, no hace nada). */
export function cargarGoogle({ documento = globalThis.document, ventana = globalThis, espera = 10_000 } = {}) {
  if (ventana.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolver, rechazar) => {
    const script = documento.createElement('script');
    const fallar = () => rechazar(new ErrorCuenta('No se pudo cargar el inicio de sesión de Google. Revisa la conexión a internet.'));
    const reloj = setTimeout(fallar, espera);
    script.src = URL_GSI;
    script.async = true;
    script.onload = () => { clearTimeout(reloj); ventana.google?.accounts?.oauth2 ? resolver() : fallar(); };
    script.onerror = () => { clearTimeout(reloj); fallar(); };
    documento.head.append(script);
  });
}

function leerCuenta(almacenamiento) {
  try {
    const crudo = almacenamiento?.getItem(CLAVE_CUENTA);
    const dato = crudo ? JSON.parse(crudo) : null;
    return dato && typeof dato.email === 'string' ? dato : null;
  } catch {
    return null;
  }
}

function guardarCuenta(almacenamiento, cuenta) {
  try {
    if (cuenta) almacenamiento?.setItem(CLAVE_CUENTA, JSON.stringify(cuenta));
    else almacenamiento?.removeItem(CLAVE_CUENTA);
  } catch { /* sin almacenamiento: el adulto tendrá que iniciar sesión cada vez */ }
}

export function crearAuth({
  clienteId = CLIENT_ID,
  cargar = cargarGoogle,
  ventana = globalThis,
  almacenamiento = globalThis.localStorage,
  fetchFn = (...args) => globalThis.fetch(...args),
  ahora = () => Date.now(),
  esperaRenovar = ESPERA_RENOVAR_MS,
} = {}) {
  let token = null;
  let venceEn = 0;
  let cliente = null;
  let pendiente = null; // { resolver, rechazar, reloj } de la petición de token en curso
  let renovando = null;

  const resolver = (valor) => { const p = pendiente; pendiente = null; if (p) { clearTimeout(p.reloj); p.resolver(valor); } };
  const rechazar = (error) => { const p = pendiente; pendiente = null; if (p) { clearTimeout(p.reloj); p.rechazar(error); } };

  async function obtenerCliente() {
    if (cliente) return cliente;
    await cargar();
    cliente = ventana.google.accounts.oauth2.initTokenClient({
      client_id: clienteId,
      scope: ALCANCES,
      callback: (respuesta) => {
        if (respuesta?.access_token) {
          token = respuesta.access_token;
          venceEn = ahora() + Math.max(0, Number(respuesta.expires_in ?? 3600)) * 1000;
          resolver(token);
        } else {
          rechazar(new ErrorCuenta('Google no entregó el permiso. Inténtalo de nuevo.', { vuelveAIniciar: true }));
        }
      },
      error_callback: (error) => {
        const cerrada = error?.type === 'popup_closed' || error?.type === 'popup_failed_to_open';
        rechazar(new ErrorCuenta(
          cerrada ? 'Se cerró la ventana de Google antes de terminar.' : 'No se pudo iniciar sesión con Google.',
          { vuelveAIniciar: true },
        ));
      },
    });
    return cliente;
  }

  /** Pide un token (con ventana si hace falta). `opciones`: { prompt, hint }. */
  async function pedirToken(opciones, { espera = ESPERA_INTERACTIVA_MS } = {}) {
    if (!clienteId) throw new ErrorCuenta('Falta configurar el cliente de Google (CLIENT_ID).');
    const c = await obtenerCliente();
    return new Promise((res, rej) => {
      rechazar(new ErrorCuenta('Otra petición de inicio de sesión reemplazó a esta.')); // por si había una colgada
      const reloj = setTimeout(() => rechazar(new ErrorCuenta('Google no respondió. Inténtalo de nuevo.', { vuelveAIniciar: true })), espera);
      pendiente = { resolver: res, rechazar: rej, reloj };
      c.requestAccessToken(opciones);
    });
  }

  async function cargarUsuario() {
    const respuesta = await fetchFn(URL_USUARIO, { headers: { Authorization: `Bearer ${token}` } });
    if (!respuesta.ok) throw new ErrorCuenta('No se pudo leer la cuenta de Google.');
    const datos = await respuesta.json();
    return { email: datos.email ?? '', nombre: datos.name ?? '' };
  }

  return {
    configurado: () => Boolean(clienteId),

    /** ¿Hay un token que sirva ahora, sin pedir nada a Google? (el modo niño no debe abrir ventanas) */
    tokenVigente: () => Boolean(token) && ahora() < venceEn - MARGEN_MS,

    /** { vinculada, email, nombre } de la cuenta recordada en este dispositivo. */
    cuenta() {
      const c = leerCuenta(almacenamiento);
      return { vinculada: Boolean(c), email: c?.email ?? '', nombre: c?.nombre ?? '' };
    },

    /** Abre la ventana de Google (debe llamarse desde un toque del adulto). */
    async iniciarSesion({ cambiarCuenta = false } = {}) {
      await pedirToken({ prompt: cambiarCuenta ? 'select_account' : '' });
      const usuario = await cargarUsuario();
      guardarCuenta(almacenamiento, usuario);
      return usuario;
    },

    /**
     * Un token vigente. Si venció, lo renueva en silencio (sin ventana, si Google ya conoce la cuenta).
     * Lanza ErrorCuenta con `vuelveAIniciar` si hace falta que el adulto inicie sesión otra vez.
     */
    async obtenerToken(forzar = false) {
      if (token && !forzar && ahora() < venceEn - MARGEN_MS) return token;
      const guardada = leerCuenta(almacenamiento);
      if (!guardada) throw new ErrorCuenta('No hay una cuenta de Google vinculada.', { vuelveAIniciar: true });
      if (!renovando) {
        renovando = pedirToken({ prompt: '', hint: guardada.email }, { espera: esperaRenovar })
          .catch((error) => {
            token = null;
            venceEn = 0;
            throw error instanceof ErrorCuenta ? error : new ErrorCuenta('No se pudo renovar la sesión de Google.', { vuelveAIniciar: true });
          })
          .finally(() => { renovando = null; });
      }
      return renovando;
    },

    /** Cierra la sesión: revoca el token y olvida la cuenta en este dispositivo. */
    cerrarSesion() {
      const anterior = token;
      token = null;
      venceEn = 0;
      guardarCuenta(almacenamiento, null);
      if (anterior) {
        try { ventana.google?.accounts?.oauth2?.revoke(anterior, () => {}); } catch { /* ya no sirve de nada */ }
      }
    },
  };
}
