<?php
declare(strict_types=1);

require_once __DIR__ . '/registration-row.php';

// Copia de los registros en una hoja de cálculo de Google, a través de un Apps
// Script publicado como aplicación web (`deploy/apps-script-sheet.gs`).
//
// La hoja es un espejo, nunca la fuente: la base de datos ya guardó el registro
// antes de intentar el envío, así que un fallo de red o una cuota de Google no
// pueden impedirle al participante obtener su kit. El script identifica cada
// fila por el ID del registro, de modo que reenviar actualiza en lugar de
// duplicar y `scripts/sync-sheet.php` puede recuperar lo que se haya perdido.

const SHEET_COLUMNS = 'id, full_name, email, company, service, application, clarity, service_rating, unique_code, created_at, completed_at, opinion_consent, opinion_consent_at, opinion_consent_text';
const SHEET_CONNECT_TIMEOUT = 4;
// El envío de una encuesta ocurre dentro de la petición del participante, así que
// se corta pronto. Las operaciones del panel pueden esperar bastante más.
const SHEET_TOTAL_TIMEOUT = 8;
const SHEET_ADMIN_TIMEOUT = 60;

function sheetSyncSettings(): ?array
{
    $settings = config();
    $url = $settings['sheet_webhook_url'] ?? '';
    $token = $settings['sheet_webhook_token'] ?? '';
    if (!is_string($url) || $url === '' || !is_string($token) || $token === '') return null;
    return [$url, $token];
}

function sheetRegistrationPayload(array $registration): array
{
    return [
        'id' => (int) $registration['id'],
        'nombre' => (string) $registration['full_name'],
        'correo' => (string) $registration['email'],
        'empresa' => (string) $registration['company'],
        'estado' => registrationStatusLabel($registration),
        'servicio' => $registration['service'],
        'aplicacion' => $registration['application'],
        'claridad' => $registration['clarity'],
        'calificacion' => $registration['service_rating'] === null ? null : (int) $registration['service_rating'],
        'folio' => $registration['unique_code'],
        'alta' => registrationUtcTimestamp($registration['created_at']),
        'emision' => registrationUtcTimestamp($registration['completed_at']),
        'testimonio' => registrationConsentLabel($registration['opinion_consent'] === null ? null : (int) $registration['opinion_consent']),
        'testimonioFecha' => registrationUtcTimestamp($registration['opinion_consent_at']),
        'testimonioTexto' => $registration['opinion_consent_text'],
    ];
}

/**
 * Envía un lote de registros. Con $replace la hoja queda con exactamente estas
 * filas, útil para recargarla completa. Devuelve cuántas filas confirmó la hoja
 * y lanza RuntimeException si el envío no se pudo completar.
 */
function sendRegistrationsToSheet(array $registrations, bool $replace = false, int $timeout = SHEET_TOTAL_TIMEOUT): int
{
    $payload = ['registros' => array_map('sheetRegistrationPayload', $registrations)];
    if ($replace) $payload['reemplazar'] = true;
    return postToSheet($payload, count($registrations), $timeout);
}

/**
 * Quita de la hoja las filas de esos registros. Devuelve cuántas encontró.
 */
function deleteRegistrationsFromSheet(array $ids): int
{
    return postToSheet(['borrar' => array_values(array_map('intval', $ids))], 0, SHEET_ADMIN_TIMEOUT);
}

function postToSheet(array $payload, int $expected, int $timeout = SHEET_TOTAL_TIMEOUT): int
{
    $settings = sheetSyncSettings();
    if ($settings === null) throw new RuntimeException('Sheet webhook is not configured.');
    [$url, $token] = $settings;
    $body = json_encode(['token' => $token] + $payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

    $request = curl_init($url);
    curl_setopt_array($request, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        // Apps Script responde con un redirección a googleusercontent.com.
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_CONNECTTIMEOUT => SHEET_CONNECT_TIMEOUT,
        CURLOPT_TIMEOUT => $timeout,
    ]);
    $response = curl_exec($request);
    $status = curl_getinfo($request, CURLINFO_RESPONSE_CODE);
    $error = curl_error($request);
    curl_close($request);

    if ($response === false) throw new RuntimeException('Sheet request failed: ' . $error);
    if ($status !== 200) throw new RuntimeException('Sheet responded with status ' . $status);
    $result = json_decode((string) $response, true);
    if (!is_array($result) || ($result['ok'] ?? false) !== true) {
        throw new RuntimeException('Sheet rejected the payload: ' . substr((string) $response, 0, 200));
    }
    return (int) ($result['filas'] ?? $expected);
}

/**
 * Copia un registro recién completado. Nunca interrumpe la respuesta al
 * participante: un fallo queda en el log y se recupera con scripts/sync-sheet.php.
 */
function pushRegistrationToSheet(int $registrationId): void
{
    if (sheetSyncSettings() === null) return;
    try {
        $statement = database()->prepare('SELECT ' . SHEET_COLUMNS . ' FROM registrations WHERE id = ?');
        $statement->execute([$registrationId]);
        $registration = $statement->fetch();
        if ($registration) sendRegistrationsToSheet([$registration]);
    } catch (Throwable $error) {
        error_log('EXP IMCYC hoja: registro ' . $registrationId . ': ' . $error->getMessage());
    }
}

/**
 * Deja la hoja con exactamente los registros que hay en la base. Devuelve
 * cuántas filas se escribieron.
 */
function reloadSheet(): int
{
    $registrations = database()->query('SELECT ' . SHEET_COLUMNS . ' FROM registrations ORDER BY id')->fetchAll();
    return sendRegistrationsToSheet($registrations, true, SHEET_ADMIN_TIMEOUT);
}

/**
 * Quita de la hoja un registro que ya no está en la base. Devuelve false si la
 * hoja no se pudo actualizar: el registro ya se borró y la fila queda huérfana
 * hasta la siguiente recarga.
 */
function removeRegistrationFromSheet(int $registrationId): bool
{
    if (sheetSyncSettings() === null) return true;
    try {
        deleteRegistrationsFromSheet([$registrationId]);
        return true;
    } catch (Throwable $error) {
        error_log('EXP IMCYC hoja: no se pudo borrar el registro ' . $registrationId . ': ' . $error->getMessage());
        return false;
    }
}
