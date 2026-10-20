<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/registrations.php';
require_once __DIR__ . '/administrators.php';
require_once __DIR__ . '/registration-export.php';

const CMS_BRIDGE_MAX_BODY = 32768;
const CMS_BRIDGE_CLOCK_WINDOW = 60;
const CMS_BRIDGE_ACTIONS = [
    'registrations.list', 'registrations.detail', 'registrations.export', 'registrations.delete',
    'sheet.status', 'sheet.reload', 'users.list', 'users.create', 'users.password', 'kit.get', 'kit.save',
];

function cmsBridgeSettings(): array
{
    $path = getenv('EXP_IMCYC_CMS_CONFIG') ?: '/etc/exp-imcyc/cms-bridge.php';
    if (!is_file($path) || !is_readable($path) || (fileperms($path) & 0007) !== 0) {
        throw new HttpError(503, 'La integración del administrador no está configurada.');
    }
    $settings = require $path;
    if (!is_array($settings) || !is_string($settings['secret'] ?? null) || strlen($settings['secret']) < 32) {
        throw new HttpError(503, 'La integración del administrador no está configurada.');
    }
    $directory = $settings['nonce_path'] ?? '/var/lib/exp-imcyc/cms-bridge-nonces';
    if (!is_string($directory) || !str_starts_with($directory, '/') || str_contains($directory, "\0")) {
        throw new HttpError(503, 'La integración del administrador no está configurada.');
    }
    return ['secret' => $settings['secret'], 'nonce_path' => $directory];
}

function cmsBridgeClaimNonce(string $nonce, string $directory, int $now): void
{
    if (is_link($directory) || (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory))) {
        throw new HttpError(503, 'No se pudo verificar la solicitud del administrador.');
    }
    clearstatcache(true, $directory);
    $resolvedDirectory = realpath($directory);
    $documentRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '');
    if ($resolvedDirectory === false || (fileperms($directory) & 0077) !== 0
        || ($documentRoot !== false && ($resolvedDirectory === $documentRoot || str_starts_with($resolvedDirectory, $documentRoot . '/')))) {
        throw new HttpError(503, 'No se pudo verificar la solicitud del administrador.');
    }
    $path = $directory . '/' . hash('sha256', $nonce);
    $previousMask = umask(0077);
    try { $handle = @fopen($path, 'x'); } finally { umask($previousMask); }
    if ($handle === false) {
        if (file_exists($path)) throw new HttpError(409, 'Esta solicitud ya fue utilizada.');
        throw new HttpError(503, 'No se pudo verificar la solicitud del administrador.');
    }
    try {
        $expiry = (string) ($now + CMS_BRIDGE_CLOCK_WINDOW * 2);
        if (fwrite($handle, $expiry) !== strlen($expiry)) throw new HttpError(503, 'No se pudo verificar la solicitud del administrador.');
    } finally { fclose($handle); }
    // Keep nonce files beyond the complete acceptance window. Cleanup is bounded
    // and touches only our private hash-named files, never participant sessions.
    $inspected = 0;
    foreach (new DirectoryIterator($directory) as $entry) {
        if (++$inspected > 200) break;
        if ($entry->isFile() && !$entry->isLink() && preg_match('/\A[a-f0-9]{64}\z/', $entry->getFilename())
            && $entry->getMTime() < $now - CMS_BRIDGE_CLOCK_WINDOW * 3) @unlink($entry->getPathname());
    }
}

function authenticateCmsBridge(array $server, string $rawBody, array $settings, ?int $now = null): void
{
    if (($server['REQUEST_METHOD'] ?? '') !== 'POST') throw new HttpError(405, 'Método no permitido.');
    if (strlen($rawBody) > CMS_BRIDGE_MAX_BODY) throw new HttpError(413, 'La solicitud es demasiado grande.');
    $timestamp = $server['HTTP_X_IMCYC_CMS_TIMESTAMP'] ?? '';
    $nonce = $server['HTTP_X_IMCYC_CMS_NONCE'] ?? '';
    $signature = $server['HTTP_X_IMCYC_CMS_SIGNATURE'] ?? '';
    $now ??= time();
    if (!is_string($timestamp) || !preg_match('/\A[0-9]{10}\z/', $timestamp)
        || !is_string($nonce) || !preg_match('/\A[a-f0-9]{64}\z/', $nonce)
        || !is_string($signature) || !preg_match('/\A[a-f0-9]{64}\z/', $signature)
        || abs($now - (int) $timestamp) > CMS_BRIDGE_CLOCK_WINDOW) {
        throw new HttpError(401, 'La solicitud del administrador no es válida.');
    }
    $expected = hash_hmac('sha256', $timestamp . "\n" . $nonce . "\n" . $rawBody, $settings['secret']);
    if (!hash_equals($expected, $signature)) throw new HttpError(401, 'La solicitud del administrador no es válida.');
    cmsBridgeClaimNonce($nonce, $settings['nonce_path'], $now);
}

function cmsBridgeEnvelope(string $rawBody): array
{
    try { $envelope = json_decode($rawBody, false, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new HttpError(400, 'La información enviada no es válida.'); }
    if (!$envelope instanceof stdClass || !is_string($envelope->action ?? null)
        || !in_array($envelope->action, CMS_BRIDGE_ACTIONS, true)) {
        throw new HttpError(404, 'Ruta no encontrada.');
    }
    $parameters = $envelope->params ?? new stdClass();
    if (!$parameters instanceof stdClass) throw new HttpError(422, 'Revisa los parámetros de la solicitud.');
    return [$envelope->action, get_object_vars($parameters)];
}

function cmsBridgeRegistrationId(array $parameters): int
{
    $id = $parameters['id'] ?? null;
    if (!is_int($id) || $id < 1) throw new HttpError(422, 'Registro no válido.');
    return $id;
}

function cmsBridgeRegistrationDetail(array $parameters): array
{
    $id = cmsBridgeRegistrationId($parameters);
    $statement = database()->prepare('SELECT ' . SHEET_COLUMNS . ', discount_text, kit_snapshot FROM registrations WHERE id = ?');
    $statement->execute([$id]);
    $registration = $statement->fetch();
    if (!$registration) throw new HttpError(404, 'Ese registro ya no existe.');
    return ['registration' => serializeRegistration($registration)];
}

function cmsBridgeUsersMutation(string $action, array $parameters, array $settings): array
{
    // A separate signing secret also separates these rate buckets from the
    // original panel's password-confirmation and participant login limits.
    consumeRateLimit('cms-bridge-users', $_SERVER['REMOTE_ADDR'] ?? 'unknown', 20, 900, $settings['secret']);
    $password = validateNewPassword(['newPassword' => $parameters['password'] ?? null, 'confirmPassword' => $parameters['password'] ?? null]);
    if ($action === 'users.create') return insertAdministrator(validateAdministratorUsername($parameters), $password);
    $updated = replaceAdministratorPassword(cmsBridgeRegistrationId($parameters), $password);
    return ['changed' => true, 'username' => $updated['username']];
}

function dispatchCmsBridge(string $action, array $parameters, array $settings): array
{
    if ($action === 'kit.get') return kitConfiguration();
    if ($action === 'kit.save') return saveKitConfiguration($parameters);
    if ($action === 'registrations.list') {
        if (is_int($parameters['page'] ?? null)) $parameters['page'] = (string) $parameters['page'];
        return queryRegistrations($parameters);
    }
    if ($action === 'registrations.detail') return cmsBridgeRegistrationDetail($parameters);
    if ($action === 'registrations.export') exportRegistrationData($parameters);
    if ($action === 'registrations.delete') {
        cmsBridgeRegistrationId($parameters);
        return deleteRegistrationRecord($parameters);
    }
    if ($action === 'sheet.status') return ['configured' => sheetSyncSettings() !== null];
    if ($action === 'sheet.reload') return reloadRegistrationsSheetData();
    if ($action === 'users.list') return ['users' => administratorList()];
    if (in_array($action, ['users.create', 'users.password'], true)) return cmsBridgeUsersMutation($action, $parameters, $settings);
    throw new HttpError(404, 'Ruta no encontrada.');
}

function runCmsBridge(): never
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    try {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            header('Allow: POST');
            throw new HttpError(405, 'Método no permitido.');
        }
        if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) throw new HttpError(415, 'Envía la información en formato JSON.');
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > CMS_BRIDGE_MAX_BODY) throw new HttpError(413, 'La solicitud es demasiado grande.');
        $rawBody = file_get_contents('php://input', false, null, 0, CMS_BRIDGE_MAX_BODY + 1);
        if ($rawBody === false || strlen($rawBody) > CMS_BRIDGE_MAX_BODY) throw new HttpError(413, 'La solicitud es demasiado grande.');
        $settings = cmsBridgeSettings();
        authenticateCmsBridge($_SERVER, $rawBody, $settings);
        [$action, $parameters] = cmsBridgeEnvelope($rawBody);
        respond(dispatchCmsBridge($action, $parameters, $settings));
    } catch (HttpError $error) {
        respond(['error' => $error->getMessage()], $error->status);
    } catch (Throwable $error) {
        // Never log body contents, database parameters, credentials, or upstream
        // sheet responses that could contain participant data.
        error_log('EXP IMCYC CMS bridge: ' . get_class($error));
        respond(['error' => 'No pudimos completar la operación. Intenta nuevamente.'], 500);
    }
}
