// Google y Drive simulados para probar las aulas en el navegador (no es una prueba automática).
//
//   const sim = await import('/tests/navegador/simular-aulas.js');
//   sim.instalar({ cuenta: 'adulto@ejemplo.com' });      // en la página del adulto (localhost:8080)
//   sim.instalar({ cuenta: 'pedro@gmail.com' });         // en la página del alumno (127.0.0.1:8080)
//
// «cuenta» es el correo con el que el Google falso inicia sesión en ESA página. La nube (tests/drive-falso.js, varias cuentas)
// se comparte entre las dos páginas, aunque sean de origen distinto: cada una guarda su estado en el servidor de pruebas
// (tests/servidor.py, /__nube/estado) y lo vuelve a leer antes de cada petición. `compartida: false` la deja solo en memoria.
//
// Para jugar sin conexión: `sim.registro.sinRed = true` (las peticiones a Google fallan como sin internet).

import { crearNubeFalsa } from '/tests/drive-falso.js';
import { crearStoreEnMemoria } from '/tests/memoria.js';
import { crearAulas } from '/js/aulas.js';

export const ADULTO = 'adulto@ejemplo.com';
const RUTA = '/__nube/estado';

export function instalar({ cuenta = ADULTO, compartida = true } = {}) {
  const nube = crearNubeFalsa();
  const original = globalThis.fetch.bind(globalThis);
  const registro = { pedidos: [], concede: true, sinRed: false, peticiones: 0 };
  nube.cuenta(cuenta);

  let cola = Promise.resolve();
  const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };
  // El servidor de pruebas a veces resetea una conexión: se reintenta (y con tiempo máximo, para no colgarse)
  // (con el service worker activo, una URL repetida se serviría de su caché: por eso cada petición lleva una marca distinta)
  const pedir = async (url, opciones = {}) => {
    for (let intento = 0; ; intento++) {
      try {
        return await original(`${url}?t=${Date.now()}-${Math.random().toString(36).slice(2)}`, { ...opciones, cache: 'no-store', signal: AbortSignal.timeout(8000) }); // sin caché: si no, se lee un estado viejo
      } catch (error) {
        if (intento >= 3) throw error;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  };
  const cargar = async () => nube.importar(await (await pedir(RUTA)).json());
  // (se lee la respuesta entera: si no, las conexiones quedan abiertas y a las pocas peticiones el navegador deja de contestar)
  const guardar = async () => (await pedir(RUTA, { method: 'POST', body: JSON.stringify(nube.exportar()) })).text();

  globalThis.google = {
    accounts: {
      oauth2: {
        initTokenClient: (config) => ({
          requestAccessToken(opciones = {}) {
            registro.pedidos.push(opciones);
            setTimeout(() => {
              const scope = opciones.scope ?? config.scope;
              config.callback({ access_token: `token-${cuenta}`, expires_in: 3600, scope: registro.concede ? scope : 'openid email profile https://www.googleapis.com/auth/drive.appdata' });
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
    if (!u.startsWith('https://www.googleapis.com/')) return original(url, opciones);
    if (registro.sinRed) throw new TypeError('Failed to fetch');
    const token = (opciones.headers?.Authorization ?? '').replace('Bearer ', '');
    if (u.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) {
      return new Response(JSON.stringify({ email: token === `token-${cuenta}` ? cuenta : '', name: cuenta }), { headers: { 'Content-Type': 'application/json' } });
    }
    return enCola(async () => {
      registro.peticiones += 1;
      if (compartida) await cargar();
      nube.cuenta(token.replace(/^token-/, '')); // el token vale solo si es de una cuenta que existe
      const r = await nube.cuenta(token.replace(/^token-/, '')).fetch(url, opciones);
      if (compartida && (opciones.method ?? 'GET').toUpperCase() !== 'GET') await guardar();
      return r;
    });
  };

    /**
 * Siembra en la base REAL de esta página (el adulto) al niño Pedro con 4 palabras con foto y voz y un álbum propio «Dinos»
 * (portada, sobre y 3 láminas), y deja puesto el modo adulto y la cuenta vinculada.
 */
async function sembrarAdulto({ cuenta: correo = ADULTO } = {}) {
  const { obtenerStore } = await import('/js/contexto.js');
  const store = await obtenerStore();
  const png = (color, texto) => new Promise((resolver) => {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = color; x.fillRect(0, 0, 160, 160);
    x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.fillText(texto, 20, 95);
    c.toBlob(resolver, 'image/png');
  });
  const wav = () => {
    const n = 4000; const b = new ArrayBuffer(44 + n * 2); const v = new DataView(b);
    const s = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 8) * 3000, true);
    return new Blob([b], { type: 'audio/wav' });
  };
  for (const [t, silabas, color] of [['perro', 'pe-rro', '#c0392b'], ['gato', 'ga-to', '#2980b9'], ['casa', 'ca-sa', '#27ae60'], ['sol', 'sol', '#f39c12']]) {
    await store.guardar('medios', { id: `img-${t}`, tipo: 'imagen', mime: 'image/png', origen: 'foto', blob: await png(color, t) });
    await store.guardar('medios', { id: `voz-${t}`, tipo: 'audio', mime: 'audio/wav', origen: 'grabacion', blob: wav() });
    await store.guardar('palabras', { id: `w-${t}`, perfilId: 'P1', texto: t, silabas: silabas.split('-'), categoria: 'otras', tipo: 'sustantivo', medioImagenId: `img-${t}`, medioAudioId: `voz-${t}`, activa: true, orden: 0 });
  }
  await store.guardar('medios', { id: 'alb-port', tipo: 'imagen', mime: 'image/png', origen: 'foto', blob: await png('#8e44ad', 'Dinos') });
  await store.guardar('medios', { id: 'alb-sobre', tipo: 'imagen', mime: 'image/png', origen: 'foto', blob: await png('#16a085', 'Sobre') });
  for (const n of [1, 2, 3]) await store.guardar('medios', { id: `alb-l${n}`, tipo: 'imagen', mime: 'image/png', origen: 'foto', blob: await png('#d35400', `L${n}`) });
  await store.guardar('perfiles', { id: 'P1', nombre: 'Pedro', ajustes: {}, album: {}, etapaActual: 1, creado: new Date().toISOString(), colecciones: [{ id: 'c1', nombre: 'Dinos', medioPortadaId: 'alb-port', medioSobreId: 'alb-sobre' }] });
  for (const n of [1, 2, 3]) await store.guardar('calcomaniasPropias', { id: `cp${n}`, perfilId: 'P1', coleccionId: 'c1', nombre: `Dino ${n}`, medioImagenId: `alb-l${n}` });
  localStorage.setItem('leo_cuenta_google', JSON.stringify({ email: correo, nombre: 'Adulto' }));
  localStorage.setItem('leo_permiso_aulas', '1');
  sessionStorage.setItem('leo_modo_adulto', '1');
}

/** Un dispositivo de alumno dentro de ESTA página (solo para pruebas sin segundo origen). */
  const alumno = (email, idDispositivo) => {
    const store = crearStoreEnMemoria({ prefijo: `al-${idDispositivo}`, desde: 200 });
    const aulas = crearAulas({ store, ...nube.dep(email), idDispositivo, nombreDispositivo: `Tablet de ${email.split('@')[0]}`, versionApp: '0.34.0' });
    return {
      store, aulas, email,
      async sincronizar() {
        const [aula] = await aulas.buscarMiAula();
        return aula ? aulas.sincronizarComoAlumno({ aula, email }) : null;
      },
    };
  };

  /** Borra la nube compartida (para empezar de cero). */
  const reiniciar = async () => { await pedir(RUTA, { method: 'DELETE' }); nube.importar({ archivos: [], permisos: [], tokens: [] }); };

  globalThis.__sim = { nube, alumno, registro, original, reiniciar, cuenta, sembrar: sembrarAdulto };
  return globalThis.__sim;
}
