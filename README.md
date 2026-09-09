# Comunidad IMCYC

Registro de participantes, encuesta de experiencia y kit de continuidad. El panel
administrativo está en `/panel/`. En producción la aplicación vive bajo
`https://grabador.imcyc.com/exp-imcyc/`; `/panel` en ese dominio redirige al panel.

## Arquitectura y persistencia

Next.js genera HTML, CSS y JavaScript estáticos con `output: 'export'`. Apache sirve
el contenido de `out/`; PHP 8.3+ con PDO MySQL atiende `/api/index.php`. No se necesita
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

**Exportar Excel** descarga un `.xlsx` con todos los registros que coinciden con
la búsqueda, estado, servicio y autorización aplicados, incluidas todas las páginas. Sin filtros
descarga todos los registros. Incluye contacto, estado, respuestas, calificación,
folio y fechas en horario de Ciudad de México. Los campos pendientes quedan
vacíos; las fechas y calificaciones conservan sus tipos para ordenar y calcular.
El archivo incorpora encabezados fijos y filtros de Excel.

En el **paso 2**, después de las tres preguntas, aparece la casilla opcional
«Autorizo el uso de mi opinión como testimonio», desmarcada por defecto. Al enviar
la encuesta se guardan la decisión, su fecha y el texto presentado. No autorizar
permite continuar al kit. Los reintentos conservan la primera decisión guardada.
El listado, detalle y Excel distinguen **Autorizó**, **No autorizó** y **Sin
autorización registrada**; el panel permite filtrar por esos estados. Los registros
anteriores y formularios antiguos que no enviaban esta respuesta permanecen sin
autorización registrada, sin atribuirles consentimiento.

La ruta autenticada `admin.registrations.export` reutiliza los filtros del listado.
[OpenSpout](https://github.com/openspout/openspout) genera el libro por filas desde
una consulta sin búfer, sin cargar todos los participantes en la memoria de PHP.
El texto se guarda explícitamente como texto para evitar fórmulas introducidas en
campos de participantes. Los archivos temporales se crean bajo el directorio
privado de sesiones y se eliminan al finalizar; no quedan copias en el build.

La sección **Usuarios** (`/panel/#usuarios`) permite crear administradores y
cambiar la contraseña propia o la de otro usuario. Todos tienen los mismos
permisos para consultar registros y administrar cuentas. Cada cambio exige la
contraseña actual del administrador que lo realiza y un token CSRF válido.
Los nombres son únicos sin distinguir mayúsculas; las claves nuevas requieren
entre 12 y 128 caracteres y se guardan con Argon2id (sin truncarlas a 72 bytes).
Las contraseñas existentes en bcrypt siguen funcionando.

Cada sesión autenticada conserva una huella del hash vigente. Al cambiar una
contraseña, las demás sesiones de esa cuenta pierden acceso en su siguiente
solicitud. El cambio propio mantiene abierta la sesión actual y renueva su cookie
y token CSRF. Al instalar esta actualización, las sesiones del panel creadas
antes de que existiera la huella deben iniciar sesión nuevamente.

Supabase fue retirado de la aplicación. El checkout original no incluía URL ni
credenciales de Supabase; este despliegue crea una base nueva y no importa datos
históricos de un proyecto externo.

## Build y comprobaciones

Requisitos: Node 20.9+ (Node 22.18+ para el generador de muestra PDF), pnpm 11,
PHP 8.3+ con `pdo_mysql`, `dom`, `xmlreader`, `zip`, `fileinfo` y soporte de Argon2id,
Composer 2, MySQL 8+ o MariaDB 10.6+.

```bash
pnpm install --frozen-lockfile
composer install --working-dir=backend --no-dev --prefer-dist --optimize-autoloader
pnpm test
pnpm run typecheck
pnpm run build:deploy
```

`build:deploy` fija `NEXT_PUBLIC_BASE_PATH=/exp-imcyc` para imágenes, fuentes,
peticiones API y rutas de Next. `pnpm run build` genera el sitio para la raíz.
El artefacto publicable es `out/`, incluida la entrada PHP de la API. El directorio
`backend/`, incluido `vendor/` instalado con el `composer.lock` versionado, debe
instalarse fuera de la raíz pública. Instala las dependencias antes de publicar
la API de exportación; `vendor/` no se incluye en Git.

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
  Ese archivo conserva la contraseña inicial; los cambios posteriores desde el
  panel se guardan únicamente como hash en la base y no actualizan ese archivo.

`scripts/provision.php` crea la base, el usuario y las tablas de
`backend/schema.sql`. Ejecútalo como root desde un paquete que conserve la
estructura `scripts/` y `backend/`. Es idempotente y se detiene si encuentra una
base o usuario preexistentes sin configuración propia. Conserva las contraseñas
en despliegues posteriores.

Antes de publicar el backend que guarda autorizaciones, ejecuta `scripts/migrate.php`
como root desde el paquete completo, con `EXP_IMCYC_CONFIG` si no se usa la ruta
privada habitual. Agrega tres columnas opcionales de forma idempotente y conserva
los registros existentes con valores `NULL`. El usuario de la aplicación mantiene
sus permisos de datos; no recibe permisos para modificar el esquema. En pruebas
locales, `EXP_IMCYC_MYSQL_SOCKET` permite usar el socket de la instancia temporal.

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
python3 tests/administrators.py
```

Las pruebas de administradores comprueban creación y duplicados, contraseña
actual obligatoria, cambios propios y de otra cuenta, claves Unicode largas,
rotación de CSRF y rechazo de sesiones anteriores. Utilizan cuentas temporales
en la base local de pruebas; no modifican la contraseña del administrador `qa`.

`tests/export.py` abre los XLSX con un lector independiente y verifica acceso,
filtros, exportación de más de 25 filas, campos pendientes, cero, caracteres
especiales, fechas CDMX y texto que podría confundirse con fórmulas. Crea registros
sintéticos en la misma base local y usa un origen de conexión separado para no
interferir con los límites de intentos de las otras pruebas.

```bash
python3 -m venv /tmp/imcyc-test-env
/tmp/imcyc-test-env/bin/pip install -r tests/requirements.txt
/tmp/imcyc-test-env/bin/python tests/export.py
```

## Hoja de cálculo de Google

Cada encuesta completada se copia a una hoja de cálculo mediante un Apps Script
publicado como aplicación web; `deploy/apps-script-sheet.gs` lleva el código y
los pasos de instalación. El servidor solo necesita dos claves en
`/etc/exp-imcyc/config.php`:

```php
'sheet_webhook_url' => 'https://script.google.com/macros/s/.../exec',
'sheet_webhook_token' => 'la misma cadena que quedó en el script',
```

Ambas en blanco desactivan la copia sin afectar el registro. Así no hacen falta
credenciales de Google en el servidor: el token viaja en el cuerpo del POST y la
URL vive fuera del build.

La hoja es un espejo, nunca la fuente. El registro se guarda y se confirma al
participante antes de intentar el envío, de modo que una caída de Google no le
impide obtener su kit; el fallo queda en el log de Apache. Como Apache atiende
PHP con `php_module`, el envío ocurre dentro de la petición y le suma su latencia
—normalmente uno o dos segundos, con un tope de ocho.

Desde el panel, **Recargar hoja** reescribe la hoja con todos los registros
actuales, y el botón **Eliminar participante** del detalle borra a la persona de
la base y quita su fila. Si la hoja no responde al borrar, el registro se elimina
igual —la base manda— y el panel avisa que la fila quedó huérfana hasta la
siguiente recarga.

Las mismas operaciones desde la consola, para poblar la hoja por primera vez o
recuperar envíos fallidos:

```bash
php scripts/sync-sheet.php                    # todos los registros
php scripts/sync-sheet.php --desde=2026-09-01 # desde esa fecha (CDMX)
php scripts/sync-sheet.php --solo-completos   # omite quienes no terminaron
php scripts/sync-sheet.php --reemplazar       # deja la hoja con exactamente estos
```

El Apps Script identifica cada fila por el ID del registro, así que reenviar
actualiza en lugar de duplicar y el script puede correr en `cron` como red de
seguridad. Las columnas de texto se escriben con formato de texto para que una
respuesta que empiece con `=` no se evalúe como fórmula, igual que en el Excel.

## PDF del kit

`lib/kit-pdf.ts` reproduce la composición de la referencia en una página de
8 × 10 pulgadas: fondo claro, logotipo, descuento, fecha, beneficiario, empresa,
servicio, franja azul con folio y condiciones de vigencia. El panel y el flujo
público comparten este generador. La fecha procede de la emisión guardada en la
base, en horario de Ciudad de México; descargar de nuevo no renueva la vigencia.
Los nombres largos ajustan su tamaño y pueden ocupar varias líneas.

El footer incluye el WhatsApp **55 2104 5612** y el correo **cursos@imcyc.com**, con
enlaces de contacto. Las condiciones de la referencia especifican 30 días
naturales desde la emisión, beneficio no transferible, no acumulable con otros
descuentos, becas o promociones y descuento sobre el precio lista antes de IVA.

La pantalla del kit repite esos mismos contactos bajo el botón de descarga, para
que quien no abra el PDF de inmediato sepa cómo hacerlo válido.

Poppins se sirve localmente bajo la licencia OFL de `public/fonts/OFL.txt`.

```bash
node scripts/pdf-sample.mjs
pdftoppm -png -singlefile output/pdf/kit-continuidad-imcyc.pdf /tmp/kit-preview
```

El comando crea la muestra `output/pdf/kit-continuidad-imcyc.pdf` y una prueba con
campos largos en `tmp/pdfs/`. Estos artefactos quedan fuera de Git.

## QR de la encuesta

El QR se guarda en `public/qr-encuesta-satisfaccion.png` y
`public/qr-encuesta-satisfaccion.svg`. Ambos abren
`https://grabador.imcyc.com/exp-imcyc/`, donde el participante ingresa sus datos y
continúa a la encuesta. La imagen incluye margen blanco; conserva ese margen al
colocarla en materiales impresos. El SVG permite escalarla sin perder definición.

Para regenerarlo con [python-qrcode](https://github.com/lincolnloop/python-qrcode):

```bash
/tmp/imcyc-test-env/bin/pip install 'qrcode[pil]==8.2'
/tmp/imcyc-test-env/bin/python scripts/generate-qr.py
```

Referencias técnicas: [exportación estática de Next.js](https://nextjs.org/docs/app/guides/static-exports),
[parámetros de sesión PHP](https://www.php.net/manual/en/function.session-set-cookie-params.php)
y [consultas preparadas PDO](https://www.php.net/pdo.prepared-statements).
