# Configurar Google Cloud para Leo Conmigo (alumnos con su propia cuenta)

Guía para el dueño del proyecto. Sirve para que Google **no rechace** a los alumnos cuando entran con su Gmail. La app (fases 15 a 19 de [PLAN.md](../PLAN.md)) no puede hacer esto sola: se hace en la consola de Google Cloud.

> Leo Conmigo usa el cliente OAuth **«MindSpark»**, el mismo de ZenBan (`CLIENT_ID` en `js/config.js`). La configuración de la pantalla de consentimiento es **del proyecto de Google Cloud**: lo que cambies aquí afecta también a ZenBan y a las demás apps que usen ese cliente.

## Por qué Google rechaza a los alumnos

Mientras la app está en estado **«Prueba»** (*Testing*), solo pueden entrar las cuentas agregadas a mano como **usuarios de prueba** (hasta 100). Cualquier otro Gmail recibe un error de acceso denegado. Para que entre cualquier alumno sin agregarlo uno por uno, hay que **publicar la app** (estado **«En producción»**).

Además, la Biblioteca, los cursos y las carpetas de los alumnos usan el permiso de Drive completo (`https://www.googleapis.com/auth/drive`), que Google clasifica como **restringido**. Eso decide qué pasa al publicar (ver las opciones más abajo).

## Paso 1. Orígenes autorizados del cliente

Consola → **Google Auth Platform** (o *APIs y servicios*) → **Clientes** → «MindSpark» → **Orígenes de JavaScript autorizados**. Agregar:

- `https://mindsparkapps.github.io` (la app publicada)
- `http://localhost:8080` y `http://127.0.0.1:8080` (pruebas locales; el segundo se usa para simular el dispositivo del alumno)

## Paso 2. Permisos que pide la app

**Google Auth Platform → Acceso a los datos** (*Data access*) → **Agregar o quitar permisos**. Deben estar:

- `.../auth/drive.appdata` (sincronización personal; ya estaba)
- `.../auth/drive` (Biblioteca, cursos y carpetas de los alumnos; es el mismo que ya usa ZenBan)
- `.../auth/drive.appdata` (la carpeta oculta de la app: respaldo del adulto y también el del alumno en SU propio Drive)
- `openid`, `email`, `profile`

Comprueba también que la **API de Google Drive** esté habilitada en el proyecto (*APIs y servicios → Biblioteca*).

## Paso 3. Datos de la marca

**Google Auth Platform → Desarrollo de la marca** (*Branding*):

- Nombre de la app, correo de asistencia y logo (opcional; un logo nuevo puede pedir revisión).
- **Página principal:** `https://mindsparkapps.github.io/leo-conmigo/`
- **Política de privacidad:** `https://mindsparkapps.github.io/leo-conmigo/privacidad.html` (ya existe: `privacidad.html` en la raíz de la app, con los datos que usa, el uso de `appDataFolder`, de la Biblioteca, de los cursos y de las carpetas de los alumnos, lo que agrega la familia y cómo borrar todo; ZenBan tiene la suya aparte).
- **Dominios autorizados:** `mindsparkapps.github.io`.

## Paso 4. Publicar la app

**Google Auth Platform → Público** (*Audience*):

1. Tipo de usuario: **Externo**.
2. Estado de publicación: **Prueba** → botón **Publicar app** → confirmar. Queda **«En producción»**.

Desde ese momento cualquier cuenta de Google puede iniciar sesión. Qué ve cada persona depende de si la app está verificada:

### Opción A (recomendada para uso familiar o de una consulta): en producción sin verificar

- Al iniciar sesión, Google muestra la pantalla **«Google no verificó esta app»**. Para seguir hay que tocar **Configuración avanzada → Ir a Leo Conmigo (no seguro)** y luego aceptar los permisos. Se hace **una sola vez por cuenta** (y otra vez si se agregan permisos nuevos).
- Límite: **100 usuarios nuevos en total** para todo el proyecto (cuentan también los de ZenBan, porque el cliente es el mismo). Se ve en **Público → Límite de usuarios de OAuth** (*OAuth user cap*).
- No cuesta nada ni requiere trámites. Es lo que conviene mientras sean pocos alumnos.
- Consejo: el día que configures el dispositivo de un alumno, ten a mano esta guía para tocar «Configuración avanzada» en su teléfono.

### Opción B: verificar la app con Google (sin aviso y sin límite de 100)

Necesario solo si se va a usar con muchas familias. Para un permiso restringido como `drive`, Google pide:

- Verificar la propiedad del dominio en Google Search Console (`mindsparkapps.github.io`).
- Página principal y política de privacidad públicas en ese dominio, que expliquen qué datos de Google se usan y para qué.
- Justificación escrita de cada permiso y un **video de demostración** (en YouTube) que muestre el inicio de sesión y el uso de Drive.
- Una **evaluación de seguridad anual (CASA)** hecha por un laboratorio externo autorizado. Tiene costo y el proceso puede tardar semanas o meses.

### Opción C (a futuro): evitar el permiso restringido

Rediseñar la Biblioteca y los cursos con el permiso `drive.file` (no restringido) más **Google Picker**: el alumno elegiría la carpeta compartida una vez con el selector de Google. Evita la evaluación CASA, pero cambia el diseño de las fases 16 y 18 y hay que confirmar antes que Picker da acceso al contenido de una carpeta compartida. Está **fuera de alcance** de la Ampliación 3: preguntar antes de hacerlo.

## Si mientras tanto prefieres seguir en «Prueba»

En **Público → Usuarios de prueba** agrega el Gmail de cada alumno (hasta 100). Sin eso, el alumno ve «Acceso bloqueado» o el error `access_denied`, y la app le muestra el mensaje «Esta cuenta no tiene permiso para usar la app».

## Lista rápida

- [ ] Orígenes autorizados (paso 1)
- [ ] Permisos `drive.appdata`, `drive`, `openid`, `email`, `profile` y la API de Drive habilitada (paso 2)
- [ ] Marca: página principal, política de privacidad, dominio autorizado (paso 3)
- [ ] Publicar la app (paso 4) y elegir la opción A o B
- [ ] Probar con un Gmail que **no** sea usuario de prueba: debe entrar (con el aviso de app no verificada en la opción A)

Fuentes: ayuda de Google Cloud sobre [verificación de apps y el límite de usuarios](https://support.google.com/cloud/answer/13463817) y [apps no verificadas](https://support.google.com/cloud/answer/7454865). Los nombres de los menús cambian seguido: si alguno no coincide, búscalo dentro de **Google Auth Platform**.
