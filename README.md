# Comunidad IMCYC

Registro de participantes, encuesta de experiencia y kit de continuidad. El panel
administrativo está en `/panel/`. En producción la aplicación vive bajo
`https://grabador.imcyc.com/exp-imcyc/`; `/panel` en ese dominio redirige al panel.

## Arquitectura y persistencia

Next.js genera HTML, CSS y JavaScript estáticos con `output: 'export'`. Apache sirve
el contenido de `out/`; PHP 8.2+ con PDO MySQL atiende `/api/index.php`. No se necesita
un proceso Node en producción. Este formato aprovecha Apache y PHP ya instalados
en el servidor y mantiene las credenciales fuera de los archivos públicos.

`registration.save` guarda nombre, empresa y correo desde el primer paso. La
encuesta agrega servicio, aplicación del conocimiento, claridad, calificación
(incluido cero), folio y fecha de emisión. El panel distingue contactos sin
encuesta de encuestas completas y ofrece búsqueda, filtros y páginas de 25 filas.

Una sesión conserva su registro al recargar. Reiniciar abre un registro nuevo.
Dos sesiones pueden registrar el mismo correo; escribir un correo no demuestra
la identidad de su dueño y por eso no permite sobrescribir registros ajenos.
Una encuesta enviada conserva sus respuestas y folio ante reintentos de red.

La API usa consultas preparadas, validación, cookies HttpOnly/Secure/SameSite,
tokens CSRF, sesiones administrativas de 8 horas y límites de intentos de acceso.
Las consultas administrativas requieren autenticación y no se almacenan en caché.

Supabase fue retirado de la aplicación. El checkout original no incluía URL ni
credenciales de Supabase; este despliegue crea una base nueva y no importa datos
históricos de un proyecto externo.

## Build y comprobaciones

Requisitos: Node 20.9+ (Node 22.18+ para el generador de muestra PDF), pnpm 11,
PHP 8.2+ con `pdo_mysql`, MySQL 8+ o MariaDB 10.6+.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm run typecheck
pnpm run build:deploy
```

`build:deploy` fija `NEXT_PUBLIC_BASE_PATH=/exp-imcyc` para imágenes, fuentes,
peticiones API y rutas de Next. `pnpm run build` genera el sitio para la raíz.
El artefacto publicable es `out/`, incluida la entrada PHP de la API. El directorio
`backend/` debe instalarse fuera de la raíz pública.

## Servidor

- Build: `/var/www/html/exp-imcyc`.
- Implementación PHP: `/var/www/exp-imcyc-api`.
- Configuración privada: `/etc/exp-imcyc/config.php`, `root:www-data`, modo `0640`.
- Sesiones: `/var/lib/exp-imcyc/sessions`, solo accesibles por `www-data`.
- Base: `exp_imcyc`, en la instalación MariaDB existente (compatible con MySQL).
- Usuario de base: `exp_imcyc_app@localhost`, solo `SELECT`, `INSERT`, `UPDATE`,
  `DELETE` sobre `exp_imcyc.*`.
- Administrador inicial: `admin`. Contraseñas aleatorias en
  `/root/exp-imcyc.credentials`, modo `0600`; no incluirlas en Git ni en `out/`.

`scripts/provision.php` crea la base, el usuario y las tablas de
`backend/schema.sql`. Ejecútalo como root desde un paquete que conserve la
estructura `scripts/` y `backend/`. Es idempotente y se detiene si encuentra una
base o usuario preexistentes sin configuración propia. Conserva las contraseñas
en despliegues posteriores.

`deploy/apache-exp-imcyc.conf` se incluye dentro del VirtualHost HTTPS de
`grabador.imcyc.com`, mediante `/etc/apache2/exp-imcyc.conf`. El archivo activo es
`/etc/apache2/sites-enabled/grabador-le-ssl.conf`: en este servidor es un archivo
regular, no un enlace a `sites-available`. Modifica el archivo activo conservando
las rutas de las otras aplicaciones. Guarda respaldo antes de modificarlo y
ejecuta `apache2ctl configtest` antes de recargar Apache. Respaldar también el
build, la API y la base antes de actualizar un despliegue existente. Una reversión
del build no debe eliminar datos ni cambiar credenciales.

El primer despliegue conserva su respaldo en
`/root/exp-imcyc-backups/20260907T232716Z/`.

## Desarrollo y pruebas locales

Usa una base temporal con el esquema de `backend/schema.sql`. Copia
`backend/config.example.php` fuera de `out/` y ajusta conexión, origen, ruta de
cookies y directorio de sesiones. Para HTTP local, `cookie_secure` debe ser
`false`; nunca cambiar esta opción en producción.

```bash
EXP_IMCYC_CONFIG=/ruta/privada/config.php pnpm run preview
```

El servidor de preview atiende el build y PHP en `127.0.0.1:4187`, incluyendo la
ruta `/exp-imcyc/`. `pnpm dev` solo previsualiza el frontend Next; usa el preview
con PHP para probar persistencia y administración.

`tests/api.py` comprueba autenticación, CSRF, aislamiento de registros, escritura,
reintentos de encuesta, filtros, paginación y límite de intentos. Solo acepta una
URL local; requiere una base vacía con administrador de prueba `qa`, contraseña
`Clave-QA-local-2026` (o `EXP_IMCYC_TEST_PASSWORD`). Crea datos sintéticos y no debe
usarse contra la base de producción.

```bash
python3 tests/api.py
```

## PDF del kit

`lib/kit-pdf.ts` reproduce la composición de la referencia en una página de
8 × 10 pulgadas: fondo claro, logotipo, descuento, fecha, beneficiario, empresa,
servicio, franja azul con folio y condiciones de vigencia. El panel y el flujo
público comparten este generador. La fecha procede de la emisión guardada en la
base, en horario de Ciudad de México; descargar de nuevo no renueva la vigencia.
Los nombres largos ajustan su tamaño y pueden ocupar varias líneas.

Poppins se sirve localmente bajo la licencia OFL de `public/fonts/OFL.txt`.

```bash
node scripts/pdf-sample.mjs
pdftoppm -png -singlefile output/pdf/kit-continuidad-imcyc.pdf /tmp/kit-preview
```

El comando crea la muestra `output/pdf/kit-continuidad-imcyc.pdf` y una prueba con
campos largos en `tmp/pdfs/`. Estos artefactos quedan fuera de Git.

Referencias técnicas: [exportación estática de Next.js](https://nextjs.org/docs/app/guides/static-exports),
[parámetros de sesión PHP](https://www.php.net/manual/en/function.session-set-cookie-params.php)
y [consultas preparadas PDO](https://www.php.net/pdo.prepared-statements).
